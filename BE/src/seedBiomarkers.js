import mongoose from "mongoose";
import dotenv from "dotenv";
import { Biomarker } from "./models/biomarker.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/neuro";

const BIOMARKERS_DATA = [
  // ─── HUYẾT HỌC (17 chỉ số) ─────────────────────────────────────────────────
  {
    code: "WBC",
    name: "Bạch Cầu (WBC)",
    category: "HUYET_HOC",
    unit: "10^9/L",
    reference_range: {
      male:   { min: 4.0,  max: 10.0 },
      female: { min: 4.0,  max: 10.0 }
    }
  },
  {
    code: "NEU_PCT",
    name: "Bạch cầu Trung tính % (NEU%)",
    category: "HUYET_HOC",
    unit: "%",
    reference_range: {
      male:   { min: 50,   max: 75  },
      female: { min: 50,   max: 75  }
    }
  },
  {
    code: "NEU_ABS",
    name: "Bạch cầu Trung tính # (NEU#)",
    category: "HUYET_HOC",
    unit: "10^9/L",
    reference_range: {
      male:   { min: 1.7,  max: 7.5 },
      female: { min: 1.7,  max: 7.5 }
    }
  },
  {
    code: "LYM_PCT",
    name: "Lymphocyte % (LYM%)",
    category: "HUYET_HOC",
    unit: "%",
    reference_range: {
      male:   { min: 20,   max: 45  },
      female: { min: 20,   max: 45  }
    }
  },
  {
    code: "LYM_ABS",
    name: "Lymphocyte # (LYM#)",
    category: "HUYET_HOC",
    unit: "10^9/L",
    reference_range: {
      male:   { min: 0.4,  max: 4.5 },
      female: { min: 0.4,  max: 4.5 }
    }
  },
  {
    code: "MONO_PCT",
    name: "Monocyte % (MONO%)",
    category: "HUYET_HOC",
    unit: "%",
    reference_range: {
      male:   { min: 0,    max: 9   },
      female: { min: 0,    max: 9   }
    }
  },
  {
    code: "EOS_PCT",
    name: "Bạch cầu Ưa Acid % (EOS%)",
    category: "HUYET_HOC",
    unit: "%",
    reference_range: {
      male:   { min: 0,    max: 6   },
      female: { min: 0,    max: 6   }
    }
  },
  {
    code: "BASO_PCT",
    name: "Bạch cầu Ưa Base % (BASO%)",
    category: "HUYET_HOC",
    unit: "%",
    reference_range: {
      male:   { min: 0,    max: 1   },
      female: { min: 0,    max: 1   }
    }
  },
  {
    code: "RBC",
    name: "Hồng Cầu (RBC)",
    category: "HUYET_HOC",
    unit: "10^12/L",
    reference_range: {
      male:   { min: 4.2,  max: 5.4 },
      female: { min: 3.8,  max: 5.0 }
    }
  },
  {
    code: "HGB",
    name: "Huyết Sắc Tố (HGB)",
    category: "HUYET_HOC",
    unit: "g/L",
    reference_range: {
      male:   { min: 130,  max: 180 },
      female: { min: 120,  max: 160 }
    }
  },
  {
    code: "HCT",
    name: "Hematocrit (HCT)",
    category: "HUYET_HOC",
    unit: "%",
    reference_range: {
      male:   { min: 38,   max: 55  },
      female: { min: 35,   max: 49  }
    }
  },
  {
    code: "MCV",
    name: "Thể tích TB hồng cầu (MCV)",
    category: "HUYET_HOC",
    unit: "fL",
    reference_range: {
      male:   { min: 80,   max: 97  },
      female: { min: 80,   max: 97  }
    }
  },
  {
    code: "MCH",
    name: "Lượng HGB TB hồng cầu (MCH)",
    category: "HUYET_HOC",
    unit: "pg",
    reference_range: {
      male:   { min: 26,   max: 32  },
      female: { min: 26,   max: 32  }
    }
  },
  {
    code: "MCHC",
    name: "Nồng độ HGB TB hồng cầu (MCHC)",
    category: "HUYET_HOC",
    unit: "g/L",
    reference_range: {
      male:   { min: 320,  max: 360 },
      female: { min: 320,  max: 360 }
    }
  },
  {
    code: "RDW",
    name: "Phân bố kích thước hồng cầu (RDW)",
    category: "HUYET_HOC",
    unit: "%",
    reference_range: {
      male:   { min: 10,   max: 15  },
      female: { min: 10,   max: 15  }
    }
  },
  {
    code: "PLT",
    name: "Tiểu Cầu (PLT)",
    category: "HUYET_HOC",
    unit: "10^9/L",
    reference_range: {
      male:   { min: 150,  max: 450 },
      female: { min: 150,  max: 450 }
    }
  },
  {
    code: "MPV",
    name: "Thể tích TB tiểu cầu (MPV)",
    category: "HUYET_HOC",
    unit: "fL",
    reference_range: {
      male:   { min: 5,    max: 11  },
      female: { min: 5,    max: 11  }
    }
  },

  // ─── HÓA SINH (18 chỉ số) ──────────────────────────────────────────────────
  {
    code: "UREA",
    name: "Urê (Thận)",
    category: "HOA_SINH",
    unit: "mmol/L",
    reference_range: {
      male:   { min: 2.5,  max: 7.5  },
      female: { min: 2.5,  max: 7.5  }
    }
  },
  {
    code: "GLU",
    name: "Glucose (Đường huyết)",
    category: "HOA_SINH",
    unit: "mmol/L",
    reference_range: {
      male:   { min: 3.9,  max: 6.4  },
      female: { min: 3.9,  max: 6.4  }
    }
  },
  {
    code: "CRE",
    name: "Creatinin (Thận)",
    category: "HOA_SINH",
    unit: "μmol/L",
    reference_range: {
      male:   { min: 62,   max: 120  },
      female: { min: 44,   max: 97   }
    }
  },
  {
    code: "ACID_URIC",
    name: "Acid Uric",
    category: "HOA_SINH",
    unit: "μmol/L",
    reference_range: {
      male:   { min: 180,  max: 420  },
      female: { min: 150,  max: 360  }
    }
  },
  {
    code: "BILI_TP",
    name: "Bilirubin Toàn Phần",
    category: "HOA_SINH",
    unit: "μmol/L",
    reference_range: {
      male:   { min: null, max: 17   },
      female: { min: null, max: 17   }
    }
  },
  {
    code: "CHOL",
    name: "Cholesterol Toàn Phần",
    category: "HOA_SINH",
    unit: "mmol/L",
    reference_range: {
      male:   { min: 3.9,  max: 5.2  },
      female: { min: 3.9,  max: 5.2  }
    }
  },
  {
    code: "TRIG",
    name: "Triglycerid",
    category: "HOA_SINH",
    unit: "mmol/L",
    reference_range: {
      male:   { min: 0.46, max: 1.88 },
      female: { min: 0.46, max: 1.88 }
    }
  },
  {
    code: "HDL",
    name: "HDL-Cholesterol",
    category: "HOA_SINH",
    unit: "mmol/L",
    reference_range: {
      male:   { min: 0.9,  max: null },
      female: { min: 1.0,  max: null }
    }
  },
  {
    code: "LDL",
    name: "LDL-Cholesterol",
    category: "HOA_SINH",
    unit: "mmol/L",
    reference_range: {
      male:   { min: null, max: 3.4  },
      female: { min: null, max: 3.4  }
    }
  },
  {
    code: "NA",
    name: "Natri (Na+)",
    category: "HOA_SINH",
    unit: "mmol/L",
    reference_range: {
      male:   { min: 135,  max: 145  },
      female: { min: 135,  max: 145  }
    }
  },
  {
    code: "K",
    name: "Kali (K+)",
    category: "HOA_SINH",
    unit: "mmol/L",
    reference_range: {
      male:   { min: 3.5,  max: 5.0  },
      female: { min: 3.5,  max: 5.0  }
    }
  },
  {
    code: "CL",
    name: "Chloride (Cl-)",
    category: "HOA_SINH",
    unit: "mmol/L",
    reference_range: {
      male:   { min: 98,   max: 106  },
      female: { min: 98,   max: 106  }
    }
  },
  {
    code: "CA",
    name: "Canxi (Ca2+)",
    category: "HOA_SINH",
    unit: "mmol/L",
    reference_range: {
      male:   { min: 2.15, max: 2.6  },
      female: { min: 2.15, max: 2.6  }
    }
  },
  {
    code: "AST",
    name: "AST (GOT) - Men gan",
    category: "HOA_SINH",
    unit: "U/L",
    reference_range: {
      male:   { min: null, max: 37   },
      female: { min: null, max: 31   }
    }
  },
  {
    code: "ALT",
    name: "ALT (GPT) - Men gan",
    category: "HOA_SINH",
    unit: "U/L",
    reference_range: {
      male:   { min: null, max: 40   },
      female: { min: null, max: 33   }
    }
  },
  {
    code: "GGT",
    name: "GGT (Gamma-GT)",
    category: "HOA_SINH",
    unit: "U/L",
    reference_range: {
      male:   { min: 11,   max: 50   },
      female: { min: 7,    max: 32   }
    }
  },
  {
    code: "PROTEIN_TP",
    name: "Protein Toàn Phần",
    category: "HOA_SINH",
    unit: "g/L",
    reference_range: {
      male:   { min: 65,   max: 82   },
      female: { min: 65,   max: 82   }
    }
  },
  {
    code: "ALBUMIN",
    name: "Albumin",
    category: "HOA_SINH",
    unit: "g/L",
    reference_range: {
      male:   { min: 35,   max: 50   },
      female: { min: 35,   max: 50   }
    }
  },
];

const seedBiomarkers = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected successfully.");

    // Xóa biomarkers cũ nếu có để tránh trùng
    const existing = await Biomarker.countDocuments();
    if (existing > 0) {
      console.log(`⚠️  Tìm thấy ${existing} biomarker trong DB — đang xóa để seed lại...`);
      await Biomarker.deleteMany({});
    }

    console.log(`📥 Đang insert ${BIOMARKERS_DATA.length} biomarkers...`);
    const result = await Biomarker.insertMany(BIOMARKERS_DATA);
    
    const hoaSinh = result.filter(b => b.category === "HOA_SINH").length;
    const huyetHoc = result.filter(b => b.category === "HUYET_HOC").length;

    console.log(`\n✅ Seed biomarkers hoàn tất!`);
    console.log(`   📊 Tổng cộng: ${result.length} biomarkers`);
    console.log(`   🧪 Hóa sinh:   ${hoaSinh} chỉ số`);
    console.log(`   🩸 Huyết học:  ${huyetHoc} chỉ số`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed thất bại:", error);
    process.exit(1);
  }
};

seedBiomarkers();
