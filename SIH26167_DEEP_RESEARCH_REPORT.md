# SIH26167 Competition Readiness Report

## Executive assessment

SATQUERY AI has a strong interactive demonstration layer: natural-language image analysis, single-image optical/SAR modes, paired bi-temporal and optical–SAR modes, visual evidence, confidence/limitations, an execution trace, download reports, and GeoTIFF/TIFF acceptance. The project is therefore well positioned for a persuasive product demonstration.

The main competition risk is evidentiary, not interface design. SIH26167 explicitly requires a remote-sensing-adapted visual or vision-language component, specialist processing for the stated task modes, and evaluation on prescribed public benchmark splits plus an undisclosed ISRO/SAC dataset. A general VLM invoked through an API cannot be presented as satisfying the adaptation requirement unless an adapted model is trained, deployed, and its use is visible in the execution trace.^1

## 1. Problem statement requirements

The published SIH26167 statement defines SATQUERY AI as an agentic vision-language assistant for single and paired remote-sensing images queried in natural language. It requires the following observable capabilities.^1

| Requirement | What judges need to see | SATQUERY status | Evidence needed before final judging |
| --- | --- | --- | --- |
| Supported input scope | Optical/multispectral or SAR single images; optical–SAR and bi-temporal pairs; GeoTIFF/TIFF or allowed benchmark raster formats | Implemented | Screen recording and test assets |
| Single-image VQA | Question answered from one image | Implemented | RSVQA/VRSBench result and demo |
| Captioning or grounding | Scene description or query-guided region output | Implemented as grounding | VRSBench grounding result and demo |
| Bi-temporal understanding | Description/VQA of change between co-registered dates | Implemented in interface | CDVQA result and demo |
| Optical–SAR joint analysis | Complementary information derived from a co-registered sensor pair | Implemented in interface | BigEarthNet.txt pair demonstration and evaluation evidence |
| Agentic orchestration | Input checks, task/tool selection, permitted parameters, observable trace | Implemented | Execution trace in screen recording |
| Evidence, confidence, reports | Visual evidence, confidence/limitations, downloadable report | Implemented | Downloaded report sample |
| Domain adaptation | Fine-tuned or otherwise adapted RS visual/VL component | Pipeline only; no trained checkpoint connected | Checkpoint, hash, health response, run metadata |
| Public benchmarks | Prescribed public test-split evaluation | Not yet run | Metric files and exact evaluator commands |

## 2. Dataset and benchmark roles

### BigEarthNet.txt: training and multisensor adaptation

BigEarthNet.txt is the most strategically aligned training source because it contains 464,044 co-registered Sentinel-1 SAR and Sentinel-2 multispectral images and roughly 9.6 million S1–S2–text triplets. Its annotation types include captions, VQA, and referring-expression detection, which map directly to SIH26167’s single-image, cross-modal, and grounding goals.^2

The full BigEarthNet v2 assets are large: the official site lists approximately 59 GiB for Sentinel-2 and 51 GiB for Sentinel-1. Train on cloud GPU storage, not the current local computer, which does not have enough spare headroom for complete data, intermediates, checkpoints, and evaluation artifacts.^3

Recommended adaptation strategy:

1. Start with the project’s CLIP adapter on a documented, geographically split subset of BigEarthNet.txt.
2. Use text captions/instructions for image-text contrastive adaptation.
3. Preserve the S1/S2 pair identity and keep modality-specific preprocessing explicit.
4. Train a small reproducible baseline first, then expand only after preflight and held-out metrics are valid.
5. Connect the checkpoint to `SATQUERY_ADAPTER_URL`; the UI must show adapter readiness and model/checkpoint identity.

This baseline is useful and defensible, but a CLIP retrieval adapter by itself does not automatically deliver high-quality generative VQA or change VQA. For final competition strength, pair it with specialist task models or task-specific fine-tuning, and let the controller report exactly which component was used.

### VRSBench: single-image captioning, grounding, and VQA

VRSBench contains 29,614 remote-sensing images, 52,472 referring expressions, and 123,221 VQA pairs. It was designed for captioning, visual grounding, and VQA evaluation; its repository supplies preparation and evaluation materials.^4

