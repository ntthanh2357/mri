# -*- coding: utf-8 -*-
"""
NeuroScan AI — Active Learning Retraining Pipeline
Human-in-the-Loop Fine-Tuning with Attention Guidance, Model Versioning & Validation Gate.
"""

import os
import sys
import argparse
import csv
import json
import time
import shutil
import hashlib
from datetime import datetime
import numpy as np
import cv2

# pyrefly: ignore [missing-attribute]
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import tensorflow as tf
import builtins
setattr(builtins, "tf", tf)

try:
    tf.keras.config.enable_unsafe_deserialization()
except AttributeError:
    pass

CATEGORIES = ['glioma', 'meningioma', 'notumor', 'pituitary']
IMG_SIZE = 224

def parse_args():
    parser = argparse.ArgumentParser(description="Active Learning Fine-Tuning for NeuroScan AI")
    parser.add_argument("--base_model", type=str, default="models/resnet_risk_calibrated.keras", help="Path to base production model")
    parser.add_argument("--hard_dir", type=str, default="hard_examples", help="Directory containing hard example images")
    parser.add_argument("--csv_path", type=str, default="hard_examples/feedback_log.csv", help="Path to doctor feedback CSV")
    parser.add_argument("--test_path", type=str, default="archive_v2/Testing", help="Path to benchmark test set")
    parser.add_argument("--output_json", type=str, default="hard_examples/retrain_result.json", help="Path to write retrain metrics JSON")
    parser.add_argument("--epochs", type=int, default=10, help="Number of fine-tuning epochs")
    parser.add_argument("--batch_size", type=int, default=4, help="Batch size for fine-tuning")
    parser.add_argument("--lr", type=float, default=1e-5, help="Learning rate (small to prevent catastrophic forgetting)")
    return parser.parse_args()


def load_data_with_attention_guidance(csv_path, hard_dir):
    """
    Đọc dữ liệu từ feedback_log.csv và áp dụng Attention Guidance:
    Bôi đen toàn bộ nền não thừa, chỉ giữ lại vùng khối u thực sự do bác sĩ khoanh vùng.
    """
    images: list[np.ndarray] = []
    labels: list[int] = []
    processed_files: list[str] = []

    if not os.path.exists(csv_path):
        print(f"[Data] Không tìm thấy file CSV: {csv_path}")
        return np.array(images), np.array(labels), processed_files

    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            filename = row.get('filename')
            class_name = row.get('correct_class')
            if not filename or not class_name:
                continue

            try:
                x = int(float(row.get('x', 0)))
                y = int(float(row.get('y', 0)))
                w = int(float(row.get('w', 0)))
                h = int(float(row.get('h', 0)))
            except ValueError:
                x, y, w, h = 0, 0, 0, 0

            # Tìm file ảnh trong hard_dir
            img_path = os.path.join(hard_dir, filename)
            if not os.path.exists(img_path):
                # Thử tìm theo basename nếu tên file có prefix
                base_name = os.path.basename(filename)
                img_path = os.path.join(hard_dir, base_name)
                if not os.path.exists(img_path):
                    # Thử tìm kiếm mờ trong thư mục
                    matches = [f for f in os.listdir(hard_dir) if base_name in f] if os.path.exists(hard_dir) else []
                    if matches:
                        img_path = os.path.join(hard_dir, matches[0])
                    else:
                        continue

            img = cv2.imread(img_path)
            if img is None:
                continue

            img_h, img_w = img.shape[:2]

            # Nếu là 'notumor' hoặc tọa độ rỗng: giữ nguyên toàn bộ ảnh não
            if class_name == 'notumor' or (w <= 5 or h <= 5):
                processed_img = img
            else:
                # Áp dụng Attention Guidance (Masking)
                mask = np.zeros((img_h, img_w), dtype="uint8")
                clamped_x = max(0, min(x, img_w - 1))
                clamped_y = max(0, min(y, img_h - 1))
                clamped_w = max(5, min(w, img_w - clamped_x))
                clamped_h = max(5, min(h, img_h - clamped_y))
                cv2.rectangle(mask, (clamped_x, clamped_y), (clamped_x + clamped_w, clamped_y + clamped_h), 255, -1)
                processed_img = cv2.bitwise_and(img, img, mask=mask)

            resized = cv2.resize(processed_img, (IMG_SIZE, IMG_SIZE))
            normalized = resized.astype("float32") / 255.0

            if class_name in CATEGORIES:
                label_idx = CATEGORIES.index(class_name)
                images.append(normalized)
                labels.append(label_idx)
                processed_files.append(filename)

    return np.array(images), np.array(labels), processed_files


