"""
source_stratified_eval.py
=========================
Component 1a + 1b: 
  - Phan tích kết quả THEO NGUỒN (Kaggle vs Tam Tri)
  - Domain Confusion Probe (logistic regression tren CNN features)

Contingency Plan A dang ap dụng:
  - Tam Tri KHÔNG có no-tumor data
  - Kaggle la nguồn duy nhất cho notumor class
  - Chỉ số no-tumor recall duoc flag ro rang trong output

Outputs:
  - source_stratified_results.json
  - source_stratified_table.tex  (sẵn sang chen vao LaTeX)
  - domain_probe_results.json
"""

import os, re, json, sys
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.metrics import (
    accuracy_score, f1_score, recall_score,
    classification_report, confusion_matrix, roc_auc_score
)
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import label_binarize
from sklearn.model_selection import StratifiedKFold

# -- Cấu hình ---------------------------------------------------------------
DETAIL_CSV     = "benchmark_guard_ON_detail.csv"
CATEGORIES     = ['glioma', 'meningioma', 'notumor', 'pituitary']
MODEL_PATH     = "models/resnet_risk_calibrated.keras"
OUTPUT_JSON    = "source_stratified_results.json"
OUTPUT_TEX     = "source_stratified_table.tex"
PROBE_JSON     = "domain_probe_results.json"
RUN_DOMAIN_PROBE = True  # Đặt False nếu khong muốn load model

# -- Phan loại nguồn --------------------------------------------------------
def classify_source(img_path: str) -> str:
    """Phan loại ảnh thuộc Kaggle hay Tam Tri từ ten file."""
    fname = Path(img_path).name  # Chỉ lấy filename, bỏ path
    if re.search(r'_TT_', fname):
        return "tamtri"
    elif re.match(r'^(Te-|Tr-|Te_aug|v2_)', fname):
        return "kaggle"
    else:
        return "unknown"

# -- Load CSV ----------------------------------------------------------------
print("Loading benchmark detail CSV...")
df = pd.read_csv(DETAIL_CSV)
df["source"] = df["img"].apply(classify_source)

print(f"\nTotal rows: {len(df)}")
print(df.groupby(["source", "true"])["img"].count().to_string())

# Verify no unknown
unknown = df[df["source"] == "unknown"]
if len(unknown) > 0:
    print(f"\nWARNING: {len(unknown)} images with unknown source:")
    print(unknown["img"].head(10).to_string())

# -- Stratified metrics per source ------------------------------------------
def compute_metrics(sub_df, label=""):
    """Tính metrics cho một subset DataFrame."""
    if len(sub_df) == 0:
        return {}
    y_true = sub_df["true"].tolist()
    y_pred = sub_df["final"].tolist()
    present_classes = sorted(set(y_true))
    
    report = classification_report(y_true, y_pred, labels=present_classes,
                                   output_dict=True, zero_division=0)
    acc = accuracy_score(y_true, y_pred)
    f1  = f1_score(y_true, y_pred, average="macro", zero_division=0)
    
    # Fatal FNR: glioma predicted as notumor
    glioma_rows = sub_df[sub_df["true"] == "glioma"]
    fatal_fn    = (glioma_rows["final"] == "notumor").sum()
    fatal_fnr   = fatal_fn / len(glioma_rows) if len(glioma_rows) > 0 else None
    
    per_class = {}
    for cls in CATEGORIES:
        if cls in report:
            per_class[cls] = {
                "precision": round(report[cls]["precision"] * 100, 2),
                "recall":    round(report[cls]["recall"]    * 100, 2),
                "f1":        round(report[cls]["f1-score"]  * 100, 2),
                "support":   int(report[cls]["support"]),
            }
        else:
            per_class[cls] = {"precision": None, "recall": None,
                              "f1": None, "support": 0,
                              "note": "Class not present in this subset"}
    return {
        "n_images":   len(sub_df),
        "accuracy":   round(acc * 100, 2),
        "f1_macro":   round(f1  * 100, 2),
        "fatal_fnr_glioma_as_notumor": round(fatal_fnr * 100, 2) if fatal_fnr is not None else None,
        "per_class":  per_class,
    }

