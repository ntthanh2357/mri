# -*- coding: utf-8 -*-
import sys
import io
import os
import glob
import numpy as np
import tensorflow as tf
from preprocess import medical_preprocessing_v2
from tensorflow.keras.applications.resnet_v2 import preprocess_input as res_prep

# Ensure UTF-8 output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Categories definition
CATEGORIES = ['glioma', 'meningioma', 'notumor', 'pituitary']

# Load ResNet model
print("Loading ResNet model...")
custom_objects = {'tf': tf}
try:
    tf.keras.config.enable_unsafe_deserialization()
except AttributeError:
    pass

model_path = r"models/resnet_risk_calibrated.keras"
if not os.path.exists(model_path):
    model_path = r"models/best_resnet_model.keras"

model = tf.keras.models.load_model(model_path, custom_objects=custom_objects, safe_mode=False, compile=False)
print(f"Model loaded successfully from {model_path}.")

# Path to patient data
archive_dir = r"c:\Users\Administrator\Downloads\Archive (1)"
patients = ["Huynh Thi Nga", "Le Dinh Hiep", "Nguyen Thi Be", "Phung Tao", "Tong Thi Nghi"]

print("\nRunning classification on patients...")

for patient in patients:
    patient_dir = os.path.join(archive_dir, patient)
    if not os.path.isdir(patient_dir):
        print(f"Directory not found for patient: {patient}")
        continue
    
    # Study dir -> Sequence dirs
    subdirs = glob.glob(os.path.join(patient_dir, "*", "*"))
    if not subdirs:
        subdirs = glob.glob(os.path.join(patient_dir, "*"))
    
    chosen_sequence = None
    
    # Try T1 Contrast-Enhanced
    for sd in subdirs:
        name = os.path.basename(sd).lower()
        if "t1" in name and ("c+" in name or "c_plus" in name or "plus" in name or "tiem" in name):
            chosen_sequence = sd
            break
            
    # Try FLAIR
    if not chosen_sequence:
        for sd in subdirs:
            name = os.path.basename(sd).lower()
            if "flair" in name:
                chosen_sequence = sd
                break
                
    # Try T2
    if not chosen_sequence:
        for sd in subdirs:
            name = os.path.basename(sd).lower()
            if "t2" in name:
                chosen_sequence = sd
                break
                
    # Default to first valid dir
    if not chosen_sequence:
        for sd in subdirs:
            if os.path.isdir(sd) and any(f.lower().endswith(('.jpg', '.png')) for f in os.listdir(sd)):
                chosen_sequence = sd
                break

    if not chosen_sequence or not os.path.isdir(chosen_sequence):
        print(f"No valid image sequence folder found for patient {patient}")
        continue
        
    print(f"\nPatient: {patient}")
    print(f"  Selected sequence: {os.path.basename(chosen_sequence)}")
    
    # Get images
    images = [os.path.join(chosen_sequence, f) for f in os.listdir(chosen_sequence) if f.lower().endswith(('.jpg', '.png'))]
    images.sort()
    
    if not images:
        print("  No images found in the sequence directory.")
        continue
        
    total_imgs = len(images)
    if total_imgs > 10:
        start_idx = int(total_imgs * 0.4)
        end_idx = int(total_imgs * 0.6)
        step = max(1, (end_idx - start_idx) // 7)
        sample_indices = list(range(start_idx, end_idx, step))[:7]
    else:
        sample_indices = list(range(total_imgs))
        
    sampled_images = [images[i] for i in sample_indices]
    
    predictions = []
    
    for img_path in sampled_images:
        processed = medical_preprocessing_v2(img_path)
        if processed is not None:
            img_array = np.expand_dims(processed, axis=0)
            pred = model.predict(res_prep(img_array.copy()), verbose=0)
            predictions.append(pred[0])
            
    if not predictions:
        print("  Could not process any images for prediction.")
        continue
        
    avg_pred = np.mean(predictions, axis=0)
    best_idx = np.argmax(avg_pred)
    confidence = avg_pred[best_idx]
    detected_class = CATEGORIES[best_idx]
    
    print(f"  Average Predictions:")
    for idx, cat in enumerate(CATEGORIES):
        print(f"    {cat.capitalize()}: {avg_pred[idx]*100:.2f}%")
    print(f"  ==> Detected: {detected_class.upper()} with {confidence*100:.2f}% confidence")
