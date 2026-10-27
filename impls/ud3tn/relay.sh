#!/bin/bash
# uD3TN as a relay. Same environment as impls/ion/relay.sh:
#   NODE, IN_CL, IN_PORT, OUT_CL, OUT_HOST, OUT_PORT, OUT_NODE, DEST_NODE
# Convergence layers: mtcp, tcpclv3.
set -euo pipefail
: "${NODE:?}" "${IN_CL:?}" "${OUT_CL:?}" "${OUT_HOST:?}" "${OUT_NODE:?}"
DEST_NODE=${DEST_NODE:-2}
IN_PORT=${IN_PORT:-4556}
OUT_PORT=${OUT_PORT:-4556}
for cl in "$IN_CL" "$OUT_CL"; do
  case "$cl" in mtcp|tcpclv3) ;; *) echo "ud3tn: unsupported convergence layer $cl" >&2; exit 2 ;; esac
done
AAP=4242
OUT_IP=$(getent hosts "$OUT_HOST" | awk '{print $1; exit}')

# Every convergence layer used must be enabled; give the outgoing one a spare port
clas="$IN_CL:*,$IN_PORT"
[ "$OUT_CL" != "$IN_CL" ] && clas+=";$OUT_CL:*,4600"

echo "ud3tn $(cat /opt/VERSION): ipn:$NODE in $IN_CL:$IN_PORT -> out $OUT_CL $OUT_HOST:$OUT_PORT (ipn:$OUT_NODE)"
/opt/ud3tn/build/posix/ud3tn -L 2 -e "ipn:$NODE.0" -a 127.0.0.1 -p "$AAP" \
  -c "sqlite:file:db?mode=memory&cache=shared;$clas" &
UD=$!
sleep 1

# Contact to the next hop, open now for a day, reaching the destination node
reaches=()
[ "$DEST_NODE" != "$OUT_NODE" ] && reaches=(--reaches "ipn:$DEST_NODE.0")
/opt/venv/bin/python /opt/ud3tn/tools/aap/aap_config.py --tcp 127.0.0.1 "$AAP" \
  --schedule 1 86400 100000 "${reaches[@]}" "ipn:$OUT_NODE.0" "$OUT_CL:$OUT_IP:$OUT_PORT"
echo "ud3tn: contact to ipn:$OUT_NODE.0 via $OUT_CL:$OUT_IP:$OUT_PORT"
wait "$UD"
