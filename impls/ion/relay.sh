#!/bin/bash
# ION as a relay: receive bundles on IN_CL, forward everything for DEST_NODE to the next
# hop on OUT_CL.
#
#   NODE                  this node's ipn node number (also its LTP engine number)
#   IN_CL, IN_PORT        udp | stcp | tcpclv3 | ltp | ltp-1, and the port to listen on
#                         (ltp-1: LTP with one bundle per block, no aggregation)
#   IN_PEER_NODE/HOST     upstream node (LTP only: where report segments go)
#   OUT_CL, OUT_HOST, OUT_PORT, OUT_NODE   next hop
#   DEST_NODE             destination node of the test bundles (default 2)
#
# LTP always uses UDP port 1113.
set -euo pipefail

: "${NODE:?}" "${IN_CL:?}" "${OUT_CL:?}" "${OUT_HOST:?}" "${OUT_NODE:?}"
DEST_NODE=${DEST_NODE:-2}
IN_PORT=${IN_PORT:-4556}
OUT_PORT=${OUT_PORT:-4556}
LTP_PORT=1113
D=/tmp/ion
mkdir -p "$D"
cd "$D"

proto() { # ION's name for a convergence layer
  case "$1" in
    udp) echo udp ;; stcp) echo stcp ;; tcpclv3) echo tcp ;; ltp) echo ltp ;;
    *) echo "ion: unsupported convergence layer $1" >&2; exit 2 ;;
  esac
}
# "ltp-1" is LTP with one bundle per LTP block (no aggregation)
AGGR=100000
if [ "$IN_CL" = ltp-1 ] || [ "$OUT_CL" = ltp-1 ]; then AGGR=1; fi
IN=$(proto "${IN_CL%-1}")
OUT=$(proto "${OUT_CL%-1}")

# Contacts along the actual path only (upstream -> this node -> next hop -> destination),
# so contact graph routing reaches DEST_NODE through the next hop's plan
edges="$NODE:$NODE $NODE:$OUT_NODE"
[ -n "${IN_PEER_NODE:-}" ] && edges+=" ${IN_PEER_NODE}:$NODE"
[ "$DEST_NODE" != "$OUT_NODE" ] && edges+=" $OUT_NODE:$DEST_NODE"
contacts=""
for e in $edges; do
  a=${e%%:*} b=${e#*:}
  pairs=("$a $b")
  [ "$a" != "$b" ] && pairs+=("$b $a")
  for pair in "${pairs[@]}"; do
    contacts+="a contact +0 +86400 $pair 100000000"$'\n'"a range +0 +86400 $pair 1"$'\n'
  done
done

ltp=""
if [ "$IN" = ltp ] || [ "$OUT" = ltp ]; then
  ltp="## begin ltpadmin"$'\n'"1 64"$'\n'
  [ "$OUT" = ltp ] && ltp+="a span $OUT_NODE 64 64 1400 $AGGR 1 'udplso $OUT_HOST:$LTP_PORT'"$'\n'
  [ "$IN" = ltp ] && ltp+="a span ${IN_PEER_NODE:?} 64 64 1400 $AGGR 1 'udplso ${IN_PEER_HOST:?}:$LTP_PORT'"$'\n'
  ltp+="s 'udplsi 0.0.0.0:$LTP_PORT'"$'\n'"## end ltpadmin"
fi

induct() {
  case "$IN" in
    ltp) echo "a induct ltp $NODE ltpcli" ;;
    *) echo "a induct $IN 0.0.0.0:$IN_PORT ${IN}cli" ;;
  esac
  # ION's TCPCL outducts are driven by the tcpcli induct process ("tcpclo is deprecated"),
  # so a node that only sends over TCPCL still needs a TCP induct
  if [ "$OUT" = tcp ] && [ "$IN" != tcp ]; then
    echo "a induct tcp 0.0.0.0:4600 tcpcli"
  fi
}
outduct() {
  case "$OUT" in
    ltp) echo "a outduct ltp $OUT_NODE ltpclo" ;;
    *) echo "a outduct $OUT $OUT_HOST:$OUT_PORT ${OUT}clo" ;;
  esac
}
plan_duct() {
  case "$OUT" in
    ltp) echo "ltp/$OUT_NODE" ;;
    *) echo "$OUT/$OUT_HOST:$OUT_PORT" ;;
  esac
}

protocols="a protocol $IN"
[ "$OUT" != "$IN" ] && protocols+=$'\n'"a protocol $OUT"
[ "$IN" = ltp ] || [ "$OUT" = ltp ] && protocols=${protocols//a protocol ltp/a protocol ltp 1400 100}

printf 'configFlags 1\nwmSize 5000000\nheapWords 2500000\npathName %s\n' "$D" > node.ionconfig
cat > node.rc << EOF
## begin ionadmin
1 $NODE $D/node.ionconfig
s
$contacts
m horizon +0
## end ionadmin
$ltp
## begin bpadmin
1
a scheme ipn 'ipnfw' 'ipnadminep'
a endpoint ipn:$NODE.1 q
$protocols
$(induct)
$(outduct)
s
## end bpadmin
## begin ipnadmin
a plan $OUT_NODE $(plan_duct)
## end ipnadmin
EOF

echo "ion $(cat /opt/VERSION): ipn:$NODE in $IN_CL:$IN_PORT -> out $OUT_CL $OUT_HOST:$OUT_PORT (ipn:$OUT_NODE)"
trap 'ionstop > /dev/null 2>&1; exit 0' TERM INT
ionstart -I node.rc > start.log 2>&1 || { cat start.log; exit 1; }
echo "ion: started"
tail -n +1 -F ion.log &
wait