Use VRSBench only through its prescribed test split. Report task-specific results rather than an invented combined score:

- Captioning: BLEU, METEOR, ROUGE-L, CIDEr and/or the benchmark’s supplied semantic metric.
- Grounding: Acc@IoU 0.5 and Acc@IoU 0.7, including any benchmark-specific unique/non-unique split.
- VQA: exact/open-answer metric following the supplied evaluator.

The VRSBench evaluation repository has been added locally at `ml/benchmarks/VRSBench`, pinned at source commit `56e1ed1baabaaafef19b07fa937cfbdc1924e922`. Preserve its licence and citations; do not rewrite its claimed metrics as SATQUERY metrics.

### RSVQA: remote-sensing VQA evaluation

RSVQA is a dedicated remote-sensing visual-question-answering benchmark, with low- and high-resolution variants. It supports the mandatory single-image VQA proof point and is named by SIH26167 alongside VRSBench.^5

Use its official split and evaluator. Report accuracy by question type when available, not merely a cherry-picked demo. Keep the imagery source and spatial-resolution setting in the report.

### CDVQA: multitemporal change VQA evaluation

CDVQA was introduced specifically for change-detection-based visual question answering over multi-temporal aerial imagery. It supplies image–question–answer triplets and is the appropriate public benchmark for proving your bi-temporal workflow.^6

For SATQUERY, the critical demonstration is not only an answer but an answer that is correctly conditional on co-registration and date order. Keep T1/T2 ordering, source image IDs, and question/answer outputs in the evaluation artifact. Do not train on the CDVQA test split.

## 3. Architecture judges should understand

```
Operator question + input images
        │
        ▼
Input validator ── format, raster dimensions, pair aspect ratio,
                   modality declaration, date / co-registration warnings
        │
        ▼
Agent controller ── query intent + input configuration → permitted workflow
        │
        ├── Single image → RS VQA / captioning / grounding specialist
        ├── Bi-temporal pair → registration check + change model + change VQA
        └── Optical–SAR pair → sensor-specific preprocessing + fusion model
        │
        ▼
Evidence and reporting ── answer, confidence calibration, evidence regions,
                          limitations, model/version/parameters, export
```

The important discipline is separation of roles. The controller routes and records the workflow; specialist models generate measurable visual outputs; the language component turns only those outputs into a readable explanation. This avoids allowing an LLM to invent geospatial measurements, acquisition metadata, or change claims.

## 4. Recommended implementation sequence

### Phase A — reproducible adaptation baseline (highest priority)

1. Use [the project cloud notebook](ml/remote_sensing_adapter/SIH26167_Colab_Kaggle.ipynb) with a GPU runtime.
2. Build train and held-out manifests from licensed BigEarthNet.txt assets, preserving split IDs.
3. Run `preflight.py`; retain `runs/dataset-preflight.json` showing no overlap.
4. Train the adapter and save the checkpoint plus SHA-256 hash.
5. Run held-out adapter evaluation and retain `runs/adapter-evaluation.json`.
6. Deploy the checkpoint to the adapter service and demonstrate that the dashboard health response reports it as ready.

### Phase B — task-specific public benchmark evidence

1. Download VRSBench, RSVQA and CDVQA under their own licences.
2. Freeze model/configuration/version before test evaluation.
3. Implement output adapters for each evaluator rather than modifying test labels.
4. Run each official test split once, retaining raw predictions, evaluator command, package versions, GPU hardware, random seed, and metrics JSON.
5. Make a compact comparison table for the PPT. Do not compare different benchmark metrics as if they are directly interchangeable.

### Phase C — close the technical gaps in the current demo

