# Multimodal AI Consensus System (MAICS) for Brain Tumor Classification

[![MICAD 2026 Accepted](https://img.shields.io/badge/MICAD%202026-Accepted%20(Paper%20ID%20664)-success.svg)](https://www.micad.org)
[![Python 3.10](https://img.shields.io/badge/Python-3.10-blue.svg)](https://www.python.org/)
[![Framework](https://img.shields.io/badge/Framework-FastAPI%20%7C%20PyTorch%20%7C%20TensorFlow-orange.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Official repository for **"Multimodal AI Consensus System (MAICS) with Risk-Calibrated Decision Support and Spatial Localization for Brain Tumor Classification"**, accepted at the 7th International Conference on Medical Imaging and Computer-Aided Diagnosis (**MICAD 2026**), Edinburgh, UK.

---

## 📌 Executive Summary & Key Results

MAICS addresses three major bottlenecks in CAD systems for brain tumor classification: severe scanner domain shifts, high false-negative rates in malignant lesions, and opaque black-box predictions.

- **Patient-Level Split Benchmark:** Evaluated on an independent, patient-split test set of **3,461 images** (including **1,861 real-world clinical scans** from Tam Tri Danang Hospital).
- **Diagnostic Performance:** Achieved **91.01% Accuracy** and **92.04% Macro F1**.
- **Clinical Safety:** Suppressed the **Fatal False Negative Rate** (Glioma $\rightarrow$ No-Tumor misclassification) to **0.43%** (90.31% Glioma recall) — a **49.4% relative risk reduction** compared to Tier 1 alone.
- **Statistical Significance:** McNemar's test confirmed statistically significant superiority over baseline CNN ensembles ($p = 0.000009$).
- **Privacy & Cost Efficiency:** Anatomical Privacy Guard pre-filters non-axial planes, reducing cloud VLM API calls by **79.5%** (from 12.14% to 2.48% of scans) while suppressing hallucination-induced errors.

---

## 🏗️ Three-Tier Arbitration Architecture

```
                       [ Input MRI Scan (224x224) ]
                                    │
                                    ├───► [ Preprocessing: Otsu Crop + CLAHE + Denoise ]
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌─────────────────────────────┐           ┌──────────────────────────────────┐
│ Tier 1: Bayesian CNN        │           │ Tier 2: YOLOv8 Spatial          │
│ Soft-Voting Ensemble        │           │ Localization                     │
│ (ResNet50 + Risk Loss,      │           │ (Bounding Box Detection          │
│  EfficientNetV2,            │           │  & ROI Crop Extraction)          │
│  DenseNet121 + BayTTA)      │           │                                  │
└──────────────┬──────────────┘           └─────────────────┬────────────────┘
               │ Class P_v, Conf c1                         │ Class c_YOLO
               └──────────────────┬─────────────────────────┘
                                  ▼
                     [ Diagnostic Conflict? ]
                     (c_BayTTA ≠ c_YOLO OR c1 < 0.80)
                                  │
                       ┌──────────┴──────────┐
                       │ YES                 │ NO ──► Output Tier 1 Class
                       ▼                     
         ┌──────────────────────────┐
         │ Anatomical Privacy Guard │
         │ (Axial Plane Filter)     │
         └─────────────┬────────────┘
                       │
             ┌─────────┴─────────┐
             │ Confirmed Axial?  │
             ├─── YES ──► [ Tier 3: Gemini 3.1 Flash-Lite VLM Arbitration ]
             │            (ROI Crop + Anatomical CoT Rules + Guard-1/2 Gating)
             │
             └─── NO  ──► Fallback to Tier 1 Class (Cloud Transmission Blocked)
```

---

## 📊 Experimental Benchmark Comparison

| System Configuration | Accuracy | Macro F1 | Glioma Recall | Fatal FNR | VLM API Call % | Safety Guardrails |
|---|---|---|---|---|---|---|
| **MAICS (Guard-ON)** | **91.01%** | **92.04%** | **90.31%** | **0.43%** | **2.48%** | **Active (Guard-1/2)** |
| MAICS (Guard-OFF) | 91.07% | 91.96% | 90.05% | 0.68% | 12.14% | Disabled |
| Tier 1 Ensemble (CNN) | 89.92% | 90.96% | 84.75% | 0.85% | 0.00% | N/A |
| ViT-Tiny (Baseline) | 67.44% | 65.10% | 45.30% | 3.12% | 0.00% | Overfitting |
| Custom CNN (Scratch) | 25.25% | 21.05% | 12.50% | 8.40% | 0.00% | Overfitting |

---

## 📂 Repository Structure

```
MRIteam/
├── main.py                          # FastAPI Application Server (Tier 1-3 Pipeline)
├── localization.py                  # Tier 2 YOLOv8 ROI & Anatomical Privacy Guard
├── gemini_rotator.py                # Tier 3 Gemini 3.1 Flash-Lite Multi-Key Proxy
├── preprocess.py                    # Otsu Crop, CLAHE, Gaussian Denoising
├── train_resnet_risk_loss.py        # Cost-Sensitive ResNet50 Training
├── train_efficientnet.py            # EfficientNetV2 Training
├── train_densenet.py                # DenseNet121 Training
├── train_yolo.py                    # YOLOv8m Fine-tuning
├── benchmark_with_guard.py          # Benchmark Execution Script (Guard-ON)
├── benchmark_no_guard.py            # Benchmark Execution Script (Guard-OFF)
├── benchmark_guard_ON_results.json  # Guard-ON Experimental Results (Raw Data)
├── benchmark_guard_ON_detail.csv    # Per-Image Model Predictions (Guard-ON)
├── benchmark_guard_OFF_results.json # Guard-OFF Experimental Results (Raw Data)
├── benchmark_guard_OFF_detail.csv   # Per-Image Model Predictions (Guard-OFF)
├── plane_manifest.json              # Privacy Guard Plane Classification Manifest
├── plane_audit_log.csv              # Plane Audit Verification Log
├── combined_data.yaml               # YOLO Dataset Configuration
├── tumor_data.yaml                  # YOLO Classes Configuration
├── frontend/                        # Web Dashboard Demo for Clinicians
├── scratch/                         # Research Analysis & Plotting Tools
│   ├── mcnemar_test.py              # McNemar Statistical Significance Test
│   ├── draw_confusion_matrices.py   # Confusion Matrix Generator
│   ├── draw_fig4_case_study.py      # Multimodal CoT Interpretability Diagram
│   └── analyze_guard_effect.py      # Privacy Guard API Reduction Analysis
├── .gitignore                       # Git exclusion rules for large datasets/weights
└── README.md                        # Documentation
```

---

## 💻 Quick Start & Reproducibility

### 1. Prerequisites
- Python 3.10+
- CUDA-compatible GPU (e.g., RTX 3050 / GTX 1660 or higher)

### 2. Environment Setup
```bash
git clone https://github.com/huylegiatranGB-cmd/MRI_MAICS.git
cd MRI_MAICS

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. API Key Configuration
Create a `.env` file in the root directory (refer to `.env.example`):
```env
GEMINI_API_KEYS=YOUR_API_KEY_1,YOUR_API_KEY_2,...
```

### 4. Running Benchmarks
To reproduce the full patient-level benchmark (3,461 scans):
```bash
# Run MAICS with Anatomical Privacy Guard (Guard-ON)
python benchmark_with_guard.py

# Run Ablation Baseline (Guard-OFF)
python benchmark_no_guard.py

# Run McNemar Statistical Significance Test
python scratch/mcnemar_test.py
```

### 5. Launch Web API / UI
```bash
uvicorn main:app --reload --port 8000
```

---

## 📜 Citation

If you find this work useful in your research, please cite our MICAD 2026 paper:

```bibtex
@inproceedings{huy2026maics,
  title     = {Multimodal AI Consensus System (MAICS) with Risk-Calibrated Decision Support and Spatial Localization for Brain Tumor Classification},
  author    = {Le Tran Gia Huy},
  booktitle = {Proceedings of the 7th International Conference on Medical Imaging and Computer-Aided Diagnosis (MICAD 2026)},
  series    = {Lecture Notes in Electrical Engineering},
  publisher = {Springer},
  year      = {2026}
}
```

---

## ✉️ Contact & License

- **Author:** Le Tran Gia Huy (FPT University Danang)
- **Email:** huylegiatran22@gmail.com
- **License:** Distributed under the MIT License.
