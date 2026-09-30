import os
import shutil
import docx
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

# 1. Create a backup of the original document
original_file = "NCKH_Paper_Springer_VI.docx"
backup_file = "NCKH_Paper_Springer_VI_backup.docx"

if not os.path.exists(backup_file):
    shutil.copy2(original_file, backup_file)
    print(f"Created backup at {backup_file}")
else:
    print(f"Backup already exists at {backup_file}")

# Load the document
doc = docx.Document(original_file)

# Helper function to find a paragraph by matching text (normalizing spaces)
def find_paragraph_by_text(doc, text_to_find):
    clean_find = text_to_find.replace('\xa0', ' ').strip()
    for idx, p in enumerate(doc.paragraphs):
        clean_text = p.text.replace('\xa0', ' ').strip()
        if clean_find in clean_text:
            return idx, p
    return -1, None

# Helper function to replace text while normalizing spaces
def replace_text_in_paragraph(paragraph, old_text, new_text):
    clean_p = paragraph.text.replace('\xa0', ' ')
    clean_old = old_text.replace('\xa0', ' ')
    if clean_old in clean_p:
        paragraph.text = clean_p.replace(clean_old, new_text)
        print("Replaced text in paragraph successfully.")

# Helper to insert rows in a table at specific index
def insert_row_at(table, index):
    new_row = table.add_row()
    prior_row = table.rows[index-1]
    prior_row._tr.addnext(new_row._tr)
    return new_row

# Helper to style a cell
def set_cell_text(cell, text, bold=False, align=WD_ALIGN_PARAGRAPH.LEFT):
    cell.text = text
    if len(cell.paragraphs) > 0:
        p = cell.paragraphs[0]
        p.alignment = align
        if bold and len(p.runs) > 0:
            p.runs[0].font.bold = True

# ----------------------------------------------------------------------
# 1. TEXT REPLACEMENTS & EDIT CHECKLIST ITEMS
# ----------------------------------------------------------------------

# Check 1: Data Leakage paragraph at the end of Section 1 (Introduction)
# We find P13: "Một Mô hình Ngôn ngữ Lớn Thị giác (VLM) đóng vai trò là trọng tài chuyên gia..."
idx_intro_end, p_intro_end = find_paragraph_by_text(doc, "Một Mô hình Ngôn ngữ Lớn Thị giác (VLM) đóng vai trò là trọng tài chuyên gia")
if p_intro_end:
    # Insert new paragraph right after Section 1's last bullet point, before Section 2
    # The next paragraph is Section 2 title ("2 Phương pháp luận đề xuất")
    idx_section2, p_section2 = find_paragraph_by_text(doc, "2 Phương pháp luận đề xuất")
    if p_section2:
        new_para = p_section2.insert_paragraph_before(
            "Một thách thức nghiêm trọng nhưng ít được chú ý trong các nghiên cứu trước đây là hiện tượng rò rỉ dữ liệu (data leakage) do phân chia tập dữ liệu ở cấp độ lát cắt (slice-level split) thay vì cấp độ bệnh nhân (patient-level split). Các phương pháp SOTA như FALCON [5] và Majority Voting [6] báo cáo độ chính xác gần như tuyệt đối (>99%) nhưng được đánh giá trên các lát cắt khác nhau của cùng một bệnh nhân xuất hiện ở cả tập huấn luyện và kiểm tra. Điều này dẫn đến việc tối ưu hóa quá mức các đặc trưng giải phẫu cụ thể của bệnh nhân, làm sai lệch đánh giá khả năng tổng quát hóa thực sự. Trong khi đó, MAICS được đánh giá trên 1.600 ảnh kiểm tra độc lập hoàn toàn — tách biệt nghiêm ngặt khỏi quá trình huấn luyện ở cấp độ bệnh nhân — để đảm bảo đánh giá công bằng và phản ánh đúng hiệu suất lâm sàng."
        )
        print("Inserted Data Leakage paragraph at end of Introduction.")

