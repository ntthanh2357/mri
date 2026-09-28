# -*- coding: utf-8 -*-
import sys
import io
import os
import glob
from ultralytics import YOLO

# Ensure UTF-8 output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Path to YOLO model
yolo_model_path = r"runs/detect/mri_tumor_det_v3/weights/best.pt"
if not os.path.exists(yolo_model_path):
    print("YOLO model weights not found.")
    sys.exit(1)

print("Loading YOLOv8 model...")
yolo_model = YOLO(yolo_model_path)
print("YOLOv8 loaded.")

# Classes mapping
class_names = {0: 'glioma', 1: 'meningioma', 2: 'notumor', 3: 'pituitary'}

# Phung Tao directory
patient_dir = r"c:\Users\Administrator\Downloads\Archive (1)\Phung Tao"
subdirs = glob.glob(os.path.join(patient_dir, "*", "*"))
if not subdirs:
    subdirs = glob.glob(os.path.join(patient_dir, "*"))

print("\nRunning YOLO detection on all slices of patient: Phung Tao...")

detections_found = []

for sd in subdirs:
    if not os.path.isdir(sd):
        continue
    seq_name = os.path.basename(sd)
    
    # Skip localizers and screen saves
    if "localizer" in seq_name.lower() or "screen_save" in seq_name.lower():
        continue
        
    images = [os.path.join(sd, f) for f in os.listdir(sd) if f.lower().endswith(('.jpg', '.png'))]
    if not images:
        continue
        
    print(f"\nScanning sequence: {seq_name} ({len(images)} images)...")
    
    for img_path in images:
        results = yolo_model.predict(source=img_path, conf=0.25, verbose=False)
        if len(results) > 0:
            boxes = getattr(results[0], 'boxes', None)
            if boxes is not None and len(boxes) > 0:
                for box in boxes:
                    cls_idx = int(box.cls[0].item())
                    conf = float(box.conf[0].item())
                    label = class_names.get(cls_idx, 'unknown')
                    xyxy = box.xyxy[0].tolist()
                    
                    detections_found.append({
                        "sequence": seq_name,
                        "image": os.path.basename(img_path),
                        "label": label,
                        "conf": conf,
                        "box": xyxy
                    })
                    print(f"  [FOUND] Image: {os.path.basename(img_path)} | Class: {label.upper()} | Conf: {conf*100:.2f}% | Box: {xyxy}")

if not detections_found:
    print("\nNo tumors detected by YOLOv8 on any slices of Phung Tao.")
else:
    print(f"\nTotal detections found: {len(detections_found)}")
    # Summarize detections
    summary: dict[str, int] = {}
    for d in detections_found:
        label = str(d["label"])
        summary[label] = summary.get(label, 0) + 1
    print("Summary of detected classes:")
    for lbl, count in summary.items():
        print(f"  {lbl.upper()}: {count} slices")
