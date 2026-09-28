"""
Kiểm tra cấu trúc Patient ID trong tập test Tam Tri
"""
import os
import re
import json
from pathlib import Path
from collections import defaultdict

test_dir = Path('archive_v2/Testing')
tt_files = {'glioma': [], 'meningioma': [], 'pituitary': []}

for cls in ['glioma', 'meningioma', 'pituitary']:
    cls_dir = test_dir / cls
    if cls_dir.exists():
        for f in sorted(cls_dir.iterdir()):
            if '_TT_' in f.name:
                tt_files[cls].append(f.name)

# Show sample + count
all_ids = defaultdict(list)
for cls, files in tt_files.items():
    nums = []
    for f in files:
        m = re.search(r'_TT_(\d+)', f)
        if m:
            nums.append(m.group(1))
            all_ids[cls].append(m.group(1))
    
    unique_nums = sorted(set(nums), key=lambda x: int(x))
    print(f"{cls}: {len(files)} files, {len(unique_nums)} unique IDs")
    if unique_nums:
        print(f"  Sample IDs: {unique_nums[:10]}")
        print(f"  Max ID: {max(unique_nums, key=lambda x: int(x))}")
        print(f"  Slices/patient (approx): {len(files) / len(unique_nums):.1f}")
    print()

# Check overlapping IDs across classes
glioma_ids = set(all_ids['glioma'])
mening_ids = set(all_ids['meningioma'])
pituitary_ids = set(all_ids['pituitary'])

print("=== ID OVERLAP ANALYSIS ===")
print(f"Glioma IDs: {len(glioma_ids)}")
print(f"Meningioma IDs: {len(mening_ids)}")
print(f"Pituitary IDs: {len(pituitary_ids)}")
print(f"Glioma ∩ Meningioma: {len(glioma_ids & mening_ids)}")
print(f"Glioma ∩ Pituitary: {len(glioma_ids & pituitary_ids)}")
print(f"Meningioma ∩ Pituitary: {len(mening_ids & pituitary_ids)}")
print()

# Now check dataTAMTRI structure
print("=== DATAMTRI FOLDER STRUCTURE ===")
data_dir = Path('dataTAMTRI')
if data_dir.exists():
    for tumor_folder in sorted(data_dir.iterdir()):
        if tumor_folder.is_dir() and not tumor_folder.name.endswith('.zip'):
            patients = [d.name for d in sorted(tumor_folder.iterdir()) if d.is_dir()]
            print(f"{tumor_folder.name}: {len(patients)} patients")
            for p in patients:
                print(f"  - {p}")
