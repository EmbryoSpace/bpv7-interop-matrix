# dtn7-rs, built from source at a pinned commit.
FROM rust:1-bookworm AS build
ARG DTN7_COMMIT=dc26e2adcb50
RUN git clone -q https://github.com/dtn7/dtn7-rs.git /src && cd /src && git checkout -q "${DTN7_COMMIT}" \
    && git rev-parse --short=12 HEAD > /VERSION
# At this commit core/dtn7 is version 0.22.0 but examples/Cargo.toml still asks for
# 0.21.0, so the workspace does not resolve; align it.
RUN cd /src && sed -i '/path = "..\/core\/dtn7"/s/version = "0.21.0"/version = "0.22.0"/' examples/Cargo.toml \
    && grep -q 'path = "../core/dtn7".*version = "0.22.0"' examples/Cargo.toml \
    && cargo build --release --bin dtnd
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates procps && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/dtnd /usr/local/bin/
COPY --from=build /VERSION /opt/VERSION
COPY --chmod=755 relay.sh /relay.sh
CMD ["/relay.sh"]
