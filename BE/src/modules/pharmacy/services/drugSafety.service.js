import mongoose from "mongoose";
import { User } from "../../../models/user.model.js";
import { VitalSign } from "../../../models/vitalSign.model.js";
import { LabOrder } from "../../../models/labOrder.model.js";
import { Prescription } from "../../../models/prescription.model.js";
import { Drug } from "../../../models/drug.model.js";
import { ImagingResult } from "../../../models/imagingResult.model.js";

// In-memory cache cho openFDA để tối ưu tốc độ và tránh rate limit
const openFdaCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ

// =============================================================================
// CƠ SỞ TRI THỨC DƯỢC LÂM SÀNG CHUYÊN SÂU (CLINICAL PHARMACY KNOWLEDGE BASE)
// Chuẩn hóa dược lực học, tương tác thuốc, chống chỉ định thần kinh & ung thư
// =============================================================================
export const CLINICAL_DRUG_KNOWLEDGE_BASE = {
  temozolomide: {
    name: "Temozolomide",
    activeIngredient: "Temozolomide",
    aliases: ["temodal", "temodar", "tmz"],
    category: "chemotherapy",
    maxDailyDose: "200mg/m2/ngày",
    interactions: [
      {
        target: "valproate",
        targetAliases: ["depakine", "valproic acid", "sodium valproate", "depakote"],
        severity: "HIGH",
        mechanism: "Valproate ức chế chuyển hóa temozolomide, làm giảm thanh thải temozolomide khoảng 5%, tăng độc tính tủy xương (hạ bạch cầu hạt, hạ tiểu cầu nặng).",
        recommendation: "Theo dõi sát huyết học (CBC/tiểu cầu) hàng tuần. Cân nhắc giảm liều Temozolomide nếu có dấu hiệu ức chế tủy xương."
      },
      {
        target: "carbamazepine",
        targetAliases: ["tegretol"],
        severity: "HIGH",
        mechanism: "Carbamazepine cảm ứng mạnh CYP3A4, làm tăng thanh thải và giảm nồng độ hiệu lực của Temozolomide trong máu.",
        recommendation: "Khuyến cáo chuyển sang Levetiracetam (Keppra) - thuốc chống co giật không cảm ứng enzyme gan."
      },
      {
        target: "phenobarbital",
        targetAliases: ["gardenal"],
        severity: "HIGH",
        mechanism: "Phenobarbital cảm ứng enzyme gan, làm giảm nồng độ hóa trị Temozolomide.",
        recommendation: "Đổi sang Levetiracetam để bảo toàn hiệu lực phác đồ Stupp."
      }
    ],
    contraindications: [
      "Suy tủy xương nặng",
      "Tiểu cầu dưới 100.000/mm3",
      "Bạch cầu đa nhân trung tính dưới 1.500/mm3",
      "Phụ nữ mang thai hoặc cho con bú"
    ],
    renalNotes: "Thận trọng khi eGFR < 36 ml/phút.",
    hepaticNotes: "Thận trọng khi suy gan nặng (Child-Pugh C)."
  },

  keppra: {
    name: "Keppra",
    activeIngredient: "Levetiracetam",
    aliases: ["levetiracetam", "epilepsir"],
    category: "anticonvulsant",
    maxDailyDose: "3000mg/ngày",
    interactions: [
      {
        target: "depakine",
        targetAliases: ["valproate", "valproic acid", "sodium valproate"],
        severity: "HIGH",
        mechanism: "Hiệp đồng ức chế thần kinh trung ương và tăng độc tính chuyển hóa; có thể gây ngủ sâu, hạ thân nhiệt và bệnh não tăng amoniac máu.",
        recommendation: "Theo dõi tri giác và nồng độ amoniac máu nếu bắt buộc phải phối hợp."
      },
      {
        target: "tegretol",
        targetAliases: ["carbamazepine"],
        severity: "MEDIUM",
        mechanism: "Tăng nguy cơ chóng mặt, thất điều, song thị và buồn ngủ do tác dụng cộng hưởng thần kinh.",
        recommendation: "Bắt đầu với liều thấp và điều chỉnh chậm."
      }
    ],
    contraindications: [
      "Quá mẫn với Levetiracetam hoặc dẫn xuất pyrrolidone"
    ],
    renalNotes: "Bài tiết 66% qua thận nguyên vẹn. BẮT BUỘC giảm liều theo eGFR (eGFR 30-50: giảm 50%; eGFR < 30: giảm 75%).",
    hepaticNotes: "Không chuyển hóa qua gan, an toàn cho bệnh nhân u não có suy gan."
  },

  depakine: {
    name: "Depakine",
    activeIngredient: "Valproate",
    aliases: ["valproate", "valproic acid", "sodium valproate", "depakote"],
    category: "anticonvulsant",
    maxDailyDose: "2500mg/ngày (30mg/kg/ngày)",
    interactions: [
      {
        target: "phenobarbital",
        targetAliases: ["gardenal"],
        severity: "CRITICAL",
        mechanism: "Valproate ức chế mạnh quá trình hydroxyl hóa phenobarbital, làm tăng vọt nồng độ phenobarbital huyết tương dẫn đến an thần nặng, ức chế hô hấp và hôn mê.",
        recommendation: "CHỐNG CHỈ ĐỊNH PHỐI HỢP LIỀU CAO. Nếu dùng, phải giảm liều phenobarbital từ 30-50% và định lượng nồng độ huyết tương."
      },
      {
        target: "diazepam",
        targetAliases: ["seduxen", "valium"],
        severity: "HIGH",
        mechanism: "Valproate cạnh tranh gắn kết albumin và ức chế chuyển hóa diazepam, làm tăng nồng độ diazepam tự do trong máu gây ức chế thần kinh trung ương kéo dài.",
        recommendation: "Giảm liều Diazepam và theo dõi tri giác chặt chẽ."
      },
      {
        target: "aspirin",
        targetAliases: ["acetylsalicylic acid"],
        severity: "HIGH",
        mechanism: "Aspirin cạnh tranh gắn kết protein huyết tương và ức chế beta-oxidation của valproate, làm tăng nồng độ valproate tự do gây nhiễm độc gan cấp và bệnh não.",
        recommendation: "Tránh dùng Aspirin hạ sốt/giảm đau cho người đang điều trị bằng Valproate. Thay bằng Paracetamol liều thấp."
      }
    ],
    contraindications: [
      "Viêm gan cấp hoặc mạn tính",
      "Tiền sử gia đình suy gan nặng do thuốc",
      "Rối loạn chu trình urê",
      "Bệnh lý ty thể do đột biến gen POLG",
      "Phụ nữ mang thai (nguy cơ dị tật ống thần kinh cao)"
    ],
    hepaticNotes: "Chống chỉ định tuyệt đối khi Men gan ALT/AST > 3 lần ngưỡng bình thường."
  },

  dexamethasone: {
    name: "Dexamethasone",
    activeIngredient: "Dexamethasone",
    aliases: ["decadron", "dexa"],
    category: "corticosteroid",
    maxDailyDose: "16mg - 24mg/ngày (trong phù não cấp quanh u)",
    interactions: [
      {
        target: "ibuprofen",
        targetAliases: ["aspirin", "meloxicam", "celecoxib", "diclofenac", "nsaid"],
        severity: "HIGH",
        mechanism: "Phối hợp Corticosteroid với NSAIDs làm tăng gấp 4 - 5 lần nguy cơ viêm loét dạ dày, thủng ruột và xuất huyết tiêu hóa ồ ạt.",
        recommendation: "Bắt buộc kê kèm thuốc ức chế bơm proton (PPI: Omeprazole / Esomeprazole) để bảo vệ niêm mạc dạ dày."
      },
      {
        target: "carbamazepine",
        targetAliases: ["tegretol", "phenobarbital", "phenytoin"],
        severity: "HIGH",
        mechanism: "Thuốc chống co giật cảm ứng enzyme CYP3A4 làm tăng chuyển hóa Dexamethasone gấp 2-3 lần, làm mất hiệu quả chống phù não quanh khối u.",
        recommendation: "Cần tăng liều Dexamethasone hoặc đổi thuốc chống co giật sang Levetiracetam (Keppra)."
      }
    ],
    contraindications: [
      "Nhiễm nấm toàn thân",
      "Loét dạ dày tá tràng tiến triển có nguy cơ xuất huyết",
      "Nhiễm khuẩn cấp tính chưa được kiểm soát bằng kháng sinh"
    ],
    bmiDosageWarning: true,
    clinicalAdvice: "Luôn uống sau ăn no vào buổi sáng. Theo dõi đường huyết định kỳ."
  },

  mannitol: {
    name: "Mannitol",
    activeIngredient: "Mannitol",
    aliases: ["osmitrol"],
    category: "anti_edema",
    maxDailyDose: "1.5g - 2g/kg/ngày",
    interactions: [
      {
        target: "cisplatin",
        targetAliases: ["gentamicin", "vancomycin", "amikacin"],
        severity: "CRITICAL",
        mechanism: "Tăng mạnh nguy cơ suy thận cấp hoại tử ống thận và điếc tai khi dùng đồng thời với thuốc độc thận.",
        recommendation: "Chống chỉ định phối hợp hoặc phải theo dõi eGFR, Creatinine và thính lực đồ liên tục."
      }
    ],
    contraindications: [
      "Vô niệu hoàn toàn do bệnh thận nặng",
      "Phù phổi cấp hoặc suy tim ứ huyết nặng",
      "Mất nước nội tế bào nghiêm trọng",
      "Xuất huyết nội sọ tiến triển (trừ trường hợp đang mở hộp sọ)"
    ],
    renalNotes: "Chống chỉ định khi Creatinine > 200 umol/L hoặc eGFR < 30 ml/phút."
  },

  bevacizumab: {
    name: "Bevacizumab",
    activeIngredient: "Bevacizumab",
    aliases: ["avastin"],
    category: "chemotherapy",
    maxDailyDose: "10mg - 15mg/kg mỗi 2 tuần",
    interactions: [
      {
        target: "aspirin",
        targetAliases: ["clopidogrel", "enoxaparin", "warfarin", "heparin"],
        severity: "HIGH",
        mechanism: "Kháng thể ức chế VEGF kết hợp thuốc chống đông/chống kết tập tiểu cầu làm tăng vọt nguy cơ xuất huyết nội sọ ở bệnh nhân u thần kinh đệm.",
        recommendation: "Cân nhắc kỹ lợi ích - nguy cơ xuất huyết não qua MRI trước khi chỉ định phối hợp."
      }
    ],
    contraindications: [
      "Vết mổ sọ não chưa liền sẹo (phải cách ít nhất 28 ngày sau mổ)",
      "Protein niệu hội chứng thận hư",
      "Tăng huyết áp không kiểm soát"
    ]
  },

  phenobarbital: {
    name: "Phenobarbital",
    activeIngredient: "Phenobarbital",
    aliases: ["gardenal", "luminal"],
    category: "psychotropic",
    interactions: [
      {
        target: "diazepam",
        targetAliases: ["seduxen", "valium"],
        severity: "HIGH",
        mechanism: "Hiệp đồng ức chế sâu trung tâm hô hấp ở hành não, nguy cơ suy hô hấp và ngừng thở.",
        recommendation: "Theo dõi sát nhịp thở, SpO2 và chuẩn bị sẵn phương tiện cấp cứu đường thở."
      }
    ],
    contraindications: [
      "Suy hô hấp nặng",
      "Rối loạn chuyển hóa porphyrin",
      "Suy gan hoặc suy thận nặng"
    ]
  },

  diazepam: {
    name: "Diazepam",
    activeIngredient: "Diazepam",
    aliases: ["seduxen", "valium"],
    category: "psychotropic",
    interactions: [
      {
        target: "tramadol",
        targetAliases: ["ultram", "paracetamol + tramadol"],
        severity: "HIGH",
        mechanism: "Cảnh báo Hộp Đen FDA (Black Box Warning): Phối hợp Benzodiazepine và Opioid làm tăng nguy cơ an thần sâu, ức chế hô hấp dẫn đến tử vong.",
        recommendation: "Tránh phối hợp. Nếu đau nặng, dùng thuốc giảm đau không gây nghiện hoặc giảm liều cả hai xuống mức thấp nhất."
      }
    ],
    contraindications: [
      "Nhược cơ nặng (Myasthenia gravis)",
      "Hội chứng ngưng thở khi ngủ",
      "Suy hô hấp mạn tính",
      "Tăng nhãn áp góc đóng"
    ]
  },

  tegretol: {
    name: "Tegretol",
    activeIngredient: "Carbamazepine",
    aliases: ["carbamazepine"],
    category: "anticonvulsant",
    interactions: [
      {
        target: "tramadol",
        targetAliases: ["ultram"],
        severity: "HIGH",
        mechanism: "Carbamazepine làm giảm nồng độ giảm đau của tramadol và hạ ngưỡng co giật, làm bùng phát cơn co giật ở bệnh nhân u não.",
        recommendation: "Chống chỉ định dùng chung ở bệnh nhân có bệnh lý não."
      }
    ],
    contraindications: [
      "Block nhĩ thất tim",
      "Tiền sử suy tủy xương hoặc giảm bạch cầu",
      "Porphyria cấp tính"
    ]
  },

  tramadol: {
    name: "Tramadol",
    activeIngredient: "Tramadol",
    aliases: ["ultram"],
    category: "pain_reliever",
    contraindications: [
      "Bệnh nhân có tiền sử động kinh hoặc co giật do u não chưa kiểm soát",
      "Nhiễm độc cấp tính rượu, thuốc ngủ, thuốc giảm đau trung ương"
    ]
  },

  ibuprofen: {
    name: "Ibuprofen",
    activeIngredient: "Ibuprofen",
    aliases: ["advil", "motrin", "brufen"],
    category: "pain_reliever",
    contraindications: [
      "Loét dạ dày tá tràng tiến triển",
      "Suy thận nặng (eGFR < 30)",
      "Suy tim ứ huyết nặng",
      "Rối loạn đông máu hoặc đang chảy máu"
    ]
  },

  metformin: {
    name: "Metformin",
    activeIngredient: "Metformin",
    aliases: ["glucophage"],
    category: "cardiovascular",
    contraindications: [
      "Suy thận có eGFR < 30 ml/phút (nguy cơ nhiễm toan lactic tử vong)",
      "Nhiễm toan chuyển hóa cấp"
    ],
    renalNotes: "Phải tạm ngừng Metformin 48 giờ trước và sau khi tiêm thuốc cản từ/cản quang chụp MRI/CT nếu có suy thận."
  }
};

