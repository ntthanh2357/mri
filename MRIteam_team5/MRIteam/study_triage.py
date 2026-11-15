"""
study_triage.py — Fast MRI Study Ingestion, Sequence Filtering & Top-K Lesion Triage
===================================================================================
Filters raw multi-series brain MRI study folders / ZIP archives (~500-1,500+ images):
  1. Drops non-diagnostic series (localizers, scouts, screen saves, calibration)
     and invalid/outer black frames.
  2. Classifies sequences (T1C+, T2_FLAIR, T1_FLAIR, T2W, T2_CORONAL, DWI, ADC, TOF_MRA)
     and acquisition plane (axial, sagittal, coronal, unknown) WITHOUT misclassifying
     T1_FLAIR as T2_FLAIR.
  3. Weights series priority according to requested protocol_code & with_contrast.
  4. Runs fast batched YOLOv8 lesion detection + ResNet50 screening to score each slice
     by lesion clarity and anatomical brain coverage.
  5. Returns up to `candidate_limit` (default 40) ranked slices with `top_k` (default 10)
     diverse, clearest slices pre-selected for KTV review.
"""

from __future__ import annotations

import math
import os
import re
import zipfile
from collections import defaultdict
from typing import Any, Callable, Dict, List, Optional, Tuple

import cv2
import numpy as np

from localization import (
    PLANE_AXIAL,
    PLANE_CORONAL,
    PLANE_SAGITTAL,
    PLANE_UNKNOWN,
    infer_plane_from_path,
)
from preprocess import medical_preprocessing_v2

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

_IGNORE_FOLDER_TOKENS = (
    "localizer",
    "localiser",
    "scout",
    "screen_save",
    "screensave",
    "scrsave",
    "calib",
    "calibration",
    "survey",
    "report",
    "protocol",
    "dose",
    "__macosx",
)

_YOLO_DEFAULT_CLASSES = {
    0: "glioma",
    1: "meningioma",
    2: "notumor",
    3: "pituitary",
}

_NO_TUMOR_ALIASES = {"notumor", "no tumor", "no_tumor", "normal", "negative"}

_PROTOCOL_WEIGHTS: Dict[str, Dict[str, float]] = {
    "BRAIN_TUMOR_NON_CONTRAST": {
        "T2_FLAIR": 1.35,
        "T2W": 1.25,
        "T2_CORONAL": 1.18,
        "DWI": 1.12,
        "T1_FLAIR": 1.10,
        "ADC": 1.00,
        "T1W": 0.98,
        "T1C+": 1.20,
        "OTHER": 1.00,
        "TOF_MRA": 0.42,
    },
    "BRAIN_TUMOR_CORE_CONTRAST": {
        "T1C+": 1.45,
        "T2_FLAIR": 1.32,
        "T2W": 1.20,
        "T2_CORONAL": 1.16,
        "DWI": 1.14,
        "T1_FLAIR": 1.12,
        "ADC": 1.02,
        "T1W": 0.95,
        "OTHER": 1.00,
        "TOF_MRA": 0.42,
    },
    "BRAIN_TUMOR_POST_OP": {
        "T1C+": 1.45,
        "DWI": 1.30,
        "ADC": 1.20,
        "T2_FLAIR": 1.28,
        "T2W": 1.18,
        "T1_FLAIR": 1.10,
        "T2_CORONAL": 1.12,
        "T1W": 0.96,
        "OTHER": 1.00,
        "TOF_MRA": 0.42,
    },
    "STROKE_DIFFUSION": {
        "DWI": 1.42,
        "ADC": 1.34,
        "T2_FLAIR": 1.28,
        "TOF_MRA": 1.16,
        "T2W": 1.10,
        "T1_FLAIR": 1.02,
        "T2_CORONAL": 1.00,
        "T1C+": 0.95,
        "T1W": 0.90,
        "OTHER": 0.95,
    },
}


def sanitize_rel_path(rel_path: str) -> str:
    """Normalize a study-relative path and strip traversal segments."""
    raw = (rel_path or "").replace("\\", "/")
    parts = [p.strip() for p in raw.split("/") if p.strip() and p.strip() not in (".", "..")]
    return "/".join(parts)


def extract_series_folder(rel_path: str) -> str:
    """Return meaningful immediate sequence folder name for display and grouping."""
    clean = sanitize_rel_path(rel_path)
    parts = clean.split("/")
    if len(parts) <= 1:
        return "Uploaded_Study"
    return parts[-2]


def parse_slice_number(filename: str) -> Optional[int]:
    """Extract trailing numeric index from slice filename (e.g. IM0012.jpg -> 12)."""
    stem = os.path.splitext(os.path.basename(filename or ""))[0]
    nums = re.findall(r"\d+", stem)
    if not nums:
        return None
    try:
        return int(nums[-1])
    except ValueError:
        return None


