import os
import random
import numpy as np
import tensorflow as tf
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
from PIL import Image, ImageDraw
from dotenv import load_dotenv
from google import genai
from google.genai import types
from gemini_rotator import GeminiProxy

# Tắt cảnh báo
import warnings
warnings.filterwarnings('ignore')

load_dotenv()
client = GeminiProxy()

# Import logic tiền xử lý và YOLO
from preprocess import medical_preprocessing_v2
from ultralytics import YOLO
from tensorflow.keras.applications.resnet_v2 import preprocess_input as res_prep # type: ignore
from tensorflow.keras.applications.efficientnet_v2 import preprocess_input as eff_prep # type: ignore
from tensorflow.keras.applications.densenet import preprocess_input as den_prep # type: ignore
import time

# ==========================================================
# CẤU HÌNH
# ==========================================================
TEST_PATH = "archive_v2/Testing"
CATEGORIES = ['glioma', 'meningioma', 'notumor', 'pituitary']
CNN_MODEL_PATH = "models/resnet_risk_calibrated.keras"
YOLO_MODEL_PATH = "runs/detect/mri_tumor_det_v3/weights/best.pt"
NUM_IMAGES_TO_TEST = 2200 # Số lượng ảnh để test nhanh (tránh limit API)

# Cho phép load Lambda layer
import builtins
builtins.tf = tf # type: ignore
custom_objects = {'tf': tf}
try:
    tf.keras.config.enable_unsafe_deserialization()
except AttributeError:
    pass

def load_all_models():
    print("Đang tải các mô hình (Vui lòng đợi)...")
    print("1. Đang tải ResNet50V2...")
    cnn_model = tf.keras.models.load_model('models/resnet_risk_calibrated.keras', custom_objects=custom_objects, safe_mode=False, compile=False)
    print("2. Đang tải EfficientNetV2...")
    eff_model = tf.keras.models.load_model('models/best_efficientnet_model.keras', custom_objects=custom_objects, safe_mode=False, compile=False)
    print("3. Đang tải DenseNet121...")
    den_model = tf.keras.models.load_model('models/best_densenet_model.keras', custom_objects=custom_objects, safe_mode=False, compile=False)
    print("4. Đang tải YOLOv8...")
    try:
        yolo_model = YOLO(YOLO_MODEL_PATH)
    except:
        yolo_model = None
        print("Không tìm thấy mô hình YOLO.")
    
    return cnn_model, eff_model, den_model, yolo_model

# ==========================================================
# HÀM TRỢ GIÚP
# ==========================================================
import cv2

def adaptive_roi_crop(bbox, img_shape):
    """Tính toán vùng cắt ROI với margin động dựa trên kích thước tương đối của khối u."""
    x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
    img_h, img_w = img_shape[:2]
    tumor_area_ratio = (w * h) / (img_h * img_w + 1e-7)

    if tumor_area_ratio < 0.05:   # U nhỏ: mở rộng nhiều để lấy context mô xung quanh
        margin = 0.40
    elif tumor_area_ratio > 0.30: # U lớn: mở rộng ít, tránh nhiễu nền hộp sọ
        margin = 0.10
    else:                          # Trung bình
        margin = 0.25

    w_expand = int(w * margin)
    h_expand = int(h * margin)
    x1 = max(0, x - w_expand)
    y1 = max(0, y - h_expand)
    x2 = min(img_w, x + w + w_expand)
    y2 = min(img_h, y + h + h_expand)
    return x1, y1, x2, y2


