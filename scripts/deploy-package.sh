#!/usr/bin/env bash
# Builds deploy.zip with production-only dependencies.
#
# Strategy: prune dev deps in place, zip, then restore via `npm install`.
# A bash trap guarantees the restore runs even on failure or Ctrl+C, so the
# repo never ends up in a broken "no dev deps" state.

set -euo pipefail

restore_dev_deps() {
    echo ""
    echo "Restoring dev dependencies..."
    npm install --silent
}
trap restore_dev_deps EXIT

rm -f deploy.zip

echo "Pruning dev dependencies..."
npm prune --omit=dev --silent

echo "Creating deploy.zip..."
zip -qr deploy.zip \
    packages/server/dist \
    packages/server/data \
    packages/server/.msal-cache.json \
    packages/client/dist \
    node_modules \
    package.json \
    packages/server/package.json \
    packages/client/package.json

echo "deploy.zip created ($(du -h deploy.zip | cut -f1))"
