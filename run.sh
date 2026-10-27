#!/bin/bash
# Run one interop test.
#
#   ./run.sh single <impl> <in_cl> <out_cl>
#       ref source --in_cl--> <impl> ipn:10 --out_cl--> ref sink
#   ./run.sh pair <implX> <implY> <link_cl>
#       ref source --> X ipn:10 --link_cl--> Y ipn:20 --> ref sink
#       (X and Y talk to the reference endpoints on their own default convergence layer)
#
# Writes results/<test>.json. Images are built by ./build.sh.
set -euo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"

SINK_SECS=${SINK_SECS:-60}
mkdir -p results logs

# Convergence layer each implementation uses towards the reference endpoints
ref_cl() {
  case "$1" in
    ion|hdtn|bplib|bplib-fixed|dtn7) echo udp ;;
    ud3tn) echo mtcp ;;
    hardy) echo tcpclv4 ;;
    *) echo "unknown implementation $1" >&2; exit 2 ;;
  esac
}
# Largest bundle that fits every hop (UDP: one datagram)
max_bundle() { for cl in "$@"; do [ "$cl" = udp ] && { echo 1400; return; }; done; echo 60000; }

port_of() { case "$1" in ltp|ltp-1) echo 1113 ;; *) echo 4556 ;; esac; }

cleanup() {
  docker rm -f "${CONTAINERS[@]}" > /dev/null 2>&1 || true
  docker network rm "$NET" > /dev/null 2>&1 || true
}

relay() { # name impl node in_cl in_peer_node in_peer_host out_cl out_host out_node
  local name=$1 impl=$2
  docker run -d --name "$name" --network "$NET" --network-alias "$name" --shm-size 256m \
    -e NODE="$3" -e IN_CL="$4" -e IN_PORT="$(port_of "$4")" -e IN_PEER_NODE="$5" -e IN_PEER_HOST="$6" \
    -e OUT_CL="$7" -e OUT_HOST="$8" -e OUT_PORT="$(port_of "$7")" -e OUT_NODE="$9" -e DEST_NODE=2 \
    "interop/$impl" > /dev/null
  CONTAINERS+=("$name")
}

ref() { # name args...
  local name=$1; shift
  local id=ipn:1.0
  [ "$name" = sink ] && id=ipn:2.0
  docker run --name "$name" --network "$NET" --network-alias "$name" -e REF_NODE_ID="$id" \
    -v "$(pwd -W 2>/dev/null || pwd)/ref:/ref:ro" -v "$(pwd -W 2>/dev/null || pwd)/results:/results" \
    -w /ref node:20-bookworm-slim node endpoint.mjs "$@"
}

mode=$1; shift
if [ "$mode" = single ]; then
  X=$1 IN=$2 OUT=$3
  TEST="single_${X}_${IN}_${OUT}"
  RELAYS=1
elif [ "$mode" = pair ]; then
  X=$1 Y=$2 LINK=$3
  IN=$(ref_cl "$X") OUT=$(ref_cl "$Y")
  TEST="pair_${X}_${Y}_${LINK}"
  RELAYS=2
else
  echo "usage: $0 single <impl> <in_cl> <out_cl> | pair <implX> <implY> <link_cl>" >&2
  exit 2
fi

NET="interop_$TEST"
CONTAINERS=()
trap cleanup EXIT
cleanup
docker network create "$NET" > /dev/null

# Start from the far end, so every node that dials its next hop finds it listening:
# the sink first, then the relays from last to first.
ref sink sink "$OUT" "$(port_of "$OUT")" "$SINK_SECS" "$RELAYS" "/results/$TEST.json" > "logs/$TEST.sink.log" 2>&1 &
SINK=$!
CONTAINERS+=(sink source)
sleep 3
if [ "$mode" = single ]; then
  relay rx "$X" 10 "$IN" 1 source "$OUT" sink 2
  MAX=$(max_bundle "$IN" "$OUT")
else
  relay ry "$Y" 20 "$LINK" 10 rx "$OUT" sink 2
  sleep 3
  relay rx "$X" 10 "$IN" 1 source "$LINK" ry 20
  MAX=$(max_bundle "$IN" "$LINK" "$OUT")
fi
sleep "${START_SECS:-15}"
ref source source "$IN" rx "$(port_of "$IN")" "$MAX" > "logs/$TEST.source.log" 2>&1 || true
wait "$SINK" || true

for c in rx ry; do docker logs "$c" > "logs/$TEST.$c.log" 2>&1 || true; done
echo "== $TEST"
cat "logs/$TEST.sink.log"
