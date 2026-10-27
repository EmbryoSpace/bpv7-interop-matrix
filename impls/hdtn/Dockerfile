# NASA HDTN, built from source at a pinned commit.
FROM debian:bookworm-slim
ARG HDTN_COMMIT=7fbe90cdbe3c
RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates cmake build-essential libzmq3-dev libboost-all-dev openssl libssl-dev procps python3 \
    && rm -rf /var/lib/apt/lists/*
RUN git clone -q https://github.com/nasa/HDTN.git /opt/HDTN \
    && cd /opt/HDTN && git checkout -q "${HDTN_COMMIT}" && git rev-parse --short=12 HEAD > /opt/VERSION \
    && mkdir build && cd build \
    && cmake .. -DCMAKE_BUILD_TYPE=Release -DUSE_X86_HARDWARE_ACCELERATION=OFF -DLTP_RNG_USE_RDSEED=OFF > /dev/null \
    && make -j4 hdtn-one-process > /dev/null
ENV HDTN_SOURCE_ROOT=/opt/HDTN
COPY --chmod=755 relay.sh /relay.sh
COPY relay_config.py /relay_config.py
CMD ["/relay.sh"]
