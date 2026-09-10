# -*- coding: utf-8 -*-
import sys
import io
import os
import glob
import shutil
import cv2
import numpy as np

# Ensure UTF-8 output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("="*60)
print("MRI PATIENT IMAGE FILTER & ORGANIZER FOR MRITEAM")
print("="*60)

# Paths configuration
archive_dir = r"c:\Users\Administrator\Downloads\Archive (1)"
output_dir = r"C:\Users\Administrator\OneDrive\Desktop\MRIteam\MRIteam\patient_test_data"

patients = ["Huynh Thi Nga", "Le Dinh Hiep", "Nguyen Thi Be", "Phung Tao", "Tong Thi Nghi"]

# Create output directory if it doesn't exist
os.makedirs(output_dir, exist_ok=True)

def is_valid_slice(img_path):
    """
    Check if the slice has enough visual information (not mostly black/empty).
    """
    img = cv2.imread(img_path)
    if img is None:
        return False
        
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Calculate standard deviation of pixel values
    std_dev = np.std(gray)
    if std_dev < 10.0:
        return False # Flat/empty image
        
    # Count pixels that are above a dark threshold (brightness > 20)
    non_black_pixels = np.sum(gray > 20)
    total_pixels = gray.size
    ratio = non_black_pixels / total_pixels
    
    # If less than 12% of the image contains brain tissue/signal, it's likely an outer slice
    if ratio < 0.12:
        return False
        
    return True

total_copied = 0

for patient in patients:
    patient_dir = os.path.join(archive_dir, patient)
    if not os.path.isdir(patient_dir):
        print(f"Directory not found for patient: {patient}")
        continue
        
    print(f"\nProcessing Patient: {patient}")
    
    # Study dir -> Sequence dirs
    subdirs = glob.glob(os.path.join(patient_dir, "*", "*"))
    if not subdirs:
        subdirs = glob.glob(os.path.join(patient_dir, "*"))
        
    # Clean patient name for folder naming
    clean_patient_name = patient.replace(" ", "_")
    
    for sd in subdirs:
        if not os.path.isdir(sd):
            continue
            
        seq_name = os.path.basename(sd)
        
        # Skip localizers and screen saves
        if "localizer" in seq_name.lower() or "screen_save" in seq_name.lower():
            continue
            
        # Get all images in sequence
        images = [os.path.join(sd, f) for f in os.listdir(sd) if f.lower().endswith(('.jpg', '.png'))]
        if not images:
            continue
            
        # Determine sequence type category for labeling
        seq_lower = seq_name.lower()
        if "t1" in seq_lower and ("c+" in seq_lower or "c_plus" in seq_lower or "tiem" in seq_lower):
            seq_category = "T1_Contrast"
        elif "flair" in seq_lower:
            seq_category = "T2_FLAIR"
        elif "t2" in seq_lower:
            seq_category = "T2"
        elif "dwi" in seq_lower or "b1000" in seq_lower:
            seq_category = "DWI"
        elif "tof" in seq_lower:
            seq_category = "TOF_Angiography"
        else:
            seq_category = "Other_Sequence"
            
        # Target directory for this sequence of this patient
        target_seq_dir = os.path.join(output_dir, clean_patient_name, seq_category + "_" + seq_name)
        os.makedirs(target_seq_dir, exist_ok=True)
        
        print(f"  Sequence: {seq_name} ({seq_category}) -> Found {len(images)} slices.")
        
        seq_copied = 0
        
        # Scan and copy valid slices
        for img_path in images:
            if is_valid_slice(img_path):
                filename = os.path.basename(img_path)
                dest_path = os.path.join(target_seq_dir, filename)
                shutil.copy2(img_path, dest_path)
                seq_copied += 1
                total_copied += 1
                
        print(f"    -> Filtered out {len(images) - seq_copied} empty/black slices. Saved {seq_copied} slices.")

print("\n" + "="*60)
print(f"COMPLETED! Filtered and organized {total_copied} total slices.")
print(f"All outputs saved under: {output_dir}")
print("="*60)
