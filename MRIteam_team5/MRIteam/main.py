# pyrefly: ignore [missing-import]
from fastapi import FastAPI, File, UploadFile, Form, Request
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from google import genai
from google.genai import types
import csv
import sqlite3
from datetime import datetime
import re
import hashlib
import uuid
from pathlib import Path
# pyrefly: ignore [missing-import]
import uvicorn
import numpy as np
# pyrefly: ignore [untyped-import]
import tensorflow as tf
import builtins
# pyrefly: ignore [missing-attribute]
builtins.tf = tf  # Inject tf into builtins so Lambda layers can find it globally
from PIL import Image, ImageDraw
import io
import os
import cv2
import base64
from preprocess import medical_preprocessing_v2
from ultralytics import YOLO
from tensorflow.keras.applications.resnet_v2 import preprocess_input as res_prep # type: ignore
from tensorflow.keras.applications.efficientnet_v2 import preprocess_input as eff_prep # type: ignore
from tensorflow.keras.applications.densenet import preprocess_input as den_prep # type: ignore

from localization import find_tumor_box, generate_gradcam_localization, infer_plane_from_path, should_call_gemini, FACIAL_RISK_PLANES
from dotenv import load_dotenv

load_dotenv()

# =====================================================================
# ROI HELPER FUNCTIONS (Location-Grounded Arbitration)
# =====================================================================
def adaptive_roi_crop(bbox: dict, img_shape: tuple) -> tuple:
    """Tính vùng cắt ROI với margin động dựa trên kích thước tương đối của khối u."""
    x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
    img_h, img_w = img_shape[:2]
    tumor_area_ratio = (w * h) / (img_h * img_w + 1e-7)

    if tumor_area_ratio < 0.05:   # U nhỏ → mở rộng 40% để lấy context
        margin = 0.40
    elif tumor_area_ratio > 0.30: # U lớn → mở rộng ít, tránh nhiễu hộp sọ
        margin = 0.10
    else:
        margin = 0.25

    w_expand = int(w * margin)
    h_expand = int(h * margin)
    x1 = max(0, x - w_expand)
    y1 = max(0, y - h_expand)
    x2 = min(img_w, x + w + w_expand)
    y2 = min(img_h, y + h + h_expand)
    return x1, y1, x2, y2


def infer_anatomical_location(bbox: dict, img_shape: tuple) -> tuple:
    """Suy luận vị trí giải phẫu từ bbox để cung cấp prior y tế cho prompt."""
    img_h, img_w = img_shape[:2]
    x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
    cx = (x + w / 2) / img_w
    cy = (y + h / 2) / img_h

    if 0.35 < cx < 0.65 and cy > 0.45:
        return "midline sellar/suprasellar region", "PITUITARY ADENOMA (midline sellar location)"
    elif cx < 0.15 or cx > 0.85 or cy < 0.10 or cy > 0.90:
        return "peripheral convexity/meninges region", "MENINGIOMA (extra-axial dural-based location)"
    else:
        return "deep white matter / intra-axial region", "GLIOMA (intra-axial parenchymal location)"


app = FastAPI(title="Brain Tumor Diagnosis API")

# Cấu hình Gemini API (SDK mới google.genai)
from gemini_rotator import GeminiProxy
gemini_client = GeminiProxy()
GEMINI_MODEL = "gemini-3.1-flash-lite"

def call_gemini(system_prompt: str, user_prompt: str, temperature: float = 0.2) -> str:
    """Helper duy nhất để gọi Gemini API cho tất cả Agents."""
    response = gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            max_output_tokens=2048,
        )
    )
    return response.text or ""

def apply_temperature_scaling(probs, T=1.3):
    """Áp dụng Temperature Scaling cho xác suất đầu ra để giảm lỗi quá tự tin (overconfidence)"""
    eps = 1e-7
    logits = np.log(probs + eps)
    scaled_logits = logits / T
    exp_logits = np.exp(scaled_logits - np.max(scaled_logits, axis=-1, keepdims=True))
    return exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)

# Data models
class ReportRequest(BaseModel):
    resnet_data: Dict[str, Any]

class TranslationRequest(BaseModel):
    clinical_report: str

class ChatRequest(BaseModel):
    doctor_id: str
    message: str

class MeetingRequest(BaseModel):
    chat_logs: str

# Cho phép cấu hình qua AUDIT_DB_PATH hoặc lưu trữ bền vững trong thư mục data/ (Docker volume)
_base_data_dir = os.path.join(os.path.dirname(__file__), "data")
if os.path.exists(_base_data_dir) or os.getenv("DOCKER_CONTAINER"):
    os.makedirs(_base_data_dir, exist_ok=True)
    _default_db = os.path.join(_base_data_dir, "audit_logs.db")
else:
    _default_db = "audit_logs.db"

DB_FILE = os.getenv("AUDIT_DB_PATH", _default_db)
_db_dir = os.path.dirname(DB_FILE)
if _db_dir:
    os.makedirs(_db_dir, exist_ok=True)

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            doctor_id TEXT,
            question TEXT,
            ai_answer TEXT,
            status TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def log_interaction(doctor_id, question, ai_answer, status="pending"):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute(
        "INSERT INTO audit_logs (timestamp, doctor_id, question, ai_answer, status) VALUES (?, ?, ?, ?, ?)",
        (datetime.now().isoformat(), doctor_id, question, ai_answer, status)
    )
    conn.commit()
    conn.close()

BLACKLIST_WORDS = ["uống thuốc gì", "bao giờ chết", "tự tử", "đơn thuốc", "kê đơn", "sống được bao lâu"]

def check_keyword_trap(text: str) -> bool:
    text_lower = text.lower()
    for word in BLACKLIST_WORDS:
        if word in text_lower:
            return True
    return False

