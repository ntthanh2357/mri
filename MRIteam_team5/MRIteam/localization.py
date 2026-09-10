"""
localization.py — Pipeline 3 tầng định vị khối u não:
  Tầng 1: Grad-CAM  → heatmap hiển thị (XAI, không dùng để định box)
  Tầng 2: OpenCV    → blob detection trong vùng não (box sơ bộ)
  Tầng 3: Gemini Vision → nhìn ảnh MRI gốc, căn chỉnh box cuối cùng

Privacy Guard (Hướng A):
  - Sagittal/Coronal planes carry facial-reconstruction risk on 2-D JPEG slices.
  - Plane is detected from the file path (sequence folder prefix: Sag/COR/COR/SAG)
    or, as fallback, from image aspect ratio heuristic.
  - If the plane is classified FACIAL_RISK, Gemini Vision is NOT called for
    localization; the system falls back to YOLO/OpenCV and logs the reason.
"""

import cv2
import numpy as np
import tensorflow as tf
import base64
import json
import re
import os
import time

try:
    from ultralytics import YOLO # type: ignore
    YOLO_MODEL_PATH = "runs/detect/mri_tumor_det_v3/weights/best.pt"
    if os.path.exists(YOLO_MODEL_PATH):
        yolo_tumor_model = YOLO(YOLO_MODEL_PATH)
    else:
        yolo_tumor_model = None
except ImportError:
    yolo_tumor_model = None


# ═══════════════════════════════════════════════════════════════════
# PLANE DETECTION — Privacy guard (Hướng A)
# ═══════════════════════════════════════════════════════════════════

# Prefixes/substrings found in DICOM-derived sequence folder names
# (case-insensitive).  Order matters: checked top-to-bottom.
_SAGITTAL_TOKENS  = ["sag_", "sag ", "sagittal", "_sag"]
_CORONAL_TOKENS   = ["cor_", "cor ", "coronal",  "_cor"]
_AXIAL_TOKENS     = ["ax_",  "ax ",  "axial",    "_ax", "axi"]

PLANE_AXIAL        = "axial"
PLANE_SAGITTAL     = "sagittal"
PLANE_CORONAL      = "coronal"
PLANE_UNKNOWN      = "unknown"

# Planes for which Gemini Vision should NOT be called (facial-risk).
# PLANE_UNKNOWN is intentionally included as a FAIL-SAFE:
#   When a user uploads an image from the frontend, the filename rarely
#   contains DICOM sequence tokens (e.g. "sag", "ax").  In that case
#   plane detection returns UNKNOWN.  Treating UNKNOWN as safe would
#   create a silent bypass of the privacy guard for real-world uploads.
#   → Default: UNKNOWN = facial-risk.  Override only if you have an
#     out-of-band metadata source that positively confirms axial plane.
FACIAL_RISK_PLANES = {PLANE_SAGITTAL, PLANE_CORONAL, PLANE_UNKNOWN}




def infer_plane_from_path(file_path: str) -> str:
    """
    Determine the MRI acquisition plane from the file path.

    Design principle — "permit only when provenance is confirmed":
      Gemini Vision is called ONLY when we have RELIABLE evidence the image
      is axial.  Two trusted sources are recognised:
        1. Plane manifest (plane_manifest.json) — highest trust.  Built from
           dataset provenance with confirmed DICOM sequence tags (TT hospital
           data only).  If a filename is listed here, return immediately.
        2. Path/filename DICOM tokens — sequence-folder names embedded in
           the file path (e.g. 'Sag_T1_FLAIR_7', 'COR_T2_6', 'Ax_DWI_5').

    Why pixel heuristics (symmetry / aspect-ratio) are NOT used to grant
    PLANE_AXIAL:
      The Kaggle "Brain Tumor MRI Dataset" (Nickparvar) pre-processes all
      images to 512x512 squares.  Black background padding is symmetric and
      dominates the L-R symmetry score (measured ~0.93-0.99 for EVERY image
      regardless of acquisition plane).  The signal is therefore unreliable
      and cannot distinguish axial from sagittal in this specific dataset.
      [Experimented in experiments/symmetry_heuristic_experiment.py —
       kept for Discussion reference.]

    Default: PLANE_UNKNOWN in FACIAL_RISK_PLANES -> Gemini blocked (fail-safe).

    Returns one of: PLANE_AXIAL | PLANE_SAGITTAL | PLANE_CORONAL | PLANE_UNKNOWN
    """
    import json as _json

    # ── Step 1: Manifest lookup ─────────────────────────────────────────────
    _MANIFEST_PATH = os.path.join(os.path.dirname(__file__), "plane_manifest.json")
    try:
        if os.path.exists(_MANIFEST_PATH):
            with open(_MANIFEST_PATH, "r", encoding="utf-8") as _f:
                _manifest: dict = _json.load(_f)
            _basename = os.path.basename(file_path)
            if _basename in _manifest:
                _plane = _manifest[_basename]
                print(f"[Plane Detect] manifest hit: '{_basename}' → '{_plane}'")
                return _plane
    except Exception as _e:
        print(f"[Plane Detect] manifest read error (ignored): {_e}")

    # ── Step 2: Path/filename token scan ────────────────────────────────────
    path_lower = file_path.replace("\\", "/").lower()

    for token in _SAGITTAL_TOKENS:
        if token in path_lower:
            return PLANE_SAGITTAL
    for token in _CORONAL_TOKENS:
        if token in path_lower:
            return PLANE_CORONAL
    for token in _AXIAL_TOKENS:
        if token in path_lower:
            return PLANE_AXIAL

    # ── Step 3: Fail-safe default ────────────────────────────────────────────
    # No provenance, no token → cannot confirm axial → block (do NOT guess).
    return PLANE_UNKNOWN


