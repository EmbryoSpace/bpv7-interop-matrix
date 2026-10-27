#!/bin/bash
# Run the whole matrix: every implementation as a single relay, then every ordered pair
# of different implementations over every convergence layer they share.
#
#   ./matrix.sh            all tests
#   ./matrix.sh singles    single-relay tests only
#   ./matrix.sh pairs      pair tests only
#
# Then: node report.mjs > results/MATRIX.md
set -uo pipefail
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")"

# Convergence layers each implementation can use as a relay
declare -A CLS=(
  [ion]="udp stcp tcpclv3 ltp ltp-1"
  [hdtn]="udp stcp tcpclv3 tcpclv4 ltp ltp-1"
  [ud3tn]="mtcp tcpclv3"
  [hardy]="tcpclv4"
  [bplib]="udp"
  [dtn7]="udp mtcp tcpclv4"
)
IMPLS=(ion hdtn ud3tn hardy bplib dtn7)
# Single-relay variants (bplib with the fixes proposed upstream)
SINGLES=(ion hdtn ud3tn hardy bplib bplib-fixed dtn7)

ref_cl() { case "$1" in ud3tn) echo mtcp ;; hardy) echo tcpclv4 ;; *) echo udp ;; esac; }

what=${1:-all}
if [ "$what" = all ] || [ "$what" = singles ]; then
  for x in "${SINGLES[@]}"; do
    cl=$(ref_cl "$x")
    ./run.sh single "$x" "$cl" "$cl" > /dev/null 2>&1
    echo "single $x ($cl): $(node -e "const r=require('./results/single_${x}_${cl}_${cl}.json').cases;console.log(Object.values(r).map(c=>c.status[0]).join(''))" 2>/dev/null || echo error)"
  done
fi

if [ "$what" = all ] || [ "$what" = pairs ]; then
  for x in "${IMPLS[@]}"; do
    for y in "${IMPLS[@]}"; do
      [ "$x" = "$y" ] && continue
      for cl in ${CLS[$x]}; do
        [[ " ${CLS[$y]} " == *" $cl "* ]] || continue
        ./run.sh pair "$x" "$y" "$cl" > /dev/null 2>&1
        echo "pair $x -> $y ($cl): $(node -e "const r=require('./results/pair_${x}_${y}_${cl}.json').cases;console.log(Object.values(r).map(c=>c.status[0]).join(''))" 2>/dev/null || echo error)"
      done
    done
  done
fi