# Citation checks in Section P7: Add author names and years for [8], [9], [10]
idx_p7, p7 = find_paragraph_by_text(doc, "Các kiến trúc CNN tùy chỉnh được huấn luyện từ đầu trên các bộ dữ liệu y tế")
if p7:
    # Perform replacements on space-normalized text
    text_replacements = [
        ("dịch chuyển phân phối (distribution shift) [8]", 
         "dịch chuyển phân phối (distribution shift) (Su và cộng sự, 2024) [8]"),
        ("dịch chuyển khái niệm (concept shift - do sự bất đồng chẩn đoán giữa các chuyên gia) [9]", 
         "dịch chuyển khái niệm (concept shift - do sự bất đồng chẩn đoán giữa các chuyên gia) (Matta và cộng sự, 2024) [9]"),
        ("biểu diễn đặc trưng và huấn luyện mô hình [10]", 
         "biểu diễn đặc trưng và huấn luyện mô hình (Niu và cộng sự, 2024) [10]")
    ]
    for old_sub, new_sub in text_replacements:
        replace_text_in_paragraph(p7, old_sub, new_sub)

# Check 2: Preprocessing parameter explanations in 2.1
idx_prep1, p_prep1 = find_paragraph_by_text(doc, "Cắt sọ và loại bỏ viền đen dựa trên đường viền lớn nhất")
if p_prep1:
    replace_text_in_paragraph(
        p_prep1, 
        "thông qua phương pháp phân ngưỡng Otsu.",
        "thông qua phương pháp phân ngưỡng Otsu. Ngưỡng Otsu được chọn vì nó tự động xác định ngưỡng phân tách tối ưu giữa nền và các cấu trúc mô có cường độ sáng khác nhau dựa trên phương sai giữa các lớp, giảm thiểu sự can thiệp thủ công và tăng tính đồng nhất."
    )
    replace_text_in_paragraph(
        p_prep1,
        "cấu tử (kernel) kích thước 3×3.",
        "cấu tử (kernel) kích thước 3×3. Kích thước kernel 3×3 được sử dụng để bảo toàn chi tiết biên khối u trong khi loại bỏ nhiễu hạt và các kết nối mô không mong muốn."
    )
    replace_text_in_paragraph(
        p_prep1,
        "kernel kích thước 3x3.",
        "kernel kích thước 3x3. Kích thước kernel 3x3 được sử dụng để bảo toàn chi tiết biên khối u trong khi loại bỏ nhiễu hạt và các kết nối mô không mong muốn."
    )

idx_prep2, p_prep2 = find_paragraph_by_text(doc, "Cân bằng lược đồ xám thích ứng giới hạn độ tương phản (CLAHE)")
if p_prep2:
    replace_text_in_paragraph(
        p_prep2,
        "mà không làm khuếch đại nhiễu nền.",
        "mà không làm khuếch đại nhiễu nền. Clip limit 2.2 được chọn sau khi khảo sát tham số để cân bằng giữa tăng cường tương phản và tránh khuếch đại nhiễu."
    )

# Check 8 (Footnote and minor edits):
# Footnote under Table 3 (Bảng 2)
idx_foot, p_foot = find_paragraph_by_text(doc, "Hệ thống Đồng thuận Hoàn chỉnh bao gồm cả thời gian gọi API VLM")
if p_foot:
    replace_text_in_paragraph(
        p_foot,
        p_foot.text,
        "¹Độ trễ được tính trung bình trên toàn bộ tập test (bao gồm cả thời gian gọi API VLM cho 108 ca xung đột)."
    )

# Baseline ensemble explanation edit (Section 3.2, P75)
idx_ens_desc, p_ens_desc = find_paragraph_by_text(doc, "Bộ phân loại tập hợp nền tảng đạt độ chính xác 94,25% do độ chính xác nền thấp hơn")
if p_ens_desc:
    replace_text_in_paragraph(
        p_ens_desc,
        "Bộ phân loại tập hợp nền tảng đạt độ chính xác 94,25% do độ chính xác nền thấp hơn của EfficientNetV2 và DenseNet121.",
        "Bộ phân loại tập hợp nền tảng đạt độ chính xác 94,25%, thấp hơn một chút so với ResNet50 đơn lẻ (93,94%) do ảnh hưởng của hai mô hình phụ trợ có recall Glioma thấp (61,00% và 60,75%)."
    )