def should_call_gemini(file_path: str) -> tuple[bool, str]:
    """
    Convenience wrapper around infer_plane_from_path().

    Returns:
        (allowed: bool, plane: str)
          - allowed=True  → plane is confirmed axial → Gemini may be called.
          - allowed=False → plane is facial-risk (sagittal / coronal / unknown)
                           → Gemini MUST be skipped; fallback to YOLO/OpenCV.

    Design: single point of truth for the Privacy Guard decision.
    Use this function at every call-site instead of inlining the plane check.

    Example:
        allowed, plane = should_call_gemini(file_path)
        if not allowed:
            log.info(f"[Privacy Guard] Skipping Gemini for {file_path}: plane={plane}")
            return fallback_result
        # ... call Gemini
    """
    plane = infer_plane_from_path(file_path)
    if plane in FACIAL_RISK_PLANES:
        return False, plane
    return True, plane


# ═══════════════════════════════════════════════════════════════════
# TẦNG 1: GRAD-CAM (chỉ để hiển thị heatmap — XAI visualization)
# ═══════════════════════════════════════════════════════════════════
def _compute_heatmap(model, img_array, class_idx, layer="conv5_block3_out"):
    grad_model = tf.keras.models.Model(
        inputs=model.inputs,
        outputs=[model.get_layer(layer).output, model.output]
    )
    with tf.GradientTape() as tape:
        conv_out, preds = grad_model(img_array)
        loss = preds[:, class_idx]
    grads = tape.gradient(loss, conv_out)
    pooled = tf.reduce_mean(grads, axis=(0, 1, 2)) # type: ignore
    hm = conv_out[0].numpy() @ pooled.numpy()[..., np.newaxis]
    hm = np.squeeze(hm)
    hm = np.maximum(hm, 0)
    return (hm / hm.max()) if hm.max() > 1e-8 else hm


