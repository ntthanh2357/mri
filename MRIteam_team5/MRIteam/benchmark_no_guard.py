"""
benchmark_no_guard.py — Benchmark BASELINE (Privacy Guard OFF)
================================================================
Chạy toàn bộ pipeline 3 tầng KHÔNG có Privacy Guard (Gemini được gọi
cho mọi ca conflict, không phân biệt axial/sagittal).

Đây là dòng baseline "trước khi có guard" trong bảng ablation (Table 4.4).

QUAN TRỌNG:
  - Script này KHÔNG sửa localization.py.
  - Guard bị tắt bằng cách bỏ qua should_call_gemini() trong vòng lặp.
  - Sau khi chạy xong, KHÔNG cần restore gì cả — code chính không thay đổi.

Outputs:
    benchmark_guard_OFF_results.json  — số liệu điền bảng ablation dòng 1
    benchmark_guard_OFF_detail.csv    — per-image chi tiết
"""

import os
import csv
import json
import random
import time
import numpy as np
import tensorflow as tf
from sklearn.metrics import (accuracy_score, classification_report,
                             f1_score, recall_score)
from PIL import Image, ImageDraw
from dotenv import load_dotenv

import warnings
warnings.filterwarnings('ignore')

load_dotenv()

from gemini_rotator import GeminiProxy
from preprocess import medical_preprocessing_v2
from ultralytics import YOLO  # type: ignore
from tensorflow.keras.applications.resnet_v2 import preprocess_input as res_prep  # type: ignore
from tensorflow.keras.applications.efficientnet_v2 import preprocess_input as eff_prep  # type: ignore
from tensorflow.keras.applications.densenet import preprocess_input as den_prep  # type: ignore
# Guard KHÔNG được import — đây là baseline

import builtins
builtins.tf = tf  # type: ignore
import cv2

# ══════════════════════════════════════════════════════════
# CẤU HÌNH
# ══════════════════════════════════════════════════════════
TEST_PATH        = "archive_v2/Testing"
CATEGORIES       = ['glioma', 'meningioma', 'notumor', 'pituitary']
YOLO_MODEL_PATH  = "runs/detect/mri_tumor_det_v3/weights/best.pt"
CHECKPOINT_FILE  = "benchmark_guard_OFF_checkpoint.json"
OUTPUT_JSON      = "benchmark_guard_OFF_results.json"
OUTPUT_CSV       = "benchmark_guard_OFF_detail.csv"

NUM_IMAGES_TO_TEST: int | None = None  # None = toàn bộ

custom_objects = {'tf': tf}
try:
    tf.keras.config.enable_unsafe_deserialization()
except AttributeError:
    pass


# ══════════════════════════════════════════════════════════
# HELPERS (giống benchmark_with_guard.py)
# ══════════════════════════════════════════════════════════
def load_all_models():
    print("Đang tải các mô hình...")
    cnn_model = tf.keras.models.load_model(
        'models/resnet_risk_calibrated.keras',
        custom_objects=custom_objects, safe_mode=False, compile=False)
    eff_model = tf.keras.models.load_model(
        'models/best_efficientnet_model.keras',
        custom_objects=custom_objects, safe_mode=False, compile=False)
    den_model = tf.keras.models.load_model(
        'models/best_densenet_model.keras',
        custom_objects=custom_objects, safe_mode=False, compile=False)
    try:
        yolo_model = YOLO(YOLO_MODEL_PATH)
        print("YOLO loaded.")
    except Exception:
        yolo_model = None
        print("YOLO không tìm thấy.")
    return cnn_model, eff_model, den_model, yolo_model


def apply_temperature_scaling(probs, T=1.3):
    eps = 1e-7
    logits = np.log(probs + eps)
    scaled = logits / T
    exp_s = np.exp(scaled - np.max(scaled, axis=-1, keepdims=True))
    return exp_s / np.sum(exp_s, axis=-1, keepdims=True)


def bayesian_tta_predict(models, img_array):
    img_lr = np.flip(img_array, axis=2)
    p_res_o = models[0].predict(res_prep(img_array.copy()), verbose=0)
    p_eff_o = apply_temperature_scaling(models[1].predict(eff_prep(img_array.copy()), verbose=0))
    p_den_o = apply_temperature_scaling(models[2].predict(den_prep(img_array.copy()), verbose=0))
    p_res_l = models[0].predict(res_prep(img_lr.copy()), verbose=0)
    p_eff_l = apply_temperature_scaling(models[1].predict(eff_prep(img_lr.copy()), verbose=0))
    p_den_l = apply_temperature_scaling(models[2].predict(den_prep(img_lr.copy()), verbose=0))
    w_r, w_e, w_d = 0.8, 0.1, 0.1
    p_o = p_res_o*w_r + p_eff_o*w_e + p_den_o*w_d
    p_l = p_res_l*w_r + p_eff_l*w_e + p_den_l*w_d
    all_p = np.array([p_o, p_l])
    eps = 1e-7
    ent = -np.sum(all_p * np.log(all_p + eps), axis=-1)
    wts = np.exp(-ent) / np.sum(np.exp(-ent), axis=0)
    wts = np.expand_dims(wts, axis=-1)
    final = np.sum(all_p * wts, axis=0)
    unc = float(np.max(np.var(np.vstack([p_res_o, p_eff_o, p_den_o]), axis=0)))
    return final[0], unc


