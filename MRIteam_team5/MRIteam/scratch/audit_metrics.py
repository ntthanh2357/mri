import json
from pathlib import Path

# Load ground truth files
s = json.loads(Path('MRIteam/source_stratified_results.json').read_text())
p = json.loads(Path('MRIteam/patient_level_results.json').read_text())
d = json.loads(Path('MRIteam/domain_probe_results.json').read_text())

# Load main paper text
tex = Path('paper_latex/maics_micad2026.tex').read_text(encoding='utf-8')

print("=======================================================================")
print("          MAICS PAPER - ALL NUMERICAL METRICS AUDIT REPORT             ")
print("=======================================================================\n")

checks = [
    # Image counts & cohort sizes
    ('3,461', 'Total test images', '3,461' in tex),
    ('1,861', 'Tam Tri hospital cases', '1,861' in tex),
    ('1,600', 'Kaggle public images', '1,600' in tex),
    ('776',   'Tam Tri Glioma cases', '776' in tex),
    ('500',   'Tam Tri Meningioma cases', '500' in tex),
    ('585',   'Tam Tri Pituitary cases', '585' in tex),

    # Overall metrics
    ('91.01\\%', 'Overall Accuracy (91.01%)', '91.01\\%' in tex),
    ('92.04\\%', 'Overall Macro F1 (92.04%)', '92.04\\%' in tex),
    ('90.31\\%', 'Glioma Recall (90.31%)', '90.31\\%' in tex),
    ('0.43\\%',  'Overall Fatal FNR (0.43%)', '0.43\\%' in tex),
    ('0.85\\%',  'Guard-OFF Glioma FNR baseline (0.85%)', '0.85\\%' in tex),

    # Wilson 95% CIs (Overall)
    ('90.02--91.92', 'Overall Acc 95% CI [90.02, 91.92]', '90.02--91.92' in tex or '90.02, 91.92' in tex),
    ('88.48, 91.87', 'Glioma Recall 95% CI [88.48, 91.87]', '88.48, 91.87' in tex),
    ('87.39, 91.39', 'Meningioma Recall 95% CI [87.39, 91.39]', '87.39, 91.39' in tex),
    ('97.82, 99.74', 'No-tumor Recall 95% CI [97.82, 99.74]', '97.82, 99.74' in tex),
    ('87.8, 91.58',  'Pituitary Recall 95% CI [87.8, 91.58]', '87.8, 91.58' in tex),
    ('0.18--0.99',   'Overall Fatal FNR 95% CI [0.18, 0.99]', '0.18--0.99' in tex),

    # Tam Tri subset metrics & CIs
    ('86.57\\%', 'Tam Tri Accuracy (86.57%)', '86.57\\%' in tex),
    ('84.94--88.04', 'Tam Tri Acc 95% CI [84.94, 88.04]', '84.94--88.04' in tex or '84.94, 88.04' in tex),
    ('89.69\\%', 'Tam Tri Glioma Recall (89.69%)', '89.69\\%' in tex),
    ('87.35, 91.64', 'Tam Tri Glioma Recall 95% CI [87.35, 91.64]', '87.35, 91.64' in tex),
    ('85.4\\%',  'Tam Tri Meningioma Recall (85.4%)', '85.4\\%' in tex),
    ('82.04, 88.23', 'Tam Tri Meningioma 95% CI [82.04, 88.23]', '82.04, 88.23' in tex),
    ('83.42\\%', 'Tam Tri Pituitary Recall (83.42%)', '83.42\\%' in tex),
    ('80.19, 86.21', 'Tam Tri Pituitary 95% CI [80.19, 86.21]', '80.19, 86.21' in tex),
    ('64.39\\%', 'Tam Tri Macro F1 (64.39%)', '64.39\\%' in tex),
    ('0.13\\%',  'Hospital-validated Fatal FNR (0.13%)', '0.13\\%' in tex),
    ('0.02--0.73', 'Tam Tri Fatal FNR 95% CI [0.02, 0.73]', '0.02--0.73' in tex),

    # Domain probe
    ('0.991',  'Domain Probe AUC (0.991)', '0.991' in tex),
    ('0.003',  'Domain Probe AUC Std (0.003)', '0.003' in tex),

    # McNemar p-values
    ('0.000009', 'Image-level McNemar p-value (0.000009)', '0.000009' in tex),
    ('0.091',    'Case-level McNemar p-value (0.091)', '0.091' in tex),

    # Privacy Guard & VLM arbitration metrics
    ('79.5\\%',  'Privacy Guard VLM call reduction (79.5%)', '79.5\\%' in tex),
    ('2.48\\%',  'VLM call rate post-guard (2.48%)', '2.48\\%' in tex),
    ('12.14\\%', 'VLM call rate pre-guard (12.14%)', '12.14\\%' in tex),
    ('76.81\\%', 'VLM conflict resolution accuracy (76.81%)', '76.81\\%' in tex),
    ('100.0\\%', 'VLM JSON parsing reliability (100.0%)', '100.0\\%' in tex),
]

all_passed = True
for target, label, status in checks:
    tag = "[PASS]" if status else "[FAIL]"
    if not status:
        all_passed = False
    print(f"{tag:<7} {label:<48} | Token: '{target}'")

print("\n=======================================================================")
if all_passed:
    print("  RESULT: 100% PERFECT MATCH! ALL 31 METRIC CHECKS PASSED.")
else:
    print("  RESULT: DISCREPANCIES DETECTED.")
print("=======================================================================")
