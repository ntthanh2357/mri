# -*- coding: utf-8 -*-
import sys
import io
import os
import glob
import numpy as np
import tensorflow as tf
from preprocess import medical_preprocessing_v2
from tensorflow.keras.applications.resnet_v2 import preprocess_input as res_prep
from tensorflow.keras.applications.efficientnet_v2 import preprocess_input as eff_prep
from tensorflow.keras.applications.densenet import preprocess_input as den_prep

# Ensure UTF-8 output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Categories
CATEGORIES = ['glioma', 'meningioma', 'notumor', 'pituitary']

# Load all 3 models
print("Loading ResNet (Risk-Calibrated) model...")
custom_objects = {'tf': tf}
try:
    tf.keras.config.enable_unsafe_deserialization()
except AttributeError:
    pass

resnet_model = tf.keras.models.load_model("models/resnet_risk_calibrated.keras", custom_objects=custom_objects, safe_mode=False, compile=False)
print("Loading EfficientNetV2 model...")
eff_model = tf.keras.models.load_model("models/best_efficientnet_model.keras", safe_mode=False, compile=False)
print("Loading DenseNet121 model...")
den_model = tf.keras.models.load_model("models/best_densenet_model.keras", safe_mode=False, compile=False)
print("All models loaded.")

archive_dir = r"c:\Users\Administrator\Downloads\Archive (1)"
patients = ["Huynh Thi Nga", "Le Dinh Hiep", "Nguyen Thi Be", "Phung Tao", "Tong Thi Nghi"]

# Helper to apply temperature scaling (copied from main.py)
def apply_temperature_scaling(probs, T=1.3):
    eps = 1e-7
    logits = np.log(probs + eps)
    scaled_logits = logits / T
    exp_logits = np.exp(scaled_logits - np.max(scaled_logits, axis=-1, keepdims=True))
    return exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)

for patient in patients:
    patient_dir = os.path.join(archive_dir, patient)
    if not os.path.isdir(patient_dir):
        continue
    
    print(f"\n=======================================================")
    print(f"PATIENT: {patient}")
    print(f"=======================================================")
    
    # Select the sequence (using T1 Contrast-Enhanced, FLAIR or T2)
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
                
    if not chosen_sequence or not os.path.isdir(chosen_sequence):
        continue
        
    print(f"Selected Sequence: {os.path.basename(chosen_sequence)}")
    
    images = [os.path.join(chosen_sequence, f) for f in os.listdir(chosen_sequence) if f.lower().endswith(('.jpg', '.png'))]
    images.sort()
    if not images:
        continue
        
    # Sample 5 slices
    total_imgs = len(images)
    if total_imgs > 10:
        start_idx = int(total_imgs * 0.4)
        end_idx = int(total_imgs * 0.6)
        step = max(1, (end_idx - start_idx) // 5)
        sample_indices = list(range(start_idx, end_idx, step))[:5]
    else:
        sample_indices = list(range(total_imgs))
        
    sampled_images = [images[i] for i in sample_indices]
    
    res_preds, eff_preds, den_preds = [], [], []
    
    for img_path in sampled_images:
        processed = medical_preprocessing_v2(img_path)
        if processed is not None:
            img_array = np.expand_dims(processed, axis=0)
            
            # Predict ResNet
            p_res = resnet_model.predict(res_prep(img_array.copy()), verbose=0)[0]
            res_preds.append(p_res)
            
            # Predict EfficientNet
            p_eff = eff_model.predict(eff_prep(img_array.copy()), verbose=0)[0]
            p_eff = apply_temperature_scaling(p_eff)
            eff_preds.append(p_eff)
            
            # Predict DenseNet
            p_den = den_model.predict(den_prep(img_array.copy()), verbose=0)[0]
            p_den = apply_temperature_scaling(p_den)
            den_preds.append(p_den)
            
    if not res_preds:
        continue
        
    avg_res = np.mean(res_preds, axis=0)
    avg_eff = np.mean(eff_preds, axis=0)
    avg_den = np.mean(den_preds, axis=0)
    
    # Combined prediction using main.py weights (80% ResNet, 10% EffNet, 10% DenseNet)
    avg_ensemble = (avg_res * 0.8) + (avg_eff * 0.1) + (avg_den * 0.1)
    
    print(f"\n  ResNet (Risk-Calibrated):")
    print(f"    G: {avg_res[0]*100:.1f}% | M: {avg_res[1]*100:.1f}% | N: {avg_res[2]*100:.1f}% | P: {avg_res[3]*100:.1f}% -> Detected: {CATEGORIES[np.argmax(avg_res)].upper()}")
    print(f"  EfficientNetV2 (Standard CE):")
    print(f"    G: {avg_eff[0]*100:.1f}% | M: {avg_eff[1]*100:.1f}% | N: {avg_eff[2]*100:.1f}% | P: {avg_eff[3]*100:.1f}% -> Detected: {CATEGORIES[np.argmax(avg_eff)].upper()}")
    print(f"  DenseNet121 (Standard CE):")
    print(f"    G: {avg_den[0]*100:.1f}% | M: {avg_den[1]*100:.1f}% | N: {avg_den[2]*100:.1f}% | P: {avg_den[3]*100:.1f}% -> Detected: {CATEGORIES[np.argmax(avg_den)].upper()}")
    print(f"  Ensemble (Combined 80-10-10):")
    print(f"    G: {avg_ensemble[0]*100:.1f}% | M: {avg_ensemble[1]*100:.1f}% | N: {avg_ensemble[2]*100:.1f}% | P: {avg_ensemble[3]*100:.1f}% -> Detected: {CATEGORIES[np.argmax(avg_ensemble)].upper()}")
