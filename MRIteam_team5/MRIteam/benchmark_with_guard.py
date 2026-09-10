"""
benchmark_with_guard.py — Benchmark CHÍNH THỨC (Privacy Guard ON)
==================================================================
Chạy toàn bộ pipeline 3 tầng trên toàn bộ tập Test với Privacy Guard
đang bật.  Guard được tích hợp trực tiếp vào vòng lặp consensus:
nếu should_call_gemini() trả về False (ảnh bị chặn), Gemini KHÔNG
được gọi và kết quả giữ nguyên theo CNN ensemble (fallback an toàn).

Outputs:
    benchmark_guard_ON_results.json  — toàn bộ số liệu để điền bảng
    benchmark_guard_ON_detail.csv    — per-image chi tiết (debug)
    Console                          — bảng kết quả in ra màn hình

Dùng số liệu này cho:
    - Table 2 (chính thức mới)
    - Table 4.4 Ablation — dòng "MAICS (có Privacy Guard)"
    - % ca dùng Tier 3 = Gemini được gọi / tổng conflict

KHÔNG XÓA CHECKPOINT nếu gặp lỗi giữa chừng — chạy lại sẽ resume.
"""

import os
import csv
import json
import random
import time
import numpy as np
import tensorflow as tf
from sklearn.metrics import (accuracy_score, classification_report,
                             confusion_matrix, f1_score, recall_score)
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
from localization import should_call_gemini  # ← Privacy Guard

import builtins
builtins.tf = tf  # type: ignore
import cv2

# ══════════════════════════════════════════════════════════
# CẤU HÌNH
# ══════════════════════════════════════════════════════════
TEST_PATH        = "archive_v2/Testing"
CATEGORIES       = ['glioma', 'meningioma', 'notumor', 'pituitary']
YOLO_MODEL_PATH  = "runs/detect/mri_tumor_det_v3/weights/best.pt"
CHECKPOINT_FILE  = "benchmark_guard_ON_checkpoint.json"
OUTPUT_JSON      = "benchmark_guard_ON_results.json"
OUTPUT_CSV       = "benchmark_guard_ON_detail.csv"

# Chạy TOÀN BỘ — không sample (None = tất cả)
NUM_IMAGES_TO_TEST: int | None = None

# Cho phép load Lambda layer
custom_objects = {'tf': tf}
try:
    tf.keras.config.enable_unsafe_deserialization()
except AttributeError:
    pass

# ══════════════════════════════════════════════════════════
# LOAD MODELS
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
        print("YOLO không tìm thấy, bỏ qua.")
    return cnn_model, eff_model, den_model, yolo_model


# ══════════════════════════════════════════════════════════
# TEMPERATURE SCALING + BayTTA
# ══════════════════════════════════════════════════════════
def apply_temperature_scaling(probs, T=1.3):
    eps = 1e-7
    logits = np.log(probs + eps)
    scaled = logits / T
    exp_s = np.exp(scaled - np.max(scaled, axis=-1, keepdims=True))
    return exp_s / np.sum(exp_s, axis=-1, keepdims=True)


def bayesian_tta_predict(models, img_array):
    img_lr = np.flip(img_array, axis=2)
    pred_res_orig = models[0].predict(res_prep(img_array.copy()), verbose=0)
    pred_eff_orig = apply_temperature_scaling(models[1].predict(eff_prep(img_array.copy()), verbose=0))
    pred_den_orig = apply_temperature_scaling(models[2].predict(den_prep(img_array.copy()), verbose=0))
    pred_res_lr   = models[0].predict(res_prep(img_lr.copy()), verbose=0)
    pred_eff_lr   = apply_temperature_scaling(models[1].predict(eff_prep(img_lr.copy()), verbose=0))
    pred_den_lr   = apply_temperature_scaling(models[2].predict(den_prep(img_lr.copy()), verbose=0))

    w_res, w_eff, w_den = 0.8, 0.1, 0.1
    pred_orig = pred_res_orig*w_res + pred_eff_orig*w_eff + pred_den_orig*w_den
    pred_lr   = pred_res_lr*w_res   + pred_eff_lr*w_eff   + pred_den_lr*w_den

    all_preds = np.array([pred_orig, pred_lr])
    eps = 1e-7
    entropies = -np.sum(all_preds * np.log(all_preds + eps), axis=-1)
    weights = np.exp(-entropies) / np.sum(np.exp(-entropies), axis=0)
    weights = np.expand_dims(weights, axis=-1)
    final_pred = np.sum(all_preds * weights, axis=0)

    preds_stack = np.vstack([pred_res_orig, pred_eff_orig, pred_den_orig])
    uncertainty_score = float(np.max(np.var(preds_stack, axis=0)))
    return final_pred[0], uncertainty_score