def classify_sequence(rel_path: str) -> Tuple[str, str, Optional[str]]:
    """
    Classify MRI sequence type, acquisition plane, and ignore reason (if non-diagnostic).
    Order carefully avoids misclassifying T1_FLAIR as T2_FLAIR or coronal T2 as generic.
    """
    clean = sanitize_rel_path(rel_path)
    low = clean.lower()
    folder_part = os.path.dirname(low)
    search_text = folder_part if folder_part else low

    for token in _IGNORE_FOLDER_TOKENS:
        if token in search_text:
            return "IGNORED", infer_plane_from_path(clean), f"Chuỗi định vị/không chẩn đoán ({token})"

    plane = infer_plane_from_path(clean)

    # Check vascular 3D TOF / MRA sequences (projection / col3d / pjn3d)
    if any(tok in search_text for tok in ("pjn3d", "col3d", "tof_", "_tof", "mra")):
        return "TOF_MRA", plane, None

    if "adc" in search_text:
        return "ADC", plane, None

    if "dwi" in search_text or "b1000" in search_text or "diff" in search_text:
        return "DWI", plane, None

    has_t1 = bool(re.search(r"(^|[_\s\-/])t1([_\s\-/cw\+]|$)|t1ce", search_text))
    has_t2 = bool(re.search(r"(^|[_\s\-/])t2([_\s\-/w]|$)", search_text))
    has_contrast = any(tok in search_text for tok in ("c+", "+c", "t1c", "t1ce", "_ce", "_gd", "post", "contrast", "mprage_c", "_km"))

    if has_t1 and has_contrast:
        return "T1C+", plane, None

    # Check T1 + FLAIR BEFORE generic FLAIR so Sag_T1_FLAIR_7 is never labeled T2_FLAIR.
    if has_t1 and "flair" in search_text:
        return "T1_FLAIR", plane, None

    if "flair" in search_text:
        return "T2_FLAIR", plane, None

    if has_t2 and (plane == PLANE_CORONAL or "cor" in search_text):
        return "T2_CORONAL", PLANE_CORONAL if plane == PLANE_UNKNOWN else plane, None

    if has_t2:
        return "T2W", plane, None

    if has_t1:
        return "T1W", plane, None

    return "OTHER", plane, None


def get_sequence_weight(
    seq_type: str,
    plane: str,
    protocol_code: Optional[str] = None,
    with_contrast: Optional[bool] = None,
) -> float:
    """Return protocol-aware priority weight for a sequence and plane."""
    code = (protocol_code or "").strip().upper()
    if code not in _PROTOCOL_WEIGHTS:
        code = "BRAIN_TUMOR_CORE_CONTRAST" if with_contrast else "BRAIN_TUMOR_NON_CONTRAST"

    base = _PROTOCOL_WEIGHTS[code].get(seq_type, 1.0)
    if with_contrast and seq_type == "T1C+":
        base = max(base, 1.48)

    plane_mult = {
        PLANE_AXIAL: 1.08,
        PLANE_CORONAL: 1.03,
        PLANE_SAGITTAL: 1.02,
        PLANE_UNKNOWN: 1.00,
    }.get(plane, 1.00)

    return round(base * plane_mult, 4)


def assess_slice_quality(img_bgr: Optional[np.ndarray]) -> Tuple[bool, float, Optional[str]]:
    """
    Validate MRI slice image and measure brain cross-section coverage.
    Returns (is_valid, brain_area_ratio, rejection_reason).
    """
    if img_bgr is None or img_bgr.size == 0:
        return False, 0.0, "Không đọc được dữ liệu ảnh"

    h, w = img_bgr.shape[:2]
    if h < 64 or w < 64:
        return False, 0.0, "Kích thước ảnh quá nhỏ"

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    mean_int = float(gray.mean())
    std_int = float(gray.std())
    non_black_ratio = float(np.count_nonzero(gray > 15)) / float(gray.size)

    if non_black_ratio < 0.08 or mean_int < 6.0 or std_int < 10.0:
        return False, non_black_ratio, "Lát cắt rỗng/quá tối (ngoài vùng sọ não)"
    if mean_int > 246.0:
        return False, 0.0, "Lát cắt bão hòa trắng/lỗi ảnh"

    # Estimate main intracranial contour coverage ratio
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 20, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    max_area = max((cv2.contourArea(c) for c in contours), default=0.0)
    brain_ratio = float(max_area) / float(h * w)

    if brain_ratio < 0.05:
        return False, brain_ratio, "Lát cắt rìa ngoài (diện tích nhu mô não quá nhỏ)"

    return True, round(min(1.0, brain_ratio), 4), None


