# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import cv2
import numpy as np
import os

# ============================================================
# ĐỊA CHỈ GỐC CỦA TẬP DỮ LIỆU – chỉnh tại đây nếu cần
# ============================================================
BASE_DIR = r"c:\Users\Administrator\OneDrive\Desktop\MRI\archive"
TRAIN_DIR = os.path.join(BASE_DIR, "Training")
TEST_DIR  = os.path.join(BASE_DIR, "Testing")
CLASSES   = ["glioma", "meningioma", "notumor", "pituitary"]


def crop_brain_contour(image):
    """
    Hàm cắt ảnh não dựa trên contour (viền) lớn nhất để loại bỏ viền đen xung quanh.
    
    Args:
        image: Ảnh đầu vào dạng BGR
    
    Returns:
        Ảnh đã được cắt theo kích thước của não.
        Nếu không tìm thấy contour hoặc vùng cắt không hợp lệ, trả về ảnh gốc.
    """
    # 1. Chuyển sang ảnh xám để xử lý đơn giản hơn
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 2. Khử nhiễu nhẹ để tìm biên chính xác hơn
    gray = cv2.GaussianBlur(gray, (5, 5), 0)

    # 3. Phân ngưỡng (Threshold): Tách phần não (sáng) khỏi nền (đen)
    # SỬ DỤNG OTSU THRESHOLD: Tự động tìm ngưỡng tối ưu thay vì fix cứng
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # 4. Thực hiện các phép toán hình thái học để đóng các lỗ hổng nhỏ
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.erode(thresh, kernel, iterations=2)
    thresh = cv2.dilate(thresh, kernel, iterations=2)

    # 5. Tìm các đường viền (Contours)
    cnts, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Kiểm tra nếu không tìm thấy contour nào
    if not cnts:
        return image  # Trả về ảnh gốc nếu không tìm thấy viền

    # 6. Chọn đường viền lớn nhất (thường là hộp sọ)
    c = max(cnts, key=cv2.contourArea)

    # 7. Tìm tọa độ cực đại (trên, dưới, trái, phải)
    extLeft  = tuple(c[c[:, :, 0].argmin()][0])
    extRight = tuple(c[c[:, :, 0].argmax()][0])
    extTop   = tuple(c[c[:, :, 1].argmin()][0])
    extBot   = tuple(c[c[:, :, 1].argmax()][0])

    # 8. Cắt ảnh theo các tọa độ cực đại
    x1, x2 = extLeft[0],  extRight[0]
    y1, y2 = extTop[1],   extBot[1]

    # BUG FIX: Đảm bảo vùng cắt có kích thước hợp lệ (tránh ảnh rỗng)
    if x2 <= x1 or y2 <= y1:
        return image  # Tọa độ không hợp lệ → giữ nguyên ảnh gốc

    new_image = image[y1:y2, x1:x2]
    return new_image


def medical_preprocessing_v2(img_path):
    """
    Pipeline xử lý ảnh y tế phiên bản 2:
    - Cắt viền đen xung quanh não
    - Resize về kích thước chuẩn
    - Cải thiện tương phản bằng CLAHE
    - Khử nhiễu
    - Chuẩn hóa dữ liệu
    
    Args:
        img_path: Đường dẫn đến file ảnh
    
    Returns:
        Ảnh đã qua xử lý với kích thước (224, 224, 3) và giá trị pixel [0, 255]
        Trả về None nếu đọc ảnh thất bại.
    """
    # Đọc ảnh từ đường dẫn
    img = cv2.imread(img_path)
    if img is None:
        print(f"Lỗi: Không thể đọc ảnh từ đường dẫn {img_path}")
        return None
    
    # BƯỚC 1: Cắt viền đen xung quanh não
    img = crop_brain_contour(img)

    # BUG FIX: Kiểm tra ảnh sau khi crop không rỗng trước khi resize
    if img is None or img.size == 0:
        print(f"Cảnh báo: crop_brain_contour trả về ảnh rỗng cho {img_path}. Bỏ qua ảnh này.")
        return None
    
    # BƯỚC 2: Resize về kích thước chuẩn 224x224 pixel
    img = cv2.resize(img, (224, 224))
    
    # BƯỚC 3: Chuyển sang ảnh xám để xử lý tương phản
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # BƯỚC 4: Áp dụng CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    enhanced_img = clahe.apply(gray)
    
    # BƯỚC 5: Khử nhiễu bằng Gaussian Blur
    blurred = cv2.GaussianBlur(enhanced_img, (3, 3), 0)
    
    # BƯỚC 6: Chuyển từ ảnh xám sang 3 kênh RGB
    final_img = cv2.cvtColor(blurred, cv2.COLOR_GRAY2RGB)
    
    # BƯỚC 7: Giữ nguyên [0, 255] để dùng Keras preprocess_input
    final_img = final_img.astype('float32')
    
    return final_img


