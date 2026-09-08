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

# publish VSIX to Open VSX (requires OVSX_PAT)
publish:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -z "${OVSX_PAT:-}" ]]; then
      echo "Set OVSX_PAT to an Open VSX access token: https://open-vsx.org/user-settings/tokens" >&2
      exit 1
    fi
    vsix=(dist/diffuse-*.vsix)
    if [[ ! -f "${vsix[0]}" ]]; then
      echo "No VSIX found. Run: just build" >&2
      exit 1
    fi
    npx --yes ovsx publish "${vsix[0]}" -p "$OVSX_PAT"

# print Open VSX namespace claim instructions
claim-namespace:
    @echo "File this as GitHub user krakjn (not as a bot):"
    @echo "https://github.com/EclipseFdn/open-vsx.org/issues/new?template=claim-namespace-ownership.yml&title=Claiming%20namespace%20krakjn"
    @echo
    @echo "Use Option 3 (not a VS Code Marketplace publisher)."
    @echo "Filled-in body: docs/DEVELOPMENT.md#claim-namespace-ownership-verified-listing"
