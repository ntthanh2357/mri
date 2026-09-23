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


def run_benchmark_eval(model, test_path, sample_per_class=25):
    """
    Validation Gate: Đánh giá mô hình trên tập test chuẩn (archive_v2/Testing)
    Lấy mẫu đại diện mỗi lớp để đo lường độ chính xác (Accuracy).
    """
    if not os.path.exists(test_path):
        print(f"[Benchmark] Cảnh báo: Không tìm thấy thư mục test: {test_path}")
        return 0.0

    test_images: list[np.ndarray] = []
    test_labels: list[int] = []

    for idx, cat in enumerate(CATEGORIES):
        cat_dir = os.path.join(test_path, cat)
        if not os.path.isdir(cat_dir):
            continue
        files = [f for f in os.listdir(cat_dir) if f.lower().endswith(('.jpg', '.png', '.jpeg'))]
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
        return 0.0

    X_test = np.array(test_images)
    y_test = np.array(test_labels)

    preds = model.predict(X_test, batch_size=16, verbose=0)
    pred_labels = np.argmax(preds, axis=1)

    acc = float(np.mean(pred_labels == y_test) * 100)
    return round(acc, 2)


def main():
    args = parse_args()
    print("=" * 65)
    print("  NEUROSCAN AI — ACTIVE LEARNING RETRAINING PIPELINE")
    print(f"  Thời gian: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
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

    # 2. Tải mô hình cơ sở
    print(f"\n[2/6] Đang nạp mô hình sản xuất: {args.base_model} ...")
    if not os.path.exists(args.base_model):
        err_msg = f"Không tìm thấy file mô hình: {args.base_model}"
        print(f"❌ [Active Learning] {err_msg}")
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump({"status": "FAILED", "error": err_msg, "timestamp": timestamp_str}, f, indent=2)
        return

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

    # 3. Đo lường chỉ số chuẩn (Baseline Benchmark) trước khi train
    print(f"\n[3/6] Đang đo lường chỉ số cơ sở (Baseline Benchmark) trên {args.test_path} ...")
    baseline_acc = run_benchmark_eval(model, args.test_path, sample_per_class=25)
    print(f"   -> Độ chính xác cơ sở hiện tại: {baseline_acc}%")

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

    # 5. Validation Gate: Đánh giá mô hình ứng viên sau khi học
    print(f"\n[5/6] Đánh giá kiểm chuẩn (Quality Gate) mô hình ứng viên mới ...")
    candidate_acc = run_benchmark_eval(model, args.test_path, sample_per_class=25)
    acc_diff = round(candidate_acc - baseline_acc, 2)
    diff_str = f"+{acc_diff}%" if acc_diff >= 0 else f"{acc_diff}%"

    # Cho phép dao động nhỏ do số mẫu học ít, cảnh báo nếu suy giảm > 1.5%
    gate_passed = candidate_acc >= (baseline_acc - 1.5)
    print(f"   -> Độ chính xác sau retrain: {candidate_acc}% (Biến thiên: {diff_str})")
    print(f"   -> Kết luận Quality Gate: {'✅ ĐẠT CHUẨN (PASSED)' if gate_passed else '⚠️ CẢNH BÁO SUY GIẢM (WARNING)'}")

    # 6. Lưu trữ phiên bản mô hình mới & Archive CSV an toàn
    print(f"\n[6/6] Lưu trữ phiên bản mô hình và bảo toàn nhật ký dữ liệu ...")
    versioned_model_path = f"models/versions/resnet_active_{timestamp_str}.keras"
    model.save(versioned_model_path)
    print(f"   -> Đã lưu mô hình phiên bản mới: {versioned_model_path}")

    # Lưu một bản copy là candidate_model.keras để hot-reload nạp nhanh
    candidate_symlink_path = "models/candidate_model.keras"
    shutil.copyfile(versioned_model_path, candidate_symlink_path)

    # Sao lưu backup baseline model phòng khi rollback
    checkpoint_path = f"models/checkpoints/resnet_baseline_backup_{timestamp_str}.keras"
    if os.path.exists(args.base_model):
        shutil.copyfile(args.base_model, checkpoint_path)
        print(f"   -> Đã tạo bản sao lưu an toàn tại: {checkpoint_path}")

    # Archive file feedback_log.csv
    archived_csv_path = f"hard_examples/history/feedback_archived_{timestamp_str}.csv"
    shutil.copyfile(args.csv_path, archived_csv_path)

    # Làm sạch file feedback_log.csv (giữ header) cho chu kỳ tiếp theo
    with open(args.csv_path, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["filename", "correct_class", "x", "y", "w", "h", "timestamp"])
    print(f"   -> Đã lưu trữ nhật ký mẫu cũ vào: {archived_csv_path}")
    print(f"   -> Đã làm sạch Sổ tay học tập ({args.csv_path}) cho đợt tiếp theo.")

    # Ghi nhận kết quả vào file JSON cho Backend/Frontend đọc
    result_data = {
        "status": "COMPLETED",
        "timestamp": timestamp_str,
        "samples_trained": len(X),
        "candidate_model_path": versioned_model_path,
        "checkpoint_backup_path": checkpoint_path,
        "baseline_accuracy": baseline_acc,
        "retrained_accuracy": candidate_acc,
        "accuracy_diff": diff_str,
        "gate_passed": gate_passed,
        "archived_csv": archived_csv_path,
        "message": f"Huấn luyện thành công {len(X)} ca phản hồi. Độ chính xác: {baseline_acc}% -> {candidate_acc}% ({diff_str})."
    }

    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(result_data, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 65)
    print("  TIẾN TRÌNH HUẤN LUYỆN LẠI HOÀN TẤT THÀNH CÔNG!")
    print("  Mô hình ứng viên đã sẵn sàng để Quản trị viên duyệt áp dụng (Deploy).")
    print("=" * 65)


if __name__ == "__main__":
    main()
