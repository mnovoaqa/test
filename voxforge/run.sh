#!/usr/bin/env bash
# VOXFORGE — one-command run on macOS/Linux with Python 3.10+ installed.
#
#   ./run.sh
#
# This creates a local venv, installs deps, and launches the UI at
# http://localhost:7860.
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo ">> Creating virtual environment..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo ">> Installing dependencies (first run only takes a few minutes)..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
pip install --quiet "gradio>=6.0"

echo ""
echo ">> Open http://localhost:7860 in your browser when it says 'Running on local URL'."
echo ">> Press Ctrl+C to stop the server."
echo ""
VOXFORGE_HOST="${VOXFORGE_HOST:-127.0.0.1}" \
VOXFORGE_PORT="${VOXFORGE_PORT:-7860}" \
VOXFORGE_SHARE="${VOXFORGE_SHARE:-0}" \
python app.py
