# SIH26167 Cloud GPU Runbook

Use the accompanying `SIH26167_Colab_Kaggle.ipynb` on Google Colab or Kaggle with a GPU. It trains the project’s BigEarthNet image-text adapter and writes evidence artifacts for the SIH presentation.

## Before opening the notebook

1. Obtain BigEarthNet.txt / BigEarthNet data under its licence. Do not use ISRO/SAC evaluation data for training.
2. Prepare two non-overlapping CSV files with the following columns:

```csv
image_path,caption,sample_id,split
images/tile_0001_rgb.png,"mixed agricultural land with forest patches",tile_0001,train
```

`image_path` can be relative to the dataset root. Use RGB visual composites for the current CLIP adapter; preserve the original Sentinel-1/Sentinel-2 files and pairing metadata separately for the optical–SAR workflow.

3. Keep a held-out test manifest. Do not reuse its rows in training.
4. In Colab, place the project and dataset in Google Drive; in Kaggle, add the dataset as a private input dataset. Note its exact input path (normally `/kaggle/input/<dataset-slug>`).

## Kaggle setup

1. In the notebook editor, select **Settings** and set **Accelerator** to **GPU T4 x2** (or another GPU option).
2. Enable **Internet** if using the notebook's GitHub clone step. If Internet must remain disabled, upload this repository as a Kaggle Dataset and change `REPO_DIR` in the first cell to its `/kaggle/input/...` path; do not write model outputs there.
3. Replace `your-private-bigearthnet` in the dataset cell with the exact slug of your attached input dataset, then run the notebook from the first cell. Inputs under `/kaggle/input` are read-only; checkpoints and reports are correctly written to `/kaggle/working/osiris`.

### Raw BigEarthNet 14K input

The common Kaggle 14K download provides `metadata.parquet` plus nested
multi-band TIFFs, rather than ready-made CSV manifests. Prepare it before
training (adjust `DATA_ROOT` to the path discovered in the Kaggle Input tab):

```bash
python ml/remote_sensing_adapter/prepare_bigearthnet14k.py --data-root "$DATA_ROOT" --output /kaggle/working/bigearthnet_prepared --train-limit 3000 --test-limit 500
```

Use `/kaggle/working/bigearthnet_prepared/manifests/train.csv` and
`/kaggle/working/bigearthnet_prepared/manifests/test.csv` for preflight,
training, and held-out evaluation. The script preserves the source split,
excludes snow/cloud-marked samples, and never writes to `/kaggle/input`.

## Artifacts to retain for SIH

- `runs/dataset-preflight.json` — split and leakage checks
- `checkpoints/bigearthnet-clip-adapter.pt` — trained checkpoint
- `runs/adapter-evaluation.json` — held-out retrieval metrics
- VRSBench / RSVQA / CDVQA task-specific reports and sample outputs
- dataset version, licence, split definition, GPU, package versions, random seed, date, and checkpoint hash

## Important limitation

The adapter evaluation measures held-out image-text retrieval. It does **not** replace the VRSBench captioning/VQA/grounding or CDVQA change-VQA benchmark evaluators. Report each metric under its actual task name.