def mask_patient_data(data_dict: dict) -> dict:
    masked_data = data_dict.copy()
    if "patient_id" in masked_data:
        hashed = hashlib.sha256(str(masked_data["patient_id"]).encode()).hexdigest()[:8]
        masked_data["patient_id"] = f"ANON_{hashed}"
    if "patient_name" in masked_data:
        masked_data["patient_name"] = "[MASKED_NAME]"
    return masked_data

def retrieve_medical_context(query: str) -> str:
    """
    Phân hệ Hỗ trợ Ra Quyết định Lâm sàng dựa trên Quy tắc (Rule-based CDSS Knowledge Engine).
    Truy xuất khuyến cáo điều trị từ Phác đồ Bộ Y Tế (QĐ 1514/QĐ-BYT) và tài liệu lâm sàng chuẩn hóa,
    đảm bảo tính tất định (deterministic), minh bạch và loại bỏ nguy cơ ảo giác (hallucination).
    """
    q = query.lower()
    
    # Nhóm: Glioma
    if any(w in q for w in ["glioma", "u thần kinh đệm", "thần kinh đệm", "gbm", "grade"]):
        return """[02_Gliomas_Guidelines.pdf] Glioma là khối u thần kinh đệm, phân loại theo WHO Grade I-IV.
        Grade IV (Glioblastoma - GBM) là dạng nguy hiểm nhất. Điều trị gồm phẫu thuật, xạ trị và hóa trị (Temozolomide).
        Theo Phác đồ QĐ 1514 Bài 19, chỉ định phẫu thuật khi khối u có thể tiếp cận được và bệnh nhân đủ thể trạng."""
    
    # Nhóm: Meningioma
    if any(w in q for w in ["meningioma", "u màng não", "màng não"]):
        return """[03_Meningiomas_Guidelines.pdf] Meningioma là u lành tính xuất phát từ màng não, chiếm ~35% u não nguyên phát.
        Triệu chứng tùy vị trí: nhức đầu, yếu liệt, rối loạn thị giác. Phần lớn mổ được triệt để.
        Theo Phác đồ QĐ 1514 Bài 20, u màng não Simpson Grade I-II có tỷ lệ tái phát thấp sau phẫu thuật."""
    
    # Nhóm: Pituitary / Tuyến yên
    if any(w in q for w in ["pituitary", "tuyến yên", "adenoma", "nội tiết", "hormone"]):
        return """[04_Pituitary_Tumors_Guidelines.pdf] U tuyến yên chiếm ~15% u não, thường lành tính.
        Có 2 loại: tiết hormone (Prolactinoma, GH-secreting...) và không tiết. Điều trị: thuốc (Cabergoline cho Prolactinoma), vi phẫu thuật qua nội soi mũi bướm.
        Theo Phác đồ QĐ 1514, kiểm tra nội tiết trước và sau mổ là bắt buộc."""
    
    # Nhóm: Phù não / Biến chứng nội sọ
    if any(w in q for w in ["phù não", "phù", "não úp", "tăng áp", "corticosteroid", "dexamethasone", "mannitol"]):
        return """[05_Brain_Edema_Management.pdf] Phù não do khối u gây tăng áp lực nội sọ. 
        Xử trí cấp: Dexamethasone 8-16mg/ngày (giảm phù), Mannitol 20% (giảm áp cấp cựu).
        Theo Phác đồ QĐ 1514 Bài 7: theo dõi GCS, đường huyết, điện giải trong quá trình dùng Corticosteroid."""
    
    # Nhóm: Quản lý đau
    if any(w in q for w in ["đau", "giảm đau", "morphine", "opioid", "đau ung thư", "paracetamol", "nsaid"]):
        return """[06_Cancer_Pain_Management.pdf] Quản lý đau ung thư theo thang bậc WHO:
        Bậc 1: Paracetamol/NSAIDs (NSAIDs cẩn thận với bệnh nhân dùng Corticosteroid).
        Bậc 2: Opioid yếu (Tramadol, Codeine). Bậc 3: Opioid mạnh (Morphine, Oxycodone).
        Theo Phác đồ QĐ 1514 Bài 15: đánh giá đau theo thang VAS (0-10) mỗi 4-6 giờ."""
    
    # Nhóm: Triệu chứng u não chung (nhức đầu, chóng mặt, buồn nôn...)
    if any(w in q for w in ["nhức đầu", "đau đầu", "chóng mặt", "mờ mắt", "thị giác", "bần nôn", "nôn", "co giật", "yếu liệt", "tê tay"]):
        return """[01_Primary_Brain_Tumors.pdf] Triệu chứng hay gặp của u não nguyên phát:
        - Nhức đầu (thường nặng vào sáng sớm, khi gắng sức): do tăng áp lực nội sọ.
        - Buồn nôn/nôn mửa: phản xạ do tăng áp lực.
        - Co giật: gặp ~25% bệnh nhân u não.
        - Suy giảm nhận thức, thay đổi tính cách: u thuỳ trán.
        Theo Phác đồ QĐ 1514 Bài 17: MRI não có cản quang là tiêu chuẩn vàng để chẩn đoán."""
    
    # Mặc định: kiến thức chung về u não
    return """[01_Primary_Brain_Tumors.pdf + Tài liệu tổng hợp] Các loại u não ngường gặp:
    Glioma (35%), Meningioma (35%), Pituitary adenoma (15%), và di căn não.
    Chẩn đoán dựa vào: MRI não, sinh thiết, xét nghiệm nội tiết (nếu nghi ngờ u tuyến yên).
    Điều trị phụ thuộc loại u: phẫu thuật, xạ trị, hóa trị, theo dõi."""

# Cho phép React kết nối với API này
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Nạp mô hình AI đã huấn luyện
RESNET_PATH = "models/best_resnet_model.keras"
EFFICIENTNET_PATH = "models/best_efficientnet_model.keras"
DENSENET_PATH = "models/best_densenet_model.keras"