def infer_anatomical_location(bbox, img_shape):
    """Suy luận vị trí giải phẫu từ tọa độ bbox để tạo prior y tế cho prompt."""
    img_h, img_w = img_shape[:2]
    x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
    cx = (x + w / 2) / img_w  # Tọa độ trung tâm ngang (0=trái, 1=phải)
    cy = (y + h / 2) / img_h  # Tọa độ trung tâm dọc (0=trên, 1=dưới)

    # Gần đường giữa ngang và phần dưới/giữa não → Pituitary
    if 0.35 < cx < 0.65 and cy > 0.45:
        return "midline sellar/suprasellar region", "PITUITARY ADENOMA (sellar/suprasellar midline location)"
    # Ngoại vi não (gần hộp sọ) → Meningioma (tế bào màng não)
    elif cx < 0.15 or cx > 0.85 or cy < 0.10 or cy > 0.90:
        return "peripheral convexity/meninges region", "MENINGIOMA (extra-axial, dural-based peripheral location)"
    # Phần trong sâu của nhu mô → Glioma
    else:
        return "deep white matter / intra-axial region", "GLIOMA (intra-axial deep parenchymal location)"


def resolve_conflict_with_gemini(img_path, cnn_class, cnn_conf, uncertainty_score, yolo_class, yolo_box_details):
    """Sử dụng Gemini để phân xử khi CNN và YOLO lệch nhau.
    Áp dụng:
    - Multi-scale ROI (3 ảnh: tổng quan, adaptive crop, 2x zoom)
    - Anatomical prior anchoring từ tọa độ bbox
    - Chain-of-Thought với self-criticism JSON schema
    - Guard: không chấp nhận 'notumor' nếu cả hai mô hình đã thấy u
    """
    import json
    cnn_is_tumor = (cnn_class != 'notumor')
    yolo_is_tumor = (yolo_class != 'notumor')

    sys_prompt = """You are a senior neuroradiologist serving as a clinical diagnostic arbitrator for a multi-model AI consensus system.
You will receive up to THREE images for context:
  - Image 1 (Overview): Full brain MRI with a RED bounding box marking the suspected tumor ROI detected by YOLOv8.
  - Image 2 (Adaptive Crop): A contextual crop of the ROI with adaptive margins for tissue context.
  - Image 3 (2× Zoom): The same ROI zoomed in at 2× resolution to reveal micro-textures, border sharpness, and signal gradients.

  HOSPITAL DATASET CONTEXT:
  Real-world hospital scans may have noise, varying contrast, slice-thickness artifacts, and subtle early-stage tumors.
  Do NOT dismiss a region as normal based on low conspicuity alone.

  CRITICAL CONSTRAINTS:
  1. You MUST analyze the tissue INSIDE the RED bounding box (or the cropped region if no bbox is visible).
     Do NOT base your verdict on tissue outside this ROI.
  2. Be decisive. Calibrate your confidence honestly: 0.85–0.99 for clear findings, <0.75 only for genuinely uninterpretable scans.
  3. If both models agree a tumor is present (neither predicted 'notumor'), you MUST select one of ('glioma','meningioma','pituitary'). 'notumor' is FORBIDDEN in this case.
  4. If the ensemble detected a tumor but YOLO missed it (no bbox), look carefully for subtle lesions, edema, or midline shift before concluding 'notumor'.

  ANATOMICAL DIAGNOSTIC CRITERIA:
  - Glioma:      Intra-axial, irregular/infiltrative borders, surrounding vasogenic edema (T2/FLAIR hyperintensity).
  - Meningioma:  Extra-axial, well-defined, dural-tail attachment, homogeneous contrast enhancement, compresses rather than invades.
  - Pituitary:   Midline sellar/suprasellar mass, potential optic chiasm compression, 'snowman sign'.
  - No Tumor:    Symmetric brain, normal CSF spaces, no mass effect, centered midline.

  OUTPUT FORMAT — strict JSON only:
  {
    "reasoning": "Step-by-step clinical review of the ROI. Reference specific anatomical features observed.",
    "anatomical_location_assessment": "Describe where in the brain the ROI is located and what structures are adjacent.",
    "differential_diagnosis": "Secondary diagnosis considered and why it was ruled out.",
    "contradictory_evidence": "List at least 2 features in the ROI that ARGUE AGAINST your primary verdict (self-criticism).",
    "confidence": 0.0-1.0 (float, your calibrated diagnostic certainty; typically 0.85-0.99 for clear cases, only below 0.75 if scan is genuinely uninterpretable),
    "verdict": "glioma" | "meningioma" | "pituitary" | "notumor"
  }"""

    # ── Chuẩn bị thông tin YOLO ──
    yolo_info = f"Class: {yolo_class}"
    if yolo_box_details:
        yolo_info += (f" (Confidence: {round(yolo_box_details['conf']*100, 2)}%), "
                      f"ROI Box: [x:{yolo_box_details['x']}, y:{yolo_box_details['y']}, "
                      f"w:{yolo_box_details['width']}, h:{yolo_box_details['height']}]")
    else:
        yolo_info += " (No bounding box detected — possible false negative)"

    # ── Anatomical Prior từ vị trí bbox ──
    anatomical_hint = ""
    if yolo_box_details:
        img_cv = cv2.imread(img_path)
        if img_cv is not None:
            loc_desc, prior_hint = infer_anatomical_location(yolo_box_details, img_cv.shape)
            anatomical_hint = (
                f"\n[ANATOMICAL PRIOR] The ROI centroid is located in the {loc_desc}. "
                f"Statistically, this position has elevated prior probability for: {prior_hint}. "
                f"Adjust your differential accordingly, but do not override clear visual evidence."
            )

    # ── Ràng buộc lâm sàng ──
    rule_hints = []
    if cnn_is_tumor and yolo_is_tumor:
        rule_hints.append(
            "⚠ CRITICAL: Both models detect a tumor. You MUST choose ('glioma'|'meningioma'|'pituitary'). "
            "Returning 'notumor' is PROHIBITED."
        )
    elif cnn_is_tumor and not yolo_is_tumor:
        rule_hints.append(
            "NOTE: CNN ensemble detected a tumor but YOLOv8 missed it (high false-negative rate on small/low-contrast tumors). "
            "Inspect very carefully for subtle lesions before concluding 'notumor'."
        )
    elif not cnn_is_tumor and yolo_is_tumor:
        rule_hints.append(
            "NOTE: YOLOv8 detected a tumor mass but the CNN ensemble voted 'notumor'. "
            "Focus on the red-boxed region — the localisation is the key evidence here."
        )
    rule_hint_str = "\n".join(rule_hints)

    usr_prompt = f"""[CLINICAL DIAGNOSTIC ARBITRATION — Location-Grounded Analysis]

MODEL VOTES:
  • CNN Ensemble  → {cnn_class} (Confidence: {round(cnn_conf*100, 2)}%, Uncertainty score: {round(uncertainty_score, 4)})
  • YOLOv8 Detector → {yolo_info}
{anatomical_hint}

VISUAL INPUTS PROVIDED:
  • Image 1 — Full scan with RED bounding box on the suspected ROI (overview context).
  • Image 2 — Adaptive-margin crop of the ROI (standard contextual detail).
  • Image 3 — 2× zoomed ROI (micro-texture, border sharpness, signal gradients).

⚠ FOCUS RULE: Restrict your analysis EXCLUSIVELY to the tissue INSIDE the RED bounding box / cropped region.
Do NOT let normal brain tissue outside this box influence your verdict.

{rule_hint_str}

Produce your full chain-of-thought and then output a single valid JSON object matching the required schema."""

    # ── Chuẩn bị ảnh: 3 scale ──
    img_pil = Image.open(img_path).convert("RGB")
    img_overview = img_pil.copy()   # Image 1: tổng quan với bbox
    img_crop_pil = None             # Image 2: adaptive crop
    img_zoom_pil = None             # Image 3: 2x zoom

    if yolo_box_details:
        # Vẽ khung đỏ lên ảnh tổng quan (Image 1)
        draw = ImageDraw.Draw(img_overview)
        bx = yolo_box_details['x']
        by = yolo_box_details['y']
        bw = yolo_box_details['width']
        bh = yolo_box_details['height']
        draw.rectangle([bx, by, bx + bw, by + bh], outline="red", width=4)

        # Tính adaptive margin crop (Image 2)
        img_cv2 = cv2.imread(img_path)
        if img_cv2 is not None:
            x1, y1, x2, y2 = adaptive_roi_crop(yolo_box_details, img_cv2.shape)
            img_crop_pil = img_pil.crop((x1, y1, x2, y2))

            # 2× zoom (Image 3) bằng nội suy Lanczos chất lượng cao
            zoom_w = max(1, (x2 - x1) * 2)
            zoom_h = max(1, (y2 - y1) * 2)
            # pyrefly: ignore [missing-attribute]
            img_zoom_pil = img_crop_pil.resize((zoom_w, zoom_h), Image.LANCZOS)

    contents = [usr_prompt, img_overview]
    if img_crop_pil:
        contents.append(img_crop_pil)
    if img_zoom_pil:
        contents.append(img_zoom_pil)

    # ──────────────────────────────────────────────────
    # Retry với exponential backoff + fallback model
    # ──────────────────────────────────────────────────
    RETRY_MODELS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite']
    RETRY_DELAYS = [5, 15, 30]  # seconds cho mỗi lần thử lại

    def _call_api(model_name):
        return client.models.generate_content(
            model=model_name,
            contents=contents, # type: ignore
            config=types.GenerateContentConfig(
                system_instruction=sys_prompt,
                temperature=0.2,
                response_mime_type="application/json"
            )
        )

    def _parse_response(response):
        raw_text = response.text.strip() if response.text else ""
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:-3].strip()
        gemini_json = json.loads(raw_text)
        verdict = str(gemini_json.get("verdict", "")).lower().strip()
        vlm_conf = float(gemini_json.get("confidence", 0))
        return verdict, vlm_conf

    for model_name in RETRY_MODELS:
        success = False
        for attempt, delay in enumerate(RETRY_DELAYS, start=1):
            try:
                if attempt > 1:
                    time.sleep(delay)  # Chỉ sleep giữa các retry, không sleep lần đầu
                else:
                    time.sleep(1)  # 1s để tránh Rate Limit nhẹ
                response = _call_api(model_name)
                verdict, vlm_conf = _parse_response(response)
                print(f" [DEBUG: VLM={verdict} (conf={vlm_conf:.2f}), cnn_is_tumor={cnn_is_tumor}, yolo_is_tumor={yolo_is_tumor}]", end="")

                if verdict in CATEGORIES:
                    if vlm_conf >= 0.85:
                        # Guard 1: Cả hai đều thấy u → không chấp nhận 'notumor' từ Gemini
                        if verdict == 'notumor' and cnn_is_tumor and yolo_is_tumor:
                            print(f" (Guard-1: cả hai thấy u -> chặn notumor, fallback: {cnn_class})", end="")
                            return cnn_class

                        # Guard-2: CNN thấy u nhưng YOLO miss → yêu cầu ngưỡng 0.97 để đổi sang notumor
                        # (đây là tình huống false-negative nguy hiểm nhất: bỏ sót u)
                        if verdict == 'notumor' and cnn_is_tumor and not yolo_is_tumor:
                            if vlm_conf < 0.97:
                                print(f" (Guard-2: CNN thấy u, VLM muốn notumor nhưng conf {vlm_conf:.2f} < 0.97 -> fallback: {cnn_class})", end="")
                                success = True
                                return cnn_class

                        success = True
                        return verdict
                    else:
                        print(f" (VLM Conf {vlm_conf:.2f} < 0.85 -> Fallback: {cnn_class})", end="")
                        success = True
                        return cnn_class
                success = True
                return cnn_class

            except Exception as e:
                err_str = str(e)
                if '503' in err_str or 'UNAVAILABLE' in err_str:
                    if attempt < len(RETRY_DELAYS):
                        print(f" [503 #{attempt} - model={model_name}. Retry sau {RETRY_DELAYS[attempt]}s...]", end="", flush=True)
                    else:
                        print(f" [503 #{attempt} - model={model_name} hết lượt. Thử model tiếp theo...]", end="", flush=True)
                        break  # Thử model tiếp theo
                elif '429' in err_str or 'RATE' in err_str.upper():
                    print(f" [429 Rate Limit - Nghỉ 30s...]", end="", flush=True)
                    time.sleep(30)
                    break
                else:
                    print(f" (Lỗi API [{model_name}]: {e})", end="")
                    return cnn_class
        if success:
            break  # Đã có kết quả thành công, không cần thử model tiếp theo

    # Tất cả model và retry đều thất bại → Fallback về Ensemble
    print(f" [Tất cả Gemini model thất bại -> Fallback: {cnn_class}]", end="")
    return cnn_class