# ═══════════════════════════════════════════════════════════════════
# TẦNG 2A: TÁCH VÙNG NÃO (loại skull & background)
# ═══════════════════════════════════════════════════════════════════
def _extract_brain_mask(gray):
    """Trả về binary mask chỉ chứa vùng mô não."""
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    cnts, _ = cv2.findContours(otsu, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    head_mask = np.zeros_like(gray)
    if cnts:
        largest = max(cnts, key=cv2.contourArea)
        cv2.drawContours(head_mask, [largest], -1, 255, thickness=cv2.FILLED)
    skull_margin = max(int(min(gray.shape) * 0.08), 8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (skull_margin, skull_margin))
    return cv2.erode(head_mask, k, iterations=2)


# ═══════════════════════════════════════════════════════════════════
# TẦNG 2B: OPENCV BLOB DETECTION (box sơ bộ, backup khi Gemini thất bại)
# ═══════════════════════════════════════════════════════════════════
def _detect_tumor_opencv(img_cv, brain_mask, heatmap_norm=None):
    """
    Trong vùng não, tìm blob sáng bất thường.
    heatmap_norm: dùng làm soft boost (không ràng buộc cứng).
    """
    h, w = img_cv.shape[:2]
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    brain_only = cv2.bitwise_and(enhanced, enhanced, mask=brain_mask)

    adaptive = cv2.adaptiveThreshold(
        brain_only, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, blockSize=61, C=-25
    )
    adaptive = cv2.bitwise_and(adaptive, adaptive, mask=brain_mask)

    k_open  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (18, 18))
    cleaned = cv2.morphologyEx(adaptive, cv2.MORPH_OPEN,  k_open,  iterations=1)
    cleaned = cv2.morphologyEx(cleaned,  cv2.MORPH_CLOSE, k_close, iterations=2)
    cnts, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_area = h * w * 0.003
    max_area = h * w * 0.12

    # Upscale heatmap nếu có
    hm_up = None
    if heatmap_norm is not None:
        hm_up = cv2.resize(heatmap_norm, (w, h), interpolation=cv2.INTER_CUBIC)
        hm_blur = cv2.GaussianBlur(hm_up, (21, 21), 0)
        mx = hm_blur.max()
        hm_up = hm_blur / mx if mx > 1e-8 else hm_blur

    brain_pixels = gray[brain_mask > 0]
    brain_mean = float(brain_pixels.mean()) if brain_pixels.size > 0 else 80
    min_brightness = brain_mean * 1.20

    candidates = []
    brain_cx, brain_cy = w // 2, h // 2

    for c in cnts:
        area = cv2.contourArea(c)
        if area < min_area or area > max_area:
            continue
        x, y, bw, bh = cv2.boundingRect(c)
        cx, cy = x + bw // 2, y + bh // 2
        roi_gray = enhanced[y:y+bh, x:x+bw]
        valid = roi_gray[brain_mask[y:y+bh, x:x+bw] > 0]
        if valid.size == 0 or float(valid.mean()) < min_brightness:
            continue
        mean_int = float(valid.mean())
        heat_boost = 1.0
        if hm_up is not None:
            roi_heat = hm_up[y:y+bh, x:x+bw]
            heat_boost = 1.0 + float(roi_heat.mean()) if roi_heat.size > 0 else 1.0
        dist = np.sqrt((cx - brain_cx)**2 + (cy - brain_cy)**2)
        score = (mean_int * np.sqrt(area) * heat_boost) / (dist + 1.0)
        candidates.append((score, x, y, bw, bh))

    candidates.sort(key=lambda b: b[0], reverse=True)
    return [(x, y, bw, bh) for (_, x, y, bw, bh) in candidates]

# ═══════════════════════════════════════════════════════════════════
# TẦNG YOLO: MÔ HÌNH NHẬN DIỆN KHỐI U CHUYÊN DỤNG
# ═══════════════════════════════════════════════════════════════════
def _yolo_locate_tumor(file_path: str):
    if yolo_tumor_model is None:
        return None
    try:
        results = yolo_tumor_model(file_path, verbose=False)
        if not len(results) or len(results[0].boxes) == 0:
            return None
        # Lấy box có confidence cao nhất
        best_box = results[0].boxes[0]
        x_center, y_center, w, h = best_box.xywh[0].tolist()
        xmin = int(x_center - w / 2)
        ymin = int(y_center - h / 2)
        
        cls_idx = int(best_box.cls[0].item())
        conf = float(best_box.conf[0].item())
        # Tương ứng với cấu hình tumor_data.yaml
        class_names = {0: 'Glioma', 1: 'Meningioma', 2: 'No Tumor', 3: 'Pituitary'}
        yolo_class = class_names.get(cls_idx, "Unknown")
        
        print(f"[YOLO Localize] ✅ Tìm thấy khối u: ({xmin},{ymin},{int(w)},{int(h)}) - {yolo_class} ({conf:.2f})")
        return (xmin, ymin, int(w), int(h)), yolo_class, conf
    except Exception as e:
        print(f"[YOLO Localize] Lỗi: {e}")
        return None

# ═══════════════════════════════════════════════════════════════════
# HELPER

# ═══════════════════════════════════════════════════════════════════
def _get_img_wh(file_path: str) -> str:
    try:
        img = cv2.imread(file_path)
        if img is not None:
            h, w = img.shape[:2]
            return f"{w}x{h}"
    except Exception:
        pass
    return "unknown"


