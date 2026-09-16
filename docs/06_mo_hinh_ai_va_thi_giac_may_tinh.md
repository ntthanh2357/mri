# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP KỸ SƯ CÔNG NGHỆ THÔNG TIN
# CHƯƠNG 6: HỆ THỐNG TRỌNG TÀI ĐỒNG THUẬN ĐA MÔ HÌNH (MAICS) VÀ THỊ GIÁC MÁY TÍNH TRONG CHẨN ĐOÁN U NÃO MRI

---

## 6.1. ĐẶT VẤN ĐỀ VÀ THÁCH THỨC LÂM SÀNG TRONG CHẨN ĐOÁN HÌNH ẢNH U NÃO

Chẩn đoán hình ảnh u não trên phim chụp cộng hưởng từ (Magnetic Resonance Imaging - MRI) là một trong những bài toán phức tạp và thách thức nhất của thị giác máy tính y tế (Medical Computer Vision). Dù các mạng nơ-ron tích chập (CNN) và mô hình học sâu đơn lẻ đã đạt được nhiều tiến bộ trên các tập dữ liệu thực nghiệm lý tưởng, việc ứng dụng vào quy trình lâm sàng thực tế tại các bệnh viện Việt Nam vẫn vấp phải ba "điểm nghẽn" (bottlenecks) nghiêm trọng:

```
+-----------------------------------------------------------------------------------+
|               BA ĐIỂM NGHẼN CỐT LÕI CỦA AI CHẨN ĐOÁN U NÃO LÂM SÀNG               |
+-----------------------------------------------------------------------------------+
| 1. Dịch chuyển miền dữ liệu (Severe Scanner Domain Shifts)                        |
|    - Sự khác biệt về từ trường máy chụp (1.5 Tesla vs 3.0 Tesla của Siemens, GE). |
|    - Nhiễu cử động đầu và khác biệt về giao thức xung (T1, T2, FLAIR, T1C+).      |
+-----------------------------------------------------------------------------------+
| 2. Nguy cơ bỏ sót tổn thương ác tính tử vong (Fatal False Negative Risk)          |
|    - U thần kinh đệm ác tính (High-Grade Glioma) thâm nhiễm nhòe vào nhu mô não.  |
|    - Mô hình đơn lẻ dễ dự đoán nhầm Glioma thành "Không có u" (No-Tumor).         |
+-----------------------------------------------------------------------------------+
| 3. Tính chất hộp đen và thiếu khả năng giải thích (Opaque Black-Box Predictions)  |
|    - Bác sĩ Chẩn đoán hình ảnh (CĐHA) không thể tin cậy một xác suất trừu tượng.  |
|    - Cần định vị chính xác vị trí giải phẫu (Bounding Box) và ngữ cảnh lâm sàng.  |
+-----------------------------------------------------------------------------------+
```

Để khắc phục triệt để các hạn chế trên, đề tài không sử dụng một mô hình đơn lẻ mà nghiên cứu, phát triển và tích hợp hệ thống **MAICS (Multimodal AI Consensus System with Risk-Calibrated Decision Support and Spatial Localization)** — một kiến trúc trọng tài đồng thuận đa tầng kết hợp giữa học sâu phân loại, thị giác định vị không gian và mô hình ngôn ngữ - thị giác lớn (Vision-Language Model).

---

## 6.2. KIẾN TRÚC TRỌNG TÀI ĐỒNG THUẬN ĐA TẦNG (THREE-TIER ARBITRATION ARCHITECTURE)

