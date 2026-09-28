"""
finalize_source_strat.py
========================
Chay script nay SAU KHI source_stratified_eval.py hoan thanh.
Script nay se:
1. Copy source_stratified_table.tex vao paper_latex/tables/
2. Uncomment \input{tables/source_stratified_table.tex} trong maics_micad2026.tex
3. In tom tat ket qua domain probe
"""

import json, shutil, re
from pathlib import Path

BASE      = Path(".")
PAPER_DIR = Path("../paper_latex")
TEX_FILE  = PAPER_DIR / "maics_micad2026.tex"
TABLES_DIR = PAPER_DIR / "tables"
SRC_TABLE = BASE / "source_stratified_table.tex"
DST_TABLE = TABLES_DIR / "source_stratified_table.tex"
PROBE_JSON = BASE / "domain_probe_results.json"
STRAT_JSON = BASE / "source_stratified_results.json"

print("=== FINALIZE SOURCE STRATIFIED TABLE ===")

# 1. Check required files
for f in [SRC_TABLE, PROBE_JSON, STRAT_JSON]:
    if not f.exists():
        print(f"ERROR: Missing {f} -- run source_stratified_eval.py first!")
        exit(1)

# 2. Copy table
TABLES_DIR.mkdir(exist_ok=True)
shutil.copy(SRC_TABLE, DST_TABLE)
print(f"Copied: {SRC_TABLE.name} -> {DST_TABLE}")

# 3. Uncomment \input{tables/source_stratified_table.tex} in main tex
content = TEX_FILE.read_text(encoding="utf-8")
old = "% \\input{tables/source_stratified_table.tex}"
new = "\\input{tables/source_stratified_table.tex}"
if old in content:
    content = content.replace(old, new, 1)
    TEX_FILE.write_text(content, encoding="utf-8")
    print(f"Uncommented source_stratified_table in {TEX_FILE.name}")
elif new in content:
    print(f"Already uncommented in {TEX_FILE.name}")
else:
    print(f"WARNING: Could not find input line in {TEX_FILE.name} -- manual edit needed")

# 4. Print domain probe summary
probe = json.loads(PROBE_JSON.read_text())
print()
print("=== DOMAIN CONFUSION PROBE RESULTS ===")
print(f"  AUC (5-fold mean): {probe['mean_auc']} +/- {probe['std_auc']}")
print(f"  Fold AUCs: {probe['fold_aucs']}")
print(f"  N probe images: {probe['n_probe_images']}")
print()
print(f"  INTERPRETATION: {probe['interpretation']}")
print()

# 5. Print Tam Tri source-stratified summary
strat = json.loads(STRAT_JSON.read_text())
tt = strat["tamtri"]
print("=== TAM TRI PERFORMANCE (hospital, tumor classes only) ===")
print(f"  N = {tt['n_images']}")
print(f"  Accuracy = {tt['accuracy']}%  |  F1-Macro = {tt['f1_macro']}%")
for cls in ['glioma', 'meningioma', 'pituitary']:
    pc = tt["per_class"].get(cls, {})
    print(f"  {cls:12s}: Recall={pc.get('recall','N/A')}%  Prec={pc.get('precision','N/A')}%  N={pc.get('support',0)}")

print()
print("=== SUGGESTED PAPER UPDATE ===")
auc = probe['mean_auc']
if auc < 0.65:
    msg = (f"Domain probe AUC = {auc:.3f} (LOW): the model does NOT distinguish "
           "acquisition source from learned features. Counter-evidence against source confounding.")
elif auc < 0.80:
    msg = (f"Domain probe AUC = {auc:.3f} (MODERATE): some domain shift exists. "
           "Acknowledged in Limitations; source-stratified results provided.")
else:
    msg = (f"Domain probe AUC = {auc:.3f} (HIGH): strong source signal in features. "
           "Must strengthen Limitations and moderate claims further.")

print(f"  {msg}")
print()
print("  -> Update domain probe AUC in source_stratified_table.tex: DONE (auto-generated)")
print("  -> Update Limitations text with actual AUC value: MANUAL STEP")
print()
print("DONE. Compile paper to verify tables.")
