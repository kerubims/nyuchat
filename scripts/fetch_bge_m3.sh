#!/usr/bin/env bash
# Download BGE-M3 ONNX (fp32) into onnx/embedder/ for onnxruntime-node.
# transformers.js cannot run this repo's graph (external .onnx.data), so we
# load the raw HF files ourselves — see lib/embed.ts.
set -euo pipefail
OUT="${1:-onnx/embedder}"
mkdir -p "$OUT/onnx"
BASE="https://huggingface.co/Xenova/bge-m3/resolve/main"

for f in config.json tokenizer.json tokenizer_config.json special_tokens_map.json; do
  echo "→ $f"
  curl -fL --retry 5 --retry-delay 2 -o "$OUT/$f" "$BASE/$f"
done

echo "→ onnx/model.onnx"
curl -fL --retry 5 --retry-delay 2 -o "$OUT/onnx/model.onnx" "$BASE/onnx/model.onnx"
echo "→ onnx/model.onnx_data (2.2GB — this takes a while)"
curl -fL --retry 8 --retry-delay 5 -C - -o "$OUT/onnx/model.onnx_data" "$BASE/onnx/model.onnx_data"

echo "done → $OUT"
ls -la "$OUT" "$OUT/onnx"
