# Node toolchain for building/packaging Diffuse (Docker-only).
#
#   just img    — build this image
#   just build  — run container, write dist/*.vsix
#
# Context is docker/ so the daemon never sees the repo tree. Source is mounted
# at runtime: docker run -v "$(pwd):/work" …

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /work

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