def apply_temperature_scaling(probs, T=1.3):
    """Áp dụng Temperature Scaling cho xác suất đầu ra để giảm lỗi quá tự tin (overconfidence)"""
    eps = 1e-7
    logits = np.log(probs + eps)
    scaled_logits = logits / T
    exp_logits = np.exp(scaled_logits - np.max(scaled_logits, axis=-1, keepdims=True))
    return exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)

# ==========================================================
# TEST-TIME AUGMENTATION (TTA) + BAYESIAN AVERAGING (BayTTA)
# ==========================================================
def bayesian_tta_predict(models, img_array):
    """
    Thực hiện TTA với 2 biến thể: Gốc, Lật ngang.
    Sử dụng Bayesian Averaging (trọng số nghịch đảo Entropy) để tổng hợp kết quả.
    Trả về: (final_pred_probs, uncertainty_score)
    """
    img_orig = img_array
    img_lr = np.flip(img_array, axis=2) # Lật ngang (Horizontal)
    
    # Dự đoán trên ảnh gốc
    pred_res_orig = models[0].predict(res_prep(img_orig.copy()), verbose=0)
    pred_eff_orig = apply_temperature_scaling(models[1].predict(eff_prep(img_orig.copy()), verbose=0))
    pred_den_orig = apply_temperature_scaling(models[2].predict(den_prep(img_orig.copy()), verbose=0))
    
    # Dự đoán trên ảnh lật ngang
    pred_res_lr = models[0].predict(res_prep(img_lr.copy()), verbose=0)
    pred_eff_lr = apply_temperature_scaling(models[1].predict(eff_prep(img_lr.copy()), verbose=0))
    pred_den_lr = apply_temperature_scaling(models[2].predict(den_prep(img_lr.copy()), verbose=0))
    
    # Tối ưu hóa trọng số: ResNet50 chiếm ưu thế lớn (0.80), các mô hình khác đóng vai trò bổ trợ (0.10)
    w_res, w_eff, w_den = 0.8, 0.1, 0.1
    pred_orig = (pred_res_orig * w_res) + (pred_eff_orig * w_eff) + (pred_den_orig * w_den)
    pred_lr = (pred_res_lr * w_res) + (pred_eff_lr * w_eff) + (pred_den_lr * w_den)
    
    all_preds = np.array([pred_orig, pred_lr]) # shape (2, 1, 4)
    
    # Tính Entropy cho từng góc nhìn (BayTTA)
    eps = 1e-7
    entropies = -np.sum(all_preds * np.log(all_preds + eps), axis=-1) # shape (2, 1)
    
    # Trọng số Bayesian (Softmax của nghịch đảo Entropy)
    weights = np.exp(-entropies) / np.sum(np.exp(-entropies), axis=0) # shape (2, 1)
    weights = np.expand_dims(weights, axis=-1) # shape (2, 1, 1)
    
    # BayTTA: Trung bình có trọng số
    final_pred = np.sum(all_preds * weights, axis=0) # shape (1, 4)
    
    # Tính phương sai (variance) của các dự đoán để đo lường độ không chắc chắn (Uncertainty) dựa trên ảnh gốc
    preds_stack = np.vstack([pred_res_orig, pred_eff_orig, pred_den_orig])
    ensemble_variance = np.var(preds_stack, axis=0)
    uncertainty_score = float(np.max(ensemble_variance))
    
    return final_pred[0], uncertainty_score

