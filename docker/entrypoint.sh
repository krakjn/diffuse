#!/usr/bin/env bash
set -euo pipefail

npm pkg set version="$(bump print)"
npm install --no-audit --no-fund
npm run package

echo "VSIX written to dist/"
ls -la dist/
