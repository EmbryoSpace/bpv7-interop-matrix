#!/bin/bash
# HDTN as a relay. Same environment as impls/ion/relay.sh:
#   NODE, IN_CL, IN_PORT, IN_PEER_NODE, IN_PEER_HOST, OUT_CL, OUT_HOST, OUT_PORT, OUT_NODE, DEST_NODE
# Convergence layers: udp, stcp, tcpclv3, tcpclv4, ltp (LTP on UDP port 1113).
set -euo pipefail
python3 /relay_config.py
echo "hdtn $(cat /opt/VERSION)"
cd /tmp/hdtn
exec /opt/HDTN/build/module/hdtn_one_process/hdtn-one-process \
  --contact-plan-file=/tmp/hdtn/plan.json --hdtn-config-file=/tmp/hdtn/hdtn.json
