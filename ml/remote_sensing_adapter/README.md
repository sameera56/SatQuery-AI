# Remote-Sensing Domain Adaptation

SIH26167 requires at least one visual or vision-language component to be fine-tuned or otherwise adapted to remote-sensing data. This folder supplies a reproducible contrastive adaptation pipeline for a CLIP image-text encoder. Training writes both a checkpoint and a SHA-256 metadata sidecar with its manifest, seed, hyperparameters, and loss history.

## Data

Use BigEarthNet (the stated primary dataset) or another permitted open remote-sensing dataset. Create a CSV manifest outside Git with two columns:

```csv
image_path,caption
/absolute/path/to/tile_001.tif,"mixed agricultural land with forest patches"
```

For the Kaggle **BigEarthNet 14K** layout, create the RGB images and manifests
in a writable directory with:

```bash
python ml/remote_sensing_adapter/prepare_bigearthnet14k.py --data-root /path/to/BEN_14k --output data/bigearthnet_prepared
```

## Train

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r ml/remote_sensing_adapter/requirements.txt
python ml/remote_sensing_adapter/train.py --manifest data/bigearthnet_manifest.csv --image-root data --epochs 3 --dataset-version "BigEarthNet 14K" --dataset-license "BigEarthNet terms" --training-split train
```

The command produces `checkpoints/bigearthnet-clip-adapter.pt`. Keep checkpoints and datasets out of source control. Record the dataset version, split, metrics, hardware, and checkpoint hash in the final SIH report.

## Serve the adapted model

After training, copy the checkpoint to `models/bigearthnet-clip-adapter.pt` and start the SATQUERY stack:

```bash
docker compose up --build
```

The `osiris-satquery-adapter` service loads that checkpoint and exposes `/health`, `/analyze`, and `/validate-raster` on the internal Docker network. SATQUERY sends the selected image or pair to this service, records semantic evidence, and includes it in the auditable result. For a bi-temporal pair the service also returns a coarse **adapter-semantic change heatmap** based on grid-cell embedding difference. It is visual decision-support only: it is not a pixel-accurate segmentation mask and cannot be used to calculate changed area.

For paired GeoTIFF inputs, `/validate-raster` checks declared CRS, bounds, dimensions, resolution, bands, selected source tags, and optical–SAR warnings. The service uses `rasterio`, so this validation becomes available after the Docker adapter is rebuilt. A failing CRS check blocks paired analysis; a bounds/grid mismatch remains an explicit warning for operator review.

If the checkpoint is absent, the service remains explicitly **not ready** and the UI/API must not claim a remote-sensing-adapted model was used.

For local development without Docker:

```bash
SATQUERY_ADAPTER_CHECKPOINT=checkpoints/bigearthnet-clip-adapter.pt uvicorn server:app --host 127.0.0.1 --port 8100
```

Set `SATQUERY_ADAPTER_URL=http://127.0.0.1:8100` for the Next.js server.

## Record evaluation evidence

Use a held-out manifest—not the training manifest—to create a reproducible adapter result file:

```bash
python ml/remote_sensing_adapter/evaluate.py --manifest data/bigearthnet_test.csv --image-root data --checkpoint checkpoints/bigearthnet-clip-adapter.pt --split test
```

This writes `runs/adapter-evaluation.json` with image-to-text retrieval Recall@1 and Recall@5. For SIH submission, also run the prescribed task-specific VRSBench, RSVQA, and CDVQA evaluators and include their metrics, dataset splits, and representative outputs in the PPT/report.

## Run benchmark reports

`benchmark_runner.py` evaluates held-out prediction files and records the input hashes and prediction coverage. It refuses a split named `train`; every result must be matched to the official held-out annotations by `id`, `question_id`, `sample_id`, `qid`, or `image_id`.

```bash
python ml/remote_sensing_adapter/benchmark_runner.py --benchmark vrsbench --task vqa --split test --references data/vrsbench/test_vqa.json --predictions runs/vrsbench-vqa-predictions.json --output runs/vrsbench-vqa-report.json
python ml/remote_sensing_adapter/benchmark_runner.py --benchmark vrsbench --task grounding --split test --references data/vrsbench/test_grounding.json --predictions runs/vrsbench-grounding-predictions.json --output runs/vrsbench-grounding-report.json
python ml/remote_sensing_adapter/benchmark_runner.py --benchmark rsvqa --task vqa --split test --references data/rsvqa/test.json --predictions runs/rsvqa-predictions.json --output runs/rsvqa-report.json
python ml/remote_sensing_adapter/benchmark_runner.py --benchmark cdvqa --task vqa --split test --references data/cdvqa/test.json --predictions runs/cdvqa-predictions.json --output runs/cdvqa-report.json
```

The runner supports VRSBench normalized boxes as `xywh`. For VRSBench captioning, use the pinned upstream evaluator for final BLEU/METEOR/ROUGE/CIDEr/CLAIR reporting; this runner's caption task is only a local smoke test and must not be labelled as an official VRSBench score.

## Verify final SIH evidence

After collecting the checkpoint, held-out adapter evaluation, and benchmark
reports, run `verify_sih_evidence.py`. It writes one JSON readiness record and
refuses to treat missing artifacts as completed evidence.

## Evaluation plan

- Use VRSBench and RSVQA prescribed splits for captioning/VQA/grounding checks.
- Use CDVQA for bi-temporal change-question evaluation.
- Keep the ISRO/SAC evaluation data unseen; it is for final evaluation only.

This training code is intentionally separate from the web demo. Do not claim a remote-sensing-adapted model is deployed until a checkpoint has been trained, evaluated, and connected to an inference service.
