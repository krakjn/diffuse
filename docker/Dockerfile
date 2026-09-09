# Node toolchain for building/packaging Diffuse (Docker-only).
#
#   just img    — build this image
#   just build  — run container, write dist/*.vsix
#
# Context is docker/ so the daemon never sees the repo tree. Source is mounted
# at runtime: docker run -v "$(pwd):/work" …

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://raw.githubusercontent.com/krakjn/bump/main/install/get_bump.sh | sh

WORKDIR /work

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
