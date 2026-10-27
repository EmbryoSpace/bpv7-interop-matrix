# Hardy (Aalyria): the BPA server plus the standalone TCPCLv4 CLA (which can dial peers),
# from the published images of commit 260fe751a0d8, pinned by digest.
FROM ghcr.io/ricktaylor/hardy/hardy-bpa-server@sha256:18f1070d633cf38467fdd500d0fe2bb1c258a9e5aa5a2bd16090d64b4143eac8 AS bpa
FROM ghcr.io/ricktaylor/hardy/hardy-tcpclv4-server@sha256:69a638ef16100b0e9815ad40b9deba295bff43001e597058043168c8958ba451 AS tcpcl
FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates procps && rm -rf /var/lib/apt/lists/*
COPY --from=bpa /usr/local/bin/hardy-bpa-server /usr/local/bin/
COPY --from=tcpcl /usr/local/bin/hardy-tcpclv4-server /usr/local/bin/
RUN echo 260fe751a0d8 > /opt/VERSION
COPY --chmod=755 relay.sh /relay.sh
CMD ["/relay.sh"]