# ══════════════════════════════════════════════════════════
# GEMINI CONFLICT RESOLVER (giữ nguyên từ benchmark_consensus.py)
# ══════════════════════════════════════════════════════════
def adaptive_roi_crop(bbox, img_shape):
    x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
    img_h, img_w = img_shape[:2]
    tumor_area_ratio = (w * h) / (img_h * img_w + 1e-7)
    margin = 0.40 if tumor_area_ratio < 0.05 else (0.10 if tumor_area_ratio > 0.30 else 0.25)
    w_e, h_e = int(w * margin), int(h * margin)
    return max(0, x-w_e), max(0, y-h_e), min(img_w, x+w+w_e), min(img_h, y+h+h_e)


def infer_anatomical_location(bbox, img_shape):
    img_h, img_w = img_shape[:2]
    x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
    cx = (x + w/2) / img_w
    cy = (y + h/2) / img_h
    if 0.35 < cx < 0.65 and cy > 0.45:
        return "midline sellar/suprasellar region", "PITUITARY ADENOMA (sellar/suprasellar midline location)"
    elif cx < 0.15 or cx > 0.85 or cy < 0.10 or cy > 0.90:
        return "peripheral convexity/meninges region", "MENINGIOMA (extra-axial, dural-based peripheral location)"
    else:
        return "deep white matter / intra-axial region", "GLIOMA (intra-axial deep parenchymal location)"


def resolve_conflict_with_gemini(client, img_path, cnn_class, cnn_conf,
                                  uncertainty_score, yolo_class, yolo_box_details):
    from google.genai import types

    cnn_is_tumor  = (cnn_class != 'notumor')
    yolo_is_tumor = (yolo_class != 'notumor')

    sys_prompt = """You are a senior neuroradiologist serving as a clinical diagnostic arbitrator.
CRITICAL CONSTRAINTS:
1. Analyze tissue INSIDE the RED bounding box only.
2. If both models agree a tumor is present, 'notumor' is FORBIDDEN.
3. Be decisive. Confidence 0.85-0.99 for clear findings.
OUTPUT FORMAT — strict JSON only:
{"reasoning":"...","confidence":0.0,"verdict":"glioma"|"meningioma"|"pituitary"|"notumor"}"""

    yolo_info = f"Class: {yolo_class}"
    if yolo_box_details:
        yolo_info += (f" (Conf:{round(yolo_box_details['conf']*100,2)}%), "
                      f"Box:[x:{yolo_box_details['x']},y:{yolo_box_details['y']},"
                      f"w:{yolo_box_details['width']},h:{yolo_box_details['height']}]")

    anatomical_hint = ""
    if yolo_box_details:
        img_cv = cv2.imread(img_path)
        if img_cv is not None:
            loc_desc, prior_hint = infer_anatomical_location(yolo_box_details, img_cv.shape)
            anatomical_hint = (f"\n[ANATOMICAL PRIOR] ROI in {loc_desc}. "
                               f"Elevated prior for: {prior_hint}.")

    rule_hints = []
    if cnn_is_tumor and yolo_is_tumor:
        rule_hints.append("⚠ CRITICAL: Both models detect tumor. 'notumor' is PROHIBITED.")
    elif cnn_is_tumor and not yolo_is_tumor:
        rule_hints.append("NOTE: CNN sees tumor, YOLO missed. Inspect carefully.")
    elif not cnn_is_tumor and yolo_is_tumor:
        rule_hints.append("NOTE: YOLO detected mass, CNN voted notumor. Focus on red box.")

    usr_prompt = (
        f"[CLINICAL ARBITRATION]\n"
        f"CNN Ensemble → {cnn_class} (conf:{round(cnn_conf*100,2)}%, unc:{round(uncertainty_score,4)})\n"
        f"YOLOv8 → {yolo_info}{anatomical_hint}\n"
        f"{chr(10).join(rule_hints)}\n"
        "Return strict JSON with keys: reasoning, confidence, verdict."
    )

    img_pil = Image.open(img_path).convert("RGB")
    img_overview = img_pil.copy()
    img_crop_pil = None
    img_zoom_pil = None

    if yolo_box_details:
        draw = ImageDraw.Draw(img_overview)
        bx, by = yolo_box_details['x'], yolo_box_details['y']
        bw, bh = yolo_box_details['width'], yolo_box_details['height']
        draw.rectangle([bx, by, bx+bw, by+bh], outline="red", width=4)
        img_cv2 = cv2.imread(img_path)
        if img_cv2 is not None:
            x1, y1, x2, y2 = adaptive_roi_crop(yolo_box_details, img_cv2.shape)
            img_crop_pil = img_pil.crop((x1, y1, x2, y2))
            img_zoom_pil = img_crop_pil.resize(
                (max(1,(x2-x1)*2), max(1,(y2-y1)*2)), Image.LANCZOS)  # type: ignore

    contents = [usr_prompt, img_overview]
    if img_crop_pil: contents.append(img_crop_pil)
    if img_zoom_pil: contents.append(img_zoom_pil)

    RETRY_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash']
    RETRY_DELAYS = [5, 15, 30]

    for model_name in RETRY_MODELS:
        for attempt, delay in enumerate(RETRY_DELAYS, start=1):
            try:
                if attempt > 1: time.sleep(delay)
                else: time.sleep(1)
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,  # type: ignore
                    config=types.GenerateContentConfig(
                        system_instruction=sys_prompt,
                        temperature=0.2,
                        response_mime_type="application/json"
                    )
                )
                raw_text = response.text.strip() if response.text else ""
                if raw_text.startswith("```json"): raw_text = raw_text[7:-3].strip()
                elif raw_text.startswith("```"):   raw_text = raw_text[3:-3].strip()
                gemini_json = json.loads(raw_text)
                verdict  = str(gemini_json.get("verdict","")).lower().strip()
                vlm_conf = float(gemini_json.get("confidence", 0))

                print(f" [VLM={verdict} conf={vlm_conf:.2f}]", end="")

                if verdict in CATEGORIES:
                    if vlm_conf >= 0.85:
                        if verdict == 'notumor' and cnn_is_tumor and yolo_is_tumor:
                            print(f" (Guard1→{cnn_class})", end="")
                            return cnn_class
                        if verdict == 'notumor' and cnn_is_tumor and not yolo_is_tumor and vlm_conf < 0.97:
                            print(f" (Guard2→{cnn_class})", end="")
                            return cnn_class
                        return verdict
                    else:
                        print(f" (conf<0.85→{cnn_class})", end="")
                        return cnn_class
                return cnn_class

            except Exception as e:
                err_str = str(e)
                if '503' in err_str or 'UNAVAILABLE' in err_str:
                    if attempt < len(RETRY_DELAYS):
                        print(f" [503#{attempt}-retry {RETRY_DELAYS[attempt]}s]", end="", flush=True)
                    else:
                        break
                elif '429' in err_str or 'RATE' in err_str.upper():
                    print(f" [429-30s]", end="", flush=True)
                    time.sleep(30)
                    break
                elif '404' in err_str or 'NOT_FOUND' in err_str:
                    print(f" [404-model gone, trying next]", end="", flush=True)
                    break  # Thử model tiếp theo
                else:
                    print(f" [Err:{e}]", end="")
                    return cnn_class

    print(f" [AllFailed→{cnn_class}]", end="")
    return cnn_class