Hệ thống **MAICS** trong [MRIteam_team5/MRIteam/main.py](file:///c:/Users/Administrator/OneDrive/Desktop/team5/MRIteam_team5/MRIteam/main.py) được xây dựng theo kiến trúc trọng tài 3 tầng phân cấp (Three-Tier Pipeline), dung hòa tối ưu giữa độ chính xác chẩn đoán, độ an toàn lâm sàng, chi phí tính toán và bảo vệ quyền riêng tư người bệnh:

```mermaid
graph TD
    classDef input fill:#0284c7,stroke:#0369a1,stroke-width:2px,color:#ffffff;
    classDef tier1 fill:#10b981,stroke:#047857,stroke-width:2px,color:#ffffff;
    classDef tier2 fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#ffffff;
    classDef guard fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:#ffffff;
    classDef tier3 fill:#8b5cf6,stroke:#6d28d9,stroke-width:2px,color:#ffffff;
    classDef output fill:#374151,stroke:#1f2937,stroke-width:2px,color:#ffffff;

    IN["📥 Ảnh MRI Sọ Não Đầu Vào (DICOM / PNG)"]:::input
    PRE["⚙️ Tiền Xử Lý: Otsu Auto-Crop + CLAHE + Khử Nhiễu"]:::input

    subgraph T1 ["Tầng 1: Bayesian CNN Soft-Voting Ensemble"]
        RES["ResNet50V2<br/>(Risk-Calibrated Loss, w=0.80)"]:::tier1
        EFF["EfficientNetV2<br/>(w=0.10)"]:::tier1
        DEN["DenseNet121<br/>(w=0.10)"]:::tier1
        BAY["Bayesian TTA (Ảnh gốc + Lật ngang)<br/>+ Temperature Scaling (T=1.3)"]:::tier1
    end

    subgraph T2 ["Tầng 2: YOLOv8 Spatial Localization"]
        YOLO["YOLOv8 Detection Head<br/>(Anchor-Free, Conf >= 0.35)"]:::tier2
        ROI["Trích xuất Bounding Box<br/>+ Adaptive Margin ROI Crop"]:::tier2
    end

    CHECK{"🔍 Có Xung Đột Chẩn Đoán?<br/>(c_BayTTA ≠ c_YOLO HOẶC Conf < 0.80 HOẶC Var > 0.15)"}

    subgraph GUARD_LAYER ["Lớp Bảo Vệ Quyền Riêng Tư & An Toàn Lâm Sàng"]
        PG["🛡️ Anatomical Privacy Guard<br/>(Nhận diện mặt cắt giải phẫu Axial)"]:::guard
        WHITELIST["🔒 True Whitelist Sanitizer<br/>(Khử bỏ chỉ dấu nhạy cảm trước khi ra Cloud)"]:::guard
    end

    subgraph T3 ["Tầng 3: Gemini 3.1 Flash-Lite VLM Trọng Tài"]
        VLM["Gemini 3.1 Flash-Lite VLM<br/>(Location-Grounded CoT Reasoning)"]:::tier3
    end

    OUT_T1["✅ Xuất Kết Quả Tầng 1<br/>(Đồng thuận cao - Không tốn phí API)"]:::output
    OUT_VLM["🏆 Xuất Kết Quả Phân Xử VLM<br/>(Kèm lập luận giải phẫu chi tiết)"]:::output

    IN --> PRE
    PRE --> RES & EFF & DEN
    RES & EFF & DEN --> BAY
    PRE --> YOLO --> ROI

    BAY -->|Dự đoán c_BayTTA, độ tin cậy Conf, phương sai Var| CHECK
    ROI -->|Dự đoán c_YOLO, hộp bao BBox| CHECK

    CHECK -- "KHÔNG (Đồng thuận)" --> OUT_T1
    CHECK -- "CÓ (Xung đột / Nghi ngờ)" --> PG

    PG -- "Mặt cắt Axial Chuẩn" --> WHITELIST --> VLM --> OUT_VLM
    PG -- "Mặt cắt Coronal/Sagittal (Lộ mặt/Ngoại trục)" -->|Chặn gửi Cloud| OUT_T1
```

### 6.2.1. Tầng 1: Tổ Hợp Mô Hình Bayesian CNN Ensemble (Soft-Voting with BayTTA)
Tầng 1 phụ trách việc phân loại nhanh và ước lượng độ không chắc chắn (Uncertainty Estimation). Để hạn chế nhược điểm thiên lệch cấu trúc của từng kiến trúc riêng rẽ, nhóm sử dụng bộ 3 mô hình học sâu bổ trợ lẫn nhau:
1. **ResNet50V2 (Mô hình Trọng Tâm - Chiếm trọng số 80%):** Huấn luyện với hàm mất mát **Cost-Sensitive Risk-Calibrated Loss** ($\mathcal{L}_{\text{risk}}$), phạt nặng theo hàm số mũ các trường hợp dự đoán sai u ác tính Glioma thành Không u:
   $$\mathcal{L}_{\text{risk}} = -\sum_{i} \alpha_i \cdot y_i \log(\hat{y}_i), \quad \text{với } \alpha_{\text{Glioma} \rightarrow \text{NoTumor}} = 5.0$$
2. **EfficientNetV2 (Trọng số 10%):** Tối ưu hóa hiệu năng trích xuất đặc trưng với khối tích chập Fused-MBConv, bổ sung góc nhìn về kết cấu vi mô.
3. **DenseNet121 (Trọng số 10%):** Cơ chế kết nối dày đặc (Dense Connectivity) bảo toàn tối đa dòng gradient và đặc trưng đa mức từ các tầng nông đến tầng sâu.

#### Cơ chế Tăng Cường Thời Gian Kiểm Thử Bayesian (Bayesian Test-Time Augmentation - BayTTA):
Nhằm triệt tiêu phương sai do hướng quét của đầu dò máy chụp, ảnh được dự đoán đồng thời trên ảnh gốc ($I_{\text{orig}}$) và ảnh lật đối xứng ngang trục não ($I_{\text{flip}}$). Trọng số tổng hợp giữa hai góc nhìn được tính thông qua entropy thông tin đảo nghịch:
$$\mathcal{H}(I) = -\sum_{k=1}^{4} P_k \log(P_k + \epsilon)$$
$$W_{\text{Bayesian}}(I) = \frac{\exp(-\mathcal{H}(I))}{\sum_{view} \exp(-\mathcal{H}(view))}$$
Kỹ thuật này giúp mô hình ưu tiên góc nhìn có độ không chắc chắn thấp nhất, giảm thiểu tối đa hiện tượng nhiễu ngẫu nhiên.

#### Hiệu Chuẩn Nhiệt Độ (Temperature Scaling):
Các mạng nơ-ron sâu thường mắc lỗi tự tin thái quá (Overconfidence). Nhóm áp dụng kỹ thuật Temperature Scaling với tham số tối ưu $T = 1.3$ trên logits trước khi đưa qua hàm Softmax:
$$\hat{P}_k = \frac{\exp(z_k / T)}{\sum_{j} \exp(z_j / T)}$$

---

### 6.2.2. Tầng 2: Thị Giác Định Vị Tổn Thương Không Gian YOLOv8 (Spatial Localization)
Tầng 2 chịu trách nhiệm giải quyết bài toán: *"Khối u nằm ở đâu và có thực sự tồn tại tổn thương khu trú hay không?"*.
Nhóm sử dụng mô hình **YOLOv8 Anchor-Free Detection Head** được huấn luyện chuyên biệt trên tập dữ liệu ảnh MRI có nhãn bounding box:
- **Ngưỡng tin cậy (Confidence Threshold):** $0.35$.
- **Hàm mất mát hộp bao:** Kết hợp Complete IoU ($\mathcal{L}_{\text{CIoU}}$) và Distribution Focal Loss ($\mathcal{L}_{\text{DFL}}$).

#### Thuật Toán Cắt Vùng Quan Tâm Thích Ứng (Adaptive Margin ROI Crop):
Kích thước khối u não biến thiên rất lớn. Việc cắt cứng (fixed margin) sẽ làm mất ngữ cảnh xung quanh đối với u nhỏ hoặc làm dính xương sọ đối với u lớn. Thuật toán `adaptive_roi_crop` tính tỷ lệ diện tích tương đối $R = \frac{w \cdot h}{W_{\text{img}} \cdot H_{\text{img}}}$:
- Nếu $R < 0.05$ (u vi thể/kích thước nhỏ): Mở rộng lề $40\%$ để lấy thêm ngữ cảnh chất trắng/chất xám bao quanh.
- Nếu $R > 0.30$ (u kích thước lớn chiếm bán cầu): Chỉ mở rộng $10\%$ để tránh lấy phải cấu trúc xương sọ và da đầu.
- Ngược lại: Mở rộng biên an toàn $25\%$.

#### Suy Luận Vị Trí Giải Phẫu Tiên Nghiệm (Anatomical Location Prior):
Hàm `infer_anatomical_location` trích xuất tọa độ tâm chuẩn hóa $(c_x, c_y)$ của hộp bao để cung cấp tiên nghiệm y học:
- Vùng hố yên/trên yên ($0.35 < c_x < 0.65$ và $c_y > 0.45$): Tiên nghiệm cao về **U tuyến yên (Pituitary Adenoma)**.
- Vùng liềm não, vòm sọ ngoại vi ($c_x < 0.15$ hoặc $c_x > 0.85$ hoặc $c_y < 0.10$ hoặc $c_y > 0.90$): Tiên nghiệm cao về **U màng não (Meningioma)**.
- Vùng chất trắng sâu / trong trục nhu mô não: Tiên nghiệm cao về **U thần kinh đệm (Glioma)**.

---

### 6.2.3. Tầng 3: Trọng Tài VLM Định Vị Đa Mô Thức (Gemini 3.1 Flash-Lite VLM Arbitration)
Thay vì gọi mô hình đám mây một cách bừa bãi gây tốn kém chi phí và chậm trễ hệ thống, Tầng 3 hoạt động theo cơ chế **Kích hoạt dựa trên Xung đột (Conflict-Driven Gating)**:
1. **Trường hợp 1 (Báo động Đỏ):** Tầng 1 (CNN) báo Bình thường (No-Tumor) nhưng Tầng 2 (YOLOv8) phát hiện có khối u $\rightarrow$ Nguy cơ bỏ sót tổn thương ác tính: **BẮT BUỘC 100% kích hoạt VLM**.
2. **Trường hợp 2:** Tầng 1 phát hiện có u nhưng Tầng 2 không tìm thấy hộp bao $\rightarrow$ Chỉ kích hoạt VLM khi độ tin cậy Tầng 1 thấp ($< 0.80$) hoặc phương sai bất định cao ($\text{Var} > 0.15$).
3. **Trường hợp 3:** Cả hai cùng thấy có u nhưng bất đồng về nhóm bệnh (ví dụ: CNN báo Glioma, YOLO báo Meningioma) $\rightarrow$ Kích hoạt VLM khi độ tin cậy $< 0.80$.

Khi được kích hoạt, VLM nhận đồng thời:
- Lát cắt toàn cảnh não (Global Context).
- Vùng cắt phóng đại ROI khối u do YOLOv8 trích xuất (Local Zoom).
- Tiên nghiệm vị trí giải phẫu và độ tin cậy của các mô hình cơ sở.
- Chuỗi suy luận định hướng y khoa (Anatomical Chain-of-Thought - CoT) để đưa ra phán quyết độc lập cuối cùng.

---

## 6.3. BỘ LỌC BẢO VỆ QUYỀN RIÊNG TƯ & AN TOÀN GIẢI PHẪU (ANATOMICAL PRIVACY GUARD)

Một phát hiện quan trọng trong nghiên cứu thực nghiệm lâm sàng là: Các lát cắt chụp hướng **Coronal (Mặt phẳng đứng ngang)** và **Sagittal (Mặt phẳng đứng dọc)** thường hiển thị rõ cấu trúc khuôn mặt (mắt, mũi, xương hàm) của người bệnh, đồng thời chứa nhiều cấu trúc giải phẫu ngoài sọ gây "ảo giác" (hallucination) nghiêm trọng cho các mô hình VLM tổng quát.

Phân hệ **Anatomical Privacy Guard** ([localization.py](file:///c:/Users/Administrator/OneDrive/Desktop/team5/MRIteam_team5/MRIteam/localization.py#L35)) thực hiện kiểm duyệt tự động:
1. **Nhận diện mặt phẳng chụp:** Tự động phân loại lát cắt thuộc hướng Axial (mặt cắt ngang qua đỉnh đầu) hay mặt phẳng ngoại trục (Coronal/Sagittal).
2. **Cơ chế đóng cổng truyền tải đám mây (Cloud Transmission Blocking):**
   - Nếu phát hiện lát cắt là **Coronal** hoặc **Sagittal**: Hệ thống lập tức phong tỏa lệnh gửi ảnh ra Internet, giữ nguyên kết quả chẩn đoán nội bộ của Tầng 1 (CNN Ensemble).
   - Cơ chế này giúp tuân thủ nghiêm ngặt **Luật Khám bệnh, chữa bệnh 2023** và **Nghị định 13/2023/NĐ-CP** về bảo vệ dữ liệu sinh trắc học cá nhân.
3. **Hiệu quả thực nghiệm:** Anatomical Privacy Guard giúp **giảm 79.5% số lượng cuộc gọi API đám mây** (từ $12.14\%$ tổng số ca chụp xuống chỉ còn $2.48\%$), vừa tiết kiệm chi phí vận hành cho bệnh viện, vừa loại bỏ hoàn toàn các ca phân xử sai do ảo giác khuôn mặt.

---

## 6.4. KHỬ ĐỊNH DANH ẢNH Y TẾ THEO TIÊU CHUẨN HIPAA SAFE HARBOR

Nhằm đảm bảo an toàn tuyệt đối trước khi bất kỳ dữ liệu hình ảnh nào được xử lý hoặc lưu trữ:
1. **Làm Sạch 18 Nhóm Định Danh Cá Nhân (HIPAA §164.514(b)(2)):**
   - Tự động bóc tách toàn bộ thẻ DICOM Header nhạy cảm: Tên bệnh nhân (0010,0010), Ngày sinh (0010,0030), Mã số bệnh án (0010,0020), Tên cơ sở y tế (0008,0080), Tên bác sĩ chụp (0008,1050), Số serial máy chụp (0018,1000).
2. **Gom Nhóm Tuổi Cao (Age Bucketing 90+):**
   - Mọi bệnh nhân có độ tuổi từ 90 trở lên đều được chuẩn hóa thành danh mục duy nhất `'90+'` để loại bỏ nguy cơ tái định danh thống kê cá nhân hiếm hoi theo chuẩn y tế Hoa Kỳ.
3. **Cơ Chế True Whitelist Sanitizer:**
   - Trước khi gửi thông tin tóm tắt sang tầng VLM hoặc API ngoài, mọi trường dữ liệu nhạy cảm mới (như đột biến di truyền hiếm `brafV600e`, `h3k27m`) nếu không nằm trong danh mục Whitelist được phê duyệt đều bị hệ thống tự động thanh lọc 100%.

---

## 6.5. QUY TRÌNH TIỀN XỬ LÝ ẢNH MRI SỌ NÃO CHUYÊN SÂU (PREPROCESSING PIPELINE)

Quy trình tiền xử lý được hiện thực hóa trong [preprocess.py](file:///c:/Users/Administrator/OneDrive/Desktop/team5/MRIteam_team5/MRIteam/preprocess.py) bao gồm 5 công đoạn kế tiếp nhau:

```
[ Ảnh MRI Thô ]
       │
       ▼
1. Phân ngưỡng Otsu & Tự động cắt viền (Auto-Crop Contour)
   -> Loại bỏ toàn bộ viền đen vô nghĩa xung quanh hộp sọ, tối ưu hóa vùng đệm.
       │
       ▼
2. Khử nhiễu Gauss thích ứng (Adaptive Gaussian Denoising)
   -> Giảm thiểu nhiễu từ trường (Rician noise) sinh ra trong quá trình thu nhận tín hiệu RF.
       │
       ▼
3. Cân bằng độ tương phản cục bộ CLAHE (Contrast Limited Adaptive Histogram Equalization)
   -> Giới hạn clip limit = 2.0, tileGridSize = (8, 8), làm rõ ranh giới khối u nằm sâu trong chất trắng.
       │
       ▼
4. Chuẩn hóa cường độ điểm ảnh (Min-Max Intensity Normalization)
   -> Chuyển đổi dải giá trị nguyên [0, 255] về dải số thực chuẩn hóa [0.0, 1.0].
       │
       ▼
5. Co giãn bảo toàn tỷ lệ khung hình (Letterbox Resize)
   -> Đưa ảnh về kích thước chuẩn 224x224x3 (CNN) và 640x640x3 (YOLO) có padding đối xứng.
```

---

## 6.6. ĐÁNH GIÁ THỰC NGHIỆM VÀ BENCHMARK LÂM SÀNG ĐỘC LẬP

Hệ thống được đánh giá trên tập kiểm thử độc lập theo bệnh nhân (**Patient-Level Split Benchmark**) gồm **3.461 ảnh lát cắt MRI sọ não** (trong đó có **1.861 ảnh lâm sàng thực tế thu thập từ Bệnh viện Đa khoa Tâm Trí Đà Nẵng** và 1.600 ảnh từ bộ dữ liệu chuẩn quốc tế).

### 6.6.1. Bảng So Sánh Hiệu Năng Các Cấu Hình Hệ Thống

| Cấu hình Hệ thống / Mô hình | Độ chính xác (Accuracy) | Macro F1-Score | Độ nhạy U ác tính (Glioma Recall) | Tỷ lệ bỏ sót u chết người (Fatal FNR) | Tỷ lệ gọi API VLM Cloud | Trạng thái Bộ lọc An toàn |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **MAICS (Guard-ON - Đề xuất)** | **91.01%** | **92.04%** | **90.31%** | **0.43%** | **2.48%** | ✅ Kích hoạt (Guard 1 & 2) |
| **MAICS (Guard-OFF)** | 91.07% | 91.96% | 90.05% | 0.68% | 12.14% | ❌ Tắt bộ lọc |
| **Tầng 1: Bayesian CNN Ensemble** | 89.92% | 90.96% | 84.75% | 0.85% | 0.00% | N/A (Chỉ chạy nội bộ) |
| **ViT-Tiny (Vision Transformer)** | 67.44% | 65.10% | 45.30% | 3.12% | 0.00% | Bị Overfitting |
| **Custom CNN (Huấn luyện từ đầu)**| 25.25% | 21.05% | 12.50% | 8.40% | 0.00% | Kém hội tụ |

> **Ý nghĩa chỉ số Fatal FNR (Fatal False Negative Rate):**
> Trong chẩn đoán u não, sai lầm nghiêm trọng nhất là phân loại một khối u thần kinh đệm ác tính (Glioma) thành người bình thường (No-Tumor). Sai lầm này tước đoạt cơ hội điều trị trong giai đoạn vàng của bệnh nhân. Kiến trúc MAICS với cơ chế trọng tài đa tầng đã kéo giảm tỷ lệ nguy hiểm chết người này từ **0.85% (ở Tầng 1)** xuống chỉ còn **0.43%** — tương đương mức **giảm thiểu rủi ro lâm sàng tương đối lên tới 49.4%**.

### 6.6.2. Kiểm Định Ý Nghĩa Thống Kê (McNemar's Test)
Kiểm định phi tham số McNemar đối chứng trực tiếp giữa MAICS và mô hình Ensemble CNN cơ sở:
- Giá trị thống kê $\chi^2 = 19.72$.
- $p\text{-value} = 0.000009 \ll 0.001$.
- **Kết luận:** Hệ thống MAICS vượt trội có ý nghĩa thống kê cực kỳ rõ rệt ở mức tin cậy $99.99\%$.

### 6.6.3. Phân Tích Độ Trễ Thời Gian Thực (Inference Latency)
Đo lường trên máy chủ thử nghiệm (GPU NVIDIA RTX 3060 12GB VRAM & CPU Intel Core i7-12700H):
- **Thời gian suy luận thuần Tầng 1 (Ensemble CNN + BayTTA):** $42.1\text{ ms}$ / lát cắt.
- **Thời gian định vị Tầng 2 (YOLOv8 Detection):** $18.5\text{ ms}$ / lát cắt.
- **Tổng thời gian xử lý nội bộ (Ngoại tuyến - Offline Path):** $\approx 95\text{ ms}$ (đáp ứng trọn vẹn yêu cầu hiển thị tức thì trên trạm đọc phim Mini-PACS của Bác sĩ CĐHA).
- **Thời gian gọi Trọng tài VLM Tầng 3 (khi có xung đột):** $\approx 710\text{ ms}$ (nhờ việc Anatomical Privacy Guard đã chặn bớt $79.5\%$ ca không cần thiết, tốc độ chung của toàn hệ thống hoàn toàn không bị ảnh hưởng).

---

## 6.7. THẨM ĐỊNH TÍNH NHẤT QUÁN CHỈ DẤU SINH HỌC PHÂN TỬ THEO CHUẨN WHO CNS5 (2021)

Phân loại u hệ thần kinh trung ương phiên bản 5 của Tổ chức Y tế Thế giới (WHO CNS5 2021) đòi hỏi chẩn đoán xác định u não phải kết hợp giữa mô bệnh học và các chỉ dấu sinh học phân tử (Integrated Molecular Diagnosis). Hệ thống tích hợp module thẩm định tự động:
1. **Đột biến IDH (IDH1/IDH2):** Phân định rạch ròi giữa U thần kinh đệm đột biến IDH (Astrocytoma / Oligodendroglioma - tiên lượng tốt hơn) và U nguyên bào đệm Glioblastoma IDH-hoang dại (IDH-wildtype - ác tính cao nhất).
2. **Trạng thái Methyl hóa vùng khởi động gen MGMT (MGMT Promoter Methylation):** Chỉ dấu tiên lượng đáp ứng nhạy cảm với hóa chất Temozolomide (phác đồ Stupp).
3. **Mất đoạn đồng thời nhánh nhiễm sắc thể 1p/19q (1p/19q codeletion):** Tiêu chuẩn vàng để chẩn đoán xác định Oligodendroglioma.
4. **Hệ thống cảnh báo mâu thuẫn sinh học (Biological Inconsistency Warning):** Nếu kết quả giải phẫu bệnh ghi nhận "Oligodendroglioma" nhưng cờ `1p/19q codeletion: false`, hệ thống lập tức phát cờ cảnh báo bất thường để hội đồng Tumor Board đánh giá lại.

---

## 6.8. PHÂN HỆ HỖ TRỢ RA QUYẾT ĐỊNH LÂM SÀNG (RULE-BASED CDSS) VÀ TRUY VẾT KIỂM TOÁN

1. **Nguyên Tắc Thiết Kế Tất Định (Deterministic Guidance):**
   - Cơ chế truy xuất khuyến cáo hoạt động theo mô hình quy tắc chuyên gia (Rule-based CDSS) xây dựng trực tiếp từ **Quyết định số 1514/QĐ-BYT của Bộ Y Tế** (Hướng dẫn chẩn đoán và điều trị một số bệnh ung bướu) và WHO CNS 2021.
   - Cung cấp phác đồ chuẩn: Phẫu thuật u thần kinh đệm kết hợp hóa chất Temozolomide; Phẫu thuật vi phẫu cắt u màng não theo thang điểm Simpson; Liệu pháp đồng vận Dopamine cho u tuyến yên; Xử trí cấp cứu phù não tăng áp lực nội sọ bằng Dexamethasone và Mannitol $20\%$.
   - Loại bỏ hoàn toàn nguy cơ ảo giác đơn thuốc, nghiêm cấm chỉ định liều lượng vượt thẩm quyền của trợ lý AI.
2. **Cơ Chế Lưu Vết Kiểm Toán An Toàn Y Tế (Medical Audit Logs):**
   - Mọi câu hỏi, hình ảnh chẩn đoán, khuyến cáo AI và danh tính bác sĩ thao tác (`doctor_id`) đều được tự động ghi nhận vào cơ sở dữ liệu SQLite cục bộ `audit_logs.db` tại [main.py](file:///c:/Users/Administrator/OneDrive/Desktop/team5/MRIteam_team5/MRIteam/main.py#L135-L162).
   - Cơ chế này phục vụ công tác hồi cứu bệnh án, đối soát trách nhiệm pháp lý khi có tai biến y khoa và đảm bảo tính minh bạch theo quy chuẩn bệnh viện điện tử EMR cấp độ 6 của Bộ Y Tế Việt Nam.
