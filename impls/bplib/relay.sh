#!/bin/bash
# bplib's bpcat as a relay. Same environment as impls/ion/relay.sh:
#   IN_CL, IN_PORT, OUT_CL, OUT_HOST, OUT_PORT, DEST_NODE   (UDP only)
# bpcat's node number and contact are compiled in (app/src/bpcat_nc.c), so the contact
# is patched to forward everything for DEST_NODE to the next hop, and bpcat rebuilt.
set -euo pipefail
DEST_NODE=${DEST_NODE:-2}
IN_PORT=${IN_PORT:-4556}
OUT_PORT=${OUT_PORT:-4556}
[ "$IN_CL" = udp ] && [ "$OUT_CL" = udp ] || { echo "bplib: bpcat supports udp only" >&2; exit 2; }
OUT_IP=$(getent hosts "$OUT_HOST" | awk '{print $1; exit}')
F=/src/bplib/app/src/bpcat_nc.c
sed -i -E \
  -e "s/(\.MaxNode +=) 200,/\1 ${DEST_NODE},/" -e "s/(\.MinNode +=) 200,/\1 ${DEST_NODE},/" \
  -e "s/(\.MaxService +=) 64,/\1 255,/" -e "s/(\.MinService +=) 64\}/\1 0}/" \
  -e "s/(\.ClaOutAddr +=) \"127\.0\.0\.1\"/\1 \"${OUT_IP}\"/" \
  -e "s/(\.ClaInPort +=) 4501,/\1 ${IN_PORT},/" -e "s/(\.ClaOutPort +=) 4551,/\1 ${OUT_PORT},/" "$F"
grep -q "MaxNode      = ${DEST_NODE}," "$F" && grep -q "\"${OUT_IP}\"" "$F" && grep -q "ClaInPort              = ${IN_PORT}," "$F" \
  || { echo "bplib: could not patch the bpcat contact table" >&2; exit 1; }
make -C /build/bplib -j4 all > /dev/null
BPCAT=$(find /build/bplib -name bpcat -type f | head -1)
echo "bplib bpcat $(cat /opt/VERSION): udp:$IN_PORT -> udp $OUT_HOST:$OUT_PORT for ipn:$DEST_NODE.*"
mkdir -p /tmp/bpcat && cd /tmp/bpcat
exec "$BPCAT"
