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

  console.log("\n🎉 TẤT CẢ CÁC BÀI KIỂM THỬ DƯỢC LÂM SÀNG ĐỀU VƯỢT QUA 100%!");
}

runTests().catch(err => {
  console.error("❌ Test thất bại:", err);
  process.exit(1);
});