# ==========================================================
# MAIN BENCHMARK LOOP
# ==========================================================
def run_system_benchmark():
    cnn_model, eff_model, den_model, yolo_model = load_all_models()
    
    # Thu thập ảnh
    all_images = []
    for cat in CATEGORIES:
        cat_dir = os.path.join(TEST_PATH, cat)
        if os.path.exists(cat_dir):
            for f in os.listdir(cat_dir):
                all_images.append((os.path.join(cat_dir, f), cat))
    
    # Shuffle và lấy sample
    random.seed(42)
    random.shuffle(all_images)
    test_set = all_images[:NUM_IMAGES_TO_TEST]
    
    # File checkpoint lưu trạng thái
    CHECKPOINT_FILE = "benchmark_checkpoint.json"
    
    y_true = []
    y_cnn_only = []
    y_final_consensus = []
    
    conflict_count = 0
    resolved_correctly = 0
    start_idx = 0
    
    import json
    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, 'r') as f:
                ckpt = json.load(f)
            # Khôi phục trạng thái cũ
            y_true = ckpt.get("y_true", [])
            y_cnn_only = ckpt.get("y_cnn_only", [])
            y_final_consensus = ckpt.get("y_final_consensus", [])
            conflict_count = ckpt.get("conflict_count", 0)
            resolved_correctly = ckpt.get("resolved_correctly", 0)
            start_idx = ckpt.get("last_processed_idx", -1) + 1
            print(f"\n[RESUME] Phát hiện checkpoint cũ. Đang khôi phục và chạy tiếp từ ảnh thứ [{start_idx + 1}/{len(test_set)}]...")
        except Exception as ckpt_err:
            print(f"\n[RESUME ERROR] Không thể đọc file checkpoint: {ckpt_err}. Bắt đầu chạy mới.")
            start_idx = 0
    
    if start_idx == 0:
        print(f"\nBắt đầu Benchmark Hệ thống Mới (Test {len(test_set)} ảnh)...")
    
    for i in range(start_idx, len(test_set)):
        img_path, true_cat = test_set[i]
        print(f"[{i+1}/{len(test_set)}] Xử lý ảnh: {true_cat}...", end="")
        
        # 1. BayTTA Ensemble Predict (ResNet + EfficientNet + DenseNet)
        img_array = medical_preprocessing_v2(img_path)
        if img_array is None:
            continue
        img_array = np.expand_dims(img_array, axis=0)
        
        # Gọi hàm BayTTA để tính toán probs với 3 mô hình
        probs, uncertainty_score = bayesian_tta_predict([cnn_model, eff_model, den_model], img_array)
        
        # Tắt Threshold Moving để Maximize Accuracy
        cls_idx = np.argmax(probs)
        cnn_class = CATEGORIES[cls_idx]
        cnn_conf = float(probs[cls_idx])
        
        # 2. YOLO Predict
        yolo_class = "notumor"
        yolo_box_details = None
        if yolo_model:
            results = yolo_model.predict(source=img_path, conf=0.35, verbose=False)
            if len(results) > 0 and getattr(results[0], 'boxes', None) is not None and len(results[0].boxes) > 0: # type: ignore
                best_box = results[0].boxes[0] # type: ignore
                cls_idx = int(best_box.cls[0].item())
                class_names = {0: 'glioma', 1: 'meningioma', 2: 'notumor', 3: 'pituitary'}
                yolo_cls_raw = class_names.get(cls_idx, 'notumor')
                
                if yolo_cls_raw != 'notumor':
                    yolo_class = yolo_cls_raw
                    # Chỉ trích xuất tọa độ box khi YOLO phát hiện u thực sự
                    x_center, y_center, bw, bh = best_box.xywh[0].tolist()
                    h_img, w_img = results[0].orig_shape
                    xmin = int(x_center - bw / 2)
                    ymin = int(y_center - bh / 2)
                    yolo_box_details = {
                        "x": max(0, min(xmin, w_img - 1)),
                        "y": max(0, min(ymin, h_img - 1)),
                        "width": max(10, min(int(bw), w_img - xmin)),
                        "height": max(10, min(int(bh), h_img - ymin)),
                        "conf": float(best_box.conf[0].item())
                    }
        final_class = cnn_class
        # 3. Consensus Logic - Kích hoạt Gemini có chọn lọc theo mức độ tự tin và lâm sàng
        cnn_is_tumor = (cnn_class != 'notumor')
        yolo_is_tumor = (yolo_class != 'notumor')

        is_conflict = False
        
        # Trường hợp 1: CNN báo NO TUMOR nhưng YOLO phát hiện có u (Tránh sót u nguy hiểm)
        if not cnn_is_tumor and yolo_is_tumor:
            is_conflict = True
            
        # Trường hợp 2: CNN báo CÓ U nhưng YOLO không thấy u
        # Chỉ gọi Gemini khi CNN không thực sự tự tin (conf < 0.80 hoặc uncertainty > 0.15)
        elif cnn_is_tumor and not yolo_is_tumor:
            if cnn_conf < 0.80 or uncertainty_score > 0.15:
                is_conflict = True
            else:
                is_conflict = False # Tin tưởng CNN vì tự tin cao, tránh bị VLM đổi thành notumor sai
                
        # Trường hợp 3: Cả hai đều báo có u nhưng khác loại u
        # Chỉ gọi Gemini khi CNN không tự tin (conf < 0.80 hoặc uncertainty > 0.15)
        elif cnn_is_tumor and yolo_is_tumor and cnn_class != yolo_class:
            if cnn_conf < 0.80 or uncertainty_score > 0.15:
                is_conflict = True
            else:
                is_conflict = False # Tin tưởng CNN vì tự tin cao
            
        if is_conflict:
            conflict_count += 1
            print(f" Xung đột (Ensemble: {cnn_class} vs YOLO: {yolo_class}) -> Gọi Gemini...", end="")
            gemini_class = resolve_conflict_with_gemini(
                img_path, cnn_class, cnn_conf, uncertainty_score, yolo_class, yolo_box_details
            )
            final_class = gemini_class
            
            if final_class == true_cat:
                resolved_correctly += 1
                print(" => Gemini phân xử ĐÚNG!")
            else:
                print(f" => Gemini phân xử SAI ({final_class})")
        else:
            print(f" Đồng thuận (Ensemble: {cnn_class} & YOLO: {yolo_class}).")
            
        y_true.append(true_cat)
        y_cnn_only.append(cnn_class)
        y_final_consensus.append(final_class)
        
        # Ghi checkpoint định kỳ mỗi 10 ảnh hoặc ở ảnh cuối cùng
        if (i + 1) % 10 == 0 or (i + 1) == len(test_set):
            try:
                ckpt_data = {
                    "last_processed_idx": i,
                    "y_true": y_true,
                    "y_cnn_only": y_cnn_only,
                    "y_final_consensus": y_final_consensus,
                    "conflict_count": conflict_count,
                    "resolved_correctly": resolved_correctly
                }
                with open(CHECKPOINT_FILE, 'w') as f:
                    json.dump(ckpt_data, f, indent=4)
            except Exception as save_err:
                print(f" [Lỗi ghi checkpoint: {save_err}]", end="")
    
    # Xử lý xong toàn bộ -> Xóa file checkpoint
    if os.path.exists(CHECKPOINT_FILE):
        try:
            os.remove(CHECKPOINT_FILE)
            print("\n[CHECKPOINT] Đã hoàn thành benchmark. File checkpoint đã được dọn dẹp sạch sẽ.")
        except Exception as rm_err:
            print(f"\n[CHECKPOINT WARNING] Không thể xóa file checkpoint: {rm_err}")
            
    # Tính toán kết quả
    acc_cnn = accuracy_score(y_true, y_cnn_only)
    acc_system = accuracy_score(y_true, y_final_consensus)
    
    print("\n" + "="*50)
    print(" KẾT QUẢ BENCHMARK HỆ THỐNG ĐỒNG THUẬN (END-TO-END)")
    print("="*50)
    print(f"- Số lượng ảnh test: {NUM_IMAGES_TO_TEST}")
    print(f"- Độ chính xác (Ensemble 3 Mô hình Weighted Soft-Voting): {acc_cnn*100:.2f}%")
    print(f"- ĐỘ CHÍNH XÁC TOÀN HỆ THỐNG (Sau khi Gemini đồng thuận): {acc_system*100:.2f}%")
    print(f"\nChi tiết xử lý xung đột:")
    print(f"- Tổng số ca phân kỳ (Ensemble != YOLO): {conflict_count} ca")
    if conflict_count > 0:
        print(f"- Tỷ lệ Gemini cứu thua thành công: {resolved_correctly}/{conflict_count} ca ({(resolved_correctly/conflict_count)*100:.2f}%)")
        
    print("\n BÁO CÁO PHÂN LOẠI CUỐI CÙNG:")
    print(classification_report(y_true, y_final_consensus))
    
    # ==========================================================
    # VẼ BIỂU ĐỒ BÁO CÁO
    # ==========================================================
    print("\nĐang sinh các biểu đồ báo cáo...")
    os.makedirs("models", exist_ok=True)
    
    # 1. Confusion Matrix cho Hệ thống Consensus
    plt.figure(figsize=(8, 6))
    cm = confusion_matrix(y_true, y_final_consensus, labels=CATEGORIES)
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=CATEGORIES, yticklabels=CATEGORIES)
    plt.title(f"Confusion Matrix - AI Consensus System\nAccuracy: {acc_system*100:.2f}%")
    plt.ylabel("Thực tế (True Label)")
    plt.xlabel("Dự đoán (Predicted Label)")
    plt.tight_layout()
    plt.savefig("models/confusion_matrix_consensus.png", dpi=150)
    plt.close()
    
    # 2. Biểu đồ so sánh Trước và Sau Consensus
    from sklearn.metrics import f1_score
    f1_cnn = f1_score(y_true, y_cnn_only, average='macro')
    f1_sys = f1_score(y_true, y_final_consensus, average='macro')
    
    metrics = ['Accuracy', 'Macro F1-Score']
    cnn_scores = [acc_cnn * 100, f1_cnn * 100]
    sys_scores = [acc_system * 100, f1_sys * 100]
    
    x = np.arange(len(metrics))
    width = 0.35
    
    fig, ax = plt.subplots(figsize=(8, 6))
    rects1 = ax.bar(x - width/2, np.array(cnn_scores), width, label='Chỉ dùng ResNet', color='#3498db')
    rects2 = ax.bar(x + width/2, np.array(sys_scores), width, label='Hệ thống AI Consensus', color='#2ecc71')
    
    ax.set_ylabel('Điểm số (%)')
    ax.set_title('So sánh Hiệu năng Trước và Sau khi dùng Gemini đồng thuận')
    ax.set_xticks(x)
    ax.set_xticklabels(metrics)
    ax.set_ylim(80, 100)
    ax.legend(loc='lower right')
    
    ax.bar_label(rects1, fmt='%.2f', padding=3)
    ax.bar_label(rects2, fmt='%.2f', padding=3)
    
    plt.tight_layout()
    plt.savefig("models/consensus_comparison_chart.png", dpi=150)
    plt.close()
    
    print(" Đã lưu biểu đồ thành công vào thư mục 'models/'!")
    print("- models/confusion_matrix_consensus.png")
    print("- models/consensus_comparison_chart.png")

if __name__ == "__main__":
    run_system_benchmark()