# Bật chế độ nạp không an toàn cho các lớp Lambda (nếu Keras hỗ trợ)
try:
    tf.keras.config.enable_unsafe_deserialization()
except AttributeError:
    pass

# Định nghĩa mapping cho biến 'tf' mà lớp Lambda đang tìm kiếm
custom_objects = {
    'tf': tf 
}

# Tắt chế độ an toàn để nạp mô hình chứa mã tùy chỉnh (Lambda layers)
model = None
efficientnet_model = None
densenet_model = None

try:
    print("Đang nạp bộ 3 mô hình Ensemble...")
    model = tf.keras.models.load_model("models/resnet_risk_calibrated.keras", custom_objects=custom_objects, safe_mode=False, compile=False)
    efficientnet_model = tf.keras.models.load_model("models/best_efficientnet_model.keras", safe_mode=False, compile=False)
    densenet_model = tf.keras.models.load_model("models/best_densenet_model.keras", safe_mode=False, compile=False)
    print("Nạp bộ 3 mô hình thành công! API đã sẵn sàng.")
except Exception as e:
    print(f"Lỗi nạp mô hình: {e}")

print("Đang tải YOLOv8...")
YOLO_MODEL_PATH = "runs/detect/mri_tumor_det_v3/weights/best.pt"
try:
    yolo_model = YOLO(YOLO_MODEL_PATH)
except Exception as e:
    print(f"Không tìm thấy mô hình YOLO: {e}")
    yolo_model = None

CATEGORIES = ['glioma', 'meningioma', 'notumor', 'pituitary']
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".dcm", ".bmp"}

