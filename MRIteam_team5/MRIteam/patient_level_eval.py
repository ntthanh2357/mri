"""
patient_level_eval.py
=====================
Component 2: Patient / Case-level Evaluation

THỰC TẾ DỮ LIỆU (da xac nhận):
  - Mỗi _TT_XXXX = 1 unique case (1 representative slice/case)
  - Slices/patient ≈ 1.0 -> patient-level = case-level cho Tam Tri
  - Kaggle: khong có patient grouping -> bao cao rieng

Outputs:
  - patient_level_results.json
  - patient_level_table.tex  (sẵn sang chen vao LaTeX)
"""

import re, json
import numpy as np
import pandas as pd
from pathlib import Path
from scipy import stats
from sklearn.metrics import (
    accuracy_score, f1_score, recall_score,
    classification_report, confusion_matrix
)

# -- Cấu hình ---------------------------------------------------------------
DETAIL_CSV_ON  = "benchmark_guard_ON_detail.csv"
DETAIL_CSV_OFF = "benchmark_guard_OFF_detail.csv"
CATEGORIES     = ['glioma', 'meningioma', 'notumor', 'pituitary']
OUTPUT_JSON    = "patient_level_results.json"
OUTPUT_TEX     = "patient_level_table.tex"

# -- Ham tien ích -----------------------------------------------------------
def classify_source(img_path: str) -> str:
    fname = Path(img_path).name
    if re.search(r'_TT_', fname):
        return "tamtri"
    elif re.match(r'^(Te-|Tr-|Te_aug|v2_)', fname):
        return "kaggle"
    return "unknown"

def wilson_ci(correct: int, total: int, z: float = 1.96):
    """Wilson score 95% confidence interval cho proportion."""
    if total == 0:
        return (0.0, 0.0)
    p    = correct / total
    denom = 1 + z**2 / total
    center = (p + z**2 / (2*total)) / denom
    margin = (z * np.sqrt(p*(1-p)/total + z**2/(4*total**2))) / denom
    return (max(0, center - margin), min(1, center + margin))

def mcnemar_test(y_true, y_pred_a, y_pred_b):
    """McNemar's test: A=Guard-ON, B=Guard-OFF."""
    n01 = sum(1 for t, a, b in zip(y_true, y_pred_a, y_pred_b)
              if (a == t) != (b == t) and (a == t))
    n10 = sum(1 for t, a, b in zip(y_true, y_pred_a, y_pred_b)
              if (a == t) != (b == t) and (b == t))
    n   = n01 + n10
    if n == 0:
        return 1.0, n01, n10
    # Exact binomial (for small n) or chi-squared
    if n < 25:
        pval = 2 * min(stats.binom.cdf(min(n01, n10), n, 0.5),
                       1 - stats.binom.cdf(min(n01, n10)-1, n, 0.5))
    else:
        pval = float(stats.chi2.sf((abs(n01 - n10) - 1)**2 / n, df=1))
    return pval, n01, n10

