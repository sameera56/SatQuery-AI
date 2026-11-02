"""Verify the artifacts required for an evidence-backed SIH26167 submission.

This does not score models or manufacture results. It checks that the trained
checkpoint, held-out retrieval report, and optional benchmark reports contain
the provenance fields needed for a reviewable submission.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"Could not read {path}: {error}") from error
    if not isinstance(value, dict):
        raise SystemExit(f"{path} must contain a JSON object.")
    return value


def check_fields(record: dict[str, Any], fields: tuple[str, ...]) -> list[str]:
    return [field for field in fields if record.get(field) in (None, "", [])]


def main() -> None:
    parser = argparse.ArgumentParser(description="Check SIH26167 model and benchmark evidence without inventing scores.")
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--adapter-evaluation", required=True, type=Path)
    parser.add_argument("--output", default="runs/sih-evidence-readiness.json", type=Path)
    parser.add_argument("--benchmark-report", type=Path, action="append", default=[])
    args = parser.parse_args()

    metadata_path = args.checkpoint.with_suffix(args.checkpoint.suffix + ".metadata.json")
    missing_files = [str(path) for path in (args.checkpoint, metadata_path, args.adapter_evaluation) if not path.is_file()]
    result: dict[str, Any] = {"checkpoint": str(args.checkpoint), "checkpoint_metadata": str(metadata_path), "adapter_evaluation": str(args.adapter_evaluation), "missing_files": missing_files, "benchmarks": []}
    if missing_files:
        result["ready"] = False
        result["reason"] = "Required model-training or held-out evaluation artifacts are missing."
    else:
        metadata, evaluation = read_json(metadata_path), read_json(args.adapter_evaluation)
        required_metadata = ("dataset_version", "dataset_license", "training_split", "manifest_sha256", "samples", "epochs", "batch_size", "learning_rate", "seed", "device", "trained_at", "checkpoint_sha256")
        required_evaluation = ("manifest_sha256", "split", "samples", "metrics", "checkpoint_sha256", "generated_at")
        result.update({
            "checkpoint_sha256_actual": hashlib.sha256(args.checkpoint.read_bytes()).hexdigest(),
            "missing_checkpoint_metadata": check_fields(metadata, required_metadata),
            "missing_adapter_evaluation_fields": check_fields(evaluation, required_evaluation),
            "adapter_metrics": evaluation.get("metrics"),
        })
        result["ready"] = not result["missing_checkpoint_metadata"] and not result["missing_adapter_evaluation_fields"]

    for report_path in args.benchmark_report:
        entry: dict[str, Any] = {"path": str(report_path), "present": report_path.is_file()}
        if report_path.is_file():
            report = read_json(report_path)
            required = ("benchmark", "task", "split", "evaluator_version", "reference_sha256", "prediction_sha256", "matched_records", "missing_predictions", "metrics")
            entry.update({"missing_fields": check_fields(report, required), "metrics": report.get("metrics"), "complete_join": report.get("missing_predictions") == 0})
        result["benchmarks"].append(entry)

    result["benchmark_evidence_ready"] = bool(result["benchmarks"]) and all(item["present"] and not item.get("missing_fields") and item.get("complete_join") for item in result["benchmarks"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
