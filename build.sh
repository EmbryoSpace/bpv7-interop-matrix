#!/bin/bash
# Build the implementation images used by run.sh and matrix.sh.
set -euo pipefail
cd "$(dirname "$0")"
for impl in ion hdtn ud3tn hardy bplib dtn7; do
  echo "== $impl"
  docker build -q -t "interop/$impl" "impls/$impl"
done
echo "== bplib-fixed (bplib with the fixes proposed in nasa/bplib#272)"
docker build -q --build-arg BPLIB_REPO=https://github.com/EmbryoSpace/bplib.git --build-arg BPLIB_REF=fd18370 \
  -t interop/bplib-fixed impls/bplib
