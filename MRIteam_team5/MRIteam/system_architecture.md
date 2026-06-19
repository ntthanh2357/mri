# Kiến trúc Hệ thống NeuroAI Diagnostic

Tài liệu này mô tả chi tiết kiến trúc của hệ thống **NeuroAI Diagnostic** - Hệ Thống Hội Chẩn Khối U Não Đa Mô Hình, bao gồm luồng dữ liệu, các thành phần công nghệ và mô hình AI được sử dụng. Đây là tài liệu phục vụ việc trình bày và đánh giá trong quá trình Nghiên cứu Khoa học (NCKH).

## 1. Sơ đồ Kiến trúc Tổng thể (Architecture Diagram)

Dưới đây là sơ đồ luồng hoạt động của hệ thống từ giao diện người dùng đến các mô hình học sâu và hệ thống tác tử (Multi-Agent).

```mermaid
graph TD
    User([Bác sĩ / Người dùng]) --> Frontend[Giao diện Web Frontend]
    
    subgraph Frontend_Layer [Lớp Giao diện]
        Frontend
    end

    Frontend -->|Upload ảnh MRI| API_Predict[API: /predict]
    Frontend -->|Chat với Trợ lý| API_Chat[API: /chat]
    Frontend -->|Tạo Báo cáo| API_Report[API: /generate_clinical_report]
    Frontend -->|Dịch Báo cáo| API_Translate[API: /translate_for_patient]
    Frontend -->|Gửi phản hồi u| API_Feedback[API: /feedback]

    subgraph Backend_Layer [Lớp Backend - FastAPI]
        API_Predict
        API_Chat
        API_Report
        API_Translate
        API_Feedback
        API_Summarize[API: /summarize_meeting]
    end

    subgraph Core_AI_Models [Lớp Mô hình AI Cốt lõi]
        API_Predict --> Preprocess[OpenCV Preprocessing]
        Preprocess --> ResNet[ResNet50 + Risk Calibrated Loss]
        Preprocess --> YOLO[YOLOv8 Tumor Localization]
        ResNet --> GradCAM[Grad-CAM Heatmap]
        
        ResNet --> Consensus{Kiểm chéo\n(Cross-Validation)}
        YOLO --> Consensus
        Consensus -->|Đưa ảnh + kết quả| GeminiVision[Gemini 2.5 Flash Vision]
    end

    subgraph Multi_Agent_System [Hệ thống Multi-Agent]
        API_Report --> Agent1[Agent 1: Bác sĩ AI\nSoạn thảo báo cáo]
        API_Translate --> Agent2[Agent 2: Phiên dịch viên\nDịch thuật y khoa]
        API_Chat --> Agent3[Agent 3: Trợ lý Lâm sàng\nRAG Chatbot]
        API_Summarize --> Agent4[Agent 4: Thư ký Y khoa\nTóm tắt hội chẩn]
        Agent3 --> RAG[(RAG Context Engine\nTừ phác đồ QĐ 1514)]
    end
    
    GeminiVision -.-> API_Predict
    Agent1 -.-> API_Report
    Agent2 -.-> API_Translate
    Agent3 -.-> API_Chat

    subgraph Security_Data_Layer [Lớp Bảo mật & Lưu trữ]
        API_Chat --> Trap[Keyword Trap Filter]
        API_Report --> Masking[Data Masking / Chuẩn HIPAA]
        API_Chat --> AuditDB[(SQLite: audit_logs.db)]
        API_Feedback --> CSV[(CSV: feedback_log.csv)]
    end

    CSV --> ActiveLearning[Active Learning Pipeline]
    ActiveLearning -.->|Fine-tune mô hình| Core_AI_Models
```

---

## 2. Các Thành phần Chính của Hệ thống

### 2.1. Lớp Frontend (User Interface)
- **Công nghệ:** HTML/CSS/JS thuần, chạy qua `http.server` (Cổng 5500).
- **Chức năng:** 
  - Giao diện trực quan tải lên ảnh MRI.
  - Hiển thị kết quả chẩn đoán, độ tin cậy.
  - Vẽ Bounding Box (từ YOLO) và Heatmap (từ Grad-CAM) trực tiếp trên ảnh.
  - Khung chat cho phép Bác sĩ/Bệnh nhân tương tác với hệ thống.
  - Công cụ cho phép Bác sĩ chỉnh sửa lại Bounding Box nếu AI đoán sai.

### 2.2. Lớp Backend (API Gateway)
- **Công nghệ:** Python, FastAPI, Uvicorn (Cổng 8000).
- **Chức năng:** Cung cấp các RESTful APIs xử lý yêu cầu từ Frontend. Quản lý việc định tuyến tới các mô hình AI, xử lý logic kiểm chéo và gọi API Gemini.

### 2.3. Lớp AI Cốt lõi (Core AI Models)
Hệ thống sử dụng phương pháp chẩn đoán đa mô hình (Ensemble/Cross-Validation) thay vì tin tưởng vào một "hộp đen" duy nhất:
1. **Phân loại ảnh (Classification):** 
   - **Mô hình:** ResNet50.
   - **Đặc tả:** Phân loại 4 nhóm (Glioma, Meningioma, Pituitary, Normal).
   - **Điểm nhấn:** Sử dụng hàm mất mát tùy chỉnh **Risk-Calibrated Loss** nhằm phạt nặng hệ thống nếu phân loại sai khối u ác tính (Glioma) thành lành tính.
   - **Explainability:** Kết hợp **Grad-CAM** để làm nổi bật vùng điểm ảnh mà ResNet50 chú ý đến dưới dạng Heatmap.
