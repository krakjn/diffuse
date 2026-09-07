# Node toolchain for building/packaging Diffuse. No host npm required.
#
# Package (writes dist/*.vsix):
#   docker compose run --rm package
#
# Publish to Open VSX:
#   OVSX_PAT=<token> docker compose run --rm publish
#
# Rebuild image after changing package.json:
#   docker compose build

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /work

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV OUT_DIR=/out

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["package"]