// =============================================================================
// HELPER: Chuẩn hóa tên thuốc để tra cứu
// =============================================================================
export function findDrugInKnowledgeBase(name) {
  if (!name || typeof name !== "string") return null;
  const clean = name.trim().toLowerCase();
  
  // 1. So sánh trực tiếp key
  if (CLINICAL_DRUG_KNOWLEDGE_BASE[clean]) {
    return CLINICAL_DRUG_KNOWLEDGE_BASE[clean];
  }
  
  // 2. So sánh aliases và name
  for (const [key, drug] of Object.entries(CLINICAL_DRUG_KNOWLEDGE_BASE)) {
    if (drug.name.toLowerCase() === clean) return drug;
    if (drug.activeIngredient.toLowerCase() === clean) return drug;
    if (drug.aliases && drug.aliases.some(a => clean.includes(a) || a.includes(clean))) {
      return drug;
    }
    // So sánh từ khóa chứa
    if (clean.includes(drug.name.toLowerCase()) || clean.includes(drug.activeIngredient.toLowerCase())) {
      return drug;
    }
  }
  return null;
}

// =============================================================================
// OPENFDA INTEGRATION (FDA Live Drug Label & DDI)
// =============================================================================
export async function queryOpenFdaDrug(drugName) {
  if (!drugName) return null;
  const key = drugName.trim().toLowerCase();

  // Kiểm tra cache
  if (openFdaCache.has(key)) {
    const cached = openFdaCache.get(key);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  try {
    const cleanTerm = encodeURIComponent(key.split(" ")[0]); // Lấy từ khóa chính
    const url = `https://api.fda.gov/drug/label.json?search=(openfda.generic_name:"${cleanTerm}"+openfda.brand_name:"${cleanTerm}")&limit=1`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      openFdaCache.set(key, { data: null, timestamp: Date.now() });
      return null;
    }

    const json = await resp.json();
    if (json.results && json.results.length > 0) {
      const res = json.results[0];
      const data = {
        brandName: res.openfda?.brand_name?.[0] || drugName,
        genericName: res.openfda?.generic_name?.[0] || drugName,
        boxedWarning: res.boxed_warning?.[0] ? res.boxed_warning[0].substring(0, 350) + "..." : null,
        drugInteractionsSummary: res.drug_interactions?.[0] ? res.drug_interactions[0].substring(0, 350) + "..." : null,
        contraindicationsSummary: res.contraindications?.[0] ? res.contraindications[0].substring(0, 350) + "..." : null,
        source: "openFDA (U.S. FDA Drug Label Database)"
      };
      openFdaCache.set(key, { data, timestamp: Date.now() });
      return data;
    }
  } catch (err) {
    // Không log lỗi quá nặng để tránh spam console khi offline
    // console.warn("openFDA lookup warning:", err.message);
  }

  openFdaCache.set(key, { data: null, timestamp: Date.now() });
  return null;
}

