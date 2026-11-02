# SATQUERY AI — Jury Q&A

The in-app version of this guide is available at `/satquery/project-guide`.

## One-minute introduction

SATQUERY AI is an agentic vision-language assistant for remote-sensing images.
A user uploads an optical, SAR, optical–SAR, or before/after image pair and
asks a question in natural language. The controller validates the inputs,
selects a constrained workflow, and returns evidence overlays, confidence,
limitations, and an auditable execution trace.

## Why is it different?

Instead of using one generic VLM answer for every task, SATQUERY routes the
query by its intent and input configuration: VQA/grounding for a single image,
change understanding for a bi-temporal pair, and complementary extraction for
an optical–SAR pair. It makes the selected tools and checks visible.

## What happens after a query?

1. Browser: validates the image, creates a preview, and optimizes normal display rasters.
2. API: decodes TIFF/GeoTIFF when needed, records metadata, and creates the deterministic execution plan.
3. Validator: paired imagery requires a second image and emits co-registration/sensor warnings; a connected adapter also checks GeoTIFF CRS, bounds, resolution, bands, and tags.
4. Visual stage: an evidence-constrained structured multimodal response is generated; a trained adapter, when configured, contributes semantic retrieval evidence and a coarse change heatmap.
5. UI: renders labelled evidence, confidence, limitations, model/tool trace, and report export.

## NLP and multilingual support

The system uses transparent intent cues for routing, structured-output prompt
engineering, multimodal visual-language inference, image-specific question
suggestions, microphone input, speech output, and 11 result-language options:
English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Malayalam, Kannada,
Punjabi, and Urdu.

## Dataset roles

| Dataset | Purpose | Key handling rule |
| --- | --- | --- |
| BigEarthNet.txt | Remote-sensing image-text adaptation | Use documented, non-overlapping train and held-out manifests. |
| VRSBench | Captioning, grounding, VQA | Use the official test split; report task-specific metrics. |
| RSVQA | Single-image remote-sensing VQA | Use official split and question-type accuracy when available. |
| CDVQA | Bi-temporal change VQA | Preserve date order; do not train on the test split. |
| ISRO/SAC | Final hidden evaluation | Keep completely unseen. |

## Honest readiness statement

The GUI, routing, input/pair validation, VQA, grounding, bi-temporal, and
optical–SAR workflows are implemented. The mandatory remaining evidence is a
trained/connected BigEarthNet adapter and official held-out VRSBench, RSVQA,
and CDVQA reports. Do not claim those results before producing the artifacts.