def adaptive_roi_crop(bbox, img_shape):
    x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
    img_h, img_w = img_shape[:2]
    r = (w*h)/(img_h*img_w+1e-7)
    m = 0.40 if r < 0.05 else (0.10 if r > 0.30 else 0.25)
    return max(0,x-int(w*m)), max(0,y-int(h*m)), min(img_w,x+w+int(w*m)), min(img_h,y+h+int(h*m))


def infer_anatomical_location(bbox, img_shape):
    img_h, img_w = img_shape[:2]
    x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
    cx = (x+w/2)/img_w; cy = (y+h/2)/img_h
    if 0.35 < cx < 0.65 and cy > 0.45:
        return "midline sellar", "PITUITARY"
    elif cx < 0.15 or cx > 0.85 or cy < 0.10 or cy > 0.90:
        return "peripheral", "MENINGIOMA"
    return "deep parenchyma", "GLIOMA"


def resolve_conflict_with_gemini(client, img_path, cnn_class, cnn_conf,
                                  uncertainty_score, yolo_class, yolo_box_details):
    from google.genai import types
    cnn_is_tumor  = (cnn_class != 'notumor')
    yolo_is_tumor = (yolo_class != 'notumor')
    sys_p = ("You are a senior neuroradiologist. Return strict JSON: "
             '{"reasoning":"...","confidence":0.0,"verdict":"glioma"|"meningioma"|"pituitary"|"notumor"}\n'
             "If both models detect tumor, 'notumor' is FORBIDDEN.")
    yolo_info = f"Class:{yolo_class}"
    if yolo_box_details:
        yolo_info += f"(conf:{yolo_box_details['conf']:.2f})"
    rules = []
    if cnn_is_tumor and yolo_is_tumor:
        rules.append("CRITICAL: Both see tumor. notumor PROHIBITED.")
    elif cnn_is_tumor and not yolo_is_tumor:
        rules.append("NOTE: CNN sees tumor, YOLO missed.")
    elif not cnn_is_tumor and yolo_is_tumor:
        rules.append("NOTE: YOLO found mass, CNN voted notumor.")
    usr_p = (f"CNN→{cnn_class}({cnn_conf:.2f}), YOLO→{yolo_info}\n"
             f"{chr(10).join(rules)}\nReturn JSON.")
    img_pil = Image.open(img_path).convert("RGB")
    img_ov  = img_pil.copy()
    img_crop = None; img_zoom = None
    if yolo_box_details:
        draw = ImageDraw.Draw(img_ov)
        bx,by,bw,bh = yolo_box_details['x'],yolo_box_details['y'],yolo_box_details['width'],yolo_box_details['height']
        draw.rectangle([bx,by,bx+bw,by+bh], outline="red", width=4)
        ic = cv2.imread(img_path)
        if ic is not None:
            x1,y1,x2,y2 = adaptive_roi_crop(yolo_box_details, ic.shape)
            img_crop = img_pil.crop((x1,y1,x2,y2))
            img_zoom = img_crop.resize((max(1,(x2-x1)*2),max(1,(y2-y1)*2)), Image.LANCZOS)  # type: ignore
    contents = [usr_p, img_ov]
    if img_crop: contents.append(img_crop)
    if img_zoom: contents.append(img_zoom)
    for model_name in ['gemini-3.1-flash-lite', 'gemini-3.5-flash']:
        for attempt, delay in enumerate([5,15,30], 1):
            try:
                if attempt > 1: time.sleep(delay)
                else: time.sleep(1)
                resp = client.models.generate_content(
                    model=model_name, contents=contents,  # type: ignore
                    config=types.GenerateContentConfig(
                        system_instruction=sys_p, temperature=0.2,
                        response_mime_type="application/json"))
                raw = resp.text.strip() if resp.text else ""
                if raw.startswith("```json"): raw=raw[7:-3].strip()
                elif raw.startswith("```"):   raw=raw[3:-3].strip()
                gj = json.loads(raw)
                v  = str(gj.get("verdict","")).lower().strip()
                vc = float(gj.get("confidence",0))
                print(f" [VLM={v} {vc:.2f}]", end="")
                if v in CATEGORIES:
                    if vc >= 0.85:
                        if v=='notumor' and cnn_is_tumor and yolo_is_tumor:
                            return cnn_class
                        if v=='notumor' and cnn_is_tumor and not yolo_is_tumor and vc<0.97:
                            return cnn_class
                        return v
                    return cnn_class
                return cnn_class
            except Exception as e:
                es = str(e)
                if '503' in es or 'UNAVAILABLE' in es:
                    if attempt < 3: continue
                    break
                elif '429' in es or 'RATE' in es.upper():
                    time.sleep(30); break
                else:
                    return cnn_class
    return cnn_class


