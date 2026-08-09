#!/usr/bin/env bash
# Launches the New Expensify standalone web dev server (rsbuild) together with the
# local API proxy. Served at https://dev.new.expensify.com:8082/.
set -euo pipefail

cd "$(dirname "$0")/.."

# Match the pinned toolchain used by install.sh (see the note there about PATH ordering).
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
NODE_VERSION="$(cat .nvmrc)"
export PATH="$NVM_DIR/versions/node/v$NODE_VERSION/bin:$HOME/.bun/bin:$PATH"

exec npm run web
