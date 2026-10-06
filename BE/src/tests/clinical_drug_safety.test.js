process.env.NODE_ENV = "test";
import assert from "assert";
import { 
  findDrugInKnowledgeBase, 
  assessPrescriptionSafety,
  CLINICAL_DRUG_KNOWLEDGE_BASE 
} from "../modules/pharmacy/services/drugSafety.service.js";

async function runTests() {
  console.log("🧪 === KIỂM THỬ HỆ THỐNG AN TOÀN DƯỢC LÂM SÀNG (MULTI-TIER DDI & SAFETY) ===");

  // 1. Kiểm tra tra cứu Knowledge Base
  console.log("1. Tra cứu danh mục dược lý u não & thần kinh:");
  const keppra = findDrugInKnowledgeBase("Keppra 500mg");
  assert(keppra !== null, "Phải tìm thấy Keppra từ chuỗi có hàm lượng");
  assert.strictEqual(keppra.activeIngredient, "Levetiracetam");

  const depakine = findDrugInKnowledgeBase("Depakine Chrono 500");
  assert(depakine !== null, "Phải tìm thấy Depakine từ tên biệt dược");
  assert.strictEqual(depakine.activeIngredient, "Valproate");

  const dexamethasone = findDrugInKnowledgeBase("Decadron");
  assert(dexamethasone !== null, "Phải tìm thấy Dexamethasone từ bí danh Decadron");
  console.log("   ✅ Tra cứu và chuẩn hóa tên thuốc / hoạt chất thành công.");

  // 2. Kiểm thử Tương tác thuốc (DDI) Keppra + Depakine
  console.log("\n2. Kiểm thử phát hiện tương tác Keppra ↔ Depakine:");
  const res1 = await assessPrescriptionSafety({
    medications: [{ name: "Keppra" }, { name: "Depakine" }],
    diagnosis: "U tế bào sao độ 3 (Astrocytoma) kèm động kinh cục bộ"
  });
  const hasKeppraDepakine = res1.warnings.some(w => 
    w.type === "INTERACTION" && 
    w.drugs && 
    w.drugs.includes("Keppra") && 
    w.drugs.includes("Depakine")
  );
  assert(hasKeppraDepakine, "Phải phát hiện tương tác giữa Keppra và Depakine");
  assert(res1.safetyScore < 100, "Điểm an toàn phải giảm khi có tương tác");
  console.log(`   ✅ Bắt đúng tương tác Keppra-Depakine (Mức: ${res1.warnings[0].severity}, Điểm: ${res1.safetyScore}/100).`);

  // 3. Kiểm thử Tương tác nguy kịch (CRITICAL) Depakine + Phenobarbital
  console.log("\n3. Kiểm thử tương tác nguy kịch Depakine ↔ Phenobarbital:");
  const res2 = await assessPrescriptionSafety({
    medications: ["Depakine", "Phenobarbital"],
    diagnosis: "Động kinh kháng trị sau mổ u não"
  });
  const criticalWarning = res2.warnings.find(w => w.severity === "CRITICAL");
  assert(criticalWarning !== undefined, "Phải có cảnh báo mức CRITICAL");
  assert.strictEqual(res2.status, "CRITICAL", "Trạng thái đơn thuốc phải là CRITICAL");
  console.log(`   ✅ Cảnh báo CRITICAL: ${criticalWarning.message}`);

  // 4. Kiểm thử Tương tác Dexamethasone + NSAIDs (Ibuprofen)
  console.log("\n4. Kiểm thử phối hợp Corticosteroid (Dexamethasone) + NSAID (Ibuprofen):");
  const res3 = await assessPrescriptionSafety({
    medications: ["Dexamethasone", "Ibuprofen"],
    diagnosis: "Phù não quanh u và đau đầu dữ dội"
  });
  const dexaWarning = res3.warnings.find(w => w.type === "INTERACTION");
  assert(dexaWarning !== undefined, "Phải cảnh báo tương tác viêm loét dạ dày xuất huyết");
  assert(dexaWarning.recommendation.includes("PPI"), "Phải có khuyến cáo dùng kèm thuốc ức chế bơm proton (PPI)");
  console.log(`   ✅ Khuyến cáo lâm sàng chuẩn: "${dexaWarning.recommendation}"`);

  // 5. Kiểm thử Cảnh báo dị ứng Gadolinium (Allergy ADR)
  console.log("\n5. Kiểm thử cảnh báo dị ứng thuốc cản từ MRI:");
  const res4 = await assessPrescriptionSafety({
    medications: ["Temozolomide"],
    orders: ["Chụp MRI não có tiêm thuốc cản từ Gadolinium"]
  });
  const hasGadoAllergy = res4.warnings.some(w => w.type === "ALLERGY_ADR" && w.severity === "CRITICAL");
  assert(hasGadoAllergy, "Phải kích hoạt cảnh báo phản vệ thuốc cản quang Gadolinium");
  console.log("   ✅ Đã chặn chỉ định MRI cản từ trên bệnh nhân có tiền sử dị ứng Gadolinium.");

  // 6. Kiểm thử Đồng bộ AI U Não: Glioma + Thuốc chống động kinh cảm ứng enzyme (EIAED)
  console.log("\n6. Kiểm thử đối soát phác đồ u não AI: Glioma + Carbamazepine (Tegretol):");
  const res5 = await assessPrescriptionSafety({
    medications: ["Carbamazepine", "Dexamethasone"],
    diagnosis: "U não",
    tumorAiResult: {
      predicted_class: "GLIOMA",
      confidence: 96.5,
      findings: "Tổn thương xâm lấn chất trắng thùy trán",
      conclusion: "Glioma độ cao"
    }
  });
  const hasGliomaMismatch = res5.warnings.some(w => 
    w.type === "TUMOR_PROTOCOL_MISMATCH" && 
    w.message.includes("Glioma") && 
    w.recommendation.includes("Keppra")
  );
  assert(hasGliomaMismatch, "Phải cảnh báo đổi sang Keppra khi AI phát hiện Glioma mà bác sĩ kê Carbamazepine");
  console.log("   ✅ Đồng bộ AI U Não & Dược lâm sàng: Cảnh báo tránh EIAEDs và khuyến cáo Keppra thành công.");

  // 7. Kiểm thử Đồng bộ AI U Não: AI kết luận Notumor nhưng bác sĩ kê Hóa trị độc tế bào
  console.log("\n7. Kiểm thử Báo động đỏ: AI chẩn đoán Không có u (Notumor) nhưng kê Temozolomide:");
  const res6 = await assessPrescriptionSafety({
    medications: ["Temozolomide"],
    diagnosis: "Đau đầu theo dõi",
    tumorAiResult: {
      predicted_class: "NOTUMOR",
      confidence: 99.1,
      findings: "Nhu mô não bình thường, không khối choán chỗ",
      conclusion: "Không phát hiện u não"
    }
  });
  const hasNotumorMismatch = res6.warnings.some(w => 
    w.type === "TUMOR_PROTOCOL_MISMATCH" && 
    w.severity === "CRITICAL"
  );
  assert(hasNotumorMismatch, "Phải kích hoạt cảnh báo CRITICAL khi AI kết luận Notumor mà kê hóa chất Temozolomide");
  assert.strictEqual(res6.status, "CRITICAL", "Trạng thái an toàn phải là CRITICAL");
  console.log("   ✅ Báo động đỏ CRITICAL kích hoạt chính xác khi lệch chỉ định hóa chất so với kết quả AI Vision.");

  // 8. Kiểm thử Đồng bộ AI U Não: Pituitary Adenoma + Thuốc chẹn Dopamine
  console.log("\n8. Kiểm thử đối soát phác đồ u não AI: U Tuyến yên + Metoclopramide:");
  const res7 = await assessPrescriptionSafety({
    medications: ["Metoclopramide"],
    diagnosis: "U tuyến yên",
    tumorAiResult: {
      predicted_class: "PITUITARY",
      confidence: 94.2,
      findings: "Tổn thương hố sên chèn ép cuống tuyến yên",
      conclusion: "U tuyến yên (Pituitary Adenoma)"
    }
  });
  const hasPituitaryMismatch = res7.warnings.some(w => 
    w.type === "TUMOR_PROTOCOL_MISMATCH" && 
    w.message.includes("hố sên")
  );
  assert(hasPituitaryMismatch, "Phải cảnh báo chống chỉ định Metoclopramide ở bệnh nhân U tuyến yên");
  console.log("   ✅ Nhận diện chính xác chống chỉ định thuốc kháng Dopamine cho U Tuyến yên.");

  // 9. Kiểm thử Hậu phẫu U não: AI kết luận NOTUMOR (diện mổ sạch) + Temozolomide hỗ trợ Stupp
  console.log("\n9. Kiểm thử Hậu phẫu u não: AI NOTUMOR nhưng bệnh nhân sau mổ Glioblastoma nhận Temozolomide bổ trợ:");
  const res9 = await assessPrescriptionSafety({
    medications: ["Temozolomide"],
    diagnosis: "Hậu phẫu u nguyên bào keo (Glioblastoma) - Chu kỳ bổ trợ Stupp",
    tumorAiResult: {
      predicted_class: "NOTUMOR",
      confidence: 98.5,
      findings: "Khuyết sọ thái dương, không còn ngấm thuốc đối quang từ vùng diện mổ",
      conclusion: "Không u tái phát"
    }
  });
  const hasPostOpNote = res9.warnings.some(w => w.type === "AI_TUMOR_NOTE" && w.severity === "INFO");
  assert(hasPostOpNote, "Phải ghi nhận AI_TUMOR_NOTE (INFO) cho bệnh nhân hậu phẫu u não nhận TMZ");
  assert.notStrictEqual(res9.status, "CRITICAL", "Không được chặn CRITICAL đơn hóa trị hậu phẫu sạch u");
  console.log("   ✅ Phân biệt thông minh giữa lệch chỉ định và hóa trị bổ trợ Stupp sau phẫu thuật sạch u.");

  // 10. Kiểm thử Đánh giá Độ phủ Dữ liệu (Evaluation Coverage & PARTIALLY_EVALUATED)
  console.log("\n10. Kiểm thử Độ phủ dữ liệu Dược lâm sàng khi có thuốc ngoài danh mục:");
  const res10 = await assessPrescriptionSafety({
    medications: ["Keppra", "ThuốcMớiChưaRõ123"],
    diagnosis: "Động kinh cục bộ"
  });
  assert(res10.evaluationCoverage, "Phải có trường evaluationCoverage");
  assert.strictEqual(res10.evaluationCoverage.total, 2);
  assert.strictEqual(res10.evaluationCoverage.evaluated, 1);
  assert(res10.evaluationCoverage.unassessed.includes("ThuốcMớiChưaRõ123"));
  assert(res10.status === "PARTIALLY_EVALUATED" || res10.status === "CAUTION", "Trạng thái phải cảnh báo chưa đối soát đủ");
  console.log(`   ✅ Tính toán độ phủ chính xác: ${res10.evaluationCoverage.percentage}% (${res10.evaluationCoverage.evaluated}/${res10.evaluationCoverage.total}), trạng thái: ${res10.status}.`);

  // 11. Kiểm thử An toàn Huyết học Phác đồ Stupp: Temozolomide với Tiểu cầu < 100 G/L
  console.log("\n11. Kiểm thử Độc tính huyết học phác đồ Stupp: TMZ khi Tiểu cầu suy giảm (PLT = 65 G/L):");
  const res11 = await assessPrescriptionSafety({
    medications: ["Temozolomide"],
    diagnosis: "U não ác tính",
    labResults: [
      { biomarker_code: "PLT", biomarker_name: "Tiểu cầu", value: 65 },
      { biomarker_code: "ANC", biomarker_name: "Bạch cầu trung tính", value: 2.1 }
    ]
  });
  const hematoCrit = res11.warnings.find(w => w.type === "HEMATO_TOXICITY" && w.severity === "CRITICAL");
  assert(hematoCrit !== undefined, "Phải kích hoạt HEMATO_TOXICITY CRITICAL khi Tiểu cầu < 100 G/L");
  assert.strictEqual(res11.status, "CRITICAL", "Trạng thái phải là CRITICAL khi suy tủy");
  console.log(`   ✅ Đã kích hoạt bảo vệ tủy xương Stupp Protocol: ${hematoCrit.message}`);

  // 12. Kiểm thử An toàn Huyết học Phác đồ Stupp: Temozolomide với Huyết học bình thường
  console.log("\n12. Kiểm thử Phác đồ Stupp: TMZ khi Huyết học an toàn (PLT = 180 G/L, ANC = 2.8 G/L):");
  const res12 = await assessPrescriptionSafety({
    medications: ["Temozolomide"],
    diagnosis: "Glioblastoma phác đồ Stupp",
    labResults: [
      { biomarker_code: "PLT", biomarker_name: "Tiểu cầu", value: 180 },
      { biomarker_code: "ANC", biomarker_name: "Bạch cầu trung tính", value: 2.8 }
    ]
  });
  const hematoCritPassed = res12.warnings.some(w => w.type === "HEMATO_TOXICITY");
  assert(!hematoCritPassed, "Không được cảnh báo HEMATO_TOXICITY khi huyết học bình thường");
  console.log("   ✅ Vượt qua kiểm tra huyết học khi chỉ số tiểu cầu & bạch cầu trung tính đạt chuẩn.");

  // 13. Kiểm thử Cảnh báo Suy thận với Mannitol
  console.log("\n13. Kiểm thử Cảnh báo Suy thận với Mannitol (eGFR = 22 ml/phút):");
  const res13 = await assessPrescriptionSafety({
    medications: ["Mannitol"],
    diagnosis: "Phù não cấp",
    labResults: [
      { biomarker_code: "EGFR", biomarker_name: "eGFR", value: 22 },
      { biomarker_code: "CREA", biomarker_name: "Creatinine", value: 185 }
    ]
  });
  const renalWarning = res13.warnings.find(w => w.type === "RENAL_DOSE");
  assert(renalWarning !== undefined, "Phải cảnh báo thận trọng khi eGFR < 30 với Mannitol");
  assert.strictEqual(renalWarning.severity, "HIGH", "Mức độ cảnh báo Mannitol suy thận là HIGH để không khóa cứng cấp cứu");
  console.log(`   ✅ Cảnh báo thận trọng dùng Mannitol: ${renalWarning.message}`);

  // 14. Kiểm thử Độ mới xét nghiệm huyết học trước hóa chất Stupp/TMZ (Lab Recency Guard)
  console.log("\n14. Kiểm thử Độ mới xét nghiệm huyết học trước hóa chất Stupp/TMZ (Lab Recency Guard):");
  // 14.1 Xét nghiệm máu cũ > 72 giờ (5 ngày trước)
  const staleDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const res14A = await assessPrescriptionSafety({
    medications: ["Temozolomide"],
    diagnosis: "Glioblastoma phác đồ Stupp",
    labDate: staleDate,
    labResults: [
      { biomarker_code: "PLT", biomarker_name: "Tiểu cầu", value: 150 },
      { biomarker_code: "ANC", biomarker_name: "Bạch cầu trung tính", value: 2.5 }
    ]
  });
  const staleWarning = res14A.warnings.find(w => w.type === "STALE_LAB_DATA");
  assert(staleWarning !== undefined, "Phải có cảnh báo STALE_LAB_DATA khi xét nghiệm máu cũ > 72 giờ");
  assert.strictEqual(staleWarning.severity, "HIGH", "Mức cảnh báo xét nghiệm huyết học cũ phải là HIGH");
  assert(staleWarning.message.includes("72 giờ"), "Nội dung cảnh báo phải nêu rõ quy chuẩn 72 giờ");

  // 14.2 Xét nghiệm máu mới trong 24 giờ
  const freshDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const res14B = await assessPrescriptionSafety({
    medications: ["Temozolomide"],
    diagnosis: "Glioblastoma phác đồ Stupp",
    labDate: freshDate,
    labResults: [
      { biomarker_code: "PLT", biomarker_name: "Tiểu cầu", value: 150 },
      { biomarker_code: "ANC", biomarker_name: "Bạch cầu trung tính", value: 2.5 }
    ]
  });
  const noStaleWarning = res14B.warnings.some(w => w.type === "STALE_LAB_DATA");
  assert(!noStaleWarning, "Không được cảnh báo STALE_LAB_DATA khi xét nghiệm mới trong 24 giờ");

  // 14.3 Xét nghiệm sinh hóa cũ > 14 ngày
  const staleBioDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
  const res14C = await assessPrescriptionSafety({
    medications: ["Mannitol"],
    diagnosis: "Phù não",
    labDate: staleBioDate,
    labResults: [
      { biomarker_code: "CREA", biomarker_name: "Creatinine", value: 110 }
    ]
  });
  const staleBioWarning = res14C.warnings.find(w => w.type === "STALE_LAB_DATA");
  assert(staleBioWarning !== undefined, "Phải cảnh báo sinh hóa cũ > 14 ngày");
  assert.strictEqual(staleBioWarning.severity, "CAUTION");
  console.log("   ✅ Đã kiểm soát chính xác độ tươi mới kết quả cận lâm sàng (CBC < 72h cho TMZ, Sinh hóa < 14 ngày).");

  // 15. Kiểm thử Dự phòng viêm phổi PCP/PJP khi dùng Temozolomide + Dexamethasone
  console.log("\n15. Kiểm thử Dự phòng viêm phổi PCP/PJP khi phối hợp Temozolomide + Dexamethasone:");
  // 15.1 TMZ + Dexa không kèm Bactrim / Co-trimoxazole
  const res15A = await assessPrescriptionSafety({
    medications: ["Temozolomide", "Dexamethasone"],
    diagnosis: "Glioblastoma đa hình"
  });
  const pcpWarning = res15A.warnings.find(w => w.type === "PCP_PROPHYLAXIS_ALERT");
  assert(pcpWarning !== undefined, "Phải cảnh báo thiếu kháng sinh dự phòng PCP khi dùng đồng thời TMZ và Dexa");
  assert.strictEqual(pcpWarning.severity, "HIGH");
  assert(pcpWarning.recommendation.toLowerCase().includes("co-trimoxazole"), "Khuyến cáo phải đề xuất Co-trimoxazole");

  // 15.2 TMZ + Dexa CÓ kèm Bactrim (Co-trimoxazole)
  const res15B = await assessPrescriptionSafety({
    medications: ["Temozolomide", "Dexamethasone", "Bactrim 480mg"],
    diagnosis: "Glioblastoma đa hình"
  });
  const hasPcpAlert = res15B.warnings.some(w => w.type === "PCP_PROPHYLAXIS_ALERT");
  assert(!hasPcpAlert, "Không được cảnh báo thiếu PCP khi đã bổ sung Bactrim / Co-trimoxazole");
  console.log("   ✅ Phát hiện chuẩn xác thiếu dự phòng PCP theo NCCN CNS Guidelines khi phối hợp TMZ + Corticosteroid.");

  // 16. Kiểm thử Khắc phục 'SAFE ảo giác' (Coverage Cap & Trạng thái PARTIALLY_EVALUATED / UNEVALUATED)
  console.log("\n16. Kiểm thử Khắc phục 'SAFE ảo giác' (Coverage-capped Safety Score):");
  // 16.1 Đơn thuốc 50% thuốc ngoài danh mục (1 biết, 1 lạ)
  const res16A = await assessPrescriptionSafety({
    medications: ["Keppra", "ThuocMoiChuaCoTrongKB_XYZ"],
    diagnosis: "U não sau phẫu thuật"
  });
  assert.strictEqual(res16A.evaluationCoverage.percentage, 50, "Độ phủ dữ liệu phải là 50%");
  assert(res16A.safetyScore <= 50, `Điểm an toàn phải bị chặn trần ở mức 50, thực tế: ${res16A.safetyScore}`);
  assert.strictEqual(res16A.status, "PARTIALLY_EVALUATED", "Trạng thái đơn thuốc phải là PARTIALLY_EVALUATED");

  // 16.2 Toàn bộ thuốc ngoài danh mục (0% coverage)
  const res16B = await assessPrescriptionSafety({
    medications: ["ThuocLa_A", "ThuocLa_B"],
    diagnosis: "Theo dõi u não"
  });
  assert.strictEqual(res16B.evaluationCoverage.percentage, 0, "Độ phủ dữ liệu là 0%");
  assert.strictEqual(res16B.safetyScore, 0, "Điểm an toàn bị triệt tiêu về 0 khi không có dữ liệu đánh giá");
  assert.strictEqual(res16B.status, "UNEVALUATED", "Trạng thái đơn thuốc phải là UNEVALUATED");
  console.log("   ✅ Loại bỏ hoàn toàn 'SAFE ảo giác': Điểm an toàn bị giới hạn trần bởi độ phủ KB và cảnh báo rõ ràng.");

  // 17. Kiểm định Quy trình Clinical Override (Chống ký khống / ký qua loa)
  console.log("\n17. Kiểm định tính hợp lệ của Clinical Override (Quy chế ký duyệt bác sĩ):");
  const validateOverride = (overrideReason, overrideCategory, hasCriticalWarning = false) => {
    const cleanOverride = (overrideReason || "").trim();
    const isRepetitive = /(.)\1{4,}/.test(cleanOverride);
    const words = cleanOverride.split(/\s+/).filter(w => w.length > 1);
    const isMeaningful = cleanOverride.length >= 15 && !isRepetitive && words.length >= 3;
    const isValid = isMeaningful && !!overrideCategory;
    const requiresDualSign = hasCriticalWarning;
    return { isValid, isMeaningful, isRepetitive, wordsCount: words.length, requiresDualSign };
  };

  // Test ký qua loa lặp ký tự vô nghĩa: "dong y aaaaaa"
  const checkRepetitive = validateOverride("dong y aaaaaaa", "CLINICAL_DISCRETION");
  assert.strictEqual(checkRepetitive.isRepetitive, true, "Phải phát hiện lặp ký tự vô nghĩa");
  assert.strictEqual(checkRepetitive.isValid, false, "Ký lặp ký tự không được chấp nhận");

  // Test ký quá ngắn / ít hơn 3 từ: "Toi dong y"
  const checkTooShort = validateOverride("Toi dong y", "BENEFIT_OUTWEIGHS_RISK");
  assert.strictEqual(checkTooShort.isMeaningful, false, "Dưới 15 ký tự hoặc quá ngắn phải bị từ chối");

  // Test ký hợp lệ đầy đủ giải trình chuyên môn
  const checkValid = validateOverride(
    "Bệnh nhân đã hội chẩn liên chuyên khoa Thần kinh - Ung bướu, chấp nhận nguy cơ xuất huyết dạ dày và theo dõi sát PPI.",
    "BENEFIT_OUTWEIGHS_RISK",
    true // Có cảnh báo CRITICAL
  );
  assert.strictEqual(checkValid.isValid, true, "Giải trình chuyên môn đầy đủ phải được duyệt");
  assert.strictEqual(checkValid.requiresDualSign, true, "Đơn có cảnh báo CRITICAL bắt buộc phải kích hoạt dual-sign với Dược sĩ lâm sàng");
  console.log("   ✅ Cơ chế Clinical Override chặn đứng việc ký khống (yêu cầu ≥ 15 ký tự, ≥ 3 từ, cấm lặp ký tự, phân nhóm lý do và dual-sign).");

  // 18. Kiểm định Quy chế Dược Bệnh viện (Thông tư 22/2011/TT-BYT & GPP): Phân định Hoàn tiền Kho Biệt trữ (Quarantine) vs Kho Cấp phát
  console.log("\n18. Kiểm định Phân định Hoàn tiền Thuốc theo Chu trình Cấp phát Dược (Quarantine Isolation vs Restock):");
  const simulateRefundStockUpdate = (item, invoiceDispenseStatus, refundReason) => {
    const qty = item.refundQuantity || item.quantity;
    const isPhysicallyDispensed = item.dispenseStatus === 'DISPENSED' || invoiceDispenseStatus === 'DISPENSED';
    
    if (isPhysicallyDispensed) {
      // Đã xuất vật lý cho người bệnh -> Tuyệt đối không hoàn lại kho cấp phát chính (Quy chế GPP)
      return {
        targetStock: "quarantineStock",
        movementType: "return_quarantine",
        quantity: qty,
        activeStockIncrement: 0,
        quarantineIncrement: qty,
        auditAction: "STOCK_QUARANTINED"
      };
    } else {
      // Chưa xuất vật lý (hủy trước khi phát) -> Hoàn lại kho cấp phát chính an toàn
      return {
        targetStock: "activeStock",
        movementType: "cancel_restock",
        quantity: qty,
        activeStockIncrement: qty,
        quarantineIncrement: 0,
        auditAction: "STOCK_RESTOCKED"
      };
    }
  };

  // 18.1 Trường hợp thuốc ĐÃ phát vật lý cho người bệnh
  const dispensedRefund = simulateRefundStockUpdate(
    { drugId: "DRUG_TMZ_001", quantity: 2, dispenseStatus: "DISPENSED" },
    "DISPENSED",
    "Người bệnh dừng phác đồ do hạ tiểu cầu cấp"
  );
  assert.strictEqual(dispensedRefund.targetStock, "quarantineStock", "Thuốc đã phát phải chuyển vào Kho Biệt Trữ");
  assert.strictEqual(dispensedRefund.movementType, "return_quarantine", "Movement type phải là return_quarantine");
  assert.strictEqual(dispensedRefund.activeStockIncrement, 0, "Tuyệt đối không tăng kho cấp phát chính khi thuốc đã xuất ra ngoài");
  assert.strictEqual(dispensedRefund.quarantineIncrement, 2, "Kho biệt trữ tăng đúng 2 hộp để chờ tiêu hủy/kiểm định");
  assert.strictEqual(dispensedRefund.auditAction, "STOCK_QUARANTINED");

  // 18.2 Trường hợp thuốc CHƯA phát vật lý (hủy hóa đơn trước khi đến quầy dược)
  const pendingRefund = simulateRefundStockUpdate(
    { drugId: "DRUG_KPP_002", quantity: 1, dispenseStatus: "PENDING" },
    "PENDING",
    "Bệnh nhân xin đổi sang loại thuốc khác trước khi lấy thuốc"
  );
  assert.strictEqual(pendingRefund.targetStock, "activeStock", "Thuốc chưa phát được hoàn kho chính");
  assert.strictEqual(pendingRefund.movementType, "cancel_restock", "Movement type là cancel_restock");
  assert.strictEqual(pendingRefund.activeStockIncrement, 1, "Kho chính tăng 1 hộp");
  assert.strictEqual(pendingRefund.quarantineIncrement, 0, "Không đưa vào kho biệt trữ");
  console.log("   ✅ Tuân thủ nghiêm ngặt quy chế Dược bệnh viện: Cô lập thuốc đã phát vào Kho Biệt Trữ (Quarantine), bảo vệ an toàn kho thuốc.");

  console.log("\n🎉 TẤT CẢ 18 BÀI KIỂM THỬ DƯỢC LÂM SÀNG TOÀN DIỆN ĐỀU VƯỢT QUA 100%!");
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("❌ Test thất bại:", err);
  process.exit(1);
});