# ══════════════════════════════════════════════════════════
# MAIN BENCHMARK — GUARD ON
# ══════════════════════════════════════════════════════════
def run_benchmark_guard_on():
    client = GeminiProxy()
    cnn_model, eff_model, den_model, yolo_model = load_all_models()

    # Thu thập tất cả ảnh
    all_images = []
    for cat in CATEGORIES:
        cat_dir = os.path.join(TEST_PATH, cat)
        if os.path.exists(cat_dir):
            for f in sorted(os.listdir(cat_dir)):
                if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                    all_images.append((os.path.join(cat_dir, f), cat))

    random.seed(42)
    random.shuffle(all_images)
    if NUM_IMAGES_TO_TEST:
        test_set = all_images[:NUM_IMAGES_TO_TEST]
    else:
        test_set = all_images  # Toàn bộ

    print(f"\n{'='*60}")
    print(f"  BENCHMARK — Privacy Guard ON")
    print(f"  Tổng ảnh sẽ chạy: {len(test_set)}")
    print(f"{'='*60}\n")

    # Resume từ checkpoint nếu có
    y_true, y_cnn_only, y_final = [], [], []
    conflict_count = 0
    guard_blocked_conflict = 0   # conflict bị chặn bởi guard (không gọi Gemini)
    gemini_called_count = 0      # conflict thực sự gọi Gemini
    resolved_correctly = 0
    start_idx = 0
    detail_rows = []

    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, 'r') as f:
                ckpt = json.load(f)
            y_true              = ckpt.get("y_true", [])
            y_cnn_only          = ckpt.get("y_cnn_only", [])
            y_final             = ckpt.get("y_final", [])
            conflict_count      = ckpt.get("conflict_count", 0)
            guard_blocked_conflict = ckpt.get("guard_blocked_conflict", 0)
            gemini_called_count = ckpt.get("gemini_called_count", 0)
            resolved_correctly  = ckpt.get("resolved_correctly", 0)
            detail_rows         = ckpt.get("detail_rows", [])
            start_idx           = ckpt.get("last_processed_idx", -1) + 1
            print(f"[RESUME] Đang tiếp tục từ ảnh [{start_idx+1}/{len(test_set)}]...")
        except Exception as e:
            print(f"[RESUME ERROR] {e} — bắt đầu mới.")

    for i in range(start_idx, len(test_set)):
        img_path, true_cat = test_set[i]
        print(f"[{i+1}/{len(test_set)}] {true_cat}/{os.path.basename(img_path)}", end="")

        # ── Tier 1: BayTTA CNN Ensemble ──────────────────────────────
        img_array = medical_preprocessing_v2(img_path)
        if img_array is None:
            print(" [SKIP: preprocess failed]")
            continue
        img_array = np.expand_dims(img_array, axis=0)
        probs, uncertainty_score = bayesian_tta_predict(
            [cnn_model, eff_model, den_model], img_array)
        cls_idx   = np.argmax(probs)
        cnn_class = CATEGORIES[cls_idx]
        cnn_conf  = float(probs[cls_idx])
        print(f" CNN={cnn_class}({cnn_conf:.2f})", end="")

        # ── Tier 2: YOLO ──────────────────────────────────────────────
        yolo_class       = "notumor"
        yolo_box_details = None
        if yolo_model:
            results = yolo_model.predict(source=img_path, conf=0.35, verbose=False)
            if (len(results) > 0
                    and getattr(results[0], 'boxes', None) is not None
                    and len(results[0].boxes) > 0):  # type: ignore
                best_box = results[0].boxes[0]  # type: ignore
                yolo_cls_raw = {0:'glioma',1:'meningioma',2:'notumor',3:'pituitary'}.get(
                    int(best_box.cls[0].item()), 'notumor')
                if yolo_cls_raw != 'notumor':
                    yolo_class = yolo_cls_raw
                    x_c, y_c, bw, bh = best_box.xywh[0].tolist()
                    h_img, w_img = results[0].orig_shape
                    xmin, ymin = int(x_c - bw/2), int(y_c - bh/2)
                    yolo_box_details = {
                        "x":      max(0, min(xmin, w_img-1)),
                        "y":      max(0, min(ymin, h_img-1)),
                        "width":  max(10, min(int(bw), w_img-xmin)),
                        "height": max(10, min(int(bh), h_img-ymin)),
                        "conf":   float(best_box.conf[0].item())
                    }

        # ── Conflict Detection ────────────────────────────────────────
        cnn_is_tumor  = (cnn_class != 'notumor')
        yolo_is_tumor = (yolo_class != 'notumor')
        is_conflict   = False

        if not cnn_is_tumor and yolo_is_tumor:
            is_conflict = True
        elif cnn_is_tumor and not yolo_is_tumor:
            is_conflict = (cnn_conf < 0.80 or uncertainty_score > 0.15)
        elif cnn_is_tumor and yolo_is_tumor and cnn_class != yolo_class:
            is_conflict = (cnn_conf < 0.80 or uncertainty_score > 0.15)

        # ── Tier 3: Gemini (chỉ khi có conflict VÀ Guard cho phép) ────
        final_class  = cnn_class
        guard_reason = "no_conflict"
        gemini_used  = False

        if is_conflict:
            conflict_count += 1
            # ★ PRIVACY GUARD ★
            allowed, plane = should_call_gemini(img_path)
            if not allowed:
                guard_blocked_conflict += 1
                guard_reason = f"guard_blocked({plane})"
                # Fallback: giữ CNN (fail-safe, không đoán thêm)
                print(f" CONFLICT→GUARD_BLOCK(plane={plane})", end="")
            else:
                gemini_called_count += 1
                guard_reason = f"gemini_called(plane={plane})"
                print(f" CONFLICT→Gemini(plane={plane})", end="")
                gemini_class = resolve_conflict_with_gemini(
                    client, img_path, cnn_class, cnn_conf,
                    uncertainty_score, yolo_class, yolo_box_details)
                final_class = gemini_class
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
            "img": img_path,
            "true": true_cat,
            "cnn": cnn_class,
            "cnn_conf": round(cnn_conf, 4),
            "yolo": yolo_class,
            "is_conflict": is_conflict,
            "gemini_used": gemini_used,
            "guard_reason": guard_reason,
            "final": final_class,
            "correct": (final_class == true_cat),
        })

        # Checkpoint mỗi 10 ảnh
        if (i + 1) % 10 == 0 or (i + 1) == len(test_set):
            ckpt_data = {
                "last_processed_idx": i,
                "y_true": y_true, "y_cnn_only": y_cnn_only, "y_final": y_final,
                "conflict_count": conflict_count,
                "guard_blocked_conflict": guard_blocked_conflict,
                "gemini_called_count": gemini_called_count,
                "resolved_correctly": resolved_correctly,
                "detail_rows": detail_rows,
            }
            with open(CHECKPOINT_FILE, 'w', encoding='utf-8') as f:
                json.dump(ckpt_data, f, indent=2, ensure_ascii=False)

    # ── Tính kết quả cuối ─────────────────────────────────────────────
    if os.path.exists(CHECKPOINT_FILE):
        os.remove(CHECKPOINT_FILE)
        print("\n[CHECKPOINT] Đã xóa file checkpoint tạm.")

    n = len(y_true)
    acc_cnn    = accuracy_score(y_true, y_cnn_only)
    acc_system = accuracy_score(y_true, y_final)
    f1_cnn     = f1_score(y_true, y_cnn_only,  average='macro')
    f1_system  = f1_score(y_true, y_final,      average='macro')

    # Fatal FNR: glioma bị dự đoán là notumor
    glioma_true   = [1 if t == 'glioma' else 0 for t in y_true]
    glioma_missed = [1 if (t == 'glioma' and p == 'notumor') else 0
                     for t, p in zip(y_true, y_final)]
    fatal_fnr = sum(glioma_missed) / max(sum(glioma_true), 1)

    recall_glioma = recall_score(
        [t == 'glioma' for t in y_true],
        [p == 'glioma' for p in y_final],
        pos_label=True, zero_division=0)

    pct_tier3 = (gemini_called_count / max(n, 1)) * 100

    results = {
        "config":                "Guard ON (manifest+token, no symmetry)",
        "total_images":          n,
        "conflict_count":        conflict_count,
        "guard_blocked_conflict": guard_blocked_conflict,
        "gemini_called_count":   gemini_called_count,
        "pct_tier3_of_total":    round(pct_tier3, 2),
        "acc_cnn_only":          round(float(acc_cnn * 100), 2),
        "acc_system":            round(float(acc_system * 100), 2),
        "f1_macro_cnn":          round(float(f1_cnn * 100), 2),
        "f1_macro_system":       round(float(f1_system * 100), 2),
        "recall_glioma":         round(float(recall_glioma * 100), 2),
        "fatal_fnr_glioma_as_notumor": round(fatal_fnr * 100, 2),
        "classification_report": classification_report(y_true, y_final, output_dict=True),
    }

    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=detail_rows[0].keys())
        writer.writeheader()
        writer.writerows(detail_rows)

    # ── In kết quả ───────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  BENCHMARK — PRIVACY GUARD ON — KẾT QUẢ CHÍNH THỨC")
    print("=" * 65)
    print(f"  Tổng ảnh test             : {n:,}")
    print(f"  Tổng conflict (CNN≠YOLO)  : {conflict_count:,}")
    print(f"  ├─ Guard chặn (blocked)   : {guard_blocked_conflict:,}  "
          f"({guard_blocked_conflict/max(conflict_count,1)*100:.1f}% của conflict)")
    print(f"  └─ Gemini được gọi        : {gemini_called_count:,}  "
          f"({gemini_called_count/max(conflict_count,1)*100:.1f}% của conflict)")
    print(f"  % Tier-3 / tổng ảnh       : {pct_tier3:.1f}%")
    print("-" * 65)
    print(f"  Accuracy — CNN only        : {acc_cnn*100:.2f}%")
    print(f"  Accuracy — Full system     : {acc_system*100:.2f}%  ← Table 2")
    print(f"  F1 Macro — CNN only        : {f1_cnn*100:.2f}%")
    print(f"  F1 Macro — Full system     : {f1_system*100:.2f}%  ← Table 2")
    print(f"  Recall Glioma              : {recall_glioma*100:.2f}%  ← Table 2")
    print(f"  Fatal FNR (Glioma→notumor) : {fatal_fnr*100:.2f}%  ← CHỈ SỐ CHÍNH")
    print("=" * 65)
    print(f"\n  Đã lưu: {OUTPUT_JSON}")
    print(f"  Đã lưu: {OUTPUT_CSV}")
    print(classification_report(y_true, y_final))


if __name__ == "__main__":
    run_benchmark_guard_on()
