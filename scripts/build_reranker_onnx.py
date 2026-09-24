#!/usr/bin/env python3
"""Export BAAI/bge-reranker-v2-m3 to ONNX for onnxruntime-node.

The XLM-R tokenizer does not emit token_type_ids, but the classifier head
consumes them, so we pass an explicit zeros tensor.

Requires: transformers, torch (cpu), onnxruntime is optional here.
"""
import os
import sys
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL = "BAAI/bge-reranker-v2-m3"
OUT = sys.argv[1] if len(sys.argv) > 1 else "onnx/reranker"

tok = AutoTokenizer.from_pretrained(MODEL)
mod = AutoModelForSequenceClassification.from_pretrained(MODEL)
mod.eval()

os.makedirs(os.path.join(OUT, "tokenizer"), exist_ok=True)
tok.save_pretrained(os.path.join(OUT, "tokenizer"))

enc = tok("what is vey doing", text_pair="vey is curious about zack", return_tensors="pt", padding=True)
input_ids = enc["input_ids"]
attention_mask = enc["attention_mask"]
token_type_ids = torch.zeros_like(input_ids, dtype=torch.long)

with torch.no_grad():
    torch.onnx.export(
        mod,
        (input_ids, attention_mask, token_type_ids),
        os.path.join(OUT, "reranker.onnx"),
        input_names=["input_ids", "attention_mask", "token_type_ids"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "seq"},
            "attention_mask": {0: "batch", 1: "seq"},
            "token_type_ids": {0: "batch", 1: "seq"},
            "logits": {0: "batch"},
        },
        opset_version=17,
    )
print("EXPORT OK ->", os.path.join(OUT, "reranker.onnx"))