# ══════════════════════════════════════════════════════════
# MAIN BENCHMARK — GUARD OFF
# ══════════════════════════════════════════════════════════
def run_benchmark_guard_off():
    client = GeminiProxy()
    cnn_model, eff_model, den_model, yolo_model = load_all_models()

    all_images = []
    for cat in CATEGORIES:
        cat_dir = os.path.join(TEST_PATH, cat)
        if os.path.exists(cat_dir):
            for f in sorted(os.listdir(cat_dir)):
                if f.lower().endswith(('.jpg','.jpeg','.png')):
                    all_images.append((os.path.join(cat_dir,f), cat))

    random.seed(42)
    random.shuffle(all_images)
    test_set = all_images[:NUM_IMAGES_TO_TEST] if NUM_IMAGES_TO_TEST else all_images

    print(f"\n{'='*60}")
    print(f"  BENCHMARK — Privacy Guard OFF (BASELINE for Ablation)")
    print(f"  Tổng ảnh: {len(test_set)}  |  Gemini gọi cho MỌI conflict")
    print(f"{'='*60}\n")

    y_true, y_cnn_only, y_final = [], [], []
    conflict_count = 0
    gemini_called_count = 0
    resolved_correctly = 0
    start_idx = 0
    detail_rows = []

    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, 'r') as f:
                ckpt = json.load(f)
            y_true = ckpt.get("y_true",[])
            y_cnn_only = ckpt.get("y_cnn_only",[])
            y_final = ckpt.get("y_final",[])
            conflict_count = ckpt.get("conflict_count",0)
            gemini_called_count = ckpt.get("gemini_called_count",0)
            resolved_correctly = ckpt.get("resolved_correctly",0)
            detail_rows = ckpt.get("detail_rows",[])
            start_idx = ckpt.get("last_processed_idx",-1) + 1
            print(f"[RESUME] Tiếp tục từ ảnh [{start_idx+1}/{len(test_set)}]...")
        except Exception as e:
            print(f"[RESUME ERROR] {e}")

    for i in range(start_idx, len(test_set)):
        img_path, true_cat = test_set[i]
        print(f"[{i+1}/{len(test_set)}] {true_cat}/{os.path.basename(img_path)}", end="")

        img_array = medical_preprocessing_v2(img_path)
        if img_array is None:
            print(" [SKIP]")
            continue
        img_array = np.expand_dims(img_array, axis=0)
        probs, unc = bayesian_tta_predict([cnn_model, eff_model, den_model], img_array)
        cls_idx   = np.argmax(probs)
        cnn_class = CATEGORIES[cls_idx]
        cnn_conf  = float(probs[cls_idx])
        print(f" CNN={cnn_class}({cnn_conf:.2f})", end="")

        yolo_class = "notumor"; yolo_box_details = None
        if yolo_model:
            res = yolo_model.predict(source=img_path, conf=0.35, verbose=False)
            if len(res)>0 and getattr(res[0],'boxes',None) is not None and len(res[0].boxes)>0:  # type: ignore
                bb = res[0].boxes[0]  # type: ignore
                yr = {0:'glioma',1:'meningioma',2:'notumor',3:'pituitary'}.get(int(bb.cls[0].item()),'notumor')
                if yr != 'notumor':
                    yolo_class = yr
                    xc,yc,bw,bh = bb.xywh[0].tolist()
                    hi,wi = res[0].orig_shape
                    xi,yi = int(xc-bw/2), int(yc-bh/2)
                    yolo_box_details = {"x":max(0,min(xi,wi-1)),"y":max(0,min(yi,hi-1)),
                                        "width":max(10,min(int(bw),wi-xi)),
                                        "height":max(10,min(int(bh),hi-yi)),
                                        "conf":float(bb.conf[0].item())}

        cnn_is_tumor  = (cnn_class != 'notumor')
        yolo_is_tumor = (yolo_class != 'notumor')
        is_conflict   = False
        if not cnn_is_tumor and yolo_is_tumor:
            is_conflict = True
        elif cnn_is_tumor and not yolo_is_tumor:
            is_conflict = (cnn_conf < 0.80 or unc > 0.15)
        elif cnn_is_tumor and yolo_is_tumor and cnn_class != yolo_class:
            is_conflict = (cnn_conf < 0.80 or unc > 0.15)

        final_class = cnn_class
        gemini_used = False

        if is_conflict:
            conflict_count += 1
            gemini_called_count += 1
            # ★ NO GUARD — Gemini called for ALL conflicts ★
            print(f" CONFLICT→Gemini(NO_GUARD)", end="")
            gc = resolve_conflict_with_gemini(
                client, img_path, cnn_class, cnn_conf,
                unc, yolo_class, yolo_box_details)
            final_class = gc
            gemini_used = True
            if final_class == true_cat:
                resolved_correctly += 1
                print(" ✓")
            else:
                print(f" ✗(pred={final_class})")
        else:
            print(f" OK({cnn_class}&{yolo_class})")

        y_true.append(true_cat)
        y_cnn_only.append(cnn_class)
        y_final.append(final_class)
        detail_rows.append({
            "img":img_path,"true":true_cat,"cnn":cnn_class,"cnn_conf":round(cnn_conf,4),
            "yolo":yolo_class,"is_conflict":is_conflict,"gemini_used":gemini_used,
            "final":final_class,"correct":(final_class==true_cat)
        })

        if (i+1)%10==0 or (i+1)==len(test_set):
            with open(CHECKPOINT_FILE,'w',encoding='utf-8') as f:
                json.dump({"last_processed_idx":i,"y_true":y_true,"y_cnn_only":y_cnn_only,
                           "y_final":y_final,"conflict_count":conflict_count,
                           "gemini_called_count":gemini_called_count,
                           "resolved_correctly":resolved_correctly,
                           "detail_rows":detail_rows}, f, indent=2, ensure_ascii=False)

    if os.path.exists(CHECKPOINT_FILE):
        os.remove(CHECKPOINT_FILE)
        print("\n[CHECKPOINT] Đã xóa.")

    n = len(y_true)
    acc_cnn    = accuracy_score(y_true, y_cnn_only)
    acc_system = accuracy_score(y_true, y_final)
    f1_cnn     = f1_score(y_true, y_cnn_only, average='macro')
    f1_system  = f1_score(y_true, y_final,     average='macro')
    glioma_true   = [t=='glioma' for t in y_true]
    glioma_missed = [t=='glioma' and p=='notumor' for t,p in zip(y_true,y_final)]
    fatal_fnr = sum(glioma_missed)/max(sum(glioma_true),1)
    recall_glioma = recall_score(glioma_true,[p=='glioma' for p in y_final],
                                 pos_label=True, zero_division=0)
    pct_tier3 = (gemini_called_count/max(n,1))*100

    results = {
        "config":              "Guard OFF — Gemini called for ALL conflicts (ablation baseline)",
        "total_images":        n,
        "conflict_count":      conflict_count,
        "gemini_called_count": gemini_called_count,
        "pct_tier3_of_total":  round(float(pct_tier3), 2),
        "acc_cnn_only":        round(float(acc_cnn*100), 2),
        "acc_system":          round(float(acc_system*100), 2),
        "f1_macro_cnn":        round(float(f1_cnn*100), 2),
        "f1_macro_system":     round(float(f1_system*100), 2),
        "recall_glioma":       round(float(recall_glioma*100), 2),
        "fatal_fnr_glioma_as_notumor": round(fatal_fnr*100, 2),
        "classification_report": classification_report(y_true, y_final, output_dict=True),
    }
    with open(OUTPUT_JSON,'w',encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    with open(OUTPUT_CSV,'w',newline='',encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=detail_rows[0].keys())
        writer.writeheader(); writer.writerows(detail_rows)

    print("\n" + "="*65)
    print("  BENCHMARK — GUARD OFF — KẾT QUẢ (dùng làm baseline ablation)")
    print("="*65)
    print(f"  Tổng ảnh test             : {n:,}")
    print(f"  Conflict (CNN≠YOLO)       : {conflict_count:,}")
    print(f"  Gemini được gọi           : {gemini_called_count:,}  (= tất cả conflict)")
    print(f"  % Tier-3 / tổng ảnh       : {pct_tier3:.1f}%  (≈ 100% of conflict)")
    print("-"*65)
    print(f"  Accuracy — CNN only        : {acc_cnn*100:.2f}%")
    print(f"  Accuracy — Full system     : {acc_system*100:.2f}%")
    print(f"  F1 Macro                   : {f1_system*100:.2f}%")
    print(f"  Recall Glioma              : {recall_glioma*100:.2f}%")
    print(f"  Fatal FNR (Glioma→notumor) : {fatal_fnr*100:.2f}%")
    print("="*65)
    print(f"  Đã lưu: {OUTPUT_JSON}")
    print(f"  Đã lưu: {OUTPUT_CSV}")
    print(classification_report(y_true, y_final))


if __name__ == "__main__":
    run_benchmark_guard_off()
