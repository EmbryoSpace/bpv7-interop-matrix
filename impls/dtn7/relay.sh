#!/bin/bash
# dtn7-rs as a relay. Same environment as impls/ion/relay.sh:
#   NODE, IN_CL, IN_PORT, OUT_CL, OUT_HOST, OUT_PORT, OUT_NODE, DEST_NODE
# Convergence layers: udp, mtcp, tcpclv4 (dtn7's "tcp").
set -euo pipefail
: "${NODE:?}" "${IN_CL:?}" "${OUT_CL:?}" "${OUT_HOST:?}" "${OUT_NODE:?}"
DEST_NODE=${DEST_NODE:-2}
IN_PORT=${IN_PORT:-4556}
OUT_PORT=${OUT_PORT:-4556}

cla() {
  case "$1" in
    udp) echo udp ;; mtcp) echo mtcp ;; tcpclv4) echo tcp ;;
    *) echo "dtn7: unsupported convergence layer $1" >&2; exit 2 ;;
  esac
}
IN=$(cla "$IN_CL")
OUT=$(cla "$OUT_CL")
OUT_IP=$(getent hosts "$OUT_HOST" | awk '{print $1; exit}')

D=/tmp/dtn7
mkdir -p "$D"
echo "1 * ipn:$DEST_NODE.* ipn:$OUT_NODE.0" > "$D/routes"

clas=(-C "$IN:port=$IN_PORT")
# The outgoing convergence layer must be enabled too; give it a spare listening port
[ "$OUT" != "$IN" ] && clas+=(-C "$OUT:port=4600")

echo "dtn7 $(cat /opt/VERSION): ipn:$NODE in $IN_CL:$IN_PORT -> out $OUT_CL $OUT_HOST:$OUT_PORT (ipn:$OUT_NODE)"
exec dtnd -n "$NODE" -W "$D" -D mem --disable_nd -i 0 -w 3000 "${clas[@]}" \
  -r static -R "static.routes=$D/routes" \
  -s "$OUT://$OUT_IP:$OUT_PORT/$OUT_NODE"
