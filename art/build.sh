#!/usr/bin/env bash
# Rebuild all 3D models and compress them for the web.
set -e
cd "$(dirname "$0")/.."
python3 art/creatures.py "$@"
python3 art/world.py
python3 art/props.py
for f in public/models/*.raw.glb; do
  out="${f%.raw.glb}.glb"
  npx gltfpack -i "$f" -o "$out" -cc -vpf -kn -km >/dev/null
  rm "$f"
done
ls -la public/models