def medical_preprocessing_v1(img_path):
    """
    Pipeline xử lý ảnh y tế phiên bản 1 (không cắt viền đen).
    
    Lưu ý: Phiên bản này bỏ qua bước crop_brain_contour, có thể ảnh hưởng
    đến chất lượng phân loại do vẫn còn viền đen xung quanh.
    """
    # 1. Đọc ảnh từ đường dẫn
    img = cv2.imread(img_path)
    if img is None:
        print(f"Lỗi: Không thể đọc ảnh từ đường dẫn {img_path}")
        return None
    
    # 2. Resize về kích thước chuẩn 224x224
    img = cv2.resize(img, (224, 224))
    
    # 3. Chuyển sang ảnh xám để xử lý tương phản
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 4. Áp dụng CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced_img = clahe.apply(gray)
    
    # 5. Khử nhiễu bằng Gaussian Blur
    blurred = cv2.GaussianBlur(enhanced_img, (3, 3), 0)
    
    # 6. Chuyển ngược lại RGB để khớp với đầu vào ResNet50
    final_img = cv2.cvtColor(blurred, cv2.COLOR_GRAY2RGB)
    
    # 7. Giữ nguyên pixel [0, 255]
    final_img = final_img.astype('float32')
    
    return final_img


def load_dataset(split="Testing", version=2):
    """
    Tải toàn bộ ảnh từ thư mục Training hoặc Testing.
    
    Args:
        split   : "Training" hoặc "Testing"
        version : 1 hoặc 2 (phiên bản preprocessing)
    
    Returns:
        X (np.ndarray) : mảng ảnh shape (N, 224, 224, 3)
        y (np.ndarray) : mảng nhãn số nguyên tương ứng
        label_map (dict): mapping {tên_lớp: chỉ_số}
    """
    root = TRAIN_DIR if split == "Training" else TEST_DIR
    preprocess_fn = medical_preprocessing_v2 if version == 2 else medical_preprocessing_v1

    X, y = [], []
    label_map = {cls: idx for idx, cls in enumerate(CLASSES)}

    for cls in CLASSES:
        folder = os.path.join(root, cls)
        if not os.path.isdir(folder):
            print(f"Cảnh báo: Không tìm thấy thư mục {folder}")
            continue
        for fname in os.listdir(folder):
            if not fname.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            img_path = os.path.join(folder, fname)
            processed = preprocess_fn(img_path)
            if processed is not None:
                X.append(processed)
                y.append(label_map[cls])

    return np.array(X, dtype='float32'), np.array(y, dtype='int32'), label_map


