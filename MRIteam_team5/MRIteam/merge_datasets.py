import os
import shutil
import glob
from pathlib import Path
import numpy as np

# Sources and Dest
ARCHIVE_LABEL = Path(r"c:\Users\Administrator\OneDrive\Desktop\MRIteam\MRIteam\archive_label")
ARCHIVE_V2 = Path(r"c:\Users\Administrator\OneDrive\Desktop\MRIteam\MRIteam\archive_v2")
COMBINED_DIR = Path(r"c:\Users\Administrator\OneDrive\Desktop\MRIteam\MRIteam\combined_dataset")
MODEL_PATH = Path(r"c:\Users\Administrator\OneDrive\Desktop\MRIteam\MRIteam\runs\detect\mri_tumor_det_v3\weights\best.pt")

# Map folder name to YOLO Class ID
CLASS_MAP = {
    "glioma": 0,
    "meningioma": 1,
    "notumor": 2,
    "pituitary": 3,
    "Glioma": 0,
    "Meningioma": 1,
    "No Tumor": 2,
    "Pituitary": 3
}

def get_average_bboxes():
    """Calculate fallback average bounding box for each class"""
    print("Calculating fallback average bounding boxes...")
    bboxes = {0: [], 1: [], 2: [], 3: []}
    
    for label_file in ARCHIVE_LABEL.rglob("*.txt"):
        if "labels.cache" in label_file.name:
            continue
        try:
            with open(label_file, "r") as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) == 5:
                        cls = int(parts[0])
                        box = [float(x) for x in parts[1:]]
                        if cls in bboxes:
                            bboxes[cls].append(box)
        except Exception as e:
            print(f"Error reading {label_file}: {e}")
            
    fallbacks = {}
    for cls, boxes in bboxes.items():
        if boxes:
            fallbacks[cls] = np.mean(boxes, axis=0).tolist()
        else:
            fallbacks[cls] = [0.5, 0.5, 0.5, 0.5]
        print(f"  Class {cls}: Fallback bbox = {fallbacks[cls]}")
    return fallbacks

def copy_archive_label():
    """Copy archive_label to flat structure combined_dataset"""
    print("Copying archive_label to combined_dataset...")
    for split in ["Train", "Val"]:
        dest_split = "train" if split == "Train" else "val"
        dest_img_dir = COMBINED_DIR / dest_split / "images"
        dest_lbl_dir = COMBINED_DIR / dest_split / "labels"
        
        dest_img_dir.mkdir(parents=True, exist_ok=True)
        dest_lbl_dir.mkdir(parents=True, exist_ok=True)
        
        split_dir = ARCHIVE_LABEL / split
        for class_dir in split_dir.iterdir():
            if not class_dir.is_dir():
                continue
            
            # Copy images
            img_dir = class_dir / "images"
            if img_dir.exists():
                for img_path in img_dir.glob("*.[jJ][pP]*[gG]"):
                    shutil.copy(img_path, dest_img_dir / img_path.name)
                    
            # Copy labels
            lbl_dir = class_dir / "labels"
            if lbl_dir.exists():
                for lbl_path in lbl_dir.glob("*.txt"):
                    shutil.copy(lbl_path, dest_lbl_dir / lbl_path.name)
    print("Archive_label copied successfully.")

def auto_label_archive_v2(fallbacks):
    """Auto-label archive_v2 using trained model and merge into combined_dataset"""
    print("Loading YOLOv8 model for auto-labeling...")
    try:
        from ultralytics import YOLO
        model = YOLO(MODEL_PATH)
    except Exception as e:
        print(f"Could not load model from {MODEL_PATH}: {e}")
        print("Fallback to average bboxes for all new data.")
        model = None

    dest_train_img = COMBINED_DIR / "train" / "images"
    dest_train_lbl = COMBINED_DIR / "train" / "labels"
    dest_val_img = COMBINED_DIR / "val" / "images"
    dest_val_lbl = COMBINED_DIR / "val" / "labels"

    splits = [("Training", dest_train_img, dest_train_lbl), 
              ("Testing", dest_val_img, dest_val_lbl)]

    for src_split, dest_img, dest_lbl in splits:
        split_path = ARCHIVE_V2 / src_split
        if not split_path.exists():
            continue
            
        print(f"Processing split {src_split}...")
        for class_dir in split_path.iterdir():
            if not class_dir.is_dir():
                continue
            
            class_name = class_dir.name
            target_class_id = CLASS_MAP.get(class_name)
            if target_class_id is None:
                print(f"Skipping unknown dir: {class_name}")
                continue
                
            print(f"  Auto-labeling class: {class_name} (ID: {target_class_id})")
            
            images = list(class_dir.glob("*.[jJ][pP]*[gG]"))
            if not images:
                continue
                
            batch_size = 32
            for i in range(0, len(images), batch_size):
                batch = images[i:i+batch_size]
                
                results = []
                if model is not None:
                    try:
                        results = model.predict(batch, verbose=False, conf=0.2)
                    except Exception as e:
                        print(f"Error predicting batch: {e}")
                        results = [None] * len(batch)
                else:
                    results = [None] * len(batch)
                
                for img_path, res in zip(batch, results):
                    new_img_name = f"v2_{img_path.name}"
                    new_lbl_name = f"v2_{img_path.stem}.txt"
                    
                    shutil.copy(img_path, dest_img / new_img_name)
                    
                    labels_to_write = []
                    
                    boxes = res.boxes if res is not None else None
                    if boxes is not None and len(boxes) > 0:
                        found_target = False
                        for box in boxes:
                            cls_id = int(box.cls[0].item())
                            if cls_id == target_class_id:
                                xywh = box.xywhn[0].tolist()
                                labels_to_write.append(f"{target_class_id} " + " ".join(f"{x:.6f}" for x in xywh))
                                found_target = True
                        
                        if not found_target:
                            best_box = boxes[0]
                            xywh = best_box.xywhn[0].tolist()
                            labels_to_write.append(f"{target_class_id} " + " ".join(f"{x:.6f}" for x in xywh))
                    
                    if not labels_to_write:
                        fallback_box = fallbacks[target_class_id]
                        labels_to_write.append(f"{target_class_id} " + " ".join(f"{x:.6f}" for x in fallback_box))
                        
                    with open(dest_lbl / new_lbl_name, "w") as f:
                        f.write("\n".join(labels_to_write) + "\n")
                        
    print("Auto-labeling completed for archive_v2.")

def create_yaml():
    """Create new dataset YAML file"""
    yaml_content = f"""path: {COMBINED_DIR.as_posix()}
train: train/images
val: val/images

nc: 4
names:
  0: Glioma
  1: Meningioma
  2: No Tumor
  3: Pituitary
"""
    yaml_path = Path(r"c:\Users\Administrator\OneDrive\Desktop\MRIteam\MRIteam\combined_data.yaml")
    with open(yaml_path, "w") as f:
        f.write(yaml_content)
    print(f"Created new dataset YAML at: {yaml_path}")

if __name__ == "__main__":
    COMBINED_DIR.mkdir(parents=True, exist_ok=True)
    fallbacks = get_average_bboxes()
    copy_archive_label()
    auto_label_archive_v2(fallbacks)
    create_yaml()
    print("\n" + "="*50)
    print(" DATASET MERGING COMPLETED!")
    print("="*50)
    print(f"Combined dataset location: {COMBINED_DIR}")
    print("Use combined_data.yaml to retrain your model.")
