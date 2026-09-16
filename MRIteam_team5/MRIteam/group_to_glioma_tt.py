# -*- coding: utf-8 -*-
import sys
import io
import os
import glob
import shutil

# Ensure UTF-8 output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("="*60)
print("GROUPING MRI PATIENT IMAGES TO glioma_TT")
print("="*60)

# Source folder (the already filtered slices)
src_dir = r"C:\Users\Administrator\OneDrive\Desktop\MRIteam\MRIteam\patient_test_data"
# Destination folder
dest_dir = r"C:\Users\Administrator\OneDrive\Desktop\MRIteam\MRIteam\glioma_TT"

if not os.path.exists(src_dir):
    print(f"Source directory {src_dir} does not exist. Please run filter_patient_scans.py first.")
    sys.exit(1)

# Create destination folder (clean it if it exists to avoid duplicate accumulation)
if os.path.exists(dest_dir):
    print(f"Destination folder {dest_dir} already exists. Cleaning it first...")
    shutil.rmtree(dest_dir)
os.makedirs(dest_dir, exist_ok=True)

# Find all images in the source directory recursively
image_paths = []
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.lower().endswith(('.jpg', '.png', '.jpeg')):
            image_paths.append(os.path.join(root, file))

image_paths.sort()
total_images = len(image_paths)
print(f"Found {total_images} filtered images to group.")

# We will copy and rename them to glioma_TT_xxxx.jpg
copied_count = 0
mapping_lines = []

for idx, img_path in enumerate(image_paths):
    # Get original details for mapping
    # Relative path from src_dir
    rel_path = os.path.relpath(img_path, src_dir)
    parts = rel_path.split(os.sep)
    patient_name = parts[0]
    sequence_name = parts[1] if len(parts) > 1 else "unknown"
    orig_filename = parts[2] if len(parts) > 2 else parts[-1]
    
    # New filename: glioma_TT_xxxx.jpg
    new_filename = f"glioma_TT_{idx+1:04d}.jpg"
    dest_path = os.path.join(dest_dir, new_filename)
    
    # Copy file
    try:
        shutil.copy2(img_path, dest_path)
        copied_count += 1
        
        # Save mapping info
        mapping_lines.append(f"{new_filename}\t{patient_name}\t{sequence_name}\t{orig_filename}\n")
    except Exception as e:
        print(f"Error copying {img_path}: {e}")

# Save the mapping file
mapping_file_path = os.path.join(dest_dir, "mapping_log.txt")
with open(mapping_file_path, "w", encoding="utf-8") as f:
    f.write("New_Filename\tPatient_Name\tSequence_Name\tOriginal_Filename\n")
    f.writelines(mapping_lines)

print("\n" + "="*60)
print(f"COMPLETED! Grouped and renamed {copied_count} slices into glioma_TT.")
print(f"Target folder: {dest_dir}")
print(f"Mapping log saved at: {mapping_file_path}")
print("="*60)