def extract_zip_safely(
    zip_path: str,
    dest_dir: str,
    max_files: int = 3500,
    max_uncompressed_bytes: int = 1600 * 1024 * 1024,
) -> List[Tuple[str, str]]:
    """
    Safely extract diagnostic candidate image files from a ZIP archive.
    Prevents zip-slip traversal and decompression bombs.
    Returns list of `(abs_file_path, rel_path)`.
    """
    extracted: List[Tuple[str, str]] = []
    dest_abs = os.path.abspath(dest_dir)
    os.makedirs(dest_abs, exist_ok=True)
    total_bytes = 0
    seen_files = 0

    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            # Skip symlinks (Unix external_attr mode S_IFLNK = 0o120000)
            if (info.external_attr >> 16) & 0o170000 == 0o120000:
                continue

            seen_files += 1
            if seen_files > max_files:
                raise ValueError(f"ZIP vượt quá giới hạn {max_files} tệp.")

            total_bytes += info.file_size or 0
            if total_bytes > max_uncompressed_bytes:
                raise ValueError("Dung lượng giải nén ZIP vượt ngưỡng an toàn cho phép.")

            clean_rel = sanitize_rel_path(info.filename)
            if not clean_rel:
                continue
            ext = os.path.splitext(clean_rel)[1].lower()
            if ext not in IMAGE_EXTENSIONS:
                continue

            out_path = os.path.abspath(os.path.join(dest_abs, *clean_rel.split("/")))
            if not (out_path == dest_abs or out_path.startswith(dest_abs + os.sep)):
                continue

            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            with zf.open(info, "r") as src, open(out_path, "wb") as dst:
                dst.write(src.read())
            extracted.append((out_path, clean_rel))

    return extracted


def _run_yolo_batch(
    yolo_model: Any,
    items: List[Dict[str, Any]],
    batch_size: int = 24,
    conf_thresh: float = 0.14,
) -> None:
    """Mutate item dicts in place with YOLOv8 detection metadata."""
    if yolo_model is None or not items:
        return

    for start in range(0, len(items), batch_size):
        chunk = items[start : start + batch_size]
        paths = [it["absPath"] for it in chunk]
        try:
            results = yolo_model(paths, conf=conf_thresh, verbose=False)
        except Exception as exc:
            print(f"[Triage YOLO] Batch inference warning: {exc}")
            continue

        for it, res in zip(chunk, results):
            boxes = getattr(res, "boxes", None)
            if boxes is None or len(boxes) == 0:
                continue

            names_map = getattr(res, "names", None) or _YOLO_DEFAULT_CLASSES
            tumor_boxes = []
            for b in boxes:
                cls_idx = int(b.cls[0].item())
                raw_cls = str(names_map.get(cls_idx, _YOLO_DEFAULT_CLASSES.get(cls_idx, "tumor"))).strip().lower()
                norm_cls = "notumor" if raw_cls in _NO_TUMOR_ALIASES else raw_cls
                if norm_cls == "notumor":
                    continue
                tumor_boxes.append((float(b.conf[0].item()), norm_cls, b))

            if not tumor_boxes:
                continue

            conf, yolo_class, best_box = max(tumor_boxes, key=lambda t: t[0])

            xc, yc, bw, bh = best_box.xywh[0].tolist()
            w_img = max(1, it["width"])
            h_img = max(1, it["height"])
            xmin = max(0.0, float(xc - bw / 2.0))
            ymin = max(0.0, float(yc - bh / 2.0))
            norm_x = round(max(0.0, min(1.0, xmin / w_img)), 4)
            norm_y = round(max(0.0, min(1.0, ymin / h_img)), 4)
            norm_w = round(max(0.01, min(1.0 - norm_x, bw / w_img)), 4)
            norm_h = round(max(0.01, min(1.0 - norm_y, bh / h_img)), 4)

            it["yoloDetected"] = True
            it["yoloClass"] = yolo_class
            it["yoloConf"] = round(conf, 4)
            it["boundingBox"] = {"x": norm_x, "y": norm_y, "w": norm_w, "h": norm_h}


def _default_resnet_preprocess_input(arr: np.ndarray) -> np.ndarray:
    """Match ResNet50V2 preprocess_input: scale [0, 255] float32 -> [-1, 1]."""
    return (arr.astype(np.float32) / 127.5) - 1.0


def _default_temperature_scale(probs: np.ndarray, temp: float = 1.3) -> np.ndarray:
    """Apply temperature scaling matching main.py apply_temperature_scaling."""
    eps = 1e-7
    logits = np.log(np.clip(probs, eps, 1.0))
    scaled = logits / temp
    exp_logits = np.exp(scaled - np.max(scaled, axis=-1, keepdims=True))
    return exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)


def _predict_model_batched(model_obj: Any, batch_arr: np.ndarray, prep_fn: Callable[[np.ndarray], np.ndarray], batch_size: int) -> Optional[np.ndarray]:
    """Predict probabilities across batches for a single Keras model."""
    if model_obj is None or len(batch_arr) == 0:
        return None
    outputs = []
    for start in range(0, len(batch_arr), batch_size):
        chunk = prep_fn(batch_arr[start : start + batch_size].copy())
        preds = model_obj.predict(chunk, verbose=0)
        outputs.append(np.asarray(preds, dtype=np.float32))
    return np.concatenate(outputs, axis=0) if outputs else None