print("\n--- Computing source-stratified metrics ---")
kaggle_df  = df[df["source"] == "kaggle"]
tamtri_df  = df[df["source"] == "tamtri"]
overall_df = df[df["source"] != "unknown"]

results = {
    "contingency_plan_a": {
        "active": True,
        "reason": "Tam Tri hospital dataset contains no no-tumor (healthy) cases. "
                  "All no-tumor test images (N=400) originate from the Kaggle public benchmark. "
                  "No-tumor recall and Fatal FNR metrics CANNOT be interpreted as "
                  "hospital-validated negative controls.",
    },
    "overall":  compute_metrics(overall_df, "Overall"),
    "kaggle":   compute_metrics(kaggle_df,  "Kaggle"),
    "tamtri":   compute_metrics(tamtri_df,  "Tam Tri"),
    "source_counts": {
        "kaggle":  int(len(kaggle_df)),
        "tamtri":  int(len(tamtri_df)),
        "unknown": int(len(unknown)),
    },
}

# Tam Tri subset (tumor only -- fair comparison)
tamtri_tumor_df = tamtri_df[tamtri_df["true"] != "notumor"]
kaggle_tumor_df = kaggle_df[kaggle_df["true"] != "notumor"]
results["tamtri_tumor_only"] = compute_metrics(tamtri_tumor_df, "Tam Tri (tumor only)")
results["kaggle_tumor_only"] = compute_metrics(kaggle_tumor_df, "Kaggle (tumor only)")

# In kết quả
print(f"\n=== SOURCE-STRATIFIED RESULTS ===")
for src in ["overall", "kaggle", "tamtri", "tamtri_tumor_only"]:
    m = results[src]
    print(f"\n[{src.upper()}] N={m['n_images']}")
    print(f"  Accuracy: {m['accuracy']}%  |  F1-Macro: {m['f1_macro']}%")
    if m.get('fatal_fnr_glioma_as_notumor') is not None:
        print(f"  Fatal FNR (Glioma->NoTumor): {m['fatal_fnr_glioma_as_notumor']}%")
    for cls in CATEGORIES:
        pc = m["per_class"].get(cls, {})
        if pc.get("support", 0) > 0:
            print(f"  {cls:12s}: Recall={pc.get('recall','N/A')}%  "
                  f"Prec={pc.get('precision','N/A')}%  "
                  f"N={pc.get('support',0)}")
        else:
            print(f"  {cls:12s}: N/A (not present in this subset)")