2. **Khoanh vùng khối u (Localization):**
   - **Mô hình:** YOLOv8.
   - **Chức năng:** Độc lập tìm kiếm và vẽ hình chữ nhật (Bounding Box) bao quanh khối u trên ảnh MRI gốc.
3. **Kiểm chéo (Cross-Validation) & Hội chẩn:**
   - **Mô hình:** Gemini 2.5 Flash (Vision Capability).
   - **Logic:** Khi kết quả của ResNet50 và YOLOv8 có sự khác biệt (Phân kỳ), Backend sẽ tự động đẩy ảnh MRI kèm theo phân tích của 2 mô hình lên Gemini Vision. Gemini đóng vai trò như "Bác sĩ thứ 3" nhận định hình ảnh độc lập, đưa ra đánh giá đồng thuận hoặc phát cảnh báo chuyên môn.

### 2.4. Hệ thống Tác tử (Multi-Agent System)
Sử dụng LLM (Gemini) để tự động hóa các tác vụ lâm sàng phụ trợ:
- **Agent 1 (Bác sĩ AI):** Nhận kết quả từ mô hình học sâu để soạn thảo bản nháp Báo cáo Y tế theo chuẩn form (đã loại bỏ thông tin nhạy cảm qua Data Masking).
- **Agent 2 (Phiên dịch viên AI):** Nhận Báo cáo Y tế phức tạp và chuyển đổi sang ngôn ngữ đời thường, thấu cảm cho bệnh nhân.
- **Agent 3 (Trợ lý RAG Chatbot):** Hỗ trợ trả lời các câu hỏi y tế dựa trên công cụ RAG (Retrieval-Augmented Generation) lấy ngữ cảnh từ các phác đồ chuẩn (QĐ 1514).
- **Agent 4 (Thư ký Y khoa):** Tổng hợp và tóm tắt biên bản sau quá trình hội chẩn.

### 2.5. Lớp Bảo mật & Lưu trữ (Security & Database)
- **HIPAA Data Masking:** Băm (hash) ID bệnh nhân và ẩn tên (MASKED) trước khi gửi prompt lên API của Google.
- **Audit Logging:** Toàn bộ câu hỏi và câu trả lời AI đều được ghi lại trong cơ sở dữ liệu `audit_logs.db` (SQLite) nhằm phục vụ thanh tra y tế.
- **Keyword Traps:** Chặn đứng các câu hỏi nguy hiểm (như "tự tử", "đơn thuốc", "kê đơn") và từ chối dự đoán tuổi thọ.

### 2.6. Vòng lặp Học tăng cường (Active Learning)
- Hệ thống không dừng lại ở việc dự đoán mà còn có tính năng **học liên tục**.
- Khi mô hình dự đoán sai (đặc biệt là khối u khó), Bác sĩ có thể dùng Frontend khoanh lại hộp Bounding Box cho chuẩn.
- Dữ liệu này được lưu xuống `hard_examples/feedback_log.csv` và ảnh gốc để đội ngũ kỹ sư dùng script `fine_tune_active_learning.py` cập nhật, huấn luyện lại mô hình ngày càng thông minh hơn.

---

## 2.7. Hệ thống Đánh giá Hiệu năng (Benchmark System)
Dự án được trang bị sẵn một module benchmark toàn diện (`benchmark_models.py`) nhằm đo lường và đánh giá khách quan sức mạnh của các mô hình học sâu trước khi triển khai thực tế. Hệ thống này có khả năng tự động thực hiện các tác vụ sau:

- **Đánh giá Độ chính xác (Accuracy Metrics):** Tính toán các chỉ số chuyên sâu như Accuracy, Precision, Recall, Macro F1-Score và vẽ Biểu đồ Ma trận Nhầm lẫn (Confusion Matrix) cho từng mô hình (ResNet, DenseNet, EfficientNet...).
- **Đo lường Tài nguyên & Tốc độ (Performance Metrics):** Đo lường số lượng tham số (Parameters), thời gian nạp mô hình (Load Time), dung lượng file (MB), và đặc biệt là độ trễ suy luận (Inference Latency tính bằng ms/ảnh) để đảm bảo mô hình chạy mượt mà trên môi trường bệnh viện.
- **Đánh giá APIs ngoại vi:** Đo lường độ trễ phản hồi của các mô hình LLM từ Google (ví dụ: Gemini 2.5 Flash) để xem xét tính khả thi của hệ thống Multi-Agent theo thời gian thực.
- **Tự động hóa Báo cáo:** Tự động tạo biểu đồ so sánh trực quan và xuất báo cáo dưới dạng Markdown (`benchmark_report.md`) sau mỗi lần chạy.

---
*Tài liệu được tổng hợp tự động từ kiến trúc mã nguồn hiện tại của dự án.*
