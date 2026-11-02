# Public SIH26167 Benchmark Sources

This directory contains the pinned public **VRSBench evaluation repository** used for the single-image captioning, grounding, and VQA evaluation workflow required by SIH26167.

| Benchmark | Role in SATQUERY evidence | Source |
| --- | --- | --- |
| VRSBench | Captioning, visual grounding, visual question answering | `VRSBench/`, upstream commit `56e1ed1baabaaafef19b07fa937cfbdc1924e922` |
| RSVQA | Additional remote-sensing VQA testing | Download and run under its official project instructions |
| CDVQA | Bi-temporal change visual question answering | Download and run under the official dataset/project instructions |

The VRSBench source code is third-party research code. Retain its licence, citation, and original evaluator behavior. Benchmark datasets, model checkpoints, prediction files, and generated metric files must stay outside source control unless their licences explicitly allow distribution.

Do not present upstream baseline figures as SATQUERY AI results. SATQUERY results exist only after running the official evaluator with SATQUERY predictions on the stated held-out split.