# ═══════════════════════════════════════════════════════════════════
# TẦNG 3: GEMINI VISION — NHÌN THẲNG VÀO ẢNH MRI, CĂN CHỈNH BOX
# ═══════════════════════════════════════════════════════════════════
def _gemini_locate_tumor(file_path: str, predicted_class: str,
                          confidence: float, opencv_box,
                          gemini_client, gemini_model: str,
                          plane: str = PLANE_UNKNOWN):
    """
    Gửi ảnh MRI gốc cho Gemini Vision để xác định vị trí khối u.
    Dùng gemini-2.0-flash-lite (quota riêng) để không tốn quota chat.
    opencv_box: (x, y, w, h) gợi ý từ OpenCV.
    Trả về dict {x, y, width, height, note} hoặc None.
    """
    VISION_MODEL = "gemini-2.5-flash-lite"

    # ── Privacy Guard: block Gemini for facial-risk planes ──────────
    if plane in FACIAL_RISK_PLANES:
        print(
            f"[Gemini Localize] ⚠ PRIVACY GUARD: plane='{plane}' is classified as "
            f"facial-risk ({', '.join(sorted(FACIAL_RISK_PLANES))}). "
            f"VLM localization skipped — falling back to YOLO/OpenCV. "
            f"[audit: file={os.path.basename(file_path)}, class={predicted_class}]"
        )
        return None
    # ────────────────────────────────────────────────────────────────

    try:
        with open(file_path, "rb") as f:
            img_bytes = f.read()

        ext = os.path.splitext(file_path)[-1].lower()
        mime = "image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png"

        img_wh = _get_img_wh(file_path)
        prompt = (
            f"You are an expert radiologist analyzing a brain MRI.\n"
            f"AI diagnosis: {predicted_class.upper()} ({confidence:.1f}% confidence).\n"
            f"Task: Find the exact location of the brain tumor/lesion.\n"
            f"Return the bounding box in the format [ymin, xmin, ymax, xmax], where values are scaled between 0 and 1000.\n"
            f"Return ONLY raw JSON (no markdown):\n"
            f"{{\"box_2d\": [ymin, xmin, ymax, xmax], \"note\": \"<mô tả tiếng Việt ngắn gọn về vị trí>\"}}\n"
            f"Rules: Only bound the actual tumor tissue, not the whole brain."
        )

        from google.genai import types as genai_types

        raw = None
        for attempt in range(3):
            try:
                response = gemini_client.models.generate_content(
                    model=VISION_MODEL,
                    contents=[
                        genai_types.Part.from_bytes(data=img_bytes, mime_type=mime),
                        prompt
                    ],
                    config=genai_types.GenerateContentConfig(
                        temperature=0.05,
                        max_output_tokens=256,
                    )
                )
                raw = response.text.strip()
                break
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    wait_s = 35 * (attempt + 1)
                    print(f"[Gemini Localize] Rate limit (attempt {attempt+1}), retry sau {wait_s}s...")
                    time.sleep(wait_s)
                    if attempt == 2:
                        print("[Gemini Localize] Hết quota, fallback OpenCV")
                        return None
                else:
                    raise

        if raw is None:
            return None

        # Parse JSON — xử lý cả khi Gemini bọc trong ```json ... ```
        clean = re.sub(r'```[a-zA-Z]*\n?', '', raw).replace('```', '').strip()
        json_match = re.search(r'\{[^{}]+\}', clean, re.DOTALL)
        if not json_match:
            print(f"[Gemini Localize] Không parse được JSON từ: {raw[:150]}")
            return None

        data = json.loads(json_match.group())
        
        # Support fallback to old keys just in case, but prioritize box_2d
        if "box_2d" in data and isinstance(data["box_2d"], list) and len(data["box_2d"]) == 4:
            ymin, xmin, ymax, xmax = data["box_2d"]
            img_cv = cv2.imread(file_path)
            if img_cv is None:
                return None
            h_img, w_img = img_cv.shape[:2]
            x = int(xmin * w_img / 1000)
            y = int(ymin * h_img / 1000)
            width = int((xmax - xmin) * w_img / 1000)
            height = int((ymax - ymin) * h_img / 1000)
        else:
            x      = int(data.get("x",      data.get("left",  0)))
            y      = int(data.get("y",      data.get("top",   0)))
            width  = int(data.get("width",  data.get("w",     0)))
            height = int(data.get("height", data.get("h",     0)))
            
        note = str(data.get("note", data.get("label", "")))

        if width < 5 or height < 5:
            print(f"[Gemini Localize] Box quá nhỏ ({width}×{height}), fallback")
            return None

        print(f"[Gemini Localize] ✅ {predicted_class}: ({x},{y},{width},{height}) | {note}")
        return {"x": x, "y": y, "width": width, "height": height, "note": note}

    except Exception as e:
        print(f"[Gemini Localize] Lỗi: {e}")
        return None


