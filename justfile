# Diffuse — common tasks
#
# List recipes:  just
# Package VSIX:   just package
# Publish:       OVSX_PAT=... just publish

default:
    @just --list

# --- KWin harness (phase -1, KDE Plasma Wayland) ---

kwin-list:
    ./scripts/run-kwin.sh list

kwin-decrease:
    ./scripts/run-kwin.sh decrease

kwin-increase:
    ./scripts/run-kwin.sh increase

# --- Docker (no host npm required) ---

docker-build:
    docker compose build

package: docker-build
    mkdir -p dist
    docker compose run --rm package

publish: docker-build
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -z "${OVSX_PAT:-}" ]]; then
      echo "OVSX_PAT is required. Example: OVSX_PAT=... just publish" >&2
      exit 1
    fi
    mkdir -p dist
    docker compose run --rm publish

docker-compile: docker-build
    docker compose run --rm package compile

docker-shell: docker-build
    docker compose run --rm package shell

# --- Host npm (optional) ---

install:
    npm install

compile: install
    npm run compile

watch: install
    npm run watch

package-local: install compile
    npm run package

# --- Cleanup ---

clean:
    rm -rf out dist node_modules *.vsix
