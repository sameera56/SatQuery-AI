# SIH26167 Requirement Coverage

This checklist maps SATQUERY AI to the published ISRO / SIH26167 functional scope. It is deliberately evidence-based: do not mark an item complete in a presentation unless the linked workflow can be demonstrated.

| Official requirement | SATQUERY AI evidence | Status |
| --- | --- | --- |
| Interactive GUI and natural-language queries | `SatQueryPanel` in the dashboard | Ready |
| GeoTIFF / TIFF input and compatibility checking | GeoTIFF/TIFF upload, server-side raster decode, dimensions and paired aspect-ratio validation; CRS/bounds/resolution/bands validation activates with the connected adapter service | Ready with adapter service |
| Single-image visual question answering | Optical and SAR modes; evidence-grounded query response | Ready |
| Additional single-image task: captioning or grounding | Query-triggered text-guided image-region grounding with labelled evidence boxes | Ready |
| Bi-temporal change description / change VQA | `CHANGE / TIME` two-image workflow with visual evidence and co-registration warnings; a trained adapter adds a coarse semantic heatmap | Ready with trained adapter; benchmark proof pending |
| Optical–SAR paired analysis | `OPTICAL + SAR` paired workflow with sensor-specific limitations and GeoTIFF metadata warnings | Ready with trained adapter; benchmark proof pending |
| Agentic orchestration | Deterministic execution plan selects task/tools from mode, query, and inputs; shown in audit trace | Ready |
| Confidence, visual evidence, execution summary, downloadable report | Result panel evidence overlays, limitations, auditable trace, JSON/PDF report | Ready |
| Remote-sensing adaptation | BigEarthNet CLIP-adapter training/inference pipeline in `ml/remote_sensing_adapter` | Requires trained checkpoint + deployment |
| Benchmark evaluation | Scripts and evaluation plan for held-out adapter data; SIH asks for VRSBench, RSVQA, and CDVQA results | Requires benchmark runs |

## Evaluation / judging criteria

| Judging criterion | Prescribed evaluation data | Evidence to retain | Current project state |
| --- | --- | --- | --- |
| Single-image VQA | RSVQA and VRSBench official held-out test splits | Predictions, answer accuracy, input/output hashes, execution trace | UI workflow ready; official report pending |
| Captioning or text-guided grounding | VRSBench official held-out test split | Official caption score or grounding mIoU / threshold accuracy, predictions, evaluator version | Grounding workflow ready; official report pending |
| Bi-temporal change VQA | CDVQA official held-out test split | Change-VQA accuracy, predictions, pair metadata, execution trace | UI workflow ready; official report pending |
| Cross-modal optical–SAR analysis | Co-registered optical–SAR pairs and ISRO/SAC final set | Pair compatibility record, complementary findings, limitations, evaluator results where supplied | UI workflow ready; adapted checkpoint and evaluation evidence pending |
| Remote-sensing adaptation | BigEarthNet held-out split | Trained checkpoint, metadata sidecar, dataset licence/version, Recall@1/Recall@5 report | Not complete: no checkpoint or held-out evaluation file is present |
| Final ISRO/SAC evaluation | Unseen Cartosat-2S optical and RISAT SAR pairs | Normalized evaluator scores only | Must remain unseen and must not be used for training |

The live status view is available at `/satquery/evaluation`. It must be used to
show the difference between an implemented workflow and a trained/evaluated
model claim.

## Demonstration sequence

1. Upload one optical image, ask a VQA question, and show the labelled evidence regions.
2. Ask “highlight the water body” to demonstrate text-guided grounding.
3. Upload two co-registered dates, ask what changed, and open the agent execution trace.
4. Upload a matched optical–SAR pair, ask about water/built-up areas, and explain the complementary sensor evidence.
5. Download the auditable report.
6. Show the connected, trained BigEarthNet adapter health status and evaluation metrics only after completing training and benchmark evaluation.

## Mandatory ML completion evidence

The following two SIH deliverables are **not complete** until the evidence below is produced. The application has the integration points, but a UI workflow alone is not proof of a trained or benchmarked remote-sensing model.

### 1. Remote-sensing adapted / fine-tuned model

- Train the BigEarthNet CLIP adapter using a training manifest that is separate from the held-out test manifest.
- Preserve `checkpoints/bigearthnet-clip-adapter.pt` and its `.metadata.json` sidecar.
- Record the dataset version and licence, split definition, random seed, hyperparameters, hardware, training date, and checkpoint SHA-256 hash.
- Start `ml/remote_sensing_adapter/server.py` with the trained checkpoint and set `SATQUERY_ADAPTER_URL` for the web application.
- Capture `/health` output showing `ready: true` and demonstrate a SATQUERY result that identifies the adapter/checkpoint.

### 2. Held-out benchmark evaluation

- Run adapter retrieval evaluation against a held-out BigEarthNet manifest using `evaluate.py`.
- Produce prediction files and auditable reports for the official held-out VRSBench, RSVQA, and CDVQA splits using `benchmark_runner.py`.
- For every report, retain the reference and prediction hashes, record count, matched count, missing predictions, metric values, evaluator version, and exact split name.
- Run each benchmark's official evaluator where supplied. Local VRSBench caption metrics are smoke tests and must not be presented as official CLAIR/CIDEr results.
- Report each metric under its correct task (VQA, captioning, grounding, or change VQA); do not combine results from different tasks into a single accuracy claim.

## Integrity note

The application must not claim a domain-adapted model is active when `SATQUERY_ADAPTER_URL` is unset or its health endpoint reports not ready. Generic VLM analysis is an application fallback, not proof of the mandatory remote-sensing adaptation requirement.
