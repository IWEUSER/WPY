#!/usr/bin/env bash
#
# Idempotent install script for the WPY Cloud Agent environment.
# Ensures Python venv support exists, then creates a project-local
# virtualenv and installs pinned dependencies.
set -euo pipefail

cd "$(dirname "$0")/.."

PY="${PYTHON:-python3}"

# The base image ships Python 3.12 but not the venv/ensurepip package.
# Install it once (idempotent) so `python3 -m venv` works.
if ! "$PY" -c "import ensurepip" >/dev/null 2>&1; then
  echo "[install] installing python venv support (python3-venv)"
  sudo apt-get update -y
  sudo apt-get install -y --no-install-recommends python3-venv
fi

if [ ! -d .venv ]; then
  echo "[install] creating virtualenv at .venv"
  "$PY" -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "[install] upgrading pip"
python -m pip install --upgrade pip >/dev/null

echo "[install] installing dependencies"
python -m pip install -r requirements.txt

echo "[install] done"
