#!/usr/bin/env bash
set -euo pipefail

mkdir -p "${OUT_DIR:-/out}"

case "${1:-package}" in
  package)
    npm run package
    cp -v ./*.vsix "${OUT_DIR}/"
    echo "VSIX written to ${OUT_DIR}/"
    ls -la "${OUT_DIR}/"
    ;;
  publish)
    if [[ -z "${OVSX_PAT:-}" ]]; then
      echo "OVSX_PAT is required for publish" >&2
      exit 1
    fi
    npm run package
    VSIX="$(ls -1 ./*.vsix | head -1)"
    npx --yes ovsx publish "${VSIX}" -p "${OVSX_PAT}"
    cp -v "${VSIX}" "${OUT_DIR}/"
    ;;
  compile)
    npm run compile
    ;;
  shell)
    exec bash
    ;;
  *)
    echo "usage: package | publish | compile | shell" >&2
    exit 1
    ;;
esac
