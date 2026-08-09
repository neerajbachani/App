#!/usr/bin/env bash
# Cloud Agent per-boot start script for the New Expensify web dev environment.
# Idempotent: safe to run on every boot.
set -euo pipefail

# The rsbuild dev server binds to and is served at dev.new.expensify.com. A container's
# /etc/hosts is regenerated on each boot, so ensure the loopback mapping every start.
if ! grep -q "dev.new.expensify.com" /etc/hosts; then
  echo "127.0.0.1 dev.new.expensify.com" | sudo tee -a /etc/hosts >/dev/null
fi