def compute_case_level_metrics(df_sub, df_off_sub=None, label=""):
    """Tính metrics ở mức case voi CI va McNemar."""
    y_true  = df_sub["true"].tolist()
    y_pred  = df_sub["final"].tolist()
    n       = len(y_true)
    
    if n == 0:
        return {}
    
    acc     = accuracy_score(y_true, y_pred)
    f1      = f1_score(y_true, y_pred, average="macro", zero_division=0)
    
    # CI cho accuracy
    n_correct = int(acc * n)
    ci_lo, ci_hi = wilson_ci(n_correct, n)
    
    # Per-class
    report = classification_report(y_true, y_pred, labels=sorted(set(y_true)),
                                   output_dict=True, zero_division=0)
    per_class = {}
    for cls in CATEGORIES:
        if cls in report:
            recall_val = report[cls]["recall"]
            support    = int(report[cls]["support"])
            correct    = round(recall_val * support)
            ci_r_lo, ci_r_hi = wilson_ci(correct, support)
            per_class[cls] = {
                "recall":   round(recall_val * 100, 2),
                "ci_95":    [round(ci_r_lo * 100, 2), round(ci_r_hi * 100, 2)],
                "precision": round(report[cls]["precision"] * 100, 2),
                "f1":        round(report[cls]["f1-score"]  * 100, 2),
                "support":   support,
            }
        else:
            per_class[cls] = {
                "recall": None, "ci_95": None, "support": 0,
                "note": "Not present in this subset"
            }
    
    # Fatal FNR + CI
    glioma_rows = df_sub[df_sub["true"] == "glioma"]
    fatal_fn    = (glioma_rows["final"] == "notumor").sum()
    n_glioma    = len(glioma_rows)
    fatal_fnr   = fatal_fn / n_glioma if n_glioma > 0 else None
    
    if fatal_fnr is not None:
        ci_fnr_lo, ci_fnr_hi = wilson_ci(int(fatal_fn), n_glioma)
    else:
        ci_fnr_lo, ci_fnr_hi = None, None
    
    result = {
        "n_cases":      n,
        "accuracy":     round(acc * 100, 2),
        "ci_95_accuracy": [round(ci_lo * 100, 2), round(ci_hi * 100, 2)],
        "f1_macro":     round(f1  * 100, 2),
        "fatal_fnr":    round(fatal_fnr * 100, 2) if fatal_fnr is not None else None,
        "fatal_fnr_ci_95": [round(ci_fnr_lo*100,2), round(ci_fnr_hi*100,2)]
                            if ci_fnr_lo is not None else None,
        "per_class":    per_class,
    }
    
    # McNemar test so sanh Guard-ON vs Guard-OFF (nếu có)
    if df_off_sub is not None and len(df_off_sub) == n:
        y_pred_off = df_off_sub["final"].tolist()
        pval, n01, n10 = mcnemar_test(y_true, y_pred, y_pred_off)
        result["mcnemar_vs_guardoff"] = {
            "p_value": round(pval, 6),
            "n_on_correct_off_wrong": n01,
            "n_off_correct_on_wrong": n10,
            "note": ("Statistically significant (p<0.05)" if pval < 0.05
                     else f"Not significant at a=0.05 (p={pval:.4f}; "
                          f"N_cases={n} -- reduced power vs slice-level test)")
        }
    
    return result

# -- Load CSVs ---------------------------------------------------------------
print("Loading CSVs...")
df_on = pd.read_csv(DETAIL_CSV_ON)
df_on["source"] = df_on["img"].apply(classify_source)

df_off = None
if Path(DETAIL_CSV_OFF).exists():
    df_off = pd.read_csv(DETAIL_CSV_OFF)
    df_off["source"] = df_off["img"].apply(classify_source)
    print(f"Guard-OFF CSV loaded: {len(df_off)} rows")
else:
    print(f"WARNING: {DETAIL_CSV_OFF} not found -- McNemar test skipped")

# -- Case-level analysis -----------------------------------------------------
print("\n--- Case-Level Analysis ---")

# 1. Tam Tri cases (tumor only, 1 case = 1 file)
tt_on  = df_on[df_on["source"] == "tamtri"].copy()
tt_off = df_off[df_off["source"] == "tamtri"].copy() if df_off is not None else None

# Merge dể dảm bảo cùng thứ tự
if tt_off is not None:
    # Align theo img path
    tt_merged = tt_on.merge(
        tt_off[["img","final"]].rename(columns={"final":"final_off"}),
        on="img", how="inner")
    tt_on_aligned  = tt_merged
    tt_off_aligned = tt_merged
else:
    tt_on_aligned  = tt_on
    tt_off_aligned = None

print(f"Tam Tri cases: {len(tt_on_aligned)}")
results_tt = compute_case_level_metrics(
    tt_on_aligned,
    # Tạo fake df cho Guard-OFF từ cột final_off
    pd.DataFrame({"true": tt_on_aligned["true"],
                  "final": tt_on_aligned.get("final_off", tt_on_aligned["final"])})
    if "final_off" in tt_on_aligned.columns else None,
    label="Tam Tri"
)

# 2. Kaggle cases (khong có patient grouping, xử lý as-is)
kg_on  = df_on[df_on["source"] == "kaggle"].copy()
print(f"Kaggle cases: {len(kg_on)}")
results_kg = compute_case_level_metrics(kg_on, label="Kaggle")