def _run_mri_inference(file_path: str, processed_img: np.ndarray) -> dict:
    if model is None or efficientnet_model is None or densenet_model is None:
        raise RuntimeError("Mô hình AI chưa sẵn sàng (Lỗi tải mô hình)")

    # 4. Dự đoán song song trên 3 mô hình với TTA (BayTTA) và chuẩn hóa riêng biệt
    img_array = np.expand_dims(processed_img, axis=0) 
    
    img_orig = img_array
    img_lr = np.flip(img_array, axis=2) # Lật ngang (Horizontal)
    
    # Dự đoán trên ảnh gốc
    pred_res_orig = model.predict(res_prep(img_orig.copy()), verbose=0)
    pred_eff_orig = apply_temperature_scaling(efficientnet_model.predict(eff_prep(img_orig.copy()), verbose=0))
    pred_den_orig = apply_temperature_scaling(densenet_model.predict(den_prep(img_orig.copy()), verbose=0))
    
    # Dự đoán trên ảnh lật ngang
    pred_res_lr = model.predict(res_prep(img_lr.copy()), verbose=0)
    pred_eff_lr = apply_temperature_scaling(efficientnet_model.predict(eff_prep(img_lr.copy()), verbose=0))
    pred_den_lr = apply_temperature_scaling(densenet_model.predict(den_prep(img_lr.copy()), verbose=0))
    
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
    predictions = final_pred # shape (1, 4)
    
    # Tính phương sai (variance) của các dự đoán để đo lường độ không chắc chắn (Uncertainty) dựa trên ảnh gốc
    preds_stack = np.vstack([pred_res_orig, pred_eff_orig, pred_den_orig])
    ensemble_variance = np.var(preds_stack, axis=0)
    uncertainty_score = float(np.max(ensemble_variance))
    
    # 5. Trích xuất kết quả sơ bộ từ Ensemble
    probs = predictions[0]
    class_idx = np.argmax(probs)
    confidence = float(probs[class_idx])
    cnn_class = CATEGORIES[class_idx]
    
    # 6. Dự đoán độc lập với YOLOv8 (Tầng 2)
    yolo_class = "notumor"
    yolo_box_details = None
    if yolo_model:
        try:
            results = yolo_model.predict(source=file_path, conf=0.35, verbose=False)
            if len(results) > 0:
                boxes = getattr(results[0], 'boxes', None)
                if boxes is not None and len(boxes) > 0:
                    best_box = boxes[0]
                    y_cls_idx = int(best_box.cls[0].item())
                    class_names = {0: 'glioma', 1: 'meningioma', 2: 'notumor', 3: 'pituitary'}
                    yolo_cls_raw = class_names.get(y_cls_idx, 'notumor')

                    # Trích xuất tọa độ bounding box
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

                    if yolo_cls_raw != 'notumor':
                        yolo_class = yolo_cls_raw
                    else:
                        yolo_box_details = None  # Không có u thật → bỏ box
        except Exception as e:
            print(f"Lỗi khi chạy dự đoán YOLOv8: {e}")

    # 7. LOGIC ĐỒNG THUẬN TỐI ƯU (3 Tầng: CNN Ensemble → YOLO Cross-check → VLM Location-Grounded)
    # ──────────────────────────────────────────────────
    # Tầng 1: CNN Ensemble → Phân loại sơ bộ (ResNet + EfficientNet + DenseNet).
    # Tầng 2: YOLO → Kiểm tra chéo: có u không? nếu có thì ở đâu? (bounding box).
    # Tầng 3: Gemini VLM → Chỉ gọi khi có xung đột, khóa nhìn vào đúng ROI được YOLO định vị.
    # ──────────────────────────────────────────────────
    cnn_is_tumor = (cnn_class != 'notumor')
    yolo_is_tumor = (yolo_class != 'notumor')

    is_conflict = False

    # T/H 1: CNN báo NO TUMOR nhưng YOLO thấy u → Nguy cơ sót u: luôn gọi VLM
    if not cnn_is_tumor and yolo_is_tumor:
        is_conflict = True
    # T/H 2: CNN thấy u nhưng YOLO không thấy → chỉ gọi VLM khi CNN thiếu tự tin
    elif cnn_is_tumor and not yolo_is_tumor:
        if confidence < 0.80 or uncertainty_score > 0.15:
            is_conflict = True
        else:
            is_conflict = False  # CNN tự tin cao → tin CNN, không cần VLM
    # T/H 3: Cả hai cùng thấy u nhưng khác loại → chỉ gọi VLM khi CNN thiếu tự tin
    elif cnn_is_tumor and yolo_is_tumor and cnn_class != yolo_class:
        if confidence < 0.80 or uncertainty_score > 0.15:
            is_conflict = True
        else:
            is_conflict = False  # CNN tự tin cao → tin CNN

    # ── Detect acquisition plane — Privacy guard for VLM arbitration ──
    scan_plane = infer_plane_from_path(file_path)
    print(f"[Plane Detect] Uploaded file plane='{scan_plane}'")

    predicted_class = cnn_class
    final_confidence = confidence
    if not is_conflict:
        consensus_message = (f"Đồng thuận (Ensemble: {cnn_class.upper()} & YOLO: {yolo_class.upper()}). "
                             f"Kết quả: {cnn_class.upper()}.")
    else:
        consensus_message = (f"Phát hiện xung đột (Ensemble: {cnn_class.upper()} vs YOLO: {yolo_class.upper()}). "
                             f"Gọi Gemini phân xử...")

    if is_conflict:
        # ── Privacy Guard: skip VLM arbitration for facial-risk planes ─────────────
        # FACIAL_RISK_PLANES now includes PLANE_UNKNOWN (fail-safe):
        # When a user uploads from the frontend the filename carries no DICOM
        # sequence tokens → plane = unknown.  Treating unknown as safe would
        # silently bypass this guard for real hospital uploads.
        if scan_plane in FACIAL_RISK_PLANES:
            _plane_reason_map = {
                "sagittal": "Ảnh sagittal chứa profile mặt bên — nguy cơ nhận diện danh tính.",
                "coronal":  "Ảnh coronal chứa mặt trực diện — nguy cơ nhận diện danh tính.",
                "unknown":  "Không xác định được mặt phẳng từ tên file và tỷ lệ ảnh — mặc định coi là nguy cơ khuôn mặt (fail-safe).",
            }
            _plane_reason = _plane_reason_map.get(scan_plane, f"Plane '{scan_plane}' thuộc nhóm facial-risk.")
            print(
                f"[Consensus] ⚠ PRIVACY GUARD: plane='{scan_plane}' is facial-risk. "
                f"VLM arbitration skipped — falling back to CNN Ensemble result. "
                f"[audit: cnn={cnn_class}, yolo={yolo_class}, file={os.path.basename(file_path)}]"
            )
            predicted_class  = cnn_class
            final_confidence = confidence
            consensus_message = (
                f"<strong style='color:#ffaa00'>Thông báo: Privacy Guard (Plane = {scan_plane.upper()})</strong><br>"
                f"<strong style='color:#fff'>Lý do:</strong> {_plane_reason} "
                f"Gemini VLM bị bỏ qua theo chính sách bảo mật.<br>"
                f"<strong style='color:#fff'>Kết quả:</strong> Giữ kết quả Ensemble ({cnn_class.upper()})."
            )
        # ────────────────────────────────────────────────────────────────
        else:
            print(f"[Consensus] XUNG ĐỘT: Ensemble={cnn_class} vs YOLO={yolo_class}. Đang gọi Gemini VLM...")

            # ── System Prompt (Location-Grounded) ──
            sys_prompt = """You are a senior neuroradiologist serving as a clinical diagnostic arbitrator for a multi-model AI consensus system.
You will receive up to THREE images:
  - Image 1 (Overview): Full brain MRI with a RED bounding box marking the suspected tumor ROI detected by YOLOv8.
  - Image 2 (Adaptive Crop): A contextual crop of the ROI with adaptive margins.
  - Image 3 (2× Zoom): The same ROI zoomed in 2× to reveal micro-textures, border sharpness, and signal gradients.

  HOSPITAL DATASET CONTEXT: Real-world scans may have noise, varying contrast, slice-thickness artifacts, and subtle early-stage tumors.
  Do NOT dismiss a region as normal based on low conspicuity alone.

  CRITICAL CONSTRAINTS:
  1. Analyze ONLY the tissue INSIDE the RED bounding box / cropped region. Do NOT base your verdict on tissue outside the ROI.
  2. Be decisive. Calibrate confidence honestly: 0.85–0.99 for clear findings, <0.75 only for genuinely uninterpretable scans.
  3. If both models agree a tumor is present (neither said 'notumor'), you MUST choose ('glioma'|'meningioma'|'pituitary'). 'notumor' is FORBIDDEN.
  4. If ensemble detected a tumor but YOLO missed it, look carefully for subtle lesions before concluding 'notumor'.

  ANATOMICAL CRITERIA:
  - Glioma:     Intra-axial, irregular/infiltrative borders, vasogenic edema (T2/FLAIR hyperintensity).
  - Meningioma: Extra-axial, well-defined, dural-tail, compresses rather than invades.
  - Pituitary:  Midline sellar/suprasellar mass, optic chiasm compression, 'snowman sign'.
  - No Tumor:   Symmetric brain, normal CSF spaces, no mass effect, centered midline.

  OUTPUT — strict JSON only:
  {
    "reasoning": "Step-by-step clinical review of the ROI referencing specific anatomical features.",
    "anatomical_location_assessment": "Describe where in the brain the ROI is and what structures are adjacent.",
    "differential_diagnosis": "Alternative diagnosis considered and why it was ruled out.",
    "contradictory_evidence": "At least 2 features in the ROI that ARGUE AGAINST your primary verdict (self-criticism).",
    "confidence": 0.0-1.0 (float, your calibrated diagnostic certainty; typically 0.85-0.99 for clear cases, only below 0.75 if genuinely uninterpretable),
    "verdict": "glioma" | "meningioma" | "pituitary" | "notumor"
  }"""

            # ── Thông tin YOLO ──
            yolo_info = f"Class: {yolo_class}"
            if yolo_box_details:
                yolo_info += (f" (Confidence: {round(yolo_box_details['conf']*100, 2)}%), "
                              f"ROI Box: [x:{yolo_box_details['x']}, y:{yolo_box_details['y']}, "
                              f"w:{yolo_box_details['width']}, h:{yolo_box_details['height']}]")
            else:
                yolo_info += " (No bounding box — possible false negative)"

            # ── Anatomical Prior ──
            anatomical_hint = ""
            if yolo_box_details:
                img_cv_shape = cv2.imread(file_path)
                if img_cv_shape is not None:
                    loc_desc, prior_hint = infer_anatomical_location(yolo_box_details, img_cv_shape.shape)
                    anatomical_hint = (
                        f"\n[ANATOMICAL PRIOR] The ROI centroid is in the {loc_desc}. "
                        f"Elevated prior probability for: {prior_hint}. "
                        f"Adjust differential accordingly, but do not override clear visual evidence."
                    )

            # ── Ràng buộc lâm sàng ──
            rule_hints = []
            if cnn_is_tumor and yolo_is_tumor:
                rule_hints.append(
                    "⚠ CRITICAL: Both models detect a tumor. You MUST choose ('glioma'|'meningioma'|'pituitary'). "
                    "'notumor' is PROHIBITED."
                )
            elif cnn_is_tumor and not yolo_is_tumor:
                if not yolo_box_details:
                    rule_hints.append(
                        "⚠ CRITICAL: The CNN ensemble (3 independent models) detected a tumor but YOLOv8 produced no bounding box. "
                        "There is NO bbox overlay — look carefully at midline structures, periventricular regions, and sellar area for subtle lesions. "
                        "Do NOT conclude 'notumor' simply because the lesion is small or low-contrast. "
                        "Returning 'notumor' is PROHIBITED — classify as ('glioma'|'meningioma'|'pituitary')."
                    )
                else:
                    rule_hints.append(
                        "NOTE: CNN ensemble detected a tumor but YOLO missed it (high false-negative rate on small/low-contrast tumors). "
                        "Inspect carefully before concluding 'notumor'."
                    )
            elif not cnn_is_tumor and yolo_is_tumor:
                rule_hints.append(
                    "NOTE: YOLO detected a tumor mass but CNN voted 'notumor'. "
                    "Focus on the red-boxed region — localisation is key evidence."
                )
            rule_hint_str = "\n".join(rule_hints)

            usr_prompt = f"""[CLINICAL DIAGNOSTIC ARBITRATION — Location-Grounded Analysis]

MODEL VOTES:
  • CNN Ensemble   → {cnn_class} (Confidence: {round(confidence*100, 2)}%, Uncertainty: {round(uncertainty_score, 4)})
  • YOLOv8 Detector → {yolo_info}
{anatomical_hint}

VISUAL INPUTS:
  • Image 1 — Full scan with RED bounding box on the suspected ROI.
  • Image 2 — Adaptive-margin crop of the ROI.
  • Image 3 — 2× zoomed ROI (micro-texture and border sharpness).

⚠ FOCUS RULE: Restrict analysis EXCLUSIVELY to tissue INSIDE the RED bounding box / cropped region.

{rule_hint_str}

Produce your full chain-of-thought, then output a single valid JSON object."""

            try:
                # ── Chuẩn bị ảnh 3 scale ──
                img_pil = Image.open(file_path).convert("RGB")
                img_overview = img_pil.copy()  # Image 1: tổng quan + bbox
                img_crop_pil = None            # Image 2: adaptive crop
                img_zoom_pil = None            # Image 3: 2x zoom

                if yolo_box_details:
                    draw = ImageDraw.Draw(img_overview)
                    bx = yolo_box_details['x']
                    by = yolo_box_details['y']
                    bw_box = yolo_box_details['width']
                    bh_box = yolo_box_details['height']
                    draw.rectangle([bx, by, bx + bw_box, by + bh_box], outline="red", width=4)

                    img_cv2 = cv2.imread(file_path)
                    if img_cv2 is not None:
                        x1, y1, x2, y2 = adaptive_roi_crop(yolo_box_details, img_cv2.shape)
                        img_crop_pil = img_pil.crop((x1, y1, x2, y2))
                        zoom_w = max(1, (x2 - x1) * 2)
                        zoom_h = max(1, (y2 - y1) * 2)
                        img_zoom_pil = img_crop_pil.resize((zoom_w, zoom_h), Image.Resampling.LANCZOS)

                contents: list = [usr_prompt, img_overview]
                if img_crop_pil:
                    contents.append(img_crop_pil)
                if img_zoom_pil:
                    contents.append(img_zoom_pil)

                response = gemini_client.models.generate_content(
                    model=GEMINI_MODEL,
                    contents=contents,  # type: ignore
                    config=types.GenerateContentConfig(
                        system_instruction=sys_prompt,
                        temperature=0.2,
                        response_mime_type="application/json"
                    )
                )

                raw_text = response.text.strip() if response.text else ""
                try:
                    import json
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:-3].strip()
                    elif raw_text.startswith("```"):
                        raw_text = raw_text[3:-3].strip()

                    gemini_json = json.loads(raw_text)
                    verdict   = str(gemini_json.get("verdict", "")).lower().strip()
                    vlm_conf  = float(gemini_json.get("confidence", 0))
                    reasoning = gemini_json.get("reasoning", "")
                    diff_dx   = gemini_json.get("differential_diagnosis", "")
                    contra_ev = gemini_json.get("contradictory_evidence", "")

                    if verdict in CATEGORIES:
                        if vlm_conf >= 0.85:
                            # Guard-1: Cả hai cùng thấy u → không chấp nhận 'notumor' từ Gemini
                            if verdict == 'notumor' and cnn_is_tumor and yolo_is_tumor:
                                predicted_class   = cnn_class
                                final_confidence  = confidence
                                consensus_message = (
                                    "<strong style='color:#ffaa00'>Cảnh báo: Guard-1 Triggered</strong><br>"
                                    "<strong style='color:#fff'>Lý do:</strong> Cả Ensemble và YOLO đều ngđi u, VLM chẩn đoán nhầm thành 'notumor'.<br>"
                                    f"<strong style='color:#fff'>Hành động:</strong> Quây về Ensemble ({cnn_class.upper()}) để đảm bảo an toàn."
                                )
                            # Guard-2: CNN thấy u nhưng YOLO miss → cần 97% mới được đổi sang notumor
                            elif verdict == 'notumor' and cnn_is_tumor and not yolo_is_tumor and vlm_conf < 0.97:
                                predicted_class   = cnn_class
                                final_confidence  = confidence
                                consensus_message = (
                                    f"<strong style='color:#ffaa00'>Cảnh báo: Guard-2 Triggered</strong><br>"
                                    f"<strong style='color:#fff'>Lý do:</strong> CNN phát hiện u nhưng VLM muốn 'notumor' với chỉ {vlm_conf*100:.0f}% (cần ≥ 97% để bác bỏ kết quả CNN).<br>"
                                    f"<strong style='color:#fff'>Hành động:</strong> Giữ kết quả Ensemble ({cnn_class.upper()}) tránh bỏ sót u."
                                )
                            else:
                                predicted_class   = verdict
                                final_confidence  = vlm_conf
                                consensus_message = (
                                    f"<strong style='color:#fff'>Trọng tài VLM quyết định:</strong> {verdict.upper()}<br>"
                                    f"<strong style='color:#fff'>Độ tin cậy:</strong> {vlm_conf*100:.1f}%<br>"
                                    f"<strong style='color:#fff'>Lập luận:</strong> {reasoning}<br>"
                                    f"<strong style='color:#fff'>Chẩn đoán phân biệt:</strong> {diff_dx}<br>"
                                    f"<strong style='color:#aaa'>Bằng chứng phản bác:</strong> {contra_ev}"
                                )
                        else:
                            predicted_class   = cnn_class
                            final_confidence  = confidence
                            consensus_message = (
                                f"<strong style='color:#ffaa00'>Cảnh báo: Ambiguous</strong><br>"
                                f"<strong style='color:#fff'>Lý do:</strong> VLM confidence ({vlm_conf*100:.1f}%) < ngưỡng 85%.<br>"
                                f"<strong style='color:#fff'>Lập luận VLM:</strong> {reasoning}<br>"
                                f"<strong style='color:#fff'>Hành động:</strong> Quây về Ensemble ({cnn_class.upper()}) & hội chẩn thủ công."
                            )
                    else:
                        predicted_class   = cnn_class
                        final_confidence  = confidence
                        consensus_message = (
                            f"<strong style='color:#ff5555'>Cảnh báo: VLM verdict không hợp lệ</strong><br>"
                            f"<strong style='color:#fff'>Hành động:</strong> Quây về Ensemble ({cnn_class.upper()})."
                        )
                except Exception as e:
                    print(f"[Consensus] Lỗi phân tích JSON Gemini: {e}. Raw: {raw_text}")
                    predicted_class   = cnn_class
                    final_confidence  = confidence
                    consensus_message = (
                        f"<strong style='color:#ff5555'>Cảnh báo: Lỗi xử lý kết quả phân xử</strong><br>"
                        f"<strong style='color:#fff'>Hành động:</strong> Quây về Ensemble ({cnn_class.upper()})."
                    )
            except Exception as e:
                print(f"[Consensus] Lỗi gọi Gemini API: {e}")
                predicted_class   = cnn_class
                final_confidence  = confidence
                consensus_message = (
                    f"<strong style='color:#ff5555'>Cảnh báo: Lỗi kết nối API</strong><br>"
                    f"<strong style='color:#fff'>Hành động:</strong> Quây về Ensemble ({cnn_class.upper()})."
                ) 

    # 8. Xử lý khoanh vùng khối u (Sử dụng Grad-CAM kết hợp lọc ROI hoặc YOLO box)
    b64_string = ""
    tumor_location = None
    try:
        if predicted_class != "notumor":
            final_class_idx = CATEGORIES.index(predicted_class)
            tumor_location, img_cv = generate_gradcam_localization(
                model, img_array, file_path, predicted_class, final_class_idx,
                confidence=final_confidence * 100,
                gemini_client=gemini_client,
                gemini_model=GEMINI_MODEL
            )
        else:
            img_cv = cv2.imread(file_path)
            
        if img_cv is not None:
            _, buffer = cv2.imencode('.jpg', img_cv)
            b64_string = base64.b64encode(buffer).decode('utf-8')
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Lỗi khi thực hiện định vị / Grad-CAM: {e}")
        
    result = {
        "class_name": predicted_class,
        "confidence": round(final_confidence * 100, 2),
        "annotated_image": f"data:image/jpeg;base64,{b64_string}" if b64_string else None,
        "tumor_location": tumor_location,
        "is_conflict": is_conflict,
        "consensus_message": consensus_message,
        "all_probabilities": {
            CATEGORIES[i]: round(float(predictions[0][i]) * 100, 2)
            for i in range(4)
        }
    }
    return result


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if model is None or efficientnet_model is None or densenet_model is None:
        return {"error": "Hệ thống AI chưa sẵn sàng (Lỗi tải mô hình)"}

    # 1. Kiểm tra định dạng tệp an toàn (Whitelist Extensions)
    raw_name = os.path.basename(file.filename or "scan.jpg")
    ext = Path(raw_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return {"error": f"Định dạng tệp '{ext}' không được hỗ trợ. Chỉ chấp nhận: {sorted(list(ALLOWED_EXTENSIONS))}"}

    # 2. Sinh tên tệp an toàn bằng UUID chống Path Traversal và đè file
    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir, exist_ok=True)
    
    safe_filename = f"scan_{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(upload_dir, safe_filename)

    try:
        content = await file.read()
        if len(content) > 50 * 1024 * 1024:
            return {"error": "Kích thước tệp vượt quá 50MB"}
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        # 3. Tiền xử lý bằng Pipeline OpenCV v2 của Huy
        processed_img = medical_preprocessing_v2(file_path)
        if processed_img is None:
            return {"error": "Không thể xử lý ảnh"}

        # 4. Thực thi suy luận đa mô hình Ensemble & YOLO & VLM
        return _run_mri_inference(file_path, processed_img)
    finally:
        # Luôn đảm bảo tệp ảnh tạm được xóa an toàn khỏi ổ đĩa
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as clean_err:
                print(f"[Cleanup] Không thể xóa file tạm {file_path}: {clean_err}")