# -- Domain Confusion Probe -------------------------------------------------
if RUN_DOMAIN_PROBE:
    print("\n--- Domain Confusion Probe ---")
    try:
        import tensorflow as tf
        print("Loading ResNet50 model for feature extraction...")
        try:
            tf.keras.config.enable_unsafe_deserialization()
        except AttributeError:
            pass

        full_model = tf.keras.models.load_model(
            MODEL_PATH, safe_mode=False, compile=False)

        # Feature extractor: penultimate layer (before softmax)
        feature_model = tf.keras.Model(
            inputs=full_model.input,
            outputs=full_model.layers[-2].output)

        from preprocess import medical_preprocessing_v2
        from tensorflow.keras.applications.resnet_v2 import preprocess_input as res_prep

        # Only tumor classes for fair comparison (no notumor)
        probe_df = df[(df["source"].isin(["kaggle", "tamtri"])) &
                      (df["true"] != "notumor")].copy().reset_index(drop=True)
        probe_df["domain_label"] = (probe_df["source"] == "tamtri").astype(int)

        print(f"  Probe dataset: {len(probe_df)} images "
              f"(Kaggle tumor={len(probe_df[probe_df['domain_label']==0])}, "
              f"TamTri={len(probe_df[probe_df['domain_label']==1])})")

        # ── Batch feature extraction ──────────────────────────────────────
        BATCH_SIZE = 32
        IMG_SIZE   = (224, 224)

        def load_and_preprocess(img_path):
            arr = medical_preprocessing_v2(img_path)
            if arr is None:
                return np.zeros((*IMG_SIZE, 3), dtype=np.float32)
            return arr.astype(np.float32)

        print(f"  Extracting features in batches of {BATCH_SIZE} (CPU mode)...")

        features_list, labels_list = [], []
        n = len(probe_df)
        for start in range(0, n, BATCH_SIZE):
            batch_rows = probe_df.iloc[start:start + BATCH_SIZE]
            batch_imgs = np.stack([load_and_preprocess(r["img"])
                                   for _, r in batch_rows.iterrows()], axis=0)
            batch_prep = res_prep(batch_imgs.copy())
            batch_feat = feature_model.predict(batch_prep, verbose=0)
            features_list.append(batch_feat)
            labels_list.extend(batch_rows["domain_label"].tolist())
            pct = min(start + BATCH_SIZE, n)
            print(f"    {pct}/{n} images processed...", end="\r", flush=True)

        print()  # newline after \r
        features = np.vstack(features_list)
        labels   = np.array(labels_list)
        print(f"  Extracted features: {features.shape}")

        # 5-fold CV logistic regression
        skf   = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        aucs  = []
        for fold, (tr_idx, val_idx) in enumerate(skf.split(features, labels)):
            clf = LogisticRegression(max_iter=1000, random_state=42, C=0.1)
            clf.fit(features[tr_idx], labels[tr_idx])
            proba = clf.predict_proba(features[val_idx])[:, 1]
            auc   = roc_auc_score(labels[val_idx], proba)
            aucs.append(auc)
            print(f"  Fold {fold+1}: AUC={auc:.4f}")

        mean_auc = float(np.mean(aucs))
        std_auc  = float(np.std(aucs))

        if mean_auc < 0.65:
            interpretation = (
                "LOW -- ResNet50 features CANNOT distinguish Kaggle vs Tam Tri source. "
                "Source confounding is NOT a dominant factor in the learned representation. "
                "Strong counter-argument against Reviewer concern.")
        elif mean_auc < 0.80:
            interpretation = (
                "MODERATE -- some domain shift exists but does not fully confound results. "
                "Source asymmetry is acknowledged as Limitation 1; stratified results reported.")
        else:
            interpretation = (
                "HIGH -- model CAN distinguish data source from penultimate features. "
                "Source confounding is real and must be fully acknowledged in paper.")

        print(f"\n  Domain Probe AUC (5-fold mean): {mean_auc:.4f} +/- {std_auc:.4f}")
        print(f"  Interpretation: {interpretation}")

        probe_results = {
            "n_probe_images": int(len(labels)),
            "mean_auc":       round(mean_auc, 4),
            "std_auc":        round(std_auc,  4),
            "fold_aucs":      [round(a, 4) for a in aucs],
            "interpretation": interpretation,
            "method": (
                "Logistic regression (C=0.1) on ResNet50 penultimate-layer features, "
                "5-fold stratified CV. Tumor classes only (notumor excluded for fairness). "
                "Batch inference (batch_size=32)."),
        }
        results["domain_confusion_probe"] = probe_results

        with open(PROBE_JSON, 'w') as f:
            json.dump(probe_results, f, indent=2)
        print(f"\n  Saved: {PROBE_JSON}")

    except Exception as e:
        import traceback
        print(f"  [DOMAIN PROBE ERROR] {e}")
        traceback.print_exc()
        print("  Skipping domain probe.")
        results["domain_confusion_probe"] = {"error": str(e)}


