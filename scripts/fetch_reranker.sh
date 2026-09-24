#!/usr/bin/env bash
# Download the bge-reranker-v2-m3 ONNX export into onnx/reranker/.
#
# We do not export it ourselves in Docker (that needs torch + transformers,
# ~4GB of image) — this mirror ships the same XLMRobertaForSequenceClassification
# graph with dynamic batch/seq. fp16 conversion is a separate step
# (scripts/to_fp16_stream.py) because fp32 costs ~5s/pair on a 4-core box.
set -euo pipefail

OUT="${1:-onnx/reranker}"
BASE="https://huggingface.co/celinehoang/bge-reranker-v2-m3-onnx/resolve/main"

mkdir -p "$OUT"

echo "→ model.onnx"
curl -fL --retry 6 --retry-delay 5 -C - -o "$OUT/reranker.onnx" "$BASE/model.onnx"

echo "→ model.onnx_data (4.5GB — takes a while)"
curl -fL --retry 8 --retry-delay 5 -C - -o "$OUT/reranker.onnx.data" "$BASE/model.onnx_data"

echo "→ tokenizer files"
curl -fL --retry 4 -C - -o "$OUT/tokenizer.json" "$BASE/tokenizer.json"
curl -fL --retry 4 -C - -o "$OUT/tokenizer_config.json" "$BASE/tokenizer_config.json"
curl -fL --retry 4 -C - -o "$OUT/sentencepiece.bpe.model" "$BASE/sentencepiece.bpe.model"
curl -fL --retry 4 -C - -o "$OUT/special_tokens_map.json" "$BASE/special_tokens_map.json"

echo
echo "done → $OUT"
du -sh "$OUT"
