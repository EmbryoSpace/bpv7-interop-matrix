# NASA bplib's standalone bpcat relay, built the way bplib CI does (OSAL, QCBOR v1.5.1).
# BPLIB_REPO/BPLIB_REF select upstream or a fork branch with fixes.
FROM debian:bookworm-slim
ARG BPLIB_REPO=https://github.com/nasa/bplib.git
ARG BPLIB_REF=c5fb8358dd99
ARG OSAL_COMMIT=422c6b8
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential cmake git ca-certificates libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*
RUN git clone -q https://github.com/nasa/osal.git /src/osal && cd /src/osal && git checkout -q "${OSAL_COMMIT}" \
    && cmake -DCMAKE_INSTALL_PREFIX=/usr/local -DOSAL_SYSTEM_BSPTYPE=generic-linux -DCMAKE_BUILD_TYPE=Release \
       -DOSAL_OMIT_DEPRECATED=TRUE -DOSAL_CONFIG_DEBUG_PERMISSIVE_MODE=ON -S /src/osal -B /build/osal > /dev/null \
    && make -C /build/osal -j4 install > /dev/null && ldconfig
RUN git clone -q --depth 1 --branch v1.5.1 https://github.com/laurencelundblade/QCBOR.git /src/qcbor \
    && make -C /src/qcbor -j4 install > /dev/null && ldconfig
RUN git clone -q "${BPLIB_REPO}" /src/bplib && cd /src/bplib && git checkout -q "${BPLIB_REF}" \
    && echo "$(git rev-parse --short=12 HEAD)" > /opt/VERSION \
    && cmake -DCMAKE_BUILD_TYPE=Debug -DBPLIB_OS_LAYER=OSAL -DCMAKE_PREFIX_PATH=/usr/local/lib/cmake \
       -S /src/bplib -B /build/bplib > /dev/null \
    && make -C /build/bplib -j4 all > /dev/null
COPY --chmod=755 relay.sh /relay.sh
CMD ["/relay.sh"]
