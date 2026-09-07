_:
    @just --list

# build Docker image
img:
    docker build -t diffuse-builder .

# package VSIX to dist/
build: img
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p dist
    docker run --rm \
      -v "$(pwd):/work" \
      -v diffuse-node-modules:/work/node_modules \
      -w /work \
      diffuse-builder

# install VSIX into Cursor
install:
    #!/usr/bin/env bash
    set -euo pipefail
    vsix=(dist/diffuse-*.vsix)
    if [[ ! -f "${vsix[0]}" ]]; then
      echo "No VSIX found. Run: just build" >&2
      exit 1
    fi
    cursor --install-extension "${vsix[0]}"
