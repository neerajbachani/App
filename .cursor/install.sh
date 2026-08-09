#!/usr/bin/env bash
# Cloud Agent install script for the New Expensify standalone (NewDot) web build.
# Idempotent: safe to run repeatedly. Provisions the pinned toolchain, installs JS
# dependencies, and generates local HTTPS certificates for the dev server.
set -euo pipefail

cd "$(dirname "$0")/.."

# The exec daemon prepends its own Node (v22) to PATH, but this repo pins Node 26.5.0
# via .nvmrc/engines with engine-strict, so nvm's Node must take precedence here.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
NODE_VERSION="$(cat .nvmrc)"
nvm install "$NODE_VERSION" >/dev/null
nvm use "$NODE_VERSION" >/dev/null
export PATH="$NVM_DIR/versions/node/v$NODE_VERSION/bin:$HOME/.bun/bin:$PATH"

# bun runs the web dev proxy (web/proxy.ts) and several build scripts.
BUN_VERSION="1.3.14"
if ! command -v bun >/dev/null 2>&1 || [ "$(bun -v 2>/dev/null)" != "$BUN_VERSION" ]; then
  curl -fsSL https://bun.sh/install | bash -s "bun-v$BUN_VERSION"
fi
export PATH="$HOME/.bun/bin:$PATH"

# mkcert generates the local HTTPS certificate the rsbuild dev server requires.
if ! command -v mkcert >/dev/null 2>&1; then
  curl -fsSL -o /tmp/mkcert "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64"
  sudo install -m 0755 /tmp/mkcert /usr/local/bin/mkcert
fi

echo "Using node $(node -v), npm $(npm -v), bun $(bun -v)"

# The Mobile-Expensify submodule is a private Expensify repo and is not needed for the
# web build, so install dependencies for the standalone NewDot app only.
STANDALONE_NEW_DOT=true npm install

# Trust the local CA and (re)generate certs into config/rsbuild for the HTTPS dev server.
mkcert -install
npm run setup-https
