#!/bin/bash
# Hardy as a relay. Same environment as impls/ion/relay.sh:
#   NODE, IN_CL, IN_PORT, OUT_CL, OUT_HOST, OUT_PORT, OUT_NODE, DEST_NODE   (tcpclv4 only)
# The next hop is identified by the node ID it sends in its TCPCLv4 SESS_INIT.
set -euo pipefail
: "${NODE:?}" "${OUT_HOST:?}" "${OUT_NODE:?}"
DEST_NODE=${DEST_NODE:-2}
IN_PORT=${IN_PORT:-4556}
OUT_PORT=${OUT_PORT:-4556}
[ "$IN_CL" = tcpclv4 ] && [ "$OUT_CL" = tcpclv4 ] || { echo "hardy: supports tcpclv4 only" >&2; exit 2; }
D=/tmp/hardy
mkdir -p "$D"

route="ipn:$DEST_NODE.* via ipn:$OUT_NODE.0"
[ "$DEST_NODE" = "$OUT_NODE" ] && route="ipn:$DEST_NODE.* via ipn:$DEST_NODE.0"
echo "$route" > "$D/routes"

cat > "$D/bpa.yaml" << Y
log-level: info
admin-endpoints: ["ipn:$NODE.0"]
grpc:
  address: "[::1]:50051"
  services: [cla]
storage:
  metadata: { type: memory }
  bundle: { type: memory }
static-routes:
  routes-file: $D/routes
Y
cat > "$D/tcpclv4.yaml" << Y
log-level: info
bpa-address: "http://[::1]:50051"
cla-name: tcp
listeners: ["0.0.0.0:$IN_PORT"]
peers: ["$OUT_HOST:$OUT_PORT"]
Y

echo "hardy $(cat /opt/VERSION): ipn:$NODE tcpclv4:$IN_PORT -> $OUT_HOST:$OUT_PORT, route: $route"
hardy-bpa-server --config "$D/bpa.yaml" &
BPA=$!
sleep 2
HARDY_TCPCLV4_CONFIG_FILE="$D/tcpclv4.yaml" hardy-tcpclv4-server &
wait -n "$BPA" $!