def compute_file_metadata(filepath: str) -> dict:
    """Tính toán SHA-256 checksum và dung lượng (MB) của tệp mô hình để đối chiếu tính toàn vẹn khi backup/rollback."""
    if not filepath or not os.path.exists(filepath):
        return {"exists": False, "sha256": None, "size_mb": 0.0}
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    size_mb = round(os.path.getsize(filepath) / (1024 * 1024), 2)
    return {
        "exists": True,
        "sha256": h.hexdigest(),
        "size_mb": size_mb,
    }


def update_model_registry(version_entry: dict, registry_path: str = "models/model_registry.json"):
    """Lưu lịch sử các phiên bản mô hình AI, chỉ số so sánh (Bản cũ vs Bản mới) và đường dẫn bản sao lưu."""
    os.makedirs(os.path.dirname(registry_path) or ".", exist_ok=True)
    registry = {
        "active_model": "models/resnet_risk_calibrated.keras",
        "baseline_model": "models/resnet_risk_calibrated.keras",
        "last_updated_at": None,
        "versions": [],
    }
    if os.path.exists(registry_path):
        try:
            with open(registry_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    registry.update(loaded)
        except Exception:
            pass

    if not isinstance(registry.get("versions"), list):
        registry["versions"] = []

    registry["versions"].insert(0, version_entry)
    registry["versions"] = registry["versions"][:30]
    registry["last_updated_at"] = datetime.now().isoformat()

    with open(registry_path, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)
    return registry


def run_benchmark_eval(model, test_path, sample_per_class=25, return_dict=False):
    """
    Validation Gate (BUG-MLOPS-001): Đánh giá toàn diện mô hình trên tập test chuẩn (archive_v2/Testing).
    Đo lường:
      - Overall Accuracy (%)
      - Macro F1-Score (%)
      - Per-class Recall / Sensitivity (%) — đặc biệt giám sát 'glioma' (u ác tính)
      - Per-class Precision & F1-Score (%)
      - Average Inference Latency (ms/ảnh)
    """
    empty_metrics = {
        "accuracy": 0.0,
        "macro_f1": 0.0,
        "per_class_recall": {cat: 0.0 for cat in CATEGORIES},
        "per_class_precision": {cat: 0.0 for cat in CATEGORIES},
        "per_class_f1": {cat: 0.0 for cat in CATEGORIES},
        "avg_latency_ms": 0.0,
        "total_evaluated": 0,
    }
    if not os.path.exists(test_path):
        print(f"[Benchmark] Cảnh báo: Không tìm thấy thư mục test: {test_path}")
        return empty_metrics if return_dict else 0.0

    test_images: list[np.ndarray] = []
    test_labels: list[int] = []

    for idx, cat in enumerate(CATEGORIES):
        cat_dir = os.path.join(test_path, cat)
        if not os.path.isdir(cat_dir):
            continue
        files = sorted([f for f in os.listdir(cat_dir) if f.lower().endswith(('.jpg', '.png', '.jpeg'))])
        selected_files = files[:sample_per_class]

        for fname in selected_files:
            fpath = os.path.join(cat_dir, fname)
            img = cv2.imread(fpath)
            if img is not None:
                resized = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
                norm = resized.astype("float32") / 255.0
                test_images.append(norm)
                test_labels.append(idx)

    if not test_images:
        return empty_metrics if return_dict else 0.0

    X_test = np.array(test_images)
    y_test = np.array(test_labels)

    t0 = time.perf_counter()
    preds = model.predict(X_test, batch_size=16, verbose=0)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    avg_latency_ms = round(elapsed_ms / max(len(X_test), 1), 2)

    pred_labels = np.argmax(preds, axis=1)
    acc = round(float(np.mean(pred_labels == y_test) * 100), 2)

    per_class_recall = {}
    per_class_precision = {}
    per_class_f1 = {}
    f1_list = []

    for idx, cat in enumerate(CATEGORIES):
        tp = int(np.sum((pred_labels == idx) & (y_test == idx)))
        fp = int(np.sum((pred_labels == idx) & (y_test != idx)))
        fn = int(np.sum((pred_labels != idx) & (y_test == idx)))

        recall = (tp / (tp + fn) * 100.0) if (tp + fn) > 0 else 100.0
        precision = (tp / (tp + fp) * 100.0) if (tp + fp) > 0 else 100.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

        per_class_recall[cat] = round(float(recall), 2)
        per_class_precision[cat] = round(float(precision), 2)
        per_class_f1[cat] = round(float(f1), 2)
        f1_list.append(per_class_f1[cat])

    macro_f1 = round(float(np.mean(f1_list)), 2) if f1_list else 0.0

    metrics = {
        "accuracy": acc,
        "macro_f1": macro_f1,
        "per_class_recall": per_class_recall,
        "per_class_precision": per_class_precision,
        "per_class_f1": per_class_f1,
        "avg_latency_ms": avg_latency_ms,
        "total_evaluated": int(len(X_test)),
    }
    return metrics if return_dict else acc


def main():
    args = parse_args()
    print("=" * 65)
    print("  NEUROSCAN AI — ACTIVE LEARNING RETRAINING PIPELINE")
    print(f"  Thời gian: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    version_id = f"v_{timestamp_str}"
    os.makedirs("hard_examples", exist_ok=True)
    os.makedirs("hard_examples/history", exist_ok=True)
    os.makedirs("models/versions", exist_ok=True)
    os.makedirs("models/checkpoints", exist_ok=True)

    # 1. Đọc dữ liệu ca khó phản hồi từ bác sĩ
    print(f"\n[1/6] Đang đọc dữ liệu phản hồi từ: {args.csv_path} ...")
    X, y, processed_files = load_data_with_attention_guidance(args.csv_path, args.hard_dir)

    if len(X) == 0:
        msg = "Chưa có dữ liệu phản hồi ca khó hợp lệ trong CSV để huấn luyện."
        print(f"❌ [Active Learning] {msg}")
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump({
                "status": "NO_DATA",
                "message": msg,
                "timestamp": timestamp_str
            }, f, indent=2, ensure_ascii=False)
        return

    print(f"   -> Thu thập thành công {len(X)} ca phản hồi từ bác sĩ chuyên khoa.")
    y_one_hot = tf.keras.utils.to_categorical(y, num_classes=len(CATEGORIES))

    # 2. Tải mô hình cơ sở & Tạo bản sao lưu (Backup) TRƯỚC KHI fine-tune
    print(f"\n[2/6] Đang nạp mô hình đang vận hành (Bản cũ): {args.base_model} ...")
    if not os.path.exists(args.base_model):
        err_msg = f"Không tìm thấy file mô hình: {args.base_model}"
        print(f"❌ [Active Learning] {err_msg}")
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump({"status": "FAILED", "error": err_msg, "timestamp": timestamp_str}, f, indent=2)
        return

    # Sao lưu backup mô hình hiện hành TRƯỚC khi huấn luyện để đảm bảo 100% có thể Rollback
    checkpoint_path = f"models/checkpoints/resnet_baseline_backup_{timestamp_str}.keras"
    shutil.copyfile(args.base_model, checkpoint_path)
    base_file_meta = compute_file_metadata(checkpoint_path)
    print(f"   -> [Backup] Đã sao lưu mô hình cũ tại: {checkpoint_path} (SHA256: {base_file_meta['sha256'][:12]}..., {base_file_meta['size_mb']} MB)")

    try:
        custom_objects = {'tf': tf}
        model = tf.keras.models.load_model(args.base_model, custom_objects=custom_objects, safe_mode=False, compile=False)
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=args.lr),
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
        print("   -> Nạp mô hình thành công!")
    except Exception as e:
        err_msg = f"Lỗi nạp mô hình: {str(e)}"
        print(f"❌ [Active Learning] {err_msg}")
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump({"status": "FAILED", "error": err_msg, "timestamp": timestamp_str}, f, indent=2)
        return

    # 3. Đo lường chỉ số chuẩn (Baseline Benchmark — Bản cũ) trước khi train
    print(f"\n[3/6] Đang đo lường chỉ số mô hình cũ (Baseline Benchmark) trên {args.test_path} ...")
    baseline_metrics = run_benchmark_eval(model, args.test_path, sample_per_class=25, return_dict=True)
    baseline_acc = baseline_metrics["accuracy"]
    baseline_macro_f1 = baseline_metrics["macro_f1"]
    baseline_glioma_recall = baseline_metrics["per_class_recall"].get("glioma", 0.0)
    print(
        f"   -> [Bản cũ] Accuracy: {baseline_acc}% | Macro-F1: {baseline_macro_f1}% | "
        f"Glioma Recall: {baseline_glioma_recall}% | Latency: {baseline_metrics['avg_latency_ms']} ms/ảnh"
    )

    # 4. Huấn luyện Fine-Tuning với Attention Guidance
    print(f"\n[4/6] Bắt đầu huấn luyện Fine-Tuning ({args.epochs} Epochs, Learning Rate = {args.lr}) ...")
    try:
        history = model.fit(
            X, y_one_hot,
            epochs=args.epochs,
            batch_size=args.batch_size,
            verbose=1
        )
        print("   -> Hoàn thành các Epochs huấn luyện!")
    except Exception as e:
        err_msg = f"Lỗi trong quá trình huấn luyện fit(): {str(e)}"
        print(f"❌ [Active Learning] {err_msg}")
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump({"status": "FAILED", "error": err_msg, "timestamp": timestamp_str}, f, indent=2)
        return

    # 5. Validation Gate: Đánh giá mô hình ứng viên (Bản mới) & So sánh với Bản cũ
    print(f"\n[5/6] Đánh giá kiểm chuẩn (Clinical Quality Gate) mô hình ứng viên mới ...")
    candidate_metrics = run_benchmark_eval(model, args.test_path, sample_per_class=25, return_dict=True)
    candidate_acc = candidate_metrics["accuracy"]
    candidate_macro_f1 = candidate_metrics["macro_f1"]
    candidate_glioma_recall = candidate_metrics["per_class_recall"].get("glioma", 0.0)

    acc_diff = round(candidate_acc - baseline_acc, 2)
    f1_diff = round(candidate_macro_f1 - baseline_macro_f1, 2)
    glioma_recall_diff = round(candidate_glioma_recall - baseline_glioma_recall, 2)
    latency_diff_ms = round(candidate_metrics["avg_latency_ms"] - baseline_metrics["avg_latency_ms"], 2)

    diff_str = f"+{acc_diff}%" if acc_diff >= 0 else f"{acc_diff}%"
    f1_diff_str = f"+{f1_diff}%" if f1_diff >= 0 else f"{f1_diff}%"
    glioma_diff_str = f"+{glioma_recall_diff}%" if glioma_recall_diff >= 0 else f"{glioma_recall_diff}%"

    # Dual Clinical Validation Gate:
    # 1. Tổng Accuracy không suy giảm quá 1.5%
    # 2. Macro-F1 không suy giảm quá 2.0%
    # 3. Độ nhạy (Recall) lớp Glioma (u ác tính) không suy giảm quá 2.0%
    acc_gate_ok = candidate_acc >= (baseline_acc - 1.5)
    f1_gate_ok = candidate_macro_f1 >= (baseline_macro_f1 - 2.0)
    glioma_gate_ok = candidate_glioma_recall >= (baseline_glioma_recall - 2.0)
    gate_passed = bool(acc_gate_ok and f1_gate_ok and glioma_gate_ok)

    print(
        f"   -> [Bản mới] Accuracy: {candidate_acc}% ({diff_str}) | Macro-F1: {candidate_macro_f1}% ({f1_diff_str}) | "
        f"Glioma Recall: {candidate_glioma_recall}% ({glioma_diff_str})"
    )
    print(f"   -> Kết luận Quality Gate: {'✅ ĐẠT CHUẨN LÂM SÀNG (PASSED)' if gate_passed else '⚠️ CẢNH BÁO SUY GIẢM (FAILED GATE)'}")

    # 6. Lưu trữ phiên bản mô hình mới & Archive CSV + Model Registry
    print(f"\n[6/6] Lưu trữ phiên bản mô hình mới, checksum SHA-256 và bảo toàn nhật ký dữ liệu ...")
    versioned_model_path = f"models/versions/resnet_active_{timestamp_str}.keras"
    model.save(versioned_model_path)
    candidate_file_meta = compute_file_metadata(versioned_model_path)
    print(f"   -> Đã lưu mô hình phiên bản mới: {versioned_model_path} (SHA256: {candidate_file_meta['sha256'][:12]}..., {candidate_file_meta['size_mb']} MB)")

    # Lưu một bản copy là candidate_model.keras để hot-reload nạp nhanh
    candidate_symlink_path = "models/candidate_model.keras"
    shutil.copyfile(versioned_model_path, candidate_symlink_path)

    # Archive file feedback_log.csv
    archived_csv_path = f"hard_examples/history/feedback_archived_{timestamp_str}.csv"
    shutil.copyfile(args.csv_path, archived_csv_path)

    # Làm sạch file feedback_log.csv (giữ header) cho chu kỳ tiếp theo
    with open(args.csv_path, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["filename", "correct_class", "x", "y", "w", "h", "timestamp"])
    print(f"   -> Đã lưu trữ nhật ký mẫu cũ vào: {archived_csv_path}")
    print(f"   -> Đã làm sạch Sổ tay học tập ({args.csv_path}) cho đợt tiếp theo.")

    comparison_summary = {
        "old_model": {
            "path": args.base_model,
            "backup_checkpoint_path": checkpoint_path,
            "sha256": base_file_meta["sha256"],
            "size_mb": base_file_meta["size_mb"],
            **baseline_metrics,
        },
        "new_model": {
            "path": versioned_model_path,
            "sha256": candidate_file_meta["sha256"],
            "size_mb": candidate_file_meta["size_mb"],
            **candidate_metrics,
        },
        "delta": {
            "accuracy_diff": acc_diff,
            "accuracy_diff_str": diff_str,
            "macro_f1_diff": f1_diff,
            "macro_f1_diff_str": f1_diff_str,
            "glioma_recall_diff": glioma_recall_diff,
            "glioma_recall_diff_str": glioma_diff_str,
            "latency_diff_ms": latency_diff_ms,
            "per_class_recall_diff": {
                cat: round(candidate_metrics["per_class_recall"].get(cat, 0.0) - baseline_metrics["per_class_recall"].get(cat, 0.0), 2)
                for cat in CATEGORIES
            },
            "per_class_f1_diff": {
                cat: round(candidate_metrics["per_class_f1"].get(cat, 0.0) - baseline_metrics["per_class_f1"].get(cat, 0.0), 2)
                for cat in CATEGORIES
            },
        },
        "gate_checks": {
            "accuracy_gate_passed": acc_gate_ok,
            "macro_f1_gate_passed": f1_gate_ok,
            "glioma_recall_gate_passed": glioma_gate_ok,
            "overall_passed": gate_passed,
        },
    }

    # Ghi nhận kết quả vào file JSON cho Backend/Frontend đọc
    result_data = {
        "status": "COMPLETED",
        "version_id": version_id,
        "timestamp": timestamp_str,
        "samples_trained": len(X),
        "base_model_path": args.base_model,
        "candidate_model_path": versioned_model_path,
        "checkpoint_backup_path": checkpoint_path,
        "baseline_accuracy": baseline_acc,
        "retrained_accuracy": candidate_acc,
        "accuracy_diff": diff_str,
        "baseline_macro_f1": baseline_macro_f1,
        "retrained_macro_f1": candidate_macro_f1,
        "macro_f1_diff": f1_diff_str,
        "baseline_glioma_recall": baseline_glioma_recall,
        "retrained_glioma_recall": candidate_glioma_recall,
        "glioma_recall_diff": glioma_diff_str,
        "old_model_metrics": comparison_summary["old_model"],
        "new_model_metrics": comparison_summary["new_model"],
        "comparison": comparison_summary,
        "gate_passed": gate_passed,
        "archived_csv": archived_csv_path,
        "message": (
            f"Huấn luyện thành công {len(X)} ca phản hồi. "
            f"Accuracy: {baseline_acc}% -> {candidate_acc}% ({diff_str}) | "
            f"Macro-F1: {baseline_macro_f1}% -> {candidate_macro_f1}% ({f1_diff_str}) | "
            f"Glioma Recall: {baseline_glioma_recall}% -> {candidate_glioma_recall}% ({glioma_diff_str})."
        ),
    }

    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(result_data, f, indent=2, ensure_ascii=False)

    # Cập nhật Model Registry bền vững (models/model_registry.json)
    update_model_registry({
        "version_id": version_id,
        "created_at": datetime.now().isoformat(),
        "status": "candidate_ready" if gate_passed else "gate_failed",
        "samples_trained": len(X),
        "base_model_path": args.base_model,
        "candidate_model_path": versioned_model_path,
        "checkpoint_backup_path": checkpoint_path,
        "archived_csv": archived_csv_path,
        "gate_passed": gate_passed,
        "baseline_accuracy": baseline_acc,
        "retrained_accuracy": candidate_acc,
        "accuracy_diff": diff_str,
        "baseline_macro_f1": baseline_macro_f1,
        "retrained_macro_f1": candidate_macro_f1,
        "baseline_glioma_recall": baseline_glioma_recall,
        "retrained_glioma_recall": candidate_glioma_recall,
        "comparison": comparison_summary,
    })

    print("\n" + "=" * 65)
    print("  TIẾN TRÌNH HUẤN LUYỆN LẠI HOÀN TẤT THÀNH CÔNG!")
    print("  Mô hình ứng viên đã sẵn sàng để Quản trị viên duyệt áp dụng (Deploy).")
    print("=" * 65)


if __name__ == "__main__":
    main()
