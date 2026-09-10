# -*- coding: utf-8 -*-
import sys
import io
import os
import glob
import numpy as np
import tensorflow as tf
from preprocess import medical_preprocessing_v2
from tensorflow.keras.applications.resnet_v2 import preprocess_input as res_prep  # type: ignore

# Ensure UTF-8 output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Categories
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
print("Model loaded.")

# Path to patient data
archive_dir = r"c:\Users\Administrator\Downloads\Archive (1)"
patients = ["Huynh Thi Nga", "Le Dinh Hiep", "Nguyen Thi Be", "Phung Tao", "Tong Thi Nghi"]

for patient in patients:
    patient_dir = os.path.join(archive_dir, patient)
    if not os.path.isdir(patient_dir):
        continue
    
    print(f"\n=======================================================")
    print(f"PATIENT: {patient}")
    print(f"=======================================================")
    
    # Find all subdirectories containing images
    subdirs = glob.glob(os.path.join(patient_dir, "*", "*"))
    if not subdirs:
        subdirs = glob.glob(os.path.join(patient_dir, "*"))
        
    for sd in subdirs:
        if not os.path.isdir(sd):
            continue
            
        images = [os.path.join(sd, f) for f in os.listdir(sd) if f.lower().endswith(('.jpg', '.png'))]
        if not images:
            continue
            
        seq_name = os.path.basename(sd)
        
        # Skip localizers and screen saves
        if "localizer" in seq_name.lower() or "screen_save" in seq_name.lower():
            continue
            
        # Sample 5 slices from the middle
        total_imgs = len(images)
        images.sort()
        if total_imgs > 10:
            start_idx = int(total_imgs * 0.4)
            end_idx = int(total_imgs * 0.6)
            step = max(1, (end_idx - start_idx) // 5)
            sample_indices = list(range(start_idx, end_idx, step))[:5]
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
            continue
            
        avg_pred = np.mean(predictions, axis=0)
        best_idx = np.argmax(avg_pred)
        confidence = avg_pred[best_idx]
        detected_class = CATEGORIES[best_idx]
        
        print(f"Sequence: {seq_name} (Slices evaluated: {len(predictions)})")
        print(f"  Result: {detected_class.upper()} ({confidence*100:.1f}%) | G: {avg_pred[0]*100:.1f}% | M: {avg_pred[1]*100:.1f}% | N: {avg_pred[2]*100:.1f}% | P: {avg_pred[3]*100:.1f}%")