@app.post("/feedback")
async def save_doctor_feedback(
    file: UploadFile = File(...),
    correct_class: str = Form(...),
    x: int = Form(...),
    y: int = Form(...),
    w: int = Form(...),
    h: int = Form(...)
):
    # 1. Tạo thư mục chứa ca khó (hard_examples)
    hard_dir = "hard_examples"
    if not os.path.exists(hard_dir):
        os.makedirs(hard_dir, exist_ok=True)
        
    # 2. Khử độc tên file chống Path Traversal
    safe_feedback_name = os.path.basename(file.filename or "feedback_scan.jpg")
    file_path = os.path.join(hard_dir, f"{uuid.uuid4().hex[:8]}_{safe_feedback_name}")
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
        
    # 3. Lưu thông tin phản hồi vào CSV để sau này train lại
    csv_file = os.path.join(hard_dir, "feedback_log.csv")
    file_exists = os.path.isfile(csv_file)
    with open(csv_file, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["filename", "correct_class", "x", "y", "w", "h"])
        writer.writerow([file.filename, correct_class, x, y, w, h])
        
    return {"message": "Đã ghi nhận phản hồi để AI học lại", "file": file.filename}


@app.post("/approve")
async def save_doctor_approval(
    filename: str = Form(...),
    predicted_class: str = Form(...),
    confidence: float = Form(...)
):
    """Bác sĩ xác nhận kết quả AI là đúng (không cần sửa)."""
    hard_dir = "hard_examples"
    if not os.path.exists(hard_dir):
        os.makedirs(hard_dir)

    csv_file = os.path.join(hard_dir, "approval_log.csv")
    file_exists = os.path.isfile(csv_file)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(csv_file, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["filename", "predicted_class", "confidence", "timestamp"])
        writer.writerow([filename, predicted_class, round(confidence, 4), timestamp])

    return {"message": "Đã ghi nhận xác nhận đúng từ bác sĩ", "file": filename}


