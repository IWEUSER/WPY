#!/usr/bin/env bash
#
# Idempotent repository bootstrap for the WPY Flask app.
# Safe to run repeatedly: system package install is skipped when present and
# the virtualenv is refreshed in place.
set -euo pipefail

cd "$(dirname "$0")/.."

# The default base image ships Python 3.12 but not the venv module, so install
# it once (no-op on subsequent runs).
if ! dpkg -s python3-venv >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends python3-venv
fi

python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

echo "WPY install complete."