def _run_ensemble_batch(
    resnet_model: Any,
    items: List[Dict[str, Any]],
    categories: List[str],
    preprocess_fn: Callable[[str], Optional[np.ndarray]],
    resnet_input_fn: Optional[Callable[[np.ndarray], np.ndarray]] = None,
    efficientnet_model: Any = None,
    efficientnet_input_fn: Optional[Callable[[np.ndarray], np.ndarray]] = None,
    densenet_model: Any = None,
    densenet_input_fn: Optional[Callable[[np.ndarray], np.ndarray]] = None,
    temp_scale_fn: Optional[Callable[[np.ndarray], np.ndarray]] = None,
    batch_size: int = 16,
) -> None:
    """Run batched 3-CNN Ensemble + BayTTA (horizontal flip) across all surviving slices."""
    if resnet_model is None or not items:
        return

    res_prep_fn = resnet_input_fn or _default_resnet_preprocess_input
    eff_prep_fn = efficientnet_input_fn or res_prep_fn
    den_prep_fn = densenet_input_fn or res_prep_fn
    t_scale_fn = temp_scale_fn or _default_temperature_scale
    has_full_ensemble = (efficientnet_model is not None) and (densenet_model is not None)
    notumor_idx = categories.index("notumor") if "notumor" in categories else 2
    prepared: List[Tuple[Dict[str, Any], np.ndarray]] = []

    for it in items:
        try:
            arr = preprocess_fn(it["absPath"])
            if arr is not None:
                prepared.append((it, arr))
        except Exception as exc:
            print(f"[Triage Ensemble] Preprocess warning for {it.get('relativePath')}: {exc}")

    if not prepared:
        return

    batch_orig = np.stack([arr for _, arr in prepared], axis=0).astype(np.float32)
    batch_lr = np.flip(batch_orig, axis=2)

    try:
        res_orig = _predict_model_batched(resnet_model, batch_orig, res_prep_fn, batch_size)
        if res_orig is None:
            return

        final_preds = res_orig
        variances = np.zeros((len(prepared),), dtype=np.float32)

        if has_full_ensemble:
            eff_orig_raw = _predict_model_batched(efficientnet_model, batch_orig, eff_prep_fn, batch_size)
            den_orig_raw = _predict_model_batched(densenet_model, batch_orig, den_prep_fn, batch_size)
            res_lr = _predict_model_batched(resnet_model, batch_lr, res_prep_fn, batch_size)
            eff_lr_raw = _predict_model_batched(efficientnet_model, batch_lr, eff_prep_fn, batch_size)
            den_lr_raw = _predict_model_batched(densenet_model, batch_lr, den_prep_fn, batch_size)

            if (
                eff_orig_raw is not None
                and den_orig_raw is not None
                and res_lr is not None
                and eff_lr_raw is not None
                and den_lr_raw is not None
            ):
                eff_orig = t_scale_fn(eff_orig_raw)
                den_orig = t_scale_fn(den_orig_raw)
                eff_lr = t_scale_fn(eff_lr_raw)
                den_lr = t_scale_fn(den_lr_raw)

                w_res, w_eff, w_den = 0.8, 0.1, 0.1
                pred_orig = (res_orig * w_res) + (eff_orig * w_eff) + (den_orig * w_den)
                pred_lr = (res_lr * w_res) + (eff_lr * w_eff) + (den_lr * w_den)

                # BayTTA across [orig, lr] per item
                eps = 1e-7
                stacked_tta = np.stack([pred_orig, pred_lr], axis=0)  # (2, N, C)
                entropies = -np.sum(stacked_tta * np.log(np.clip(stacked_tta, eps, 1.0)), axis=-1)  # (2, N)
                exp_neg = np.exp(-entropies)
                weights = exp_neg / np.sum(exp_neg, axis=0, keepdims=True)
                final_preds = np.sum(stacked_tta * weights[:, :, None], axis=0)  # (N, C)

                model_stack = np.stack([res_orig, eff_orig, den_orig], axis=0)  # (3, N, C)
                variances = np.max(np.var(model_stack, axis=0), axis=-1)  # (N,)
    except Exception as exc:
        print(f"[Triage Ensemble] Predict batch warning: {exc}")
        return

    for idx, ((it, _), probs_vec) in enumerate(zip(prepared, final_preds)):
        probs = [float(p) for p in probs_vec]
        top_idx = int(np.argmax(probs))
        pred_cls = categories[top_idx] if top_idx < len(categories) else "notumor"
        pred_conf = float(probs[top_idx])
        tumor_prob = max(0.0, min(1.0, 1.0 - float(probs[notumor_idx]))) if notumor_idx < len(probs) else pred_conf

        it["predictedClass"] = pred_cls
        it["cnnClass"] = pred_cls
        it["confidence"] = round(pred_conf * 100.0, 2)
        it["tumorProb"] = round(tumor_prob, 4)
        it["uncertaintyScore"] = round(float(variances[idx]), 4)
        it["probabilities"] = {
            categories[i]: round(float(probs[i]) * 100.0, 2)
            for i in range(min(len(categories), len(probs)))
        }
        it["resnetEvaluated"] = True
        it["aiTier"] = "ensemble+yolo" if has_full_ensemble else "resnet+yolo"


