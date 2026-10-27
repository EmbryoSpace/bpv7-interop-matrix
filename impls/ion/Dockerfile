# JPL ION-DTN, built from source at a pinned commit.
FROM debian:bookworm-slim
ARG ION_COMMIT=f3b5265d066a
RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates build-essential autoconf automake libtool pkg-config procps iproute2 \
    && rm -rf /var/lib/apt/lists/*
RUN git clone -q https://github.com/nasa-jpl/ION-DTN.git /opt/ion \
    && cd /opt/ion && git checkout -q "${ION_COMMIT}" && git rev-parse --short=12 HEAD > /opt/VERSION \
    && ( [ -x ./configure ] || autoreconf -fi ) && ./configure --quiet \
    && make -j4 > /dev/null && make install > /dev/null && ldconfig
COPY --chmod=755 relay.sh /relay.sh
CMD ["/relay.sh"]