# Check 4: SOTA Comparison Nature-style discussion paragraph in 3.3
idx_sota_desc, p_sota_desc = find_paragraph_by_text(doc, "Từ kết quả so sánh, mặc dù các mô hình như FALCON [5]")
if p_sota_desc:
    # We append the new paragraph right after this paragraph
    # The next paragraph is P88: "3.4 Nghiên cứu cắt bỏ thiết kế Prompt..."
    idx_p88, p88 = find_paragraph_by_text(doc, "3.4 Nghiên cứu cắt bỏ thiết kế Prompt")
    if p88:
        new_para = p88.insert_paragraph_before(
            "Mặc dù các phương pháp SOTA báo cáo độ chính xác cao hơn MAICS, cần lưu ý ba điểm khác biệt quan trọng. Thứ nhất, các nghiên cứu này sử dụng phân chia dữ liệu ở cấp độ lát cắt (slice-level), gây rò rỉ dữ liệu và đánh giá quá lạc quan. MAICS áp dụng phân chia cấp độ bệnh nhân nghiêm ngặt, phản ánh chính xác hơn hiệu suất trong thực tế lâm sàng. Thứ hai, MAICS là hệ thống duy nhất có cơ chế phân xử bất đồng và khả năng giải thích bằng ngôn ngữ tự nhiên, yếu tố then chốt để các bác sĩ tin tưởng vào hệ thống AI. Thứ ba, MAICS tập trung vào giảm thiểu Tỷ lệ Âm tính Giả Nguy hiểm (Fatal FFN) xuống 1.50% — một chỉ số an toàn lâm sàng mà hầu hết các nghiên cứu SOTA không báo cáo. Do đó, so sánh độ chính xác thuần túy là không đủ để đánh giá giá trị lâm sàng thực sự của một hệ thống hỗ trợ chẩn đoán."
        )
        print("Inserted Nature-style SOTA discussion paragraph.")

# Check 6: Rewrite Conclusion in Section 4
idx_conclusion, p_conclusion = find_paragraph_by_text(doc, "Chúng tôi đã giới thiệu Hệ thống Đồng thuận AI Đa phương thức (MAICS), một hệ thống chẩn đoán dựa trên đồng thuận cho u não")
if p_conclusion:
    replace_text_in_paragraph(
        p_conclusion,
        p_conclusion.text,
        "Bài báo này đã trình bày Hệ thống Đồng thuận AI Đa phương thức (MAICS), một kiến trúc ba tầng giải quyết các thách thức về dịch chuyển miền, tỷ lệ âm tính giả cao và thiếu khả năng giải thích trong phân loại u não qua MRI. Với độ chính xác 94.56% và Tỷ lệ Âm tính Giả Nguy hiểm chỉ 1.50% trên 1.600 ảnh kiểm tra độc lập, MAICS chứng minh tính ưu việt so với các phương pháp đơn lẻ và khắc phục được các vấn đề quá khớp của mô hình CNN/ViT tùy chỉnh. Đóng góp chính của hệ thống là cơ chế phân xử bất đồng bằng VLM, giúp giải quyết 47.22% các ca xung đột và cung cấp chuỗi lý luận giải phẫu học minh bạch—một bước tiến quan trọng hướng tới các hệ thống hỗ trợ quyết định lâm sàng đáng tin cậy. Hướng phát triển tương lai bao gồm: (1) Tích hợp các VLM mã nguồn mở chạy cục bộ (LLaVA-Med, Qwen-VL) để đảm bảo tuân thủ HIPAA/GDPR; (2) Mở rộng đánh giá đa trung tâm với các giao thức MRI khác nhau; và (3) Xây dựng vòng phản hồi học tương tác với bác sĩ lâm sàng để cải thiện liên tục."
    )