def _run_resnet_batch(
    resnet_model: Any,
    items: List[Dict[str, Any]],
    categories: List[str],
    preprocess_fn: Callable[[str], Optional[np.ndarray]],
    resnet_input_fn: Optional[Callable[[np.ndarray], np.ndarray]] = None,
    batch_size: int = 32,
) -> None:
    """Backward-compatible wrapper delegating to _run_ensemble_batch."""
    _run_ensemble_batch(
        resnet_model=resnet_model,
        items=items,
        categories=categories,
        preprocess_fn=preprocess_fn,
        resnet_input_fn=resnet_input_fn,
        batch_size=batch_size,
    )


def _compute_clarity_score(it: Dict[str, Any], has_yolo_model: bool) -> float:
    """Compute composite lesion clarity & diagnostic suitability score in [0, 1]."""
    seq_w_norm = min(1.0, max(0.0, (it["sequenceWeight"] - 0.35) / 1.25))
    brain_norm = min(1.0, it["brainAreaRatio"] / 0.38)
    tumor_prob = float(it.get("tumorProb", 0.0))
    yolo_conf = float(it.get("yoloConf", 0.0))
    yolo_detected = bool(it.get("yoloDetected", False))

    if yolo_detected:
        box = it["boundingBox"] or {}
        area = float(box.get("w", 0.0)) * float(box.get("h", 0.0))
        # Favor well-formed visible lesions (0.4% - 20% of image frame)
        area_bonus = 1.0 if 0.004 <= area <= 0.22 else 0.72
        score = (
            0.40 * min(1.0, yolo_conf * 1.2)
            + 0.28 * tumor_prob
            + 0.16 * seq_w_norm
            + 0.10 * brain_norm
            + 0.06 * area_bonus
        )
    else:
        base = 0.44 * tumor_prob + 0.30 * seq_w_norm + 0.26 * brain_norm
        score = base * (0.76 if has_yolo_model else 1.0)

    return round(max(0.0, min(0.9999, score)), 4)


def _select_top_k_diverse(candidates: List[Dict[str, Any]], top_k: int) -> None:
    """
    Mark up to `top_k` candidates as `preselected=True`, prioritizing high clarity
    while avoiding dumping 10 identical adjacent slices from one sequence alone.
    """
    if not candidates or top_k <= 0:
        return

    distinct_diagnostic_series = {c["seriesName"] for c in candidates if c["sequenceType"] != "TOF_MRA"}
    num_series = max(1, len(distinct_diagnostic_series))
    max_per_series = top_k if num_series == 1 else max(3, math.ceil(top_k * 0.45))

    selected_indices: List[int] = []
    series_counts: Dict[str, int] = defaultdict(int)
    series_slice_nums: Dict[str, List[int]] = defaultdict(list)

    # Pass 1: Enforce series cap and mild spatial spacing (>= 2 slice gap when available)
    for idx, c in enumerate(candidates):
        if len(selected_indices) >= top_k:
            break
        sname = c["seriesName"]
        if series_counts[sname] >= max_per_series:
            continue
        snum = c.get("sliceNumber")
        if snum is not None and any(abs(snum - prev) < 2 for prev in series_slice_nums[sname]):
            continue
        selected_indices.append(idx)
        series_counts[sname] += 1
        if snum is not None:
            series_slice_nums[sname].append(snum)

    # Pass 2: Relax spacing constraint within series cap
    if len(selected_indices) < top_k:
        chosen = set(selected_indices)
        for idx, c in enumerate(candidates):
            if len(selected_indices) >= top_k:
                break
            if idx in chosen:
                continue
            sname = c["seriesName"]
            if series_counts[sname] >= max_per_series:
                continue
            selected_indices.append(idx)
            chosen.add(idx)
            series_counts[sname] += 1

    # Pass 3: Backfill strictly by score if still below top_k
    if len(selected_indices) < top_k:
        chosen = set(selected_indices)
        for idx in range(len(candidates)):
            if len(selected_indices) >= top_k:
                break
            if idx not in chosen:
                selected_indices.append(idx)
                chosen.add(idx)

    selected_set = set(selected_indices)
    for idx, c in enumerate(candidates):
        c["preselected"] = idx in selected_set
        c["rank"] = idx + 1


