#!/usr/bin/env bash
# Build the nyuchat image on the .89 server (this box has 11GB free RAM,
# enough for `next build`; the local 3.8GB box OOMs).
set -euo pipefail
set -x

REMOTE="cvku-ops@192.168.1.89"
SRC="/home/ubs/nyuchat"

# 1. rsync the project (excludes gitignored: onnx/, node_modules/, .next/)
rsync -az --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='onnx' \
  --exclude='tsconfig.tsbuildinfo' \
  -e "ssh -o StrictHostKeyChecking=no" \
  "$SRC/" "$REMOTE:~/nyuchat"

# 2. build with SKIP_MODELS first: confirm `next build` itself compiles on a
#    machine with enough RAM, then run a second pass with the model fetch.
ssh -o StrictHostKeyChecking=no "$REMOTE" bash -lc "'
cd ~/nyuchat
docker build --build-arg SKIP_MODELS=1 -t nyuchat:base .
'"