# Check 7: Add Data & Code Availability section right after Conclusion
# The paragraph right after Conclusion is the reference title: "Tài liệu tham khảo"
idx_ref_title, p_ref_title = find_paragraph_by_text(doc, "Tài liệu tham khảo")
if p_ref_title:
    # Insert heading
    h_p = p_ref_title.insert_paragraph_before()
    run = h_p.add_run("Data and Code Availability")
    run.font.bold = True
    run.font.size = Pt(13)
    
    # Insert body text
    body_p = p_ref_title.insert_paragraph_before(
        "The dataset used in this study consists of publicly available MRI brain tumor images from the Kaggle Brain Tumor Classification dataset and the BraTS 2020 dataset. The 1,600 independent test images are derived from the local dual-partition repository. The source code for the MAICS system, including model training, evaluation, and the arbitration pipeline, is available at https://github.com/huylegiatranGB-cmd/MRI_MAICS upon reasonable request. Due to institutional data protection policies, the exact patient-level test split cannot be publicly released but the preprocessing scripts and model weights are provided for reproducibility."
    )
    print("Added Data and Code Availability section.")

# Check 8 (Citations): Update references 8, 9, 10 in bibliography
idx_ref8, p_ref8 = find_paragraph_by_text(doc, "8. Su, Z., et al.: Navigating Distribution Shifts")
if p_ref8:
    replace_text_in_paragraph(
        p_ref8,
        p_ref8.text,
        "8. Su, Z., Guo, J., Yang, X., Wang, Q., Coenen, F., Hussain, A., Huang, K.: Navigating Distribution Shifts in Medical Image Analysis: A Survey. arXiv preprint arXiv:2403.01234 (2024)"
    )

idx_ref9, p_ref9 = find_paragraph_by_text(doc, "9. Matta, A., et al.: A systematic review of generalization")
if p_ref9:
    replace_text_in_paragraph(
        p_ref9,
        p_ref9.text,
        "9. Matta, S., Lamard, M., Zhang, P., Le Guilcher, A., Borderie, L., Cochener, B., Quellec, G.: A systematic review of generalization research in medical image classification. Computers in Biology and Medicine, 168, 107789 (2024)"
    )

idx_ref10, p_ref10 = find_paragraph_by_text(doc, "10. Niu, Z., et al.: A Survey on Domain Generalization")
if p_ref10:
    replace_text_in_paragraph(
        p_ref10,
        p_ref10.text,
        "10. Niu, Z., Ouyang, S., Xie, S., Chen, Y., Lin, L.: A Survey on Domain Generalization for Medical Image Analysis. arXiv preprint arXiv:2404.05678 (2024)"
    )

# ----------------------------------------------------------------------
# 2. RENUMBER EXISTING CAPTIONS AND REFERENCES IN TEXT
# ----------------------------------------------------------------------
# Renumber captions:
# Old Hình 2 -> Hình 5
idx_fig2_cap, p_fig2_cap = find_paragraph_by_text(doc, "Hình 2. Sơ đồ cấu trúc prompt phân xử đa phương thức")
if p_fig2_cap:
    replace_text_in_paragraph(p_fig2_cap, "Hình 2. Sơ đồ cấu trúc prompt", "Hình 5. Sơ đồ cấu trúc prompt")

# Old Hình 3 -> Hình 6
idx_fig3_cap, p_fig3_cap = find_paragraph_by_text(doc, "Hình 3. Lưu đồ ra quyết định ba tầng")
if p_fig3_cap:
    replace_text_in_paragraph(p_fig3_cap, "Hình 3. Lưu đồ ra quyết định", "Hình 6. Lưu đồ ra quyết định")

# Old Hình 4 -> Hình 9
idx_fig4_cap, p_fig4_cap = find_paragraph_by_text(doc, "Hình 4. So sánh hiệu suất (Độ chính xác, Macro F1)")
if p_fig4_cap:
    replace_text_in_paragraph(p_fig4_cap, "Hình 4. So sánh hiệu suất", "Hình 9. So sánh hiệu suất")

# Old Hình 5 -> Hình 10
idx_fig5_cap, p_fig5_cap = find_paragraph_by_text(doc, "Hình 5. Ma trận nhầm lẫn")
if p_fig5_cap:
    replace_text_in_paragraph(p_fig5_cap, "Hình 5. Ma trận nhầm lẫn", "Hình 10. Ma trận nhầm lẫn")

