"""Validate SIH26167 train/test manifests before expensive GPU training.

The adapter consumes CSV manifests with at least ``image_path`` and ``caption``.
Optional ``split`` and ``sample_id`` columns make leakage checks reproducible.
This program deliberately does not download any dataset or alter it.
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from hashlib import sha256
from pathlib import Path


def read_manifest(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames or not {"image_path", "caption"}.issubset(reader.fieldnames):
            raise ValueError(f"{path} must contain image_path and caption columns")
        return [{key: (value or "").strip() for key, value in row.items()} for row in reader]


def inspect(path: Path, rows: list[dict[str, str]], root: Path | None) -> dict:
    missing_images = []
    empty_captions = 0
    identifiers: list[str] = []
    for row in rows:
        identifier = row.get("sample_id") or row["image_path"]
        identifiers.append(identifier)
        if not row["caption"]:
            empty_captions += 1
        image = Path(row["image_path"])
        if root and not image.is_absolute():
            image = root / image
        if not image.exists():
            missing_images.append(str(image))
    return {
        "manifest": str(path),
        "rows": len(rows),
        "unique_identifiers": len(set(identifiers)),
        "duplicate_identifiers": len(identifiers) - len(set(identifiers)),
        "empty_captions": empty_captions,
        "missing_image_files": len(missing_images),
        "missing_examples": missing_images[:10],
        "split_counts": dict(Counter(row.get("split") or "unspecified" for row in rows)),
        "sha256": sha256(path.read_bytes()).hexdigest(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", type=Path, required=True)
    parser.add_argument("--test", type=Path, required=True, help="Held-out manifest; never use it for training")
    parser.add_argument("--image-root", type=Path, help="Base directory for relative image_path values")
    parser.add_argument("--output", type=Path, default=Path("runs/dataset-preflight.json"))
    args = parser.parse_args()

    train_rows, test_rows = read_manifest(args.train), read_manifest(args.test)
    train_ids = {row.get("sample_id") or row["image_path"] for row in train_rows}
    test_ids = {row.get("sample_id") or row["image_path"] for row in test_rows}
    overlap = sorted(train_ids & test_ids)
    report = {
        "training": inspect(args.train, train_rows, args.image_root),
        "held_out_evaluation": inspect(args.test, test_rows, args.image_root),
        "cross_split_overlap": len(overlap),
        "overlap_examples": overlap[:10],
        "ready": len(train_rows) >= 2 and len(test_rows) >= 2 and not overlap,
        "note": "A ready result validates manifest structure only. It does not prove image registration, label quality, model accuracy, or SIH benchmark performance.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if not report["ready"]:
        raise SystemExit("Preflight failed: resolve overlap and ensure both splits contain at least two samples.")


if __name__ == "__main__":
    main()
