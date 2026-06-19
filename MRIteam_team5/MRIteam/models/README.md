# Thư mục chứa các mô hình AI (Keras Models)

Thư mục này dùng để lưu trữ các tệp trọng số mô hình AI phục vụ cho việc chẩn đoán hình ảnh MRI. Do kích thước các tệp này lớn và vượt quá giới hạn của GitHub (>100MB), chúng đã được cấu hình bỏ qua trong `.gitignore`.

## Các tệp mô hình cần thiết:

Vui lòng tải các tệp mô hình tương ứng và đặt vào thư mục này trước khi chạy AI Server:

1. **`best_densenet_model.keras`**
   * *Mô tả*: Mô hình DenseNet dùng cho phân loại phân vùng khối u.
   
2. **`best_efficientnet_model.keras`**
   * *Mô tả*: Mô hình EfficientNet dùng cho phân tích đặc trưng khối u.

3. **`resnet_risk_calibrated.keras`**
   * *Mô tả*: Mô hình ResNet đã được hiệu chuẩn rủi ro dùng cho đánh giá mức độ nguy cơ.

---
*Lưu ý: Đảm bảo đặt đúng tên tệp như danh sách trên để server AI (`main.py`) có thể tự động tải mô hình thành công.*