# ============================================================
# Kiểm tra thử nghiệm cho 1 ảnh + Hiển thị ảnh so sánh
# ============================================================
if __name__ == "__main__":
    import matplotlib.pyplot as plt
    import matplotlib.gridspec as gridspec

    # Lấy ảnh đầu tiên trong thư mục Testing/glioma làm mẫu thử
    sample_dir = os.path.join(TEST_DIR, "glioma")
    sample_files = [
        f for f in os.listdir(sample_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ]

    if not sample_files:
        print(f"Lỗi: Không tìm thấy ảnh nào trong {sample_dir}")
    else:
        test_path = os.path.join(sample_dir, sample_files[0])
        print(f"Ảnh thử nghiệm: {test_path}\n")

        if not os.path.exists(test_path):
            print(f"Lỗi: Không tìm thấy file tại đường dẫn {test_path}")
        else:
            # ── Đọc ảnh gốc (BGR → RGB để matplotlib hiển thị đúng màu)
            original_bgr = cv2.imread(test_path)
            if original_bgr is not None:
                original_rgb = cv2.cvtColor(original_bgr, cv2.COLOR_BGR2RGB)
            else:
                original_rgb = None

            # ── Xử lý qua 2 pipeline
            processed_v2 = medical_preprocessing_v2(test_path)
            processed_v1 = medical_preprocessing_v1(test_path)

            if processed_v2 is not None:
                print("Phiên bản 2 - Xử lý ảnh thành công!")
                print(f"  Kích thước: {processed_v2.shape}")
                print(f"  Kiểu dữ liệu: {processed_v2.dtype}")
                print(f"  Pixel min={processed_v2.min():.3f}, max={processed_v2.max():.3f}")

            if processed_v1 is not None:
                print("\nPhiên bản 1 - Xử lý ảnh thành công!")
                print(f"  Kích thước: {processed_v1.shape}")

            print("\nSo sánh 2 phiên bản:")
            print("  Phiên bản 2: Có cắt viền đen → Tập trung vào vùng não, giảm nhiễu")
            print("  Phiên bản 1: Không cắt viền đen → Có thể còn vùng nền ảnh hưởng đến model")

            # ── Vẽ ảnh so sánh ─────────────────────────────────────────
            fig = plt.figure(figsize=(14, 5), facecolor="#1a1a2e")
            gs  = gridspec.GridSpec(1, 3, figure=fig, wspace=0.05)

            panels = [
                (original_rgb,   "Ảnh gốc (Original)",          "gray"),
                (processed_v1,   "V1 – Không cắt viền\n(CLAHE + Blur)", "gray"),
                (processed_v2,   "V2 – Có cắt viền\n(Crop + CLAHE + Blur)", "gray"),
            ]

            for i, (img, title, cmap) in enumerate(panels):
                ax = fig.add_subplot(gs[i])
                if img is None:
                    continue
                if img.ndim == 3 and img.shape[2] == 3:
                    # Hiển thị ảnh màu / grayscale-3ch
                    ax.imshow(img, cmap=None if i == 0 else "gray",
                              vmin=0, vmax=1 if img.dtype == 'float32' else 255)
                else:
                    ax.imshow(img, cmap="gray")

                ax.set_title(title, color="white", fontsize=12, pad=8, fontweight="bold")
                ax.axis("off")

                # Khung viền màu sắc phân biệt
                colors = ["#e2b96f", "#56b4e9", "#2ecc71"]
                for spine in ax.spines.values():
                    spine.set_edgecolor(colors[i])
                    spine.set_linewidth(2)
                    spine.set_visible(True)

            fname = os.path.splitext(sample_files[0])[0]
            fig.suptitle(
                f"So sánh kết quả preprocessing MRI – {fname}",
                color="white", fontsize=14, fontweight="bold", y=1.01
            )

            # Lưu ảnh so sánh ra file PNG
            out_path = os.path.join(
                r"c:\Users\Administrator\OneDrive\Desktop\MRI",
                f"preview_{fname}.png"
            )
            plt.savefig(out_path, dpi=150, bbox_inches="tight",
                        facecolor=fig.get_facecolor())
            print(f"\nĐã lưu ảnh so sánh tại: {out_path}")

            # Mở cửa sổ hiển thị (nếu có GUI)
            plt.tight_layout()
            plt.show()