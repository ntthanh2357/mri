import os
import sys
import cv2
# pyrefly: ignore [missing-attribute]
sys.stdout.reconfigure(encoding='utf-8')
import csv
import numpy as np
# pyrefly: ignore [untyped-import]
import tensorflow as tf
# pyrefly: ignore [missing-import]
from tensorflow.keras.optimizers import Adam
import builtins
# pyrefly: ignore [missing-attribute]
builtins.tf = tf

# Cấu hình đường dẫn
MODEL_PATH = "models/brain_tumor_resnet_final_fixed.keras"
HARD_DIR = "hard_examples"
CSV_PATH = os.path.join(HARD_DIR, "feedback_log.csv")
CATEGORIES = ['glioma', 'meningioma', 'notumor', 'pituitary']
IMG_SIZE = 224

def load_data_with_attention_guidance(csv_path, hard_dir):
    """
    Đọc dữ liệu từ CSV và áp dụng Attention Guidance: 
    Bôi đen toàn bộ nền, chỉ giữ lại vùng khối u do bác sĩ khoanh.
    """
    images = []
    labels = []
    processed_files = []
    
    if not os.path.exists(csv_path):
        print("Không tìm thấy file phản hồi. Chưa có dữ liệu mới để học.")
        return np.array(images), np.array(labels), processed_files

    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            filename = row['filename']
            class_name = row['correct_class']
            x = int(row['x'])
            y = int(row['y'])
            w = int(row['w'])
            h = int(row['h'])

            img_path = os.path.join(hard_dir, filename)
            if not os.path.exists(img_path):
                continue

            img = cv2.imread(img_path)
            if img is None:
                continue

            # Áp dụng Attention Guidance (Masking)
            # 1. Tạo một ảnh đen hoàn toàn cùng kích thước
            mask = np.zeros(img.shape[:2], dtype="uint8")
            # 2. Tô màu trắng vào đúng vùng bác sĩ khoanh
            cv2.rectangle(mask, (x, y), (x+w, y+h), 255, -1)
            
            # 3. Cắt lấy vùng có khối u, bôi đen toàn bộ phần còn lại (não thừa)
            masked_img = cv2.bitwise_and(img, img, mask=mask)

            # Resize về kích thước model yêu cầu
            resized_img = cv2.resize(masked_img, (IMG_SIZE, IMG_SIZE))
            
            # Normalize ảnh (chuẩn hóa giống hệt lúc train)
            normalized_img = resized_img / 255.0
            
            # Chuyển label thành số index
            if class_name in CATEGORIES:
                label_idx = CATEGORIES.index(class_name)
                images.append(normalized_img)
                # pyrefly: ignore [bad-argument-type]
                labels.append(label_idx)
                processed_files.append(filename)

    return np.array(images), np.array(labels), processed_files


def run_active_learning():
    print("=== BẮT ĐẦU QUÁ TRÌNH ACTIVE LEARNING (HUMAN-IN-THE-LOOP) ===")
    
    # 1. Chuẩn bị dữ liệu
    print("\n[1/5] Đang đọc và xử lý ảnh từ phản hồi bác sĩ (Attention Guidance)...")
    X, y, processed_files = load_data_with_attention_guidance(CSV_PATH, HARD_DIR)
    
    if len(X) == 0:
        print("Không có dữ liệu hợp lệ để huấn luyện. Kết thúc.")
        return

    print(f"   -> Tìm thấy {len(X)} mẫu hợp lệ.")
    
    # Chuyển đổi nhãn sang One-hot encoding
    y_one_hot = tf.keras.utils.to_categorical(y, num_classes=len(CATEGORIES))

    # 2. Tải mô hình hiện tại
    print(f"\n[2/5] Đang tải mô hình cốt lõi: {MODEL_PATH}")
    custom_objects = {'tf': tf}
    try:
        tf.keras.config.enable_unsafe_deserialization()
    except AttributeError:
        pass
        
    try:
        model = tf.keras.models.load_model(MODEL_PATH, custom_objects=custom_objects, safe_mode=False)
        print("   -> Tải mô hình thành công!")
    except Exception as e:
        print(f"   -> LỖI khi tải mô hình: {e}")
        return

    # 3. Fine-tuning với Learning Rate cực nhỏ (để không phá vỡ trí nhớ cũ của mô hình)
    print("\n[3/5] Cấu hình chế độ học sâu (Learning Rate = 1e-5)...")
    model.compile(
        optimizer=Adam(learning_rate=1e-5),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    # 4. Bắt đầu huấn luyện
    print(f"\n[4/5] Ép mô hình tập trung vào đặc trưng khối u ({len(X)} ảnh, 10 Epochs)...")
    model.fit(
        X, y_one_hot,
        epochs=10,        # Có thể chỉnh lớn hơn nếu lượng dữ liệu nhiều
        batch_size=4,     # Batch nhỏ vì dữ liệu ít
        verbose=1
    )

    # 5. Lưu và cập nhật mô hình mới
    print("\n[5/5] Lưu mô hình phiên bản mới (Thông minh hơn)...")
    model.save(MODEL_PATH)
    print(f"   -> Đã ghi đè thành công file: {MODEL_PATH}")
    
    # Dọn dẹp Sổ tay học tập (đổi tên để backup, làm rỗng file mới)
    backup_csv = CSV_PATH + ".bak"
    if os.path.exists(backup_csv):
        os.remove(backup_csv)
    os.rename(CSV_PATH, backup_csv)
    
    # Tạo lại file csv trống có header
    with open(CSV_PATH, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["filename", "correct_class", "x", "y", "w", "h"])
        
    print(f"   -> Đã làm sạch Sổ tay học tập. Backup lưu tại: {backup_csv}")
    print("\n=== HOÀN TẤT! HỆ THỐNG ĐÃ TRỞ NÊN THÔNG MINH HƠN ===")

if __name__ == "__main__":
    run_active_learning()