# 3. Overall
all_on  = df_on[df_on["source"] != "unknown"].copy()
all_off = df_off[df_off["source"] != "unknown"].copy() if df_off is not None else None
results_all = compute_case_level_metrics(
    all_on,
    all_off,
    label="Overall"
)

# -- In kết quả -------------------------------------------------------------
def print_results(label, r):
    print(f"\n[{label}] N={r.get('n_cases','?')}")
    print(f"  Accuracy: {r.get('accuracy')}% "
          f"[95% CI: {r.get('ci_95_accuracy',['?','?'])[0]}--"
          f"{r.get('ci_95_accuracy',['?','?'])[1]}%]")
    print(f"  F1-Macro: {r.get('f1_macro')}%")
    fatal = r.get('fatal_fnr')
    ci_f  = r.get('fatal_fnr_ci_95')
    if fatal is not None:
        print(f"  Fatal FNR: {fatal}% [95% CI: {ci_f[0]}--{ci_f[1]}%]")
    for cls in CATEGORIES:
        pc = r.get("per_class", {}).get(cls, {})
        if pc.get("support", 0) > 0:
            ci = pc.get("ci_95", ["?","?"])
            print(f"  {cls:12s}: Recall={pc['recall']}% "
                  f"[95% CI: {ci[0]}--{ci[1]}%]  N={pc['support']}")
        else:
            print(f"  {cls:12s}: N/A")
    mn = r.get("mcnemar_vs_guardoff")
    if mn:
        print(f"  McNemar (vs Guard-OFF): p={mn['p_value']} -- {mn['note']}")

print_results("OVERALL (all sources)", results_all)
print_results("TAM TRI CASES (hospital, tumor only)", results_tt)
print_results("KAGGLE CASES (public benchmark)", results_kg)

