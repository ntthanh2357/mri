import os
try:
    from ultralytics import YOLO # type: ignore
except ImportError:
    print("Vui lòng cài đặt ultralytics: pip install ultralytics")
    import sys
    sys.exit(1)

# ==============================================================
# CẤU HÌNH NÂNG CẤP YOLO
# ==============================================================
# Lựa chọn model size:
#   yolov8n.pt = nano  (kém nhất, nhanh nhất)
#   yolov8s.pt = small
#   yolov8m.pt = medium (khuyến nghị - cân bằng tốt)
#   yolov8l.pt = large  (tốt nhất, chậm hơn)
MODEL_SIZE = 'yolov8m.pt'  # Giữ nguyên bản Medium theo yêu cầu của người dùng

# Số epoch: rút ngắn từ 80 → 40
EPOCHS = 40

# Tên thư mục lưu kết quả (đổi sang v3 để train mới hoàn toàn từ đầu)
RUN_NAME = 'mri_tumor_det_v3'

# ==============================================================

def main():
    last_checkpoint = f'runs/detect/{RUN_NAME}/weights/last.pt'
    
    if os.path.exists(last_checkpoint):
        print(f"Tìm thấy checkpoint cũ tại: {last_checkpoint}")
        print("Đang tiếp tục (resume) quá trình huấn luyện...")
        model = YOLO(last_checkpoint)
        results = model.train(resume=True)
    else:
        print(f"Khởi tạo mô hình YOLOv8 Medium ({MODEL_SIZE}) để huấn luyện nhận diện khối u...")
        model = YOLO(MODEL_SIZE)

        print(f"Bắt đầu huấn luyện {EPOCHS} epochs. Quá trình này sẽ mất khoảng dưới 1 giờ...")
        results = model.train(
            data='combined_data.yaml',
            epochs=EPOCHS,          # Tối ưu hóa số lượng epoch (40)
            imgsz=640,              # Kích thước ảnh đầu vào
            batch=4,                # Giảm xuống 4 để tránh CUDA Out of Memory trên GPU 4GB VRAM
            cache=False,            # Tắt cache RAM do máy còn ít RAM trống (2.9GB)
            name=RUN_NAME,          # Tên thư mục lưu kết quả mới

            # === DATA AUGMENTATION (Tăng cường dữ liệu) ===
            # Giúp YOLO học tốt hơn trên dữ liệu y tế đa dạng
            hsv_h=0.015,            # Biến đổi màu sắc nhỏ
            hsv_s=0.4,              # Biến đổi độ bão hòa
            hsv_v=0.4,              # Biến đổi độ sáng
            degrees=10.0,           # Xoay ảnh ±10°
            translate=0.1,          # Dịch chuyển ảnh ±10%
            scale=0.3,              # Phóng to/thu nhỏ ±30%
            fliplr=0.5,             # Lật ngang (50% xác suất)
            flipud=0.0,             # Không lật dọc (MRI não có hướng cố định)
            mosaic=0.5,             # Ghép ảnh mosaic (giúp học vị trí đa dạng)
            mixup=0.0,              # Tắt mixup (không phù hợp với MRI y tế)

            # === OPTIMIZER ===
            optimizer='AdamW',      # AdamW tốt hơn SGD cho dataset nhỏ
            lr0=0.001,              # Learning rate khởi đầu
            lrf=0.01,               # Learning rate cuối (= lr0 * lrf)
            weight_decay=0.0005,    # Regularization

            # === EARLY STOPPING ===
            patience=20,            # Dừng sớm nếu 20 epoch không cải thiện

            device=0,               # Dùng GPU (CUDA đã sẵn sàng)
            workers=0,              # Đặt về 0 để tránh tràn RAM/nghẽn ổ cứng trên Windows
            verbose=True,           # Hiển thị thông tin chi tiết
            save=True,              # Lưu checkpoint tốt nhất
            save_period=10,         # Lưu checkpoint mỗi 10 epochs
            plots=True,             # Vẽ biểu đồ kết quả
        )
    
    # In kết quả
    print("\n" + "="*55)
    print(" HUẤN LUYỆN YOLO HOÀN TẤT!")
    print("="*55)
    print(f"Mô hình tốt nhất lưu tại: runs/detect/{RUN_NAME}/weights/best.pt")
    print(f"Mô hình cuối lưu tại:     runs/detect/{RUN_NAME}/weights/last.pt")
    print(f"Biểu đồ kết quả tại:      runs/detect/{RUN_NAME}/")
    print("\nĐể sử dụng trong hệ thống, cập nhật YOLO_MODEL_PATH trong:")
    print("  - benchmark_consensus.py")
    print("  - main.py")
    print(f'  Thành: "runs/detect/{RUN_NAME}/weights/best.pt"')

if __name__ == '__main__':
    main()
