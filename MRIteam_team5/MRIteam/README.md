# 🧠 NeuroAI Diagnostic - Hệ Thống Hội Chẩn Khối U Não Đa Mô Hình

Hệ thống AI tiên tiến hỗ trợ Bác sĩ chẩn đoán khối u não từ ảnh chụp cộng hưởng từ (MRI). Dự án áp dụng cơ chế **Kiểm Chéo 3 Vòng (Cross-Validation)** kết hợp giữa Học Sâu (Deep Learning) và Trí Tuệ Nhân Tạo Sinh Tạo (Generative AI) để đem lại kết quả minh bạch và an toàn y khoa.

---

## ✨ Tính Năng Nổi Bật

1. **🧠 Phân Loại Toàn Cảnh (ResNet50 + Grad-CAM):** Phân loại 4 nhãn (Glioma, Meningioma, Pituitary, Bình thường) và xuất Bản đồ nhiệt (Heatmap) giải thích vùng AI chú ý.
2. **🎯 Khoanh Vùng Cục Bộ (YOLOv8):** Tự động phát hiện và vẽ Bounding Box bao quanh vị trí chính xác của khối u trên ảnh MRI gốc.
3. **👁️ Hội Chẩn Kiểm Chéo (Gemini Vision):** Đóng vai trò là "Bác sĩ thứ 3". Tự động "soi" ảnh MRI bằng Computer Vision để giải quyết các trường hợp ResNet và YOLO cho kết quả phân kỳ (khác nhau).
4. **🤖 Đội Ngũ Đa Tác Vụ (Multi-Agent System):**
   - **Bác sĩ AI:** Tự động soạn thảo Báo Cáo Y Tế (Nháp).
   - **Phiên dịch viên:** Dịch báo cáo y khoa phức tạp sang ngôn ngữ đời thường cho bệnh nhân.
   - **Trợ lý Lâm sàng (RAG Chatbot):** Trả lời các thắc mắc y tế dựa trên tài liệu chuẩn.
   - **Thư ký Y khoa:** Tóm tắt lịch sử hội chẩn.
5. **📈 Dạy Lại AI (Active Learning):** Giao diện cho phép Bác sĩ tự tay khoanh lại vùng u bị sai (đặc biệt là các ca Glioma khó) để thu thập vào `hard_examples/` và huấn luyện lại.

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Chuẩn bị môi trường
```bash
git clone https://github.com/your-username/MRIteam.git
cd MRIteam
pip install -r requirements.txt
```

### 2. Cài đặt API Key
Tạo file `.env` ở thư mục gốc và cung cấp khóa API cho SDK `google-genai` mới nhất:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Chuẩn bị Trọng số Mô hình (Weights)
Hệ thống cần 2 file trọng số để hoạt động (do dung lượng lớn nên không có trên GitHub):
- **ResNet:** Bỏ file `best_resnet_model.keras` vào thư mục `models/`
- **YOLO:** Bỏ file `best.pt` vào thư mục `runs/detect/mri_tumor_det/weights/`

### 4. Khởi Chạy Hệ Thống

Bạn cần mở 2 cửa sổ Terminal (hoặc Command Prompt):

**Terminal 1: Khởi động Backend API (FastAPI)**
```bash
python main.py
```
*(Backend sẽ chạy tại: `http://127.0.0.1:8000`)*

**Terminal 2: Khởi động Frontend (Giao diện người dùng)**
```bash
python -m http.server 5500 --directory frontend
```
*(Mở trình duyệt và truy cập: `http://localhost:5500` để sử dụng)*

---

## 🛠️ Hướng Dẫn Huấn Luyện Lại (Dành Cho Developer)

Nếu bạn muốn tự train lại mô hình từ đầu với tập dữ liệu mới:

### 1. Dữ liệu & Nguồn Dataset
Hệ thống sử dụng 2 bộ dữ liệu chuẩn quốc tế từ Kaggle (đã được ẩn danh hóa thông tin y tế để đảm bảo quyền riêng tư):
- **Dữ liệu Phân loại (ResNet):** Bỏ dataset ảnh MRI vào thư mục `archive/`. Nguồn tải: [Brain Tumor MRI Dataset](https://www.kaggle.com/datasets/masoudnickparvar/brain-tumor-mri-dataset/data)
- **Dữ liệu Khoanh vùng (YOLO):** Bỏ dataset ảnh gán nhãn YOLO vào `archive_label/`. Nguồn tải: [MRI for Brain Tumor with Bounding Boxes](https://www.kaggle.com/datasets/ahmedsorour1/mri-for-brain-tumor-with-bounding-boxes/code)

### 2. Train mô hình YOLO (Khoanh Vùng)
Chạy file train YOLOv8:
```bash
python train_yolo.py
```
*(Lưu ý: Có thể tùy chỉnh batch size và epochs trong file).*

### 3. Train mô hình ResNet (Phân Loại)
Khuyến nghị sử dụng kỹ thuật **Risk-Calibrated Loss** để khắc phục việc nhận diện sai loại khối u Glioma (phạt nặng nếu đoán sai):
```bash
python train_resnet_risk_loss.py
```

### 4. Active Learning (Học Tăng Cường)
Dữ liệu Bác sĩ phản hồi từ giao diện web sẽ nằm trong thư mục `hard_examples/feedback_log.csv`. Viết thêm script ghép dữ liệu này vào dataset gốc để tinh chỉnh (fine-tune) lại cả 2 mô hình.

---
**Tác giả:** MRI Team  
**Giấy phép:** Dành cho mục đích nghiên cứu & học tập. Hệ thống chỉ mang tính chất hỗ trợ quyết định y tế, quyết định cuối cùng vẫn thuộc về Bác sĩ chuyên khoa.
