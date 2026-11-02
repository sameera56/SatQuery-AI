"""Create auditable, held-out benchmark reports for SATQUERY predictions.

This intentionally evaluates prediction files rather than test labels embedded
in code.  It supports the common VRSBench / RSVQA / CDVQA JSON and JSONL
layouts, detects incomplete joins, and writes a report containing hashes of
both inputs.  VRSBench's supplied GPT/CLAIR notebooks remain authoritative for
its final caption/VQA scores; the local caption measures are a smoke test.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_records(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    value: Any
    if path.suffix.lower() == ".jsonl":
        value = [json.loads(line) for line in text.splitlines() if line.strip()]
    else:
        value = json.loads(text)
    if isinstance(value, dict):
        for key in ("data", "annotations", "questions", "results", "predictions"):
            if isinstance(value.get(key), list):
                value = value[key]
                break
    if not isinstance(value, list):
        raise ValueError(f"{path} must be a JSON array or object containing one")
    if not all(isinstance(item, dict) for item in value):
        raise ValueError(f"{path} contains a non-object record")
    return value


def identifier(row: dict[str, Any]) -> str:
    for key in ("id", "question_id", "sample_id", "qid", "image_id"):
        if row.get(key) not in (None, ""):
            return str(row[key])
    raise ValueError("Every record needs one of id, question_id, sample_id, qid, or image_id")


def value(row: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in row and row[key] is not None:
            return row[key]
    return None


def norm_answer(item: Any) -> str:
    text = str(item or "").lower().strip()
    text = re.sub(r"\b(a|an|the)\b", " ", text)
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def references(row: dict[str, Any]) -> list[str]:
    answer = value(row, ("answers", "references", "reference", "answer", "ground_truth", "label"))
    if isinstance(answer, list):
        return [str(x.get("answer", x)) if isinstance(x, dict) else str(x) for x in answer]
    return [str(answer)] if answer is not None else []


def tokens(text: str) -> list[str]:
    return norm_answer(text).split()


def ngrams(items: list[str], n: int) -> Counter[tuple[str, ...]]:
    return Counter(tuple(items[i:i + n]) for i in range(max(0, len(items) - n + 1)))


def bleu(predictions: list[str], refs: list[list[str]], n: int) -> float:
    clipped = total = cand_length = ref_length = 0
    for prediction, candidates in zip(predictions, refs):
        candidate = tokens(prediction)
        candidate_counts = ngrams(candidate, n)
        maximum: Counter[tuple[str, ...]] = Counter()
        for reference in candidates:
            maximum |= ngrams(tokens(reference), n)
        clipped += sum(min(count, maximum[gram]) for gram, count in candidate_counts.items())
        total += sum(candidate_counts.values())
        cand_length += len(candidate)
        ref_lengths = [len(tokens(reference)) for reference in candidates] or [0]
        ref_length += min(ref_lengths, key=lambda length: (abs(length - len(candidate)), length))
    if not total or not cand_length:
        return 0.0
    precision = clipped / total
    bp = 1.0 if cand_length > ref_length else math.exp(1 - ref_length / cand_length)
    return round(bp * precision * 100, 4)


def lcs(left: list[str], right: list[str]) -> int:
    previous = [0] * (len(right) + 1)
    for item in left:
        current = [0]
        for index, other in enumerate(right, 1):
            current.append(previous[index - 1] + 1 if item == other else max(previous[index], current[-1]))
        previous = current
    return previous[-1]


def rouge_l(predictions: list[str], refs: list[list[str]]) -> float:
    scores = []
    for prediction, candidates in zip(predictions, refs):
        candidate = tokens(prediction)
        best = 0.0
        for reference in candidates:
            target = tokens(reference)
            if candidate and target:
                overlap = lcs(candidate, target)
                precision, recall = overlap / len(candidate), overlap / len(target)
                best = max(best, 2 * precision * recall / (precision + recall) if precision + recall else 0.0)
        scores.append(best)
    return round((sum(scores) / max(1, len(scores))) * 100, 4)


def box(row: dict[str, Any]) -> list[float] | None:
    raw = value(row, ("bbox", "box", "bounding_box", "target_box"))
    if isinstance(raw, dict): raw = [raw.get(key) for key in ("x", "y", "width", "height")]
    if not isinstance(raw, list) or len(raw) != 4:
        return None
    try: return [float(item) for item in raw]
    except (TypeError, ValueError): return None


def iou(left: list[float], right: list[float], fmt: str) -> float:
    def corners(b: list[float]) -> tuple[float, float, float, float]:
        return (b[0], b[1], b[0] + b[2], b[1] + b[3]) if fmt == "xywh" else tuple(b)  # type: ignore[return-value]
    ax1, ay1, ax2, ay2 = corners(left); bx1, by1, bx2, by2 = corners(right)
    overlap = max(0, min(ax2, bx2) - max(ax1, bx1)) * max(0, min(ay2, by2) - max(ay1, by1))
    union = max(0, ax2 - ax1) * max(0, ay2 - ay1) + max(0, bx2 - bx1) * max(0, by2 - by1) - overlap
    return overlap / union if union else 0.0


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate held-out SATQUERY prediction files.")
    parser.add_argument("--benchmark", required=True, choices=("vrsbench", "rsvqa", "cdvqa"))
    parser.add_argument("--task", required=True, choices=("vqa", "caption", "grounding"))
    parser.add_argument("--references", required=True, type=Path, help="Official held-out annotations; never use a training file.")
    parser.add_argument("--predictions", required=True, type=Path, help="Model outputs keyed by the same sample/question id.")
    parser.add_argument("--split", required=True, help="Exact official split name, e.g. test.")
    parser.add_argument("--box-format", choices=("xywh", "xyxy"), default="xywh")
    parser.add_argument("--evaluator-version", default="satquery-benchmark-runner/1", help="Evaluator/version label retained in the audit report")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if "train" in args.split.lower(): raise SystemExit("Refusing to report a training split as benchmark evidence.")
    gold_rows, prediction_rows = load_records(args.references), load_records(args.predictions)
    gold_ids, prediction_ids = [identifier(row) for row in gold_rows], [identifier(row) for row in prediction_rows]
    if len(gold_ids) != len(set(gold_ids)): raise SystemExit("Duplicate reference IDs are not allowed.")
    if len(prediction_ids) != len(set(prediction_ids)): raise SystemExit("Duplicate prediction IDs are not allowed.")
    gold = dict(zip(gold_ids, gold_rows))
    predicted = dict(zip(prediction_ids, prediction_rows))
    matched = sorted(gold.keys() & predicted.keys())
    if not matched: raise SystemExit("No matching sample IDs between references and predictions.")
    report: dict[str, Any] = {"benchmark": args.benchmark, "task": args.task, "split": args.split, "evaluator_version": args.evaluator_version, "generated_at": datetime.now(timezone.utc).isoformat(), "references": str(args.references), "predictions": str(args.predictions), "reference_sha256": hashlib.sha256(args.references.read_bytes()).hexdigest(), "prediction_sha256": hashlib.sha256(args.predictions.read_bytes()).hexdigest(), "reference_records": len(gold), "prediction_records": len(predicted), "matched_records": len(matched), "missing_predictions": len(gold) - len(matched), "unknown_predictions": len(predicted) - len(matched)}
    if args.task == "grounding":
        scores = [iou(box(predicted[key]) or [], box(gold[key]) or [], args.box_format) if box(predicted[key]) and box(gold[key]) else 0.0 for key in matched]
        report["metrics"] = {"mean_iou": round(sum(scores) / len(scores), 4), "acc_at_iou_0_5": round(sum(score >= .5 for score in scores) / len(scores) * 100, 4), "acc_at_iou_0_7": round(sum(score >= .7 for score in scores) / len(scores) * 100, 4)}
    else:
        outputs = [str(value(predicted[key], ("prediction", "answer", "caption", "text", "output")) or "") for key in matched]
        targets = [references(gold[key]) for key in matched]
        if args.task == "vqa": report["metrics"] = {"exact_match_accuracy": round(sum(norm_answer(output) in {norm_answer(item) for item in target} for output, target in zip(outputs, targets)) / len(outputs) * 100, 4)}
        else: report["metrics"] = {"local_bleu_1": bleu(outputs, targets, 1), "local_bleu_2": bleu(outputs, targets, 2), "local_bleu_3": bleu(outputs, targets, 3), "local_bleu_4": bleu(outputs, targets, 4), "local_rouge_l": rouge_l(outputs, targets)}
    report["integrity_note"] = "Only report this as a held-out SATQUERY result when matched_records equals reference_records. For VRSBench final reporting, run its official evaluator too; local caption metrics are smoke tests, not CLAIR/CIDEr substitutes."
    args.output.parent.mkdir(parents=True, exist_ok=True); args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__": main()