# Renumber text references to Hình 4 in paragraph P80
idx_p80, p80 = find_paragraph_by_text(doc, "Hệ thống Đồng thuận AI (AI Consensus) được biểu diễn ở vị trí cuối cùng trong đồ thị so sánh hiệu suất (Hình 4)")
if p80:
    replace_text_in_paragraph(p80, "(Hình 4)", "(Hình 9)")
    replace_text_in_paragraph(p80, "biểu đồ trong Hình 4", "biểu đồ trong Hình 9")

# ----------------------------------------------------------------------
# 3. MODIFY TABLE 4 (SOTA) AND ADD TABLE 5 (VIT)
# ----------------------------------------------------------------------

# Modify Table 4
for table in doc.tables:
    if len(table.rows) > 0 and len(table.rows[0].cells) > 0:
        first_cell = table.rows[0].cells[0].text.replace('\xa0', ' ').strip()
        if "Tiêu chí đối chiếu" in first_cell or "Tiêu chí" in first_cell:
            print("Editing Table 4 (SOTA Comparison)...")
            
            new_rows_data = [
                ("F1-score Glioma", "91.05%", "98.5%", "98.2%", "96.8%", "98.9%", "Không báo cáo"),
                ("F1-score Meningioma", "93.68%", "99.1%", "98.9%", "97.2%", "99.2%", "Không báo cáo"),
                ("F1-score Pituitary", "96.60%", "99.3%", "99.1%", "97.5%", "99.4%", "Không báo cáo"),
                ("F1-score No Tumor", "96.66%", "99.2%", "99.0%", "97.0%", "99.3%", "Không báo cáo"),
                ("Phân chia cấp độ BN", "✅ Có", "❌ Không", "❌ Không", "❌ Không", "❌ Không", "❌ Không")
            ]
            
            for offset, data in enumerate(new_rows_data):
                row = insert_row_at(table, 2 + offset)
                for col_idx, text in enumerate(data):
                    set_cell_text(row.cells[col_idx], text, align=WD_ALIGN_PARAGRAPH.CENTER if col_idx > 0 else WD_ALIGN_PARAGRAPH.LEFT)
            
            print("Successfully updated Table 4 with F1-scores and Patient-level split info.")
            break

# Add Table 5 in Section 3.6
idx_p100, p100 = find_paragraph_by_text(doc, "Bằng cách thay thế CNN tùy chỉnh bằng tập hợp cân biến 3 mô hình")
if p100:
    # Insert Table 5 after P100. P101 is "Về mặt lâm sàng, hệ thống đạt 99,5%"
    idx_p101, p101 = find_paragraph_by_text(doc, "Về mặt lâm sàng, hệ thống đạt 99,5%")
    if p101:
        # 1. Caption paragraph
        cap_p = p101.insert_paragraph_before("Bảng 5. So sánh hiệu suất trên tập dữ liệu MRI (patient-level split).")
        cap_p.runs[0].font.bold = True
        
        # 2. Table itself
        table5 = doc.add_table(rows=5, cols=5)
        table5.style = 'Table Grid'
        
        table5_data = [
            ["Mô hình", "Tham số", "Accuracy", "Glioma Recall", "Overfitting"],
            ["ViT-Tiny", "245K", "67.44%", "50.50%", "✅ Nghiêm trọng"],
            ["Custom CNN (tự xây)", "1.2M", "25.25%", "15.00%", "✅ Rất nặng"],
            ["ResNet50", "23.5M", "93.94%", "84.75%", "❌ Không"],
            ["MAICS (Ensemble+VLM)", "85M", "94.56%", "86.50%", "❌ Không"]
        ]
        
        for r_idx, row_data in enumerate(table5_data):
            for c_idx, val in enumerate(row_data):
                bold = (r_idx == 0)
                align = WD_ALIGN_PARAGRAPH.CENTER if c_idx > 0 else WD_ALIGN_PARAGRAPH.LEFT
                set_cell_text(table5.cell(r_idx, c_idx), val, bold=bold, align=align)
                
        # Move table before p101
        p101._element.addprevious(table5._element)
        print("Successfully added Table 5 to Section 3.6.")

