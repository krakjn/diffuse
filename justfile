set windows-shell := ["powershell.exe", "-NoLogo", "-Command"]

_:
    @just --list

# build Docker image (context is docker/ only — repo is mounted at run time)
img:
    docker build -t diffuse-builder docker/

# package VSIX to dist/
[unix]
build: img
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p dist
    docker run --rm \
      -v "$(pwd):/work" \
      -v diffuse-node-modules:/work/node_modules \
      -w /work \
      diffuse-builder

[windows]
build: img
    New-Item -ItemType Directory -Force -Path dist | Out-Null
    docker run --rm -v "${PWD}:/work" -v diffuse-node-modules:/work/node_modules -w /work diffuse-builder

# install VSIX into Cursor
[unix]
install:
    #!/usr/bin/env bash
    set -euo pipefail
    vsix=$(ls -1 dist/diffuse-*.vsix 2>/dev/null | sort -V | tail -n1)
    if [[ -z "${vsix}" || ! -f "${vsix}" ]]; then
      echo "No VSIX found. Run: just build" >&2
      exit 1
    fi
    cursor --install-extension "${vsix}"

[windows]
install:
    $vsix = Get-ChildItem -Path dist -Filter diffuse-*.vsix | Select-Object -First 1; if (-not $vsix) { throw "No VSIX found. Run: just build" }; cursor --install-extension $vsix.FullName

# publish VSIX to Open VSX (requires OVSX_PAT)
[unix]
publish:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -z "${OVSX_PAT:-}" ]]; then
      echo "Set OVSX_PAT to an Open VSX access token: https://open-vsx.org/user-settings/tokens" >&2
      exit 1
    fi
    vsix=$(ls -1 dist/diffuse-*.vsix 2>/dev/null | sort -V | tail -n1)
    if [[ -z "${vsix}" || ! -f "${vsix}" ]]; then
      echo "No VSIX found. Run: just build" >&2
      exit 1
    fi
    npx --yes ovsx publish "${vsix}" -p "$OVSX_PAT"

[windows]
publish:
    if (-not $env:OVSX_PAT) { throw "Set OVSX_PAT to an Open VSX access token: https://open-vsx.org/user-settings/tokens" }; $vsix = Get-ChildItem -Path dist -Filter diffuse-*.vsix | Select-Object -First 1; if (-not $vsix) { throw "No VSIX found. Run: just build" }; npx --yes ovsx publish $vsix.FullName -p $env:OVSX_PAT