# -- Tạo LaTeX table ---------------------------------------------------------
def make_patient_table(results_tt, results_kg, results_all):
    """Tạo bảng LaTeX case-level."""
    
    def fmt_recall_ci(r, cls):
        pc = r.get("per_class", {}).get(cls, {})
        if pc.get("support", 0) == 0 or pc.get("recall") is None:
            return "N/A", "---"
        ci = pc.get("ci_95", ["?","?"])
        return f"{pc['recall']}\\%", f"[{ci[0]}, {ci[1]}]\\%"
    
    rows = []
    for cls in CATEGORIES:
        cls_label = cls.capitalize() if cls != "notumor" else "No Tumor"
        dag = "$^{\\dag}$" if cls == "notumor" else ""
        
        r_all, ci_all = fmt_recall_ci(results_all, cls)
        r_tt,  ci_tt  = fmt_recall_ci(results_tt,  cls)
        r_kg,  ci_kg  = fmt_recall_ci(results_kg,  cls)
        
        n_all = results_all.get("per_class",{}).get(cls,{}).get("support",0)
        n_tt  = results_tt.get("per_class",{}).get(cls,{}).get("support",0)
        n_kg  = results_kg.get("per_class",{}).get(cls,{}).get("support",0)
        
        rows.append(
            f"    {cls_label}{dag} & {r_all} & {ci_all} & "
            f"{r_tt} & {ci_tt} & "
            f"{r_kg} & {ci_kg} \\\\"
        )
    
    mn = results_tt.get("mcnemar_vs_guardoff", {})
    mcnemar_line = ""
    if mn:
        mcnemar_line = (
            f"    \\midrule\n"
            f"    \\multicolumn{{7}}{{l}}{{\\textit{{McNemar's test (Guard-ON vs Guard-OFF), "
            f"Tam Tri cases: $p = {mn['p_value']}$ ($n_{{01}}={mn['n_on_correct_off_wrong']}$, "
            f"$n_{{10}}={mn['n_off_correct_on_wrong']}$)}}}} \\\\\n"
        )
    
    fatal_all = results_all.get('fatal_fnr')
    fatal_ci  = results_all.get('fatal_fnr_ci_95', ['?','?'])
    fatal_tt  = results_tt.get('fatal_fnr')
    fatal_ci_tt = results_tt.get('fatal_fnr_ci_95', ['?','?'])
    
    tex = f"""% === Case-Level Results Table ===
% Generated by patient_level_eval.py
% NOTE: Tam Tri data = 1 representative slice per case.
% patient-level = case-level for Tam Tri (no multi-slice aggregation needed).

\\begin{{table}}[ht]
\\caption{{Case-level classification performance of MAICS (Guard-ON) with 95\\% Wilson
         confidence intervals. Tam Tri Hospital cases are all tumour-positive (no
         no-tumor controls available). Kaggle images lack patient identifiers and
         are evaluated as independent cases. Fatal FNR (overall):
         {fatal_all}\\% [95\\% CI: {fatal_ci[0]}--{fatal_ci[1]}\\%];
         Tam Tri subset: {fatal_tt}\\% [95\\% CI: {fatal_ci_tt[0]}--{fatal_ci_tt[1]}\\%].}}
\\label{{tab:patient_level}}
\\centering
\\small
\\setlength{{\\tabcolsep}}{{4pt}}
\\begin{{tabular}}{{lccccccc}}
\\toprule
\\textbf{{Class}} 
  & \\multicolumn{{2}}{{c}}{{\\textbf{{Overall (N={results_all.get('n_cases','?')})}}}}
  & \\multicolumn{{2}}{{c}}{{\\textbf{{Tam Tri (N={results_tt.get('n_cases','?')})}}}}
  & \\multicolumn{{2}}{{c}}{{\\textbf{{Kaggle (N={results_kg.get('n_cases','?')})}}}} \\\\
  & Recall & 95\\% CI & Recall & 95\\% CI & Recall & 95\\% CI \\\\
\\midrule
{"".join(r + chr(10) for r in rows)}\\midrule
    Macro-F1  & \\multicolumn{{2}}{{c}}{{{results_all.get('f1_macro')}\\%}} & 
                \\multicolumn{{2}}{{c}}{{{results_tt.get('f1_macro')}\\%}} & 
                \\multicolumn{{2}}{{c}}{{{results_kg.get('f1_macro')}\\%}} \\\\
    Accuracy  & \\multicolumn{{2}}{{c}}{{{results_all.get('accuracy')}\\% [{results_all.get('ci_95_accuracy',['?','?'])[0]}--{results_all.get('ci_95_accuracy',['?','?'])[1]}]\\%}} & 
                \\multicolumn{{2}}{{c}}{{{results_tt.get('accuracy')}\\% [{results_tt.get('ci_95_accuracy',['?','?'])[0]}--{results_tt.get('ci_95_accuracy',['?','?'])[1]}]\\%}} & 
                \\multicolumn{{2}}{{c}}{{{results_kg.get('accuracy')}\\%}} \\\\
{mcnemar_line}\\bottomrule
\\multicolumn{{7}}{{l}}{{\\small $^{{\\dag}}$ No-tumor class: Kaggle-sourced only; not a}} \\\\
\\multicolumn{{7}}{{l}}{{\\small hospital-validated negative control (Contingency Plan A).}} \\\\
\\end{{tabular}}
\\end{{table}}
"""
    return tex

tex_output = make_patient_table(results_tt, results_kg, results_all)
with open(OUTPUT_TEX, 'w', encoding='utf-8') as f:
    f.write(tex_output)

# Save JSON
final_output = {
    "methodology_note": (
        "Each Tam Tri _TT_XXXX filename corresponds to one unique diagnostic case "
        "(1 representative slice per case; Slices/patient=1.0). "
        "Patient-level aggregation is equivalent to case-level for Tam Tri data. "
        "Kaggle test images lack patient identifiers and are evaluated as independent slices."
    ),
    "overall":  results_all,
    "tamtri":   results_tt,
    "kaggle":   results_kg,
}
with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(final_output, f, indent=2, ensure_ascii=False)

print(f"\n{'='*65}")
print("  PATIENT / CASE-LEVEL EVAL --- HOAN THANH")
print(f"{'='*65}")
print(f"  Saved: {OUTPUT_JSON}")
print(f"  Saved: {OUTPUT_TEX}")

if __name__ == "__main__":
    pass