# -- Tạo LaTeX table --------------------------------------------------------
def make_latex_table(results: dict) -> str:
    """Tạo bảng LaTeX source-stratified dể chen vao paper."""
    
    R_ov  = results["overall"]
    R_kg  = results["kaggle"]
    R_tt  = results["tamtri"]
    R_tt_t = results["tamtri_tumor_only"]
    
    def fmt(val, suffix="\\%"):
        return f"{val}{suffix}" if val is not None else "N/A"
    
    def row(cls):
        ov_r  = R_ov["per_class"].get(cls, {}).get("recall")
        kg_r  = R_kg["per_class"].get(cls, {}).get("recall")
        tt_r  = R_tt["per_class"].get(cls, {}).get("recall")
        ov_n  = R_ov["per_class"].get(cls, {}).get("support", 0)
        kg_n  = R_kg["per_class"].get(cls, {}).get("support", 0)
        tt_n  = R_tt["per_class"].get(cls, {}).get("support", 0)
        cls_cap = cls.capitalize() if cls != "notumor" else "No Tumor"
        tt_note = "$^{\\dag}$" if cls == "notumor" else ""
        return (f"    {cls_cap} & {fmt(ov_r)} & (N={ov_n}) & "
                f"{fmt(kg_r)} & (N={kg_n}) & "
                f"{fmt(tt_r)}{tt_note} & (N={tt_n}) \\\\")
    
    probe_line = ""
    if "domain_confusion_probe" in results and "mean_auc" in results["domain_confusion_probe"]:
        p = results["domain_confusion_probe"]
        probe_line = (f"    \\midrule\n"
                      f"    \\multicolumn{{6}}{{l}}{{\\textit{{Domain Discrimination Probe "
                      f"(AUC, 5-fold CV): {p['mean_auc']:.3f} $\\pm$ {p['std_auc']:.3f}. "
                      f"}}}} \\\\\n")
    
    tex = f"""% === Source-Stratified Performance Table ===
% Generated by source_stratified_eval.py (Contingency Plan A)
% NOTE: No-tumor class (*†*) comes exclusively from Kaggle public data.
% Tam Tri hospital has no no-tumor controls (see Sect.~\\ref{{subsec:data}}).

\\begin{{table}}[ht]
\\caption{{Source-stratified classification performance of MAICS (Guard-ON).
         Tam Tri cases are all tumour-positive; the no-tumor class is sourced exclusively
         from the Kaggle public benchmark and cannot be interpreted as hospital-validated
         negative controls.}}
\\label{{tab:source_strat}}
\\centering
\\small
\\begin{{tabular}}{{lrrrrr}}
\\toprule
\\textbf{{Class}} & \\multicolumn{{2}}{{c}}{{\\textbf{{Overall}}}} 
                  & \\multicolumn{{2}}{{c}}{{\\textbf{{Kaggle Only}}}}
                  & \\multicolumn{{2}}{{c}}{{\\textbf{{Tam Tri Only}}}} \\\\
                & Recall & N & Recall & N & Recall & N \\\\
\\midrule
{row('glioma')}
{row('meningioma')}
{row('notumor')}
{row('pituitary')}
\\midrule
    Macro-Avg  & {fmt(R_ov['f1_macro'])} F1 & (N={R_ov['n_images']}) &
                 {fmt(R_kg['f1_macro'])} F1 & (N={R_kg['n_images']}) &
                 {fmt(R_tt['f1_macro'])} F1 & (N={R_tt['n_images']}) \\\\
{probe_line}\\bottomrule
\\multicolumn{{6}}{{l}}{{\\small $^{{\\dag}}$ All no-tumor test images are from the Kaggle}} \\\\
\\multicolumn{{6}}{{l}}{{\\small public benchmark; Tam Tri has no no-tumor controls.}} \\\\
\\end{{tabular}}
\\end{{table}}
"""
    return tex

tex_output = make_latex_table(results)
with open(OUTPUT_TEX, 'w', encoding='utf-8') as f:
    f.write(tex_output)

# Save JSON
with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print(f"\n{'='*65}")
print("  SOURCE-STRATIFIED EVAL --- DONE")
print(f"{'='*65}")
print(f"  Saved: {OUTPUT_JSON}")
print(f"  Saved: {OUTPUT_TEX}")
print(f"\n  ?  CONTINGENCY PLAN A STATUS:")
print(f"  No-tumor recall ({results['kaggle']['per_class']['notumor']['recall']}%) va")
print(f"  Fatal FNR ({results['overall']['fatal_fnr_glioma_as_notumor']}%)")
print(f"  KH?NG duoc di?n gi?i la hospital-validated metrics.")
print(f"  Cac ch? s? nay s? duoc chuy?n vao Limitations trong paper.")

if __name__ == "__main__":
    pass