def _resolve_effective_slice_class(it: Dict[str, Any]) -> str:
    """Resolve consistent slice class from Ensemble (+ VLM arbitration) and high-conf YOLO."""
    pred_cls = str(it.get("predictedClass") or "notumor").lower()
    if it.get("geminiArbitrated"):
        return pred_cls
    if pred_cls != "notumor":
        return pred_cls
    yolo_cls = str(it.get("yoloClass") or "").lower()
    if it.get("yoloDetected") and float(it.get("yoloConf") or 0.0) >= 0.35 and yolo_cls and yolo_cls != "notumor":
        return yolo_cls
    return "notumor"


def _evaluate_conflict_for_slice(it: Dict[str, Any]) -> bool:
    """Match main.py 3-tier conflict logic between CNN Ensemble and YOLOv8."""
    cnn_cls = str(it.get("cnnClass") or it.get("predictedClass") or "notumor").lower()
    conf_01 = float(it.get("confidence") or 0.0) / 100.0
    unc = float(it.get("uncertaintyScore") or 0.0)
    yolo_cls = str(it.get("yoloClass") or "notumor").lower()
    yolo_strong = bool(it.get("yoloDetected") and float(it.get("yoloConf") or 0.0) >= 0.35 and yolo_cls != "notumor")

    cnn_is_tumor = cnn_cls != "notumor"
    yolo_is_tumor = yolo_strong

    if not cnn_is_tumor and yolo_is_tumor:
        return True
    if cnn_is_tumor and not yolo_is_tumor:
        return conf_01 < 0.80 or unc > 0.15
    if cnn_is_tumor and yolo_is_tumor and cnn_cls != yolo_cls:
        return conf_01 < 0.80 or unc > 0.15
    return False


