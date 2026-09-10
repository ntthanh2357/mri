import json
from pathlib import Path

ss = json.loads(Path("MRIteam/source_stratified_results.json").read_text())
pl = json.loads(Path("MRIteam/patient_level_results.json").read_text())
on = json.loads(Path("MRIteam/benchmark_guard_ON_results.json").read_text())
off = json.loads(Path("MRIteam/benchmark_guard_OFF_results.json").read_text())

print("=== OVERALL METRICS ===")
print(f"Accuracy: {ss['overall']['accuracy']}%, 95% CI: {pl['overall']['ci_95_accuracy']}")
print(f"Macro F1: {ss['overall']['f1_macro']}%")
print(f"Fatal FNR: {ss['overall']['fatal_fnr_glioma_as_notumor']}%, 95% CI: {pl['overall']['fatal_fnr_ci_95']}")
for c in ['glioma', 'meningioma', 'notumor', 'pituitary']:
    rec = ss['overall']['per_class'][c]['recall']
    ci = pl['overall']['per_class'][c]['ci_95']
    print(f"  {c:<12}: Recall={rec}%, CI={ci}")

print("\n=== TAM TRI HOSPITAL METRICS ===")
print(f"Cases: {ss['tamtri']['n_images']}")
print(f"Accuracy: {ss['tamtri']['accuracy']}%, 95% CI: {pl['tamtri']['ci_95_accuracy']}")
print(f"Macro F1: {ss['tamtri']['f1_macro']}%")
print(f"Fatal FNR: {ss['tamtri']['fatal_fnr_glioma_as_notumor']}%, 95% CI: {pl['tamtri']['fatal_fnr_ci_95']}")
for c in ['glioma', 'meningioma', 'pituitary']:
    rec = ss['tamtri']['per_class'][c]['recall']
    ci = pl['tamtri']['per_class'][c]['ci_95']
    print(f"  {c:<12}: Recall={rec}%, CI={ci}")

print("\n=== KAGGLE BENCHMARK METRICS ===")
print(f"Images: {ss['kaggle']['n_images']}")
print(f"Accuracy: {ss['kaggle']['accuracy']}%, 95% CI: {pl['kaggle']['ci_95_accuracy']}")
print(f"Macro F1: {ss['kaggle']['f1_macro']}%")
print(f"Fatal FNR: {ss['kaggle']['fatal_fnr_glioma_as_notumor']}%, 95% CI: {pl['kaggle']['fatal_fnr_ci_95']}")
for c in ['glioma', 'meningioma', 'notumor', 'pituitary']:
    rec = ss['kaggle']['per_class'][c]['recall']
    ci = pl['kaggle']['per_class'][c]['ci_95']
    print(f"  {c:<12}: Recall={rec}%, CI={ci}")

print("\n=== McNemar Tests ===")
print("Overall (patient-level JSON):", pl['overall']['mcnemar_vs_guardoff'])
print("Tam Tri (patient-level JSON):", pl['tamtri']['mcnemar_vs_guardoff'])

print("\n=== Guard Comparisons ===")
print(f"Guard ON conflicts: {on['conflict_count']}, blocked: {on['guard_blocked_conflict']}, gemini calls: {on['gemini_called_count']} ({on['pct_tier3_of_total']}%)")
print(f"Guard OFF gemini calls: {off['gemini_called_count']} ({off['pct_tier3_of_total']}%)")
print(f"Reduction in calls: {(off['gemini_called_count'] - on['gemini_called_count'])/off['gemini_called_count']*100:.2f}%")
print(f"CNN-only Acc: {on['acc_cnn_only']}%, Macro F1: {on['f1_macro_cnn']}%")
print(f"Fatal FNR Guard ON: {on['fatal_fnr_glioma_as_notumor']}%, Guard OFF: {off['fatal_fnr_glioma_as_notumor']}%")