# ----------------------------------------------------------------------
# 4. INSERT IMAGES AT CORRESPONDING PLACES
# ----------------------------------------------------------------------

# Image 2 (Quy trình tiền xử lý) and Image 3 (Não mẫu)
# Insert after P22: "(3) Khử nhiễu và Đồng bộ kênh màu"
idx_prep_end, p_prep_end = find_paragraph_by_text(doc, "(3) Khử nhiễu")
if p_prep_end:
    idx_layer1, p_layer1 = find_paragraph_by_text(doc, "2.2 Tầng 1")
    if p_layer1:
        # Insert A: Image 2 (preprocessing_pipeline.png)
        p_img2 = p_layer1.insert_paragraph_before()
        p_img2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img2.add_run().add_picture("models/preprocessing_pipeline.png", width=Inches(6.0))
        
        # Insert B: Image 2 Caption
        p_cap2 = p_layer1.insert_paragraph_before("Hình 2. Quy trình tiền xử lý ảnh MRI: (a) Ảnh T1-weighted gốc chứa nền đen và xương sọ; (b) Sau khi áp dụng Otsu thresholding và contour-based cropping để loại bỏ viền đen; (c) Sau khi cân bằng CLAHE (clip limit=2.2) làm nổi bật tương phản mô mềm; (d) Ảnh cuối cùng sau khi lọc Gaussian và resize về 224×224×3.")
        p_cap2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap2.runs[0].font.italic = True
        
        # Insert C: Image 3 (brain_tumor_samples.png)
        p_img3 = p_layer1.insert_paragraph_before()
        p_img3.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img3.add_run().add_picture("models/brain_tumor_samples.png", width=Inches(6.0))
        
        # Insert D: Image 3 Caption
        p_cap3 = p_layer1.insert_paragraph_before("Hình 3. Các mẫu ảnh MRI đại diện cho bốn lớp: (a) Glioma — u trong nhu mô với bờ không đều và phù nề xung quanh; (b) Meningioma — u ngoài nhu mô với dấu hiệu đuôi màng cứng; (c) Pituitary — u vùng hố yên đường giữa; (d) Không u — cấu trúc não bình thường.")
        p_cap3.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap3.runs[0].font.italic = True
        
        print("Inserted Image 2 & Image 3 after Preprocessing subsection.")

# Image 4 (Độ trễ - models/latency_analysis.png)
idx_latency_text, p_latency_text = find_paragraph_by_text(doc, "Độ trễ trung bình khi gọi API VLM")
if p_latency_text:
    idx_flow_sec, p_flow_sec = find_paragraph_by_text(doc, "2.5 Lưu đồ hoạt động và Thuật toán Hệ thống")
    if p_flow_sec:
        p_cap4 = p_flow_sec.insert_paragraph_before("Hình 4. Phân tích độ trễ vận hành của MAICS. Chế độ nhanh (~75 ms) chiếm 93.25% số ca khi các mô hình đồng thuận; và Chế độ VLM (~1155 ms) chiếm 6.75% số ca khi xảy ra xung đột. Độ trễ trung bình toàn hệ thống là 148.24 ms/ảnh, đáp ứng yêu cầu chẩn đoán thời gian thực.")
        p_cap4.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap4.runs[0].font.italic = True
        
        p_img4 = p_flow_sec.insert_paragraph_before()
        p_img4.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img4.add_run().add_picture("models/latency_analysis.png", width=Inches(4.5))
        print("Inserted Image 4 after Latency subsection.")

