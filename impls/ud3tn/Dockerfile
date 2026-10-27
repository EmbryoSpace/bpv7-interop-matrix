# uD3TN, built from source at a pinned release.
FROM debian:bookworm-slim
ARG UD3TN_VERSION=v0.15.2
RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates build-essential pkg-config python3 python3-pip python3-venv libsqlite3-dev libjansson-dev procps \
    && rm -rf /var/lib/apt/lists/*
RUN git clone -q --depth 1 --branch "${UD3TN_VERSION}" --recurse-submodules https://gitlab.com/d3tn/ud3tn.git /opt/ud3tn \
    && cd /opt/ud3tn && echo "${UD3TN_VERSION} $(git rev-parse --short=12 HEAD)" > /opt/VERSION \
    && make posix > /dev/null \
    && python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install -q ./pyd3tn ./python-ud3tn-utils
COPY --chmod=755 relay.sh /relay.sh
CMD ["/relay.sh"]
