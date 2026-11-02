"""Prepare a reproducible BigEarthNet 14K RGB image-text manifest.

The Kaggle BigEarthNet 14K layout stores multi-band TIFFs under split folders
and labels in metadata.parquet. This tool creates display RGB PNGs plus
non-overlapping train/test manifests without altering the read-only source.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio
from PIL import Image


def caption(labels: object) -> str:
    values = labels.tolist() if hasattr(labels, "tolist") else labels
    if not isinstance(values, (list, tuple)):
        values = [values]
    return "Satellite image containing " + ", ".join(map(str, values[:5])) + "."


def write_rgb(source: Path, destination: Path) -> None:
    with rasterio.open(source) as dataset:
        if dataset.count < 3:
            raise ValueError(f"{source} has fewer than three bands")
        rgb = dataset.read([3, 2, 1]).astype(np.float32)  # B04 red, B03 green, B02 blue
    rgb = np.moveaxis(rgb, 0, -1)
    low, high = np.percentile(rgb, 2), np.percentile(rgb, 98)
    rgb = np.clip((rgb - low) / max(high - low, 1), 0, 1)
    destination.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray((rgb * 255).astype(np.uint8)).save(destination, "PNG")


def export(frame: pd.DataFrame, split: str, source_by_id: dict[str, Path], output: Path) -> pd.DataFrame:
    rows: list[dict[str, str]] = []
    for row in frame.itertuples(index=False):
        sample_id = str(row.patch_id)
        image = output / "images" / split / f"{sample_id}.png"
        if not image.exists():
            write_rgb(source_by_id[sample_id], image)
        rows.append({"image_path": str(image), "caption": caption(row.labels), "sample_id": sample_id, "split": split})
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create BigEarthNet 14K RGB manifests from metadata.parquet and multi-band TIFFs.")
    parser.add_argument("--data-root", required=True, type=Path, help="Directory containing metadata.parquet and BigEarthNet-S2")
    parser.add_argument("--output", required=True, type=Path, help="Writable directory for images and manifests")
    parser.add_argument("--train-limit", type=int, default=3000)
    parser.add_argument("--test-limit", type=int, default=500)
    args = parser.parse_args()
    root, s2 = args.data_root, args.data_root / "BigEarthNet-S2"
    metadata = pd.read_parquet(root / "metadata.parquet")
    source_by_id = {path.stem: path for path in s2.rglob("*.tif")}
    usable = metadata[metadata["patch_id"].astype(str).isin(source_by_id)].copy()
    clean = usable[~usable["contains_seasonal_snow"].fillna(False) & ~usable["contains_cloud_or_shadow"].fillna(False)]
    train = clean[clean["split"] == "train"].head(args.train_limit)
    test = clean[clean["split"] == "test"].head(args.test_limit)
    if len(train) < 2 or len(test) < 2:
        raise SystemExit(f"Need at least two usable samples per split; found train={len(train)}, test={len(test)}.")
    args.output.mkdir(parents=True, exist_ok=True)
    train_manifest, test_manifest = export(train, "train", source_by_id, args.output), export(test, "test", source_by_id, args.output)
    manifest_dir = args.output / "manifests"; manifest_dir.mkdir(exist_ok=True)
    train_manifest.to_csv(manifest_dir / "train.csv", index=False)
    test_manifest.to_csv(manifest_dir / "test.csv", index=False)
    print(f"Prepared train={len(train_manifest)} test={len(test_manifest)} at {args.output}")


if __name__ == "__main__":
    main()
