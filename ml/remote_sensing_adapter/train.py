"""Fine-tune a CLIP visual/text encoder on remote-sensing image-text pairs.

This is the reproducible domain-adaptation component for SIH26167. It expects a
CSV manifest with `image_path` and `caption` columns. Build the manifest from
BigEarthNet labels/captions (or another permitted open remote-sensing dataset)
without committing dataset files to this repository.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
import random
from datetime import datetime, timezone
from pathlib import Path

import open_clip
import pandas as pd
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset


class RemoteSensingPairs(Dataset):
    def __init__(self, manifest: Path, preprocess, tokenizer, image_root: Path | None = None):
        self.rows = pd.read_csv(manifest).dropna(subset=["image_path", "caption"])
        self.preprocess, self.tokenizer, self.image_root = preprocess, tokenizer, image_root

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows.iloc[index]
        image_path = Path(row.image_path)
        if self.image_root and not image_path.is_absolute():
            image_path = self.image_root / image_path
        image = Image.open(image_path).convert("RGB")
        return self.preprocess(image), self.tokenizer(str(row.caption))[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--image-root", type=Path, help="Base directory for relative image_path entries in the manifest")
    parser.add_argument("--output", default="checkpoints/bigearthnet-clip-adapter.pt", type=Path)
    parser.add_argument("--epochs", default=3, type=int)
    parser.add_argument("--batch-size", default=16, type=int)
    parser.add_argument("--lr", default=1e-5, type=float)
    parser.add_argument("--seed", default=26167, type=int)
    parser.add_argument("--workers", default=2, type=int)
    parser.add_argument("--base-model", default="ViT-B-32")
    parser.add_argument("--pretrained", default="laion2b_s34b_b79k")
    parser.add_argument("--dataset-version", default="unspecified", help="Dataset release/version recorded in checkpoint evidence")
    parser.add_argument("--dataset-license", default="unspecified", help="Dataset licence recorded in checkpoint evidence")
    parser.add_argument("--training-split", default="train", help="Exact split represented by --manifest")
    args = parser.parse_args()

    if args.epochs < 1 or args.batch_size < 2:
        raise SystemExit("--epochs must be at least 1 and --batch-size at least 2.")
    random.seed(args.seed); torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
    if torch.cuda.is_available(): torch.cuda.manual_seed_all(args.seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, _, preprocess = open_clip.create_model_and_transforms(args.base_model, pretrained=args.pretrained)
    model.to(device).train()
    tokenizer = open_clip.get_tokenizer(args.base_model)
    dataset = RemoteSensingPairs(args.manifest, preprocess, tokenizer, args.image_root)
    if len(dataset) < 2:
        raise SystemExit("Training needs at least two valid image/caption pairs.")
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True, num_workers=args.workers, generator=torch.Generator().manual_seed(args.seed))
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.02)

    epoch_losses = []
    for epoch in range(args.epochs):
        running = 0.0
        for images, texts in loader:
            optimizer.zero_grad(set_to_none=True)
            # Recent OpenCLIP releases return normalized image/text features and
            # a scale factor; older releases returned the two logits directly.
            # Support both APIs so a training run remains reproducible across
            # the supported OpenCLIP package range.
            outputs = model(images.to(device), texts.to(device))
            if isinstance(outputs, tuple) and len(outputs) >= 3:
                image_features, text_features, logit_scale = outputs[:3]
                logits_i = logit_scale * image_features @ text_features.T
                logits_t = logits_i.T
            else:
                logits_i, logits_t = outputs
            labels = torch.arange(images.shape[0], device=device)
            loss = (torch.nn.functional.cross_entropy(logits_i, labels) + torch.nn.functional.cross_entropy(logits_t, labels)) / 2
            loss.backward()
            optimizer.step()
            running += loss.item()
        loss = running / max(len(loader), 1)
        epoch_losses.append(round(loss, 6))
        print(f"epoch={epoch + 1} loss={loss:.4f}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    metadata = {"format_version": 1, "base_model": args.base_model, "pretrained_initialization": args.pretrained, "dataset_manifest": str(args.manifest), "image_root": str(args.image_root) if args.image_root else None, "dataset_version": args.dataset_version, "dataset_license": args.dataset_license, "training_split": args.training_split, "manifest_sha256": hashlib.sha256(args.manifest.read_bytes()).hexdigest(), "samples": len(dataset), "epochs": args.epochs, "batch_size": args.batch_size, "learning_rate": args.lr, "seed": args.seed, "deterministic_cudnn": bool(torch.cuda.is_available()), "device": device, "cuda_device_name": torch.cuda.get_device_name(0) if device == "cuda" else None, "torch_version": torch.__version__, "open_clip_version": importlib.metadata.version("open-clip-torch"), "python_version": platform.python_version(), "platform": platform.platform(), "epoch_losses": epoch_losses, "trained_at": datetime.now(timezone.utc).isoformat()}
    torch.save({"state_dict": model.state_dict(), **metadata}, args.output)
    checksum = hashlib.sha256(args.output.read_bytes()).hexdigest()
    args.output.with_suffix(args.output.suffix + ".metadata.json").write_text(json.dumps({**metadata, "checkpoint": str(args.output), "checkpoint_sha256": checksum}, indent=2), encoding="utf-8")
    print(f"Saved adapted checkpoint to {args.output}")


if __name__ == "__main__":
    main()
