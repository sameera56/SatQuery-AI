"""Reproducible retrieval evaluation for the adapted SATQUERY encoder.

Use one held-out manifest per benchmark. This deliberately produces a JSON
artifact for the SIH report instead of printing untraceable demo claims.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

import open_clip
import pandas as pd
import torch
from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path, help="Held-out CSV with image_path,caption")
    parser.add_argument("--image-root", type=Path, help="Base directory for relative image_path entries in the manifest")
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--output", default="runs/adapter-evaluation.json", type=Path)
    parser.add_argument("--limit", type=int, default=500, help="Keep a reproducible, documented evaluation subset")
    parser.add_argument("--split", default="test", help="Exact held-out split represented by --manifest")
    args = parser.parse_args()

    rows = pd.read_csv(args.manifest).dropna(subset=["image_path", "caption"]).head(args.limit)
    if len(rows) < 2:
        raise SystemExit("Evaluation requires at least two image/caption pairs.")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    checkpoint = torch.load(args.checkpoint, map_location=device, weights_only=False)
    base_model = checkpoint.get("base_model", "ViT-B-32")
    model, _, preprocess = open_clip.create_model_and_transforms(base_model, pretrained=None)
    model.load_state_dict(checkpoint["state_dict"], strict=True)
    model.to(device).eval()
    tokenizer = open_clip.get_tokenizer(base_model)

    def resolve_image_path(path: str) -> Path:
        image_path = Path(path)
        return args.image_root / image_path if args.image_root and not image_path.is_absolute() else image_path

    images = torch.stack([preprocess(Image.open(resolve_image_path(path)).convert("RGB")) for path in rows.image_path]).to(device)
    texts = tokenizer(rows.caption.astype(str).tolist()).to(device)
    with torch.no_grad():
        image_features = model.encode_image(images)
        text_features = model.encode_text(texts)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        similarity = image_features @ text_features.T

    def recall_at(k: int) -> float:
        hits = similarity.topk(min(k, len(rows)), dim=1).indices
        target = torch.arange(len(rows), device=device).unsqueeze(1)
        return float((hits == target).any(dim=1).float().mean().item())

    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "checkpoint": str(args.checkpoint),
        "checkpoint_sha256": hashlib.sha256(args.checkpoint.read_bytes()).hexdigest(),
        "checkpoint_base_model": checkpoint.get("base_model"),
        "manifest": str(args.manifest),
        "manifest_sha256": hashlib.sha256(args.manifest.read_bytes()).hexdigest(),
        "split": args.split,
        "image_root": str(args.image_root) if args.image_root else None,
        "samples": len(rows),
        "device": device,
        "cuda_device_name": torch.cuda.get_device_name(0) if device == "cuda" else None,
        "torch_version": torch.__version__,
        "open_clip_version": importlib.metadata.version("open-clip-torch"),
        "python_version": platform.python_version(),
        "task": "held-out image-to-text retrieval",
        "metrics": {"recall_at_1": round(recall_at(1), 4), "recall_at_5": round(recall_at(5), 4)},
        "note": "Run the prescribed VRSBench, RSVQA, and CDVQA task evaluators separately; this verifies the adapted image-text encoder only.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