def _generate_lesion_heatmap(img_cv, box):
    """
    Tạo heatmap tập trung chính xác vào vùng khối u (dựa trên tọa độ box và độ sáng pixel).
    Thay thế cho Grad-CAM bị nhiễu do model học sai đặc trưng (shortcut learning).
    """
    h, w = img_cv.shape[:2]
    x, y, bw, bh = box
    
    # Tạo nền Gaussian tại tâm khối u
    mask = np.zeros((h, w), dtype=np.float32)
    cx, cy = x + bw // 2, y + bh // 2
    
    # Bán kính Gaussian vừa vặn với kích thước box
    sigma_x = bw / 3.0
    sigma_y = bh / 3.0
    
    y_idx, x_idx = np.ogrid[:h, :w]
    mask = np.exp(-(((x_idx - cx)**2) / (2 * max(sigma_x, 1)**2) + ((y_idx - cy)**2) / (2 * max(sigma_y, 1)**2)))
    
    # Lấy cường độ pixel thực tế (u thường sáng hơn)
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    
    # Combine: vùng khối u sẽ sáng nhất ở tâm và nhạt dần, dựa theo cả pixel thực
    heatmap = mask * (gray + 0.5)  # +0.5 để đảm bảo những vùng u tối vẫn có màu
    
    if heatmap.max() > 1e-8:
        heatmap /= heatmap.max()
        
    return heatmap

