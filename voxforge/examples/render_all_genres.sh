#!/usr/bin/env bash
# Render one song per genre from the synthesized demo vocal.
# Each render takes ~30-60s on a mid-tier laptop.
set -e
cd "$(dirname "$0")/.."

mkdir -p output

for genre in trap boom_bap rnb drill melodic; do
  echo "=== $genre ==="
  python -m voxforge demo \
    --genre "$genre" \
    --duration 15 \
    --out output \
    --basename "demo_${genre}" \
    --lyrics-theme hustle \
    --lyrics-bars 16 \
    --lyrics-seed 42
done

echo ""
echo "Done. Output:"
ls -lh output/*.wav output/*.md