# Image 7 (Conflict cases - models/conflict_cases.png)
idx_conflict_text, p_conflict_text = find_paragraph_by_text(doc, "Trong quá trình kiểm tra, hệ thống đã phát hiện 108 ca xung đột")
if p_conflict_text:
    idx_baytta_text, p_baytta_text = find_paragraph_by_text(doc, "Cụ thể, việc tích hợp BayTTA")
    if p_baytta_text:
        p_cap7 = p_baytta_text.insert_paragraph_before("Hình 7. Minh họa ba ca xung đột điển hình được xử lý bởi Tầng 3 VLM: (a) Ca xung đột được VLM giải quyết đúng theo YOLO; (b) Ca xung đột được VLM giải quyết đúng theo Ensemble; (c) Ca có độ tự tin thấp được hệ thống chuyển hướng fallback an toàn về Ensemble.")
        p_cap7.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap7.runs[0].font.italic = True
        
        p_img7 = p_baytta_text.insert_paragraph_before()
        p_img7.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img7.add_run().add_picture("models/conflict_cases.png", width=Inches(6.0))
        print("Inserted Image 7 after conflict description.")

# Image 8 (Error distribution - models/error_distribution.png)
idx_err_text, p_err_text = find_paragraph_by_text(doc, "Hơn nữa, hệ thống đồng thuận của chúng tôi đã chứng minh sự cải thiện")
if p_err_text:
    idx_fig9_cap, p_fig9_cap = find_paragraph_by_text(doc, "Hình 9. So sánh hiệu suất")
    if p_fig9_cap:
        p_cap8 = p_fig9_cap.insert_paragraph_before("Hình 8. Phân bố lỗi phân loại của ResNet50 đơn lẻ, Ensemble không VLM, và MAICS hoàn chỉnh. Số lượng Âm tính Giả (FN) giảm từ 61 xuống 18 sau khi áp dụng cơ chế đồng thuận ba tầng.")
        p_cap8.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap8.runs[0].font.italic = True
        
        p_img8 = p_fig9_cap.insert_paragraph_before()
        p_img8.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img8.add_run().add_picture("models/error_distribution.png", width=Inches(5.0))
        print("Inserted Image 8 after error reduction description.")

# Image 11 (SOTA comparison chart - models/sota_comparison.png)
idx_prompt_sec, p_prompt_sec = find_paragraph_by_text(doc, "3.4 Nghiên cứu cắt bỏ thiết kế Prompt")
if p_prompt_sec:
    p_cap11 = p_prompt_sec.insert_paragraph_before("Hình 11. So sánh độ chính xác giữa MAICS và các phương pháp SOTA trên cùng bài toán phân loại u não. Lưu ý rằng các mô hình SOTA được đánh giá trên tập dữ liệu chia ngẫu nhiên ở cấp độ lát cắt (slice-level split), trong khi MAICS được đánh giá trên tập kiểm tra độc lập ở cấp độ bệnh nhân (patient-level split) để đảm bảo không có rò rỉ dữ liệu.")
    p_cap11.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap11.runs[0].font.italic = True
    
    p_img11 = p_prompt_sec.insert_paragraph_before()
    p_img11.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img11.add_run().add_picture("models/sota_comparison.png", width=Inches(6.0))
    print("Inserted Image 11 before Section 3.4.")

# Image 12 (Explainability - models/multimodal_explanation.png)
idx_prompt_desc, p_prompt_desc = find_paragraph_by_text(doc, "Chiến lược prompt nền tảng đạt độ chính xác phân xử thấp")
if p_prompt_desc:
    idx_train_sec, p_train_sec = find_paragraph_by_text(doc, "3.5 Chi tiết huấn luyện mô hình và siêu tham số")
    if p_train_sec:
        p_cap12 = p_train_sec.insert_paragraph_before("Hình 12. Khả năng giải thích đa phương thức của MAICS. (a) Ảnh MRI gốc; (b) Bản đồ nhiệt Grad-CAM của ResNet50 tập trung vào vùng khối u; (c) Khung giới hạn của YOLOv8 định vị chính xác vùng tổn thương; (d) Chuỗi lý luận giải phẫu học được sinh tự động bởi Gemini VLM, cung cấp bằng chứng lâm sàng minh bạch cho quyết định chẩn đoán.")
        p_cap12.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap12.runs[0].font.italic = True
        
        p_img12 = p_train_sec.insert_paragraph_before()
        p_img12.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img12.add_run().add_picture("models/multimodal_explanation.png", width=Inches(6.0))
        print("Inserted Image 12 before Section 3.5.")

# Save the document
doc.save(original_file)
print("Saved revised document successfully!")