| Gap | Recommended improvement | Judge-facing outcome |
| --- | --- | --- |
| Pair compatibility is currently image-shape based | Read GeoTIFF CRS, transform, bounds, band/polarization, resolution and acquisition timestamps; require an explicit warning/fail state where unavailable | Demonstrably safe bi-temporal/cross-modal analysis |
| No spatial change mask is produced | Add a change-segmentation model and overlay/mask export; calculate area only from validated georeferencing | “Where and how much changed” evidence |
| Confidence is language-model generated | Calibrate per specialist model; separately expose model confidence, pair alignment confidence and out-of-distribution warning | Honest confidence semantics |
| Optical–SAR is handled as generic image pair | Apply modality-specific preprocessing and fusion; state SAR polarization/incidence limitations | Real complementary multisensor claim |
| Biometric local unlock | Keep as a privacy-preserving optional demo; do not make it central to SIH26167 scoring | Security enhancement without distracting from the RS objective |
| Predictive-risk dashboard | Present as an optional operational layer, not as satellite-image prediction capability | Avoid scope confusion |

## 5. Final demonstration script

1. Upload an optical image and ask a VQA question. Show evidence regions, caveat, and execution trace.
2. Ask a grounding request such as “Highlight the water body.” Show labelled bounding/region evidence.
3. Upload a co-registered before/after pair. Ask “What changed and where?” Show pair checks, change output, and limitations.
4. Upload an optical/SAR pair. Ask “Use both sensors to identify water-covered and built-up regions.” Explain why SAR is useful under clouds/night and why brightness is not proof by itself.
5. Open the execution trace and downloaded report. Point to model identity, checkpoint version, parameters, source files and timestamps.
6. Present the benchmark table and state the test splits are held out. Do not claim knowledge of the undisclosed ISRO/SAC labels.

## 6. Claims to use and claims to avoid

Use:

- “SATQUERY routes a natural-language request to a constrained, auditable remote-sensing workflow.”
- “The system reports evidence, input checks, model/version traceability, and limitations.”
- “Our adapted component is trained on the documented BigEarthNet.txt split and evaluated separately on held-out/public benchmark splits.” Only say this after the run artifacts exist.
- “The platform supports decision support; it does not replace authoritative disaster or emergency instructions.”

Avoid:

- “The system predicts every future disaster.”
- “SAR brightness proves a land-cover class.”
- “The model is ISRO validated” before ISRO/SAC evaluation.
- “We achieved benchmark accuracy” without saved official evaluator output.
- “Generic Gemini analysis is remote-sensing fine-tuning.”

## 7. Final evidence checklist

- [ ] Dataset licence and version recorded
- [ ] Train/validation/test split IDs recorded, no leakage report retained
- [ ] Checkpoint file, SHA-256, base model, hyperparameters, seed and hardware recorded
- [ ] Adapter service running and health endpoint shows exact checkpoint
- [ ] VRSBench captioning, grounding and VQA prediction/metric files
- [ ] RSVQA prediction/metric files
- [ ] CDVQA prediction/metric files
- [ ] Three screen recordings: VQA/grounding, change VQA, optical–SAR fusion
- [ ] Example exported report with traceability
- [ ] Known limitations slide
- [ ] No ISRO/SAC test labels used during training or tuning

## Sources

1. SIH 2026 Problem Statements. “[SIH26167 — SatQuery AI: An Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis through Text Queries](https://sih2026.vuce.in/ps/SIH26167).” Accessed September 13, 2026. Community-maintained publication of the problem statement; verify against the SIH portal when available.
2. Herzog, J.-L. et al. “[BigEarthNet.txt: A Large-Scale Multi-Sensor Image-Text Dataset and Benchmark for Earth Observation](https://txt.bigearth.net/).” 2026.
3. BigEarthNet. “[A Large-Scale Sentinel Benchmark Archive](https://bigearth.net/).” Accessed September 13, 2026.
4. Li, X., Ding, J., and Elhoseiny, M. “[VRSBench: A Versatile Vision-Language Benchmark Dataset for Remote Sensing Image Understanding](https://github.com/lx709/VRSBench).” NeurIPS Datasets and Benchmarks, 2024.
5. Lobry, S. et al. “[RSVQA: Visual Question Answering for Remote Sensing Data](https://rsvqa.sylvainlobry.com/).” IEEE TGRS, 2020.
6. Yuan, Y. et al. “[Change Detection Meets Visual Question Answering](https://ieeexplore.ieee.org/document/9901476/).” IEEE Transactions on Geoscience and Remote Sensing, 2022.
