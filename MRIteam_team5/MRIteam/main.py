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

from localization import find_tumor_box, generate_gradcam_localization
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Brain Tumor Diagnosis API")

# Cấu hình Gemini API (SDK mới google.genai)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=GEMINI_API_KEY)
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

# =====================================================================
# HỆ THỐNG DATABASE & BẢO MẬT (AUDIT, MASKING, TRAPS)
# =====================================================================
DB_FILE = "audit_logs.db"

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
    RAG Context Engine: chọn ngữ cảnh phù hợp từ 6 tài liệu dựa trên nội dung câu hỏi.
    Giả lập vector search — sẽ thầy thế bằng embedding thật trong Giai đoạn 3.
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
YOLO_MODEL_PATH = "runs/detect/mri_tumor_det/weights/best.pt"
try:
    yolo_model = YOLO(YOLO_MODEL_PATH)
except Exception as e:
    print(f"Không tìm thấy mô hình YOLO: {e}")
    yolo_model = None

CATEGORIES = ['glioma', 'meningioma', 'notumor', 'pituitary']

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if model is None or efficientnet_model is None or densenet_model is None:
        return {"error": "Hệ thống AI chưa sẵn sàng (Lỗi tải mô hình)"}

    # 2. Lưu tạm file ảnh tải lên
    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    
    file_path = os.path.join(upload_dir, file.filename or "uploaded_file.jpg")
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    # 3. Tiền xử lý bằng Pipeline OpenCV v2 của Huy
    processed_img = medical_preprocessing_v2(file_path)
    
    if processed_img is None:
        return {"error": "Không thể xử lý ảnh"}

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
                    
                    # Trích xuất tọa độ box
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
                        yolo_class = 'notumor'
        except Exception as e:
            print(f"Lỗi khi chạy dự đoán YOLOv8: {e}")
            
    # 7. LOGIC ĐỒNG THUẬN LÂM SÀNG & KIỂM CHÉO VỚI GEMINI VISION (Tầng 3)
    # So sánh cnn_class và yolo_class để phát hiện xung đột
    is_conflict = (cnn_class != yolo_class)
    # Bỏ qua xung đột nếu Ensemble rất tự tin (>= 85%) và YOLO bị lỗi bỏ sót (notumor)
    if is_conflict and cnn_class != 'notumor' and yolo_class == 'notumor' and confidence >= 0.85:
        is_conflict = False
        
    predicted_class = cnn_class
    final_confidence = confidence
    if cnn_class != yolo_class and not is_conflict:
        consensus_message = f"Đồng thuận (Tin cậy Ensemble cực cao {confidence*100:.1f}%, bỏ qua lỗi bỏ sót của YOLOv8)."
    else:
        consensus_message = "Đồng thuận 100%. Các mô hình cho kết quả tương đồng."
    
    if is_conflict:
        print(f"[Consensus] Phát hiện XUNG ĐỘT (Ensemble: {cnn_class} vs YOLOv8: {yolo_class}). Gọi Gemini VLM phân xử...")
        
        sys_prompt = """You are a senior neuroradiologist serving as a clinical diagnostic arbitrator. Analyze the provided raw MRI brain scan and resolve the classification disagreement between the detection model (YOLOv8) and the classification ensemble.
You will be provided with the full brain scan (which may have a RED bounding box highlighting the Region of Interest (ROI) detected by YOLOv8, if a tumor was detected).
If a second image is attached, it represents a zoomed-in/cropped version of that ROI to help you inspect micro-textures, tumor borders, and signal enhancements in detail.

  CRITICAL CONSTRAINTS:
  1. Rely strictly on visible anatomical and pathological features.
  2. Do NOT provide treatment plans, drug prescriptions, or survival prognoses.
  3. Be decisive. Assign a confidence score representing your certainty. Only assign a score below 0.75 if the scan is of extremely poor quality, completely uninterpretable, or the pathology is genuinely indistinguishable. Otherwise, output your true diagnostic confidence (typically 0.80 - 0.99 for clear cases).
  4. If both the classification ensemble and YOLOv8 predicted a tumor (i.e., neither predicted 'notumor'), you MUST choose one of the tumor types ('glioma', 'meningioma', 'pituitary'). Do NOT verdict 'notumor' in this case.
  5. If the classification ensemble predicted a tumor but YOLOv8 predicted 'notumor' (meaning no red bounding box is drawn), carefully inspect the scan. Do not assume 'notumor' just because the bounding box is missing; check for subtle lesions, vasogenic edema, or midline shifts.

  DIAGNOSTIC CRITERIA:
  - Glioma: Intra-axial tumor, irregular/fuzzy borders, surrounding vasogenic edema showing hyperintensity on T2/FLAIR slices.
  - Meningioma: Extra-axial mass, clear dural-tail sign attachment, homogeneous contrast enhancement on T1 post-contrast.
  - Pituitary: Midline tumor in the sellar or suprasellar pocket, potential 'snowman sign' causing compression of the optic chiasm.
  - No Tumor: Normal brain symmetry, normal CSF spaces, no mass effect, midline is centered.

  Your output must be returned strictly in JSON format matching the schema:
  {
    "reasoning": "Step-by-step clinical anatomical review of the ROI and diagnostic evidence.",
    "confidence": 0.0-1.0 (calibrated confidence score),
    "verdict": "glioma" | "meningioma" | "pituitary" | "notumor"
  }"""
        
        yolo_info = f"Class: {yolo_class}"
        if yolo_box_details:
            yolo_info += f" (Confidence: {round(yolo_box_details['conf']*100, 2)}%), ROI Box: [x:{yolo_box_details['x']}, y:{yolo_box_details['y']}, w:{yolo_box_details['width']}, h:{yolo_box_details['height']}]"
        else:
            yolo_info += " (No bounding box detected)"

        # Thêm gợi ý ràng buộc để nâng cao độ chính xác
        rule_hints = []
        if cnn_class != 'notumor' and yolo_class != 'notumor':
            rule_hints.append("CRITICAL: Both models agree a tumor is present. You MUST choose one of ('glioma', 'meningioma', 'pituitary'). Do NOT select 'notumor'.")
        elif cnn_class != 'notumor' and yolo_class == 'notumor':
            rule_hints.append("NOTE: The ensemble detected a tumor, but YOLOv8 missed it. Please inspect the scan carefully; do not default to 'notumor' just because there is no red bounding box.")
        
        # Nếu có cropped ROI image
        if yolo_box_details:
            rule_hints.append("INFO: A zoomed-in/cropped image of the ROI bounding box is provided as a second image attachment to help you analyze micro-features.")
            
        rule_hint_str = "\n".join(rule_hints) if rule_hints else ""
            
        usr_prompt = f"""[CLINICAL DIAGNOSTIC ARBITRATION]
The deep learning classification ensemble predicted: {cnn_class} (Confidence: {round(confidence*100, 2)}%).
👉 Ensemble Uncertainty Score (variance): {round(uncertainty_score, 4)}

The YOLOv8 object detection model predicted: {yolo_info}
{rule_hint_str}

There is a classification conflict. Please review the raw MRI image, consider the predictions from both models, and resolve the conflict using neuroanatomical diagnostic criteria.
State your step-by-step reasoning and output a structured JSON response."""

        try:
            img_pil = Image.open(file_path).convert("RGB")
            img_cropped = None
            if yolo_box_details:
                img_clean = img_pil.copy()
                draw = ImageDraw.Draw(img_pil)
                x = yolo_box_details['x']
                y = yolo_box_details['y']
                w = yolo_box_details['width']
                h = yolo_box_details['height']
                draw.rectangle([x, y, x + w, y + h], outline="red", width=3)
                
                # Cắt ROI (phóng to khối u)
                img_cropped = img_clean.crop((x, y, x + w, y + h))
                
            contents = [usr_prompt, img_pil]
            if img_cropped:
                contents.append(img_cropped)
                
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=contents, # type: ignore
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
                
                verdict = str(gemini_json.get("verdict", "")).lower().strip()
                vlm_conf = float(gemini_json.get("confidence", 0))
                reasoning = gemini_json.get("reasoning", "")
                
                if verdict in CATEGORIES:
                    if vlm_conf >= 0.75:
                        predicted_class = verdict
                        final_confidence = vlm_conf
                        consensus_message = f"<strong style='color:#fff'>Trọng tài VLM quyết định:</strong> {verdict.upper()}<br><strong style='color:#fff'>Độ tin cậy:</strong> {vlm_conf*100:.1f}%<br><strong style='color:#fff'>Lập luận phân tích:</strong> {reasoning}"
                    else:
                        predicted_class = cnn_class
                        final_confidence = confidence
                        consensus_message = f"<strong style='color:#ffaa00'>Cảnh báo: Highly Ambiguous (Cực kỳ mơ hồ)</strong><br><strong style='color:#fff'>Lý do:</strong> Độ tự tin của VLM ({vlm_conf*100:.1f}%) dưới ngưỡng an toàn 75%.<br><strong style='color:#fff'>Lập luận của VLM:</strong> {reasoning}<br><strong style='color:#fff'>Hành động:</strong> Tự động quay về Ensemble ({cnn_class.upper()}) & chuyển hội chẩn thủ công."
                else:
                    predicted_class = cnn_class
                    final_confidence = confidence
                    consensus_message = f"<strong style='color:#ff5555'>Cảnh báo: Quyết định VLM không xác định</strong><br><strong style='color:#fff'>Hành động:</strong> Tự động quay về Ensemble ({cnn_class.upper()})."
            except Exception as e:
                print(f"[Consensus] Lỗi phân tích JSON từ Gemini: {e}. Raw: {raw_text}")
                predicted_class = cnn_class
                final_confidence = confidence
                consensus_message = f"<strong style='color:#ff5555'>Cảnh báo: Lỗi xử lý kết quả phân xử</strong><br><strong style='color:#fff'>Hành động:</strong> Quay về Ensemble ({cnn_class.upper()})."
        except Exception as e:
            print(f"[Consensus] Lỗi gọi Gemini API: {e}")
            predicted_class = cnn_class
            final_confidence = confidence
            consensus_message = f"<strong style='color:#ff5555'>Cảnh báo: Lỗi kết nối API phân xử</strong><br><strong style='color:#fff'>Hành động:</strong> Quay về Ensemble ({cnn_class.upper()})."

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
    
    os.remove(file_path)
    return result


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
        os.makedirs(hard_dir)
        
    # 2. Lưu lại file ảnh gốc
    file_path = os.path.join(hard_dir, file.filename or "uploaded_file.jpg")
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
        system_prompt = """<system_role>Bạn là một Bác sĩ thấu cảm và là Phiên dịch viên Y tế tận tâm. Nhiệm vụ của bạn là chuyển đổi báo cáo y khoa phức tạp thành ngôn ngữ đời thường, gần gũi, dễ hiểu cho bệnh nhân.</system_role>
<translation_rules>
1. TUÂN THỦ LỜI THỀ HIPPOCRATES: Luôn đặt lợi ích, sự bình an và sức khỏe tâm lý của bệnh nhân lên hàng đầu. Dùng giọng điệu nhẹ nhàng, ấm áp, thấu cảm, tránh dùng ngôn từ gây hoảng sợ hoặc hoang mang tột độ cho bệnh nhân.
2. ĐƠN GIẢN HÓA THUẬT NGỮ: Giải thích các thuật ngữ chuyên môn phức tạp (như glioma, meningioma, pituitary, phù nề, hiệu ứng khối, v.v.) bằng các so sánh đơn giản, trực quan.
3. KHÔNG TỰ Ý THÊM BỚT THÔNG TIN LÂM SÀNG: Không suy đoán tiên lượng thời gian sống, không kê đơn thuốc hoặc tự đề xuất phương pháp phẫu thuật nằm ngoài báo cáo.
4. BẢO MẬT & TÔN TRỌNG Y ĐỨC: Luôn tôn trọng vai trò của bác sĩ điều trị trực tiếp.
5. BẮT BUỘC kết thúc bằng câu: "Đây chỉ là diễn giải kết quả để bạn tham khảo dễ hiểu hơn. Hãy luôn thảo luận trực tiếp và nghe theo phác đồ điều trị của bác sĩ chuyên khoa của bạn."
</translation_rules>"""
        user_prompt = f"<clinical_report> {request.clinical_report} </clinical_report>\nHãy dịch và giải thích báo cáo y khoa này sang ngôn ngữ gần gũi, dễ hiểu cho bệnh nhân."
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