# ═══════════════════════════════════════════════════════════════════
# RENDER
# ═══════════════════════════════════════════════════════════════════
def _render(img_cv, heatmap_norm, box, source="opencv"):
    h, w = img_cv.shape[:2]
    hm_up   = cv2.resize(heatmap_norm, (w, h), interpolation=cv2.INTER_CUBIC)
    
    # Tăng độ mượt cho heatmap
    hm_blur = cv2.GaussianBlur(hm_up, (21, 21), 0)
    mx = hm_blur.max()
    if mx > 1e-8:
        hm_blur /= mx
        
    hm_uint8 = np.uint8(255 * hm_blur)
    
    # Bỏ bớt màu xanh dương (vùng background) để ảnh gốc không bị phủ xanh
    jet = cv2.applyColorMap(hm_uint8, cv2.COLORMAP_JET) # type: ignore
    
    # Tạo mask alpha: chỗ nào heatmap < 0.1 thì trong suốt
    alpha = hm_blur.copy()
    alpha[alpha < 0.15] = 0.0
    alpha = np.expand_dims(alpha, axis=-1)
    
    # Trộn ảnh
    blended = (jet * alpha * 0.6 + img_cv * (1.0 - alpha * 0.6)).astype(np.uint8)

    if box:
        x, y, bw, bh = box
        # YOLO = đỏ (#FF0000), Gemini = xanh lá sáng (#00FF80), OpenCV = xanh lá chuẩn
        if source == "gemini":
            color = (0, 255, 128)
        elif source == "yolo":
            color = (0, 0, 255) # BGR
        else:
            color = (0, 255, 0)
        cv2.rectangle(blended, (x, y), (x+bw, y+bh), color, 2)
        label = "TUMOR (YOLO)" if source == "yolo" else "TUMOR"
        label_y = max(y - 6, 14)
        cv2.putText(blended, label, (x, label_y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    return blended


# ═══════════════════════════════════════════════════════════════════
# ENTRY POINT CHÍNH
# ═══════════════════════════════════════════════════════════════════
def generate_gradcam_localization(model, img_array, file_path,
                                   predicted_class, class_idx,
                                   confidence: float = 0.0,
                                   gemini_client=None,
                                   gemini_model: str = "gemini-2.5-flash"):
    """
    Pipeline 3 tầng:
      Tầng 1: Grad-CAM  → heatmap màu JET (XAI display)
      Tầng 2: OpenCV    → phát hiện blob sáng trong não (box sơ bộ)
      Tầng 3: Gemini Vision → căn chỉnh box cuối cùng dựa trên ảnh MRI gốc
                              [PRIVACY GUARD: skipped for sagittal/coronal]
    """
    img_cv = cv2.imread(file_path)
    if img_cv is None or predicted_class == "notumor":
        return None, img_cv

    # ── Detect acquisition plane — used by privacy guard ──
    scan_plane = infer_plane_from_path(file_path)
    print(f"[Plane Detect] file='{os.path.basename(file_path)}' → plane='{scan_plane}'")

    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)

    # Tầng 1: Grad-CAM heatmap (chỉ để hiển thị)
    heatmap = _compute_heatmap(model, img_array, class_idx)

    # Tầng 2: OpenCV blob detection
    brain_mask  = _extract_brain_mask(gray)
    opencv_boxes = _detect_tumor_opencv(img_cv, brain_mask, heatmap)
    opencv_box   = opencv_boxes[0] if opencv_boxes else None

    # Tầng YOLO: Nhận diện khối u bằng YOLOv8
    final_box  = None
    box_source = "opencv"
    yolo_class = ""
    yolo_conf = 0.0

    if yolo_tumor_model is not None:
        yolo_res = _yolo_locate_tumor(file_path)
        if yolo_res:
            yolo_box, yolo_class, yolo_conf = yolo_res
            h_img, w_img = img_cv.shape[:2]
            gx, gy, gw, gh = yolo_box
            gx = max(0, min(gx, w_img - 1))
            gy = max(0, min(gy, h_img - 1))
            gw = max(10, min(gw, w_img - gx))
            gh = max(10, min(gh, h_img - gy))
            final_box  = (gx, gy, gw, gh)
            box_source = "yolo"

    # Tầng Gemini Vision: Nếu YOLO không tìm thấy, dùng Gemini
    # (Privacy Guard sẽ tự động bị qua bên trong nếu plane là facial-risk)
    if final_box is None and gemini_client is not None:
        gemini_result = _gemini_locate_tumor(
            file_path, predicted_class, confidence,
            opencv_box, gemini_client, gemini_model,
            plane=scan_plane
        )
        if gemini_result:
            h_img, w_img = img_cv.shape[:2]
            gx = max(0, min(gemini_result["x"], w_img - 1))
            gy = max(0, min(gemini_result["y"], h_img - 1))
            gw = max(10, min(gemini_result["width"],  w_img - gx))
            gh = max(10, min(gemini_result["height"], h_img - gy))
            final_box  = (gx, gy, gw, gh)
            box_source = "gemini"
        else:
            print("[Gemini Localize] Fallback → OpenCV box")

    # Fallback sang OpenCV nếu Gemini thất bại
    if final_box is None:
        if opencv_box:
            final_box  = opencv_box
            box_source = "opencv"
        else:
            # Fallback cuối: peak Grad-CAM trong não
            h_img, w_img = img_cv.shape[:2]
            hm_up = cv2.resize(heatmap, (w_img, h_img), interpolation=cv2.INTER_CUBIC)
            hm_up = cv2.GaussianBlur(hm_up, (21, 21), 0)
            if hm_up.max() > 1e-8:
                hm_up /= hm_up.max()
            hm_up = hm_up * (brain_mask / 255.0)
            py, px = np.unravel_index(np.argmax(hm_up), hm_up.shape)
            bw_fb, bh_fb = w_img // 5, h_img // 5
            final_box  = (max(0, px - bw_fb//2), max(0, py - bh_fb//2),
                          min(bw_fb, w_img - px), min(bh_fb, h_img - py))
            box_source = "fallback"

    # Thay vì dùng Grad-CAM sai lệch, tạo heatmap chuẩn xác trực tiếp từ tọa độ khối u
    if final_box is not None:
        visual_heatmap = _generate_lesion_heatmap(img_cv, final_box)
    else:
        visual_heatmap = heatmap

    result_img = _render(img_cv, visual_heatmap, final_box, source=box_source)

    x, y, bw, bh = final_box
    from typing import Any
    tumor_location: dict[str, Any] = {"x": int(x), "y": int(y), "width": int(bw), "height": int(bh), "source": box_source}
    
    if box_source == "yolo":
        tumor_location["yolo_class"] = yolo_class
        tumor_location["yolo_conf"] = yolo_conf
        
    return tumor_location, result_img


# ── Legacy ────────────────────────────────────────────────────────────────────
def find_tumor_box(original_img):
    gray = cv2.cvtColor(original_img, cv2.COLOR_BGR2GRAY)
    brain_mask = _extract_brain_mask(gray)
    boxes = _detect_tumor_opencv(original_img, brain_mask)
    return boxes[0] if boxes else None