// =============================================================================
// AI CLINICAL PHARMACY AGENT (FastAPI / Gemini)
// =============================================================================
export async function consultAiPharmacist({ patientInfo, medications, diagnosis, tumorAiResult }) {
  const aiServerUrl = process.env.AI_SERVER_URL 
    ? process.env.AI_SERVER_URL.replace("/predict", "/check_medication_ai")
    : "http://localhost:8000/check_medication_ai";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const payload = {
      patient_info: patientInfo,
      medications: medications,
      diagnosis: diagnosis || "Bệnh lý thần kinh / U não",
      tumor_ai_result: tumorAiResult || null
    };

    const resp = await fetch(aiServerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const aiData = await resp.json();
      return {
        success: true,
        source: "Gemini 3.1 Flash-Lite AI Clinical Pharmacist",
        data: aiData
      };
    }
  } catch (err) {
    // AI server not reachable or timeout -> fallback gracefully
  }

  return {
    success: false,
    source: "Rule-based Clinical DSS",
    data: null
  };
}

// =============================================================================
// HÀM KIỂM TRA DƯỢC LÂM SÀNG TOÀN DIỆN (MAIN SAFETY CHECKER)
// =============================================================================
export async function assessPrescriptionSafety({
  patientId,
  medications = [],
  orders = [],
  diagnosis = "",
  tumorAiResult = null,
  requestAi = false
}) {
  const warnings = [];
  const classifications = [];
  const openFdaDetails = [];
  let safetyScore = 100;

  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;

  // 1. Lấy thông tin bệnh nhân
  let patient = null;
  if (patientId && isDbConnected) {
    try {
      patient = await User.findById(patientId).lean();
    } catch (e) {
      // CastError
    }
  }

  let allergies = ["Gadolinium"];
  let medicalHistory = [];
  if (patient && patient.profile) {
    if (Array.isArray(patient.profile.allergies) && patient.profile.allergies.length > 0) {
      allergies = patient.profile.allergies;
    }
    if (Array.isArray(patient.profile.medicalHistory)) {
      medicalHistory = patient.profile.medicalHistory;
    }
  }

  // 2. Lấy sinh hiệu mới nhất (BMI, Huyết áp)
  let latestVital = null;
  if (patientId && isDbConnected) {
    try {
      latestVital = await VitalSign.findOne({ patient_id: patientId }).sort({ recorded_at: -1 }).lean();
    } catch (e) {}
  }

  let bmi = null;
  if (latestVital && latestVital.weight && latestVital.height) {
    bmi = Number((latestVital.weight / Math.pow(latestVital.height / 100, 2)).toFixed(2));
  }

  // 3. Lấy xét nghiệm sinh hóa máu gần nhất (Chức năng Thận & Gan: Creatinine, eGFR, ALT, AST)
  let latestLab = null;
  let creatinineValue = null;
  let egfrValue = null;
  let altValue = null;
  let astValue = null;

  if (patientId && isDbConnected) {
    try {
      latestLab = await LabOrder.findOne({ 
        patient_id: patientId, 
        status: "COMPLETED" 
      }).sort({ ordered_at: -1 }).lean();

      if (latestLab && Array.isArray(latestLab.results)) {
        for (const res of latestLab.results) {
          const code = (res.biomarker_code || "").toUpperCase();
          const name = (res.biomarker_name || "").toLowerCase();
          const val = Number(res.value);

          if (!isNaN(val)) {
            if (code === "CREA" || name.includes("creatinine")) creatinineValue = val;
            if (code === "EGFR" || name.includes("egfr") || name.includes("mức lọc cầu thận")) egfrValue = val;
            if (code === "ALT" || name.includes("alt") || name.includes("gpt")) altValue = val;
            if (code === "AST" || name.includes("ast") || name.includes("got")) astValue = val;
          }
        }
      }
    } catch (e) {}
  }

  // 4. Lấy đơn thuốc cũ đang còn hiệu lực của bệnh nhân (Trong vòng 30 ngày qua)
  let recentDrugs = [];
  if (patientId && isDbConnected) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const pastPrescriptions = await Prescription.find({
        patient_id: patientId,
        createdAt: { $gte: thirtyDaysAgo }
      }).sort({ createdAt: -1 }).limit(3).lean();

      pastPrescriptions.forEach(p => {
        (p.drugs || []).forEach(d => {
          recentDrugs.push({
            name: d.name,
            source: `Đơn thuốc cũ ngày ${new Date(p.createdAt).toLocaleDateString("vi-VN")}`
          });
        });
      });
    } catch (e) {}
  }

  // 5. Lấy kết quả Chẩn đoán Hình ảnh MRI & AI Nhận diện Khối u (Gemini 3.1 Flash-Lite & ResNet)
  let latestImaging = null;
  let resolvedTumorAiResult = tumorAiResult;
  if (!resolvedTumorAiResult && patientId && isDbConnected) {
    try {
      latestImaging = await ImagingResult.findOne({
        $or: [
          { medicalId: patient?.medicalId || "__none__" },
          { patientName: patient?.profile?.name || "__none__" }
        ]
      }).sort({ reportDate: -1, createdAt: -1 }).lean();

      if (latestImaging) {
        resolvedTumorAiResult = {
          predicted_class: latestImaging.aiReport?.predicted_class || latestImaging.aiReport?.class_name || latestImaging.conclusion || latestImaging.diagnosis || null,
          confidence: latestImaging.aiReport?.confidence || latestImaging.aiReport?.probability || null,
          findings: latestImaging.findings || "",
          conclusion: latestImaging.conclusion || "",
          imagingType: latestImaging.imagingType || "MRI"
        };
      }
    } catch (e) {}
  }

  // Chuẩn bị danh sách tên thuốc đang kê
  const medItems = medications.map(m => (typeof m === "string" ? { name: m } : m));
  const medNames = medItems.map(m => m.name);

  // Tra cứu DB bệnh viện để lấy thông tin thuốc nội bộ
  let dbDrugs = [];
  if (isDbConnected && medNames.length > 0) {
    try {
      dbDrugs = await Drug.find({ 
        name: { $in: medNames.map(n => new RegExp(`^${n.trim()}$`, "i")) } 
      }).lean();
    } catch (e) {}
  }

  // Ánh xạ sang cấu trúc lâm sàng chuẩn
  const resolvedDrugs = medItems.map(item => {
    const kbDrug = findDrugInKnowledgeBase(item.name);
    const dbDrug = dbDrugs.find(d => d.name.toLowerCase() === item.name.toLowerCase());

    return {
      rawItem: item,
      name: item.name,
      kbDrug,
      dbDrug,
      category: kbDrug?.category || dbDrug?.category || "other"
    };
  });

  // ── KIỂM TRA 1: PHÂN LOẠI THUỐC HƯỚNG THẦN / ĐẶC BIỆT ─────────────────────
  resolvedDrugs.forEach(d => {
    if (d.category === "psychotropic") {
      classifications.push({
        name: d.name,
        type: "Thuốc hướng thần / Gây nghiện",
        warning: "Thuốc hướng tâm thần (Cần lập đơn thuốc kiểm soát đặc biệt theo quy chế dược Bộ Y Tế)."
      });
    }
  });

  // ── KIỂM TRA 2: TƯƠNG TÁC THUỐC - THUỐC (DDI TRONG ĐƠN NHÁP) ───────────────
  for (let i = 0; i < resolvedDrugs.length; i++) {
    for (let j = i + 1; j < resolvedDrugs.length; j++) {
      const drugA = resolvedDrugs[i];
      const drugB = resolvedDrugs[j];

      // Kiểm tra qua Knowledge Base chuyên sâu
      let detectedInteraction = null;

      if (drugA.kbDrug && drugA.kbDrug.interactions) {
        detectedInteraction = drugA.kbDrug.interactions.find(inter => {
          const matchTarget = inter.target.toLowerCase() === drugB.name.toLowerCase() ||
            (drugB.kbDrug && inter.target.toLowerCase() === drugB.kbDrug.activeIngredient.toLowerCase());
          const matchAlias = inter.targetAliases && inter.targetAliases.some(alias => 
            drugB.name.toLowerCase().includes(alias) || 
            (drugB.kbDrug && drugB.kbDrug.activeIngredient.toLowerCase().includes(alias))
          );
          return matchTarget || matchAlias;
        });
      }

      if (!detectedInteraction && drugB.kbDrug && drugB.kbDrug.interactions) {
        detectedInteraction = drugB.kbDrug.interactions.find(inter => {
          const matchTarget = inter.target.toLowerCase() === drugA.name.toLowerCase() ||
            (drugA.kbDrug && inter.target.toLowerCase() === drugA.kbDrug.activeIngredient.toLowerCase());
          const matchAlias = inter.targetAliases && inter.targetAliases.some(alias => 
            drugA.name.toLowerCase().includes(alias) || 
            (drugA.kbDrug && drugA.kbDrug.activeIngredient.toLowerCase().includes(alias))
          );
          return matchTarget || matchAlias;
        });
      }

      // Fallback về trường interactions mảng chuỗi trong DB
      if (!detectedInteraction) {
        const dbInterA = (drugA.dbDrug?.interactions || []).some(n => n.toLowerCase() === drugB.name.toLowerCase());
        const dbInterB = (drugB.dbDrug?.interactions || []).some(n => n.toLowerCase() === drugA.name.toLowerCase());
        if (dbInterA || dbInterB) {
          detectedInteraction = {
            severity: "HIGH",
            mechanism: `Tương tác chéo giữa ${drugA.name} và ${drugB.name}.`,
            recommendation: "Cân nhắc thay thế bằng thuốc tương đương hoặc theo dõi lâm sàng."
          };
        }
      }

      if (detectedInteraction) {
        const sev = detectedInteraction.severity || "HIGH";
        warnings.push({
          type: "INTERACTION",
          severity: sev,
          drugs: [drugA.name, drugB.name],
          message: `[Tương tác thuốc] ${drugA.name} ↔ ${drugB.name}: ${detectedInteraction.mechanism}`,
          recommendation: detectedInteraction.recommendation,
          source: "NeuroScan Clinical KB"
        });
        safetyScore -= sev === "CRITICAL" ? 35 : sev === "HIGH" ? 20 : 10;
      }
    }
  }

  // ── KIỂM TRA 3: TƯƠNG TÁC VỚI ĐƠN THUỐC CŨ (POLYPHARMACY / PAST PRESCRIPTIONS)
  for (const currentDrug of resolvedDrugs) {
    for (const pastDrug of recentDrugs) {
      if (currentDrug.name.toLowerCase() === pastDrug.name.toLowerCase()) {
        warnings.push({
          type: "DUPLICATION",
          severity: "MEDIUM",
          message: `[Trùng lặp điều trị] Thuốc "${currentDrug.name}" đang được kê trùng với ${pastDrug.source}.`,
          recommendation: "Kiểm tra xem bệnh nhân đã dùng hết thuốc đợt trước chưa để tránh quá liều.",
          source: "EHR History Engine"
        });
        safetyScore -= 10;
        continue;
      }

      if (currentDrug.kbDrug && currentDrug.kbDrug.interactions) {
        const inter = currentDrug.kbDrug.interactions.find(it => 
          it.target.toLowerCase() === pastDrug.name.toLowerCase() ||
          (it.targetAliases && it.targetAliases.some(a => pastDrug.name.toLowerCase().includes(a)))
        );
        if (inter) {
          warnings.push({
            type: "INTERACTION",
            severity: inter.severity,
            drugs: [currentDrug.name, pastDrug.name],
            message: `[Tương tác với đơn cũ] Thuốc đang kê "${currentDrug.name}" tương tác nguy hại với "${pastDrug.name}" (${pastDrug.source}): ${inter.mechanism}`,
            recommendation: inter.recommendation,
            source: "EHR Cross-Prescription Engine"
          });
          safetyScore -= 15;
        }
      }
    }
  }

  // ── KIỂM TRA 4: CHỐNG CHỈ ĐỊNH CHỨC NĂNG THẬN & GAN (LAB INTEGRATION) ───────
  for (const drug of resolvedDrugs) {
    const kb = drug.kbDrug;
    if (!kb) continue;

    // Chức năng Thận
    if (kb.renalNotes && (egfrValue !== null || creatinineValue !== null)) {
      const isRenalImpaired = (egfrValue !== null && egfrValue < 50) || (creatinineValue !== null && creatinineValue > 130);
      if (isRenalImpaired) {
        const sev = (egfrValue !== null && egfrValue < 30) ? "CRITICAL" : "HIGH";
        warnings.push({
          type: "RENAL_DOSE",
          severity: sev,
          drugName: drug.name,
          message: `[Cảnh báo Thận] Bệnh nhân có eGFR = ${egfrValue || "giảm"} ml/phút, Creatinine = ${creatinineValue || "tăng"} umol/L. Thuốc "${drug.name}": ${kb.renalNotes}`,
          recommendation: "Hiệu chỉnh giảm liều theo độ thanh thải thận hoặc xét nghiệm lại trước khi dùng.",
          source: "Lab Decision Support"
        });
        safetyScore -= sev === "CRITICAL" ? 30 : 15;
      }
    }

    // Chức năng Gan
    if (kb.hepaticNotes && (altValue !== null || astValue !== null)) {
      const isHepaticImpaired = (altValue && altValue > 120) || (astValue && astValue > 120); // > 3x ULN
      if (isHepaticImpaired) {
        warnings.push({
          type: "HEPATIC_DOSE",
          severity: "HIGH",
          drugName: drug.name,
          message: `[Cảnh báo Gan] Men gan bệnh nhân tăng cao (ALT: ${altValue || "N/A"}, AST: ${astValue || "N/A"}). Thuốc "${drug.name}": ${kb.hepaticNotes}`,
          recommendation: "Cân nhắc đổi thuốc không chuyển hóa qua gan (như Keppra) hoặc theo dõi men gan sau 3 ngày.",
          source: "Lab Decision Support"
        });
        safetyScore -= 20;
      }
    }
  }

  // ── KIỂM TRA 5: CẢNH BÁO LIỀU CORTICOSTEROID THEO BMI ───────────────────────
  if (bmi) {
    const hasCorticosteroid = resolvedDrugs.some(d => d.category === "corticosteroid");
    if (hasCorticosteroid && (bmi < 18.5 || bmi > 25.0)) {
      warnings.push({
        type: "BMI_DOSAGE",
        severity: "MEDIUM",
        message: `BMI bệnh nhân là ${bmi} (ngoài dải lý tưởng 18.5-25.0). Cân nhắc điều chỉnh liều Corticosteroid để giảm độc tính toàn thân hoặc tăng hiệu quả chống phù não.`,
        recommendation: "Tính liều theo diện tích bề mặt cơ thể (BSA) hoặc cân nặng lý tưởng.",
        source: "Clinical Physiology Engine"
      });
      safetyScore -= 10;
    }
  }

  // ── KIỂM TRA 6: CẢNH BÁO DỊ ỨNG THUỐC CẢN TỪ & DỊ ỨNG KHÁC ─────────────────
  const hasGadoliniumOrder = (orders || []).some(o => {
    const oName = typeof o === "string" ? o.toLowerCase() : (o.name || "").toLowerCase();
    return oName.includes("cản từ") || oName.includes("gadolinium") || oName.includes("tương phản") || oName.includes("mri");
  });

  if (hasGadoliniumOrder && allergies.some(a => a.toLowerCase().includes("gadolinium") || a.toLowerCase().includes("cản từ"))) {
    warnings.push({
      type: "ALLERGY_ADR",
      severity: "CRITICAL",
      message: "Cảnh báo dị ứng nghiêm trọng (ADR): Bệnh nhân có tiền sử dị ứng thuốc tương phản từ Gadolinium. Nguy cơ sốc phản vệ khi chụp MRI cản từ.",
      recommendation: "Chống chỉ định tiêm Gadolinium. Chuyển sang chuỗi xung MRI không tiêm thuốc (Native MRI/3D-TOF/DWI/FLAIR) hoặc hội chẩn tiền mê dùng kháng Histamin dự phòng.",
      source: "Allergy Surveillance"
    });
    safetyScore -= 40;
  }

  // ── KIỂM TRA 7: TRA CỨU OPENFDA LÀM GIÀU DỮ LIỆU CẢNH BÁO HỘP ĐEN ─────────
  for (const drug of resolvedDrugs.slice(0, 3)) { // Tra cứu nhanh tối đa 3 thuốc
    try {
      const fdaData = await queryOpenFdaDrug(drug.name);
      if (fdaData && fdaData.boxedWarning) {
        openFdaDetails.push(fdaData);
        // Nếu có Black Box Warning từ FDA thì bổ sung cảnh báo thông tin
        warnings.push({
          type: "BOXED_WARNING",
          severity: "MEDIUM",
          drugName: drug.name,
          message: `[Cảnh báo Hộp Đen FDA - ${drug.name}]: ${fdaData.boxedWarning}`,
          recommendation: "Đọc kỹ hướng dẫn sử dụng và dặn dò người bệnh về các dấu hiệu cảnh báo sớm.",
          source: "U.S. FDA Drug Safety Label"
        });
      }
    } catch (e) {
      // bỏ qua lỗi FDA nếu mất mạng
    }
  }

  // Chuẩn hóa điểm an toàn
  // ── KIỂM TRA 8: ĐỐI SOÁT PHÁC ĐỒ VỚI KẾT QUẢ AI NHẬN DIỆN KHỐI U NÃO ────────
  if (resolvedTumorAiResult && resolvedTumorAiResult.predicted_class) {
    const pClass = String(resolvedTumorAiResult.predicted_class).toLowerCase();

    // 8.1: Nếu AI phát hiện U Thần kinh đệm (Glioma/GBM)
    if (pClass.includes("glioma") || pClass.includes("thần kinh đệm") || pClass.includes("gbm")) {
      const hasEiaed = resolvedDrugs.find(d => 
        ["carbamazepine", "tegretol", "phenytoin", "dilantin", "phenobarbital", "gardenal"].some(a => d.name.toLowerCase().includes(a))
      );
      if (hasEiaed) {
        warnings.push({
          type: "TUMOR_PROTOCOL_MISMATCH",
          severity: "HIGH",
          drugName: hasEiaed.name,
          message: `[AI Phác đồ U Thần kinh đệm - Glioma] AI phát hiện Glioma (${resolvedTumorAiResult.confidence ? resolvedTumorAiResult.confidence + '%' : 'MRI'}). Thuốc chống co giật cảm ứng enzyme (${hasEiaed.name}) làm giảm nồng độ Temozolomide & Dexamethasone trong máu qua CYP3A4.`,
          recommendation: "Khuyến cáo đổi sang thuốc chống co giật không cảm ứng enzyme (Non-EIAED) như Levetiracetam (Keppra) 500mg.",
          source: "Neuro-Oncology AI Protocol Guard"
        });
        safetyScore -= 20;
      }
    }

    // 8.2: Nếu AI kết luận KHÔNG CÓ U (Notumor)
    if (pClass.includes("notumor") || pClass.includes("không u") || pClass.includes("bình thường")) {
      const hasChemo = resolvedDrugs.find(d => d.category === "chemotherapy");
      if (hasChemo) {
        warnings.push({
          type: "TUMOR_PROTOCOL_MISMATCH",
          severity: "CRITICAL",
          drugName: hasChemo.name,
          message: `[Cảnh báo Lệch Chỉ định Nghiêm trọng] Kết quả AI chẩn đoán hình ảnh kết luận KHÔNG PHÁT HIỆN KHỐI U NÃO (NOTUMOR). Đơn thuốc đang kê hóa chất độc tế bào (${hasChemo.name}).`,
          recommendation: "Hội chẩn khẩn cấp trước khi cấp phát hóa chất cho người bệnh.",
          source: "Neuro-Oncology AI Protocol Guard"
        });
        safetyScore -= 40;
      }
    }

    // 8.3: Nếu AI phát hiện U Tuyến yên (Pituitary Adenoma)
    if (pClass.includes("pituitary") || pClass.includes("tuyến yên") || pClass.includes("adenoma")) {
      const hasDopamineAntagonist = resolvedDrugs.find(d => 
        ["metoclopramide", "primperan", "haloperidol", "sulpiride", "dogmatil", "domperidone"].some(a => d.name.toLowerCase().includes(a))
      );
      if (hasDopamineAntagonist) {
        warnings.push({
          type: "TUMOR_PROTOCOL_MISMATCH",
          severity: "HIGH",
          drugName: hasDopamineAntagonist.name,
          message: `[Chống chỉ định U Tuyến yên] AI phát hiện tổn thương vùng hố sên / u tuyến yên. Thuốc kháng Dopamine (${hasDopamineAntagonist.name}) gây kích thích tăng tiết Prolactin mạnh.`,
          recommendation: "Tránh dùng thuốc kháng Dopamine ở bệnh nhân nghi ngờ u tuyến yên; thay bằng Ondansetron nếu cần chống nôn.",
          source: "Neuro-Oncology AI Protocol Guard"
        });
        safetyScore -= 20;
      }
    }
  }

  // Chuẩn hóa điểm an toàn
  safetyScore = Math.max(0, Math.min(100, safetyScore));
  let status = "SAFE";
  if (warnings.some(w => w.severity === "CRITICAL")) {
    status = "CRITICAL";
  } else if (warnings.some(w => w.severity === "HIGH") || safetyScore < 70) {
    status = "HIGH_RISK";
  } else if (warnings.length > 0 || safetyScore < 90) {
    status = "CAUTION";
  }

  // ── KIỂM TRA 9: THAM VẤN DƯỢC SĨ AI (NẾU ĐƯỢC YÊU CẦU HOẶC ĐƠN NGUY CƠ CAO) ──
  let aiConsultation = null;
  if (requestAi || status === "CRITICAL" || status === "HIGH_RISK") {
    const patientSummary = {
      patientId: patient?._id || patientId,
      name: patient?.profile?.name || "Bệnh nhân",
      age: patient?.profile?.dob ? (new Date().getFullYear() - new Date(patient.profile.dob).getFullYear()) : 45,
      gender: patient?.profile?.gender || "Nam",
      diagnosis: diagnosis || resolvedTumorAiResult?.predicted_class || "U não / Rối loạn thần kinh",
      allergies,
      bmi,
      creatinine: creatinineValue,
      egfr: egfrValue,
      alt: altValue,
      ast: astValue
    };

    const aiRes = await consultAiPharmacist({
      patientInfo: patientSummary,
      medications: medItems,
      diagnosis: diagnosis || resolvedTumorAiResult?.predicted_class || "U não / Rối loạn thần kinh",
      tumorAiResult: resolvedTumorAiResult
    });

    if (aiRes.success && aiRes.data) {
      aiConsultation = aiRes.data;
    }
  }

  return {
    safetyScore,
    status,
    warnings,
    classifications,
    openFdaDetails,
    aiConsultation,
    patientContext: {
      bmi,
      allergies,
      creatinine: creatinineValue,
      egfr: egfrValue,
      alt: altValue,
      ast: astValue,
      tumorAiResult: resolvedTumorAiResult,
      recentMedsCount: recentDrugs.length
    }
  };
}