def triage_study_slices(
    slice_entries: List[Dict[str, str]],
    resnet_model: Any = None,
    yolo_model: Any = None,
    categories: Optional[List[str]] = None,
    preprocess_fn: Callable[[str], Optional[np.ndarray]] = medical_preprocessing_v2,
    resnet_input_fn: Optional[Callable[[np.ndarray], np.ndarray]] = None,
    efficientnet_model: Any = None,
    efficientnet_input_fn: Optional[Callable[[np.ndarray], np.ndarray]] = None,
    densenet_model: Any = None,
    densenet_input_fn: Optional[Callable[[np.ndarray], np.ndarray]] = None,
    temp_scale_fn: Optional[Callable[[np.ndarray], np.ndarray]] = None,
    gemini_arbitrate_fn: Optional[Callable[[Dict[str, Any]], Optional[Dict[str, Any]]]] = None,
    gemini_conflict_limit: int = 5,
    protocol_code: Optional[str] = None,
    with_contrast: Optional[bool] = None,
    top_k: int = 10,
    candidate_limit: int = 120,
) -> Dict[str, Any]:
    """
    Run full-folder MRI analysis (3-CNN Ensemble + BayTTA + YOLOv8 + bounded Gemini VLM)
    across all valid diagnostic slices, compute folder-wide tumor majority stats,
    and return ranked slices with top_k pre-selected for PACS export.
    """
    cats = categories or ["glioma", "meningioma", "notumor", "pituitary"]
    top_k = max(1, min(top_k or 10, 20))
    candidate_limit = max(top_k, min(candidate_limit or 120, 300))
    gemini_cap = max(0, min(gemini_conflict_limit if gemini_conflict_limit is not None else 5, 10))

    total_files = len(slice_entries)
    ignored_sequence_count = 0
    invalid_slice_count = 0
    non_image_count = 0

    series_stats: Dict[str, Dict[str, Any]] = {}
    surviving: List[Dict[str, Any]] = []

    for idx, entry in enumerate(slice_entries):
        abs_path = entry["absPath"]
        rel_path = sanitize_rel_path(entry.get("relativePath") or os.path.basename(abs_path))
        slice_key = entry.get("sliceKey") or str(idx)
        ext = os.path.splitext(abs_path)[1].lower()
        if ext not in IMAGE_EXTENSIONS:
            non_image_count += 1
            continue

        seq_type, plane, ignore_reason = classify_sequence(rel_path)
        series_name = extract_series_folder(rel_path)

        st = series_stats.setdefault(
            series_name,
            {
                "seriesName": series_name,
                "sequenceType": seq_type,
                "plane": plane,
                "totalFiles": 0,
                "validFiles": 0,
                "ignored": seq_type == "IGNORED",
                "ignoreReason": ignore_reason,
                "topScore": 0.0,
            },
        )
        st["totalFiles"] += 1

        if seq_type == "IGNORED":
            ignored_sequence_count += 1
            continue

        img_bgr = cv2.imread(abs_path)
        is_valid, brain_ratio, invalid_reason = assess_slice_quality(img_bgr)
        if not is_valid or img_bgr is None:
            invalid_slice_count += 1
            continue

        st["validFiles"] += 1
        h_img, w_img = img_bgr.shape[:2]
        seq_weight = get_sequence_weight(seq_type, plane, protocol_code, with_contrast)
        filename = os.path.basename(rel_path)

        surviving.append(
            {
                "sliceKey": slice_key,
                "absPath": abs_path,
                "relativePath": rel_path,
                "filename": filename,
                "seriesName": series_name,
                "sequenceType": seq_type,
                "plane": plane,
                "sliceNumber": parse_slice_number(filename),
                "width": int(w_img),
                "height": int(h_img),
                "brainAreaRatio": brain_ratio,
                "sequenceWeight": seq_weight,
                "predictedClass": "notumor",
                "cnnClass": "notumor",
                "confidence": 0.0,
                "tumorProb": 0.0,
                "uncertaintyScore": 0.0,
                "probabilities": None,
                "resnetEvaluated": False,
                "yoloDetected": False,
                "yoloClass": None,
                "yoloConf": 0.0,
                "boundingBox": None,
                "isConflict": False,
                "geminiArbitrated": False,
                "consensusMessage": None,
                "aiTier": "ensemble+yolo" if (efficientnet_model is not None and densenet_model is not None) else "resnet+yolo",
                "preselected": False,
            }
        )

    # Run full batched YOLOv8 + 3-CNN Ensemble + BayTTA across ALL valid diagnostic slices
    _run_yolo_batch(yolo_model, surviving)
    _run_ensemble_batch(
        resnet_model,
        surviving,
        cats,
        preprocess_fn,
        resnet_input_fn=resnet_input_fn,
        efficientnet_model=efficientnet_model,
        efficientnet_input_fn=efficientnet_input_fn,
        densenet_model=densenet_model,
        densenet_input_fn=densenet_input_fn,
        temp_scale_fn=temp_scale_fn,
    )

    # Cap TOF_MRA only if true parenchymal sequences exist and TOF wasn't requested
    has_structural = any(it["sequenceType"] not in ("TOF_MRA", "IGNORED") for it in surviving)

    for it in surviving:
        it["isConflict"] = _evaluate_conflict_for_slice(it)
        score = _compute_clarity_score(it, has_yolo_model=(yolo_model is not None))
        if has_structural and it["sequenceType"] == "TOF_MRA" and (protocol_code or "").upper() != "STROKE_DIFFUSION":
            score = round(score * 0.45, 4)
        it["lesionClarityScore"] = score
        if score > series_stats[it["seriesName"]]["topScore"]:
            series_stats[it["seriesName"]]["topScore"] = score

    # Bounded Gemini VLM arbitration on highest-clarity axial conflict slices (Privacy Guard respected)
    conflict_count = sum(1 for it in surviving if it["isConflict"])
    gemini_used_count = 0
    if gemini_arbitrate_fn is not None and gemini_cap > 0 and conflict_count > 0:
        axial_conflicts = sorted(
            [it for it in surviving if it["isConflict"] and it.get("plane") == "axial"],
            key=lambda x: x["lesionClarityScore"],
            reverse=True,
        )
        for it in axial_conflicts[:gemini_cap]:
            try:
                vlm_res = gemini_arbitrate_fn(it)
                if isinstance(vlm_res, dict) and vlm_res.get("predictedClass") in cats:
                    it["predictedClass"] = vlm_res["predictedClass"]
                    if vlm_res.get("confidence") is not None:
                        it["confidence"] = round(float(vlm_res["confidence"]), 2)
                    if vlm_res.get("consensusMessage"):
                        it["consensusMessage"] = vlm_res["consensusMessage"]
                    it["geminiArbitrated"] = True
                    it["aiTier"] = "3-tier"
                    gemini_used_count += 1
            except Exception as exc:
                print(f"[Triage Gemini] Arbitration warning for {it.get('relativePath')}: {exc}")

    # Resolve final slice class and compute full-folder tumor statistics across ALL analyzed slices
    class_counts: Dict[str, int] = {c: 0 for c in cats}
    class_confs: Dict[str, List[float]] = {c: [] for c in cats}
    tumor_class_votes: Dict[str, int] = defaultdict(int)
    detected_tumor_count = 0

    for it in surviving:
        eff_cls = _resolve_effective_slice_class(it)
        it["predictedClass"] = eff_cls
        eff_conf = (
            round(float(it["yoloConf"]) * 100.0, 2)
            if eff_cls != "notumor" and it.get("cnnClass") == "notumor" and not it.get("geminiArbitrated") and it.get("yoloConf", 0.0) > 0
            else float(it.get("confidence") or 0.0)
        )
        it["confidence"] = eff_conf
        if eff_cls not in class_counts:
            class_counts[eff_cls] = 0
            class_confs[eff_cls] = []
        class_counts[eff_cls] += 1
        class_confs[eff_cls].append(eff_conf)

        if eff_cls != "notumor":
            detected_tumor_count += 1
            tumor_class_votes[eff_cls] += 1
        elif it["yoloDetected"]:
            # Track YOLO detection flag even if weak conf didn't flip classification
            pass

    total_analyzed = len(surviving)
    class_stats = []
    for cls_name, cnt in class_counts.items():
        confs = class_confs.get(cls_name, [])
        avg_c = round(sum(confs) / len(confs), 1) if confs else 0.0
        max_c = round(max(confs), 1) if confs else 0.0
        pct_total = round((cnt / total_analyzed) * 100.0, 1) if total_analyzed > 0 else 0.0
        class_stats.append({
            "className": cls_name,
            "count": cnt,
            "percentage": pct_total,
            "avgConfidence": avg_c,
            "maxConfidence": max_c,
        })

    # Rank tumor classes by (count, avgConfidence) descending, keeping notumor after or sorted cleanly
    class_stats.sort(key=lambda s: (s["count"], s["avgConfidence"], s["maxConfidence"]), reverse=True)

    if tumor_class_votes:
        stat_by_cls = {s["className"]: s for s in class_stats}
        dominant_prediction = max(
            tumor_class_votes.keys(),
            key=lambda c: (tumor_class_votes[c], stat_by_cls.get(c, {}).get("avgConfidence", 0.0)),
        )
    else:
        dominant_prediction = "notumor" if surviving else None

    dom_stat = next((s for s in class_stats if s["className"] == dominant_prediction), None)
    dom_count = int(dom_stat["count"]) if dom_stat else 0
    majority_overall_cls = str(class_stats[0]["className"]) if (class_stats and total_analyzed > 0) else None

    # Sort descending: lightly favor slices matching folder's dominant tumor class alongside lesion clarity
    surviving.sort(
        key=lambda x: (
            x["lesionClarityScore"] + (0.04 if dominant_prediction and dominant_prediction != "notumor" and x["predictedClass"] == dominant_prediction else 0.0),
            1 if x["yoloDetected"] else 0,
            x["tumorProb"],
            x["brainAreaRatio"],
        ),
        reverse=True,
    )

    candidates = surviving[:candidate_limit]
    _select_top_k_diverse(candidates, top_k=top_k)

    # Strip internal filesystem path before returning JSON payload
    public_candidates = []
    for c in candidates:
        row = dict(c)
        row.pop("absPath", None)
        row.pop("resnetEvaluated", None)
        public_candidates.append(row)

    series_summary = sorted(
        series_stats.values(),
        key=lambda s: (0 if not s["ignored"] else 1, -s["topScore"], -s["validFiles"]),
    )

    study_diagnosis_summary = {
        "totalAnalyzed": total_analyzed,
        "detectedTumorSlicesCount": detected_tumor_count,
        "tumorRatePct": round((detected_tumor_count / total_analyzed) * 100.0, 1) if total_analyzed > 0 else 0.0,
        "dominantClass": dominant_prediction,
        "dominantCount": dom_count,
        "dominantPctOfTotal": round((dom_count / total_analyzed) * 100.0, 1) if total_analyzed > 0 else 0.0,
        "dominantPctOfTumors": round((dom_count / detected_tumor_count) * 100.0, 1) if detected_tumor_count > 0 else 0.0,
        "dominantAvgConfidence": dom_stat["avgConfidence"] if dom_stat else 0.0,
        "dominantMaxConfidence": dom_stat["maxConfidence"] if dom_stat else 0.0,
        "majorityOverallClass": majority_overall_cls,
        "classCounts": class_counts,
        "classStats": class_stats,
        "aiMode": "ensemble_3_cnn_yolo_bounded_vlm" if (efficientnet_model is not None and densenet_model is not None) else "resnet_yolo",
        "conflictSlicesCount": conflict_count,
        "geminiArbitratedCount": gemini_used_count,
    }

    return {
        "status": "ok",
        "protocolCode": protocol_code or ("BRAIN_TUMOR_CORE_CONTRAST" if with_contrast else "BRAIN_TUMOR_NON_CONTRAST"),
        "withContrast": bool(with_contrast),
        "summary": {
            "totalFiles": total_files,
            "nonImageCount": non_image_count,
            "ignoredSequenceCount": ignored_sequence_count,
            "invalidSliceCount": invalid_slice_count,
            "analyzedCount": total_analyzed,
            "candidateCount": len(public_candidates),
            "preselectedCount": sum(1 for c in public_candidates if c["preselected"]),
            "detectedTumorSlicesCount": detected_tumor_count,
            "dominantPrediction": dominant_prediction,
            "studyDiagnosisSummary": study_diagnosis_summary,
        },
        "studyDiagnosisSummary": study_diagnosis_summary,
        "seriesSummary": series_summary,
        "candidates": public_candidates,
    }