@app.get("/training-stats")
async def get_training_stats():
    """Trả về thống kê số ca đúng/sai từ phản hồi bác sĩ."""
    hard_dir = "hard_examples"
    approval_csv = os.path.join(hard_dir, "approval_log.csv")
    feedback_csv = os.path.join(hard_dir, "feedback_log.csv")

    # Count approved correct cases
    approved_count = 0
    approved_by_class = {}
    if os.path.isfile(approval_csv):
        with open(approval_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                approved_count += 1
                cls = row.get("predicted_class", "unknown")
                approved_by_class[cls] = approved_by_class.get(cls, 0) + 1

    # Count corrected (wrong) cases
    corrected_count = 0
    corrected_by_class = {}
    if os.path.isfile(feedback_csv):
        with open(feedback_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                corrected_count += 1
                cls = row.get("correct_class", "unknown")
                corrected_by_class[cls] = corrected_by_class.get(cls, 0) + 1

    total = approved_count + corrected_count
    accuracy = round((approved_count / total * 100), 1) if total > 0 else 0.0

    return {
        "total": total,
        "approved": approved_count,
        "corrected": corrected_count,
        "accuracy": accuracy,
        "approved_by_class": approved_by_class,
        "corrected_by_class": corrected_by_class,
    }

# =====================================================================
# AGENT 1: Bác sĩ AI (Luồng Chẩn đoán Chuyên sâu)
# =====================================================================
@app.post("/generate_clinical_report")
async def generate_clinical_report(request: ReportRequest):
    try:
        system_prompt = """<system_role>Bạn là Bác sĩ Chẩn đoán Hình ảnh. KHÔNG dùng từ ngữ đời thường. KHÔNG an ủi bệnh nhân.</system_role>
<safety_guardrails>
1. KHÔNG ẢO GIÁC: Chỉ sử dụng thông số trong khối <input_data>.
2. TỪ CHỐI TIÊN LƯỢNG: TUYỆT ĐỐI KHÔNG dự đoán thời gian sống hay tỷ lệ tử vong.
3. KHÔNG KÊ ĐƠN: TUYỆT ĐỐI KHÔNG gợi ý tên thuốc, liều lượng.
</safety_guardrails>"""
        
        # Bảo mật HIPAA: Data Masking trước khi gửi lên Gemini
        safe_resnet_data = mask_patient_data(request.resnet_data)
        user_prompt = f"<input_data> {safe_resnet_data} </input_data>\nHãy viết Báo cáo chẩn đoán hình ảnh chuẩn format y tế bằng tiếng Việt."
        
        draft = call_gemini(system_prompt, user_prompt, temperature=0.1)
        return {"draft_report": draft}
    except Exception as e:
        import traceback; traceback.print_exc()
        print(f"Agent 1 error: {e}")
        resnet_data = request.resnet_data
        predicted_class = resnet_data.get("class_name", "Không rõ")
        confidence = resnet_data.get("confidence", 0)
        fallback = (
            f"⚠️ BẢN NHÁP TỰ ĐỘNG (OFFLINE MODE)\n"
            f"Kết quả phân tích từ AI Vision:\n"
            f"- Phân loại: {predicted_class}\n"
            f"- Độ tin cậy: {confidence}%\n"
            f"Vui lòng bác sĩ kiểm tra hình ảnh MRI để đưa ra kết luận cuối cùng."
        )
        return {"draft_report": fallback, "error": str(e)}

# =====================================================================
# AGENT 2: Phiên dịch viên AI (Luồng Giao tiếp Bệnh nhân)
# =====================================================================
@app.post("/translate_for_patient")
async def translate_for_patient(request: TranslationRequest):
    try:
        system_prompt = """<system_role>Bạn là Phiên dịch viên Y tế. Nhiệm vụ DUY NHẤT: chuyển đổi báo cáo y khoa thành ngôn ngữ đời thường.</system_role>
<translation_rules>
1. KHÔNG thêm bất kỳ thông tin y khoa nào không có trong báo cáo gốc.
2. KHÔNG suy diễn về tiên lượng hay cách điều trị.
3. Giữ nguyên ý nghĩa y khoa nhưng dùng giọng điệu thấu cảm.
4. BẮT BUỘC kết thúc bằng câu: "Đây chỉ là diễn giải kết quả. Vui lòng nghe theo phác đồ của bác sĩ điều trị."
</translation_rules>"""
        user_prompt = f"<clinical_report> {request.clinical_report} </clinical_report>\nHãy dịch báo cáo này sang ngôn ngữ đời thường dễ hiểu cho bệnh nhân."
        translated = call_gemini(system_prompt, user_prompt, temperature=0.4)
        return {"translated_report": translated}
    except Exception as e:
        import traceback; traceback.print_exc()
        print(f"Agent 2 error: {e}")
        return {"error": "Không thể dịch báo cáo lúc này.", "details": str(e)}

# =====================================================================
# AGENT 3: Chatbox Hỏi Đáp Lâm Sàng (RAG Integration)
# =====================================================================
@app.post("/chat")
async def clinical_chat(request: ChatRequest):
    if check_keyword_trap(request.message):
        return {"error": "CẢNH BÁO (Red Alert): Truy vấn vi phạm tiêu chuẩn y khoa. Giao dịch đã bị chặn và ghi log cảnh báo."}

    context = retrieve_medical_context(request.message)
    
    try:
        system_prompt = f"""Bạn là một người bạn thân thiết, am hiểu y tế, đang hỗ trợ bệnh nhân và bác sĩ qua hệ thống NeuroAttention AI.

VAI TRÒ CỦA BẠN:
Bạn có kiến thức y khoa sâu rộng. Hãy dùng kiến thức đó để TRẢ LỜI TỰ NHIÊN như một người hiểu biết đang nói chuyện thật.
TUYỆT ĐỐI KHÔNG trích dẫn tài liệu, KHÔNG nói "Theo phác đồ...", KHÔNG đọc sách lên mặt người hỏi.
Nói như người bạn thông minh, ấm áp đang giải thích cho người thân nghe.

GIỚI HẠN CHỦ ĐỀ (BẮT BUỘC):
Chỉ trả lời các câu hỏi liên quan đến: sức khỏe, triệu chứng, bệnh lý não, u não, chăm sóc bệnh nhân, tâm lý bệnh nhân.
Nếu câu hỏi KHÔNG liên quan y tế (toán học, lập trình, thời tiết, v.v.), từ chối nhẹ nhàng: "Mình chỉ có thể hỗ trợ về sức khỏe thôi nha. Bạn đang có triệu chứng gì cần tư vấn không?"

CÁCH TRẢ LỜI:
- Ngôn ngữ đời thường, thân thiện, ấm áp. Xưng "mình/bạn".
- Nếu bệnh nhân lo lắng hoặc sợ: trấn an trước, giải thích sau. Không làm họ sợ hơn.
- Dùng so sánh dễ hình dung thay vì thuật ngữ y khoa.
- Phân biệt rõ: triệu chứng nào cần đi khám ngay, triệu chứng nào có thể theo dõi thêm.
- TUYỆT ĐỐI KHÔNG chẩn đoán thay bác sĩ, KHÔNG tiên lượng tử vong, KHÔNG kê thuốc.
- Luôn kết thúc bằng lời khuyên gặp bác sĩ nếu cần.

KIẾN THỨC NỀN (dùng để hiểu, KHÔNG đọc ra hay trích dẫn):
{context}"""
        
        ai_answer = call_gemini(system_prompt, request.message, temperature=0.4)
        log_interaction(request.doctor_id, request.message, ai_answer, "completed")
        return {"answer": ai_answer, "source": "RAG + General Medical Knowledge"}
    except Exception as e:
        import traceback; traceback.print_exc()
        print(f"Agent 3 error: {e}")
        return {"error": f"Hệ thống AI đang gián đoạn: {str(e)}", "details": str(e)}

# =====================================================================
# AGENT 4: Tóm tắt Hội chẩn (Meeting Summarizer)
# =====================================================================
@app.post("/summarize_meeting")
async def summarize_meeting(request: MeetingRequest):
    try:
        system_prompt = """Bạn là Thư ký Y khoa. Hãy tóm tắt nội dung hội chẩn ca bệnh một cách khách quan bằng tiếng Việt thành 3 phần rõ ràng:
1. Ý kiến thống nhất.
2. Ý kiến khác biệt (nếu có).
3. Đề xuất hướng xử trí."""
        summary = call_gemini(system_prompt, f"Lịch sử hội chẩn:\n{request.chat_logs}", temperature=0.1)
        return {"summary": summary}
    except Exception as e:
        import traceback; traceback.print_exc()
        print(f"Agent 4 error: {e}")
        return {"error": f"Không thể tổng hợp hội chẩn: {str(e)}", "details": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
