import { Drug } from "../models/drug.model.js";
import { User } from "../models/user.model.js";
import { VitalSign } from "../models/vitalSign.model.js";
import { successResponse, errorResponse } from "../utils/response.util.js";

// Danh mục thuốc mặc định phục vụ kiểm tra lâm sàng thần kinh
const defaultDrugs = [
    {
        name: "Keppra",
        category: "anticonvulsant",
        dosageInstructions: "500mg - 1500mg mỗi ngày, chia 2 lần",
        interactions: ["Depakine", "Tegretol"]
    },
    {
        name: "Depakine",
        category: "anticonvulsant",
        dosageInstructions: "20mg - 30mg/kg/ngày",
        interactions: ["Keppra", "Phenobarbital", "Diazepam"]
    },
    {
        name: "Tegretol",
        category: "anticonvulsant",
        dosageInstructions: "200mg - 1200mg mỗi ngày",
        interactions: ["Keppra"]
    },
    {
        name: "Phenobarbital",
        category: "psychotropic",
        dosageInstructions: "50mg - 200mg uống trước khi đi ngủ",
        interactions: ["Depakine", "Diazepam", "Donepezil"]
    },
    {
        name: "Diazepam",
        category: "psychotropic",
        dosageInstructions: "2mg - 10mg mỗi ngày",
        interactions: ["Phenobarbital", "Depakine"]
    },
    {
        name: "Dexamethasone",
        category: "corticosteroid",
        dosageInstructions: "4mg - 16mg mỗi ngày uống sáng sau ăn",
        interactions: []
    },
    {
        name: "Donepezil",
        category: "other",
        dosageInstructions: "5mg - 10mg uống tối trước ngủ",
        interactions: ["Phenobarbital"]
    }
];

export const checkPrescription = async (req, res) => {
    try {
        const { patientId, medications, orders } = req.body;

        if (!patientId) {
            return errorResponse(res, "Thiếu thông tin bệnh nhân.", 400);
        }

        // Lấy thông tin dị ứng từ hồ sơ
        let patient = null;
        try {
            patient = await User.findById(patientId);
        } catch (e) {
            // Ignore CastError if patientId is not a valid ObjectId
        }
        let allergies = ["Gadolinium"]; // Mặc định giả lập dị ứng cản từ để dễ demo lâm sàng
        if (patient && patient.profile && Array.isArray(patient.profile.allergies)) {
            allergies = patient.profile.allergies;
        }

        // Lấy sinh hiệu đo gần nhất để tính toán BMI
        const latestVital = await VitalSign.findOne({ patient_id: patientId }).sort({ recorded_at: -1 }).lean();

        const warnings = [];
        const classifications = [];

        // Chuyển đổi danh sách thuốc truyền vào
        const medNames = (medications || []).map(m => typeof m === "string" ? m : m.name);

        // Truy vấn thông tin hoạt chất thuốc
        const dbDrugs = await Drug.find({ name: { $in: medNames } }).lean();
        const activeDrugs = medNames.map(name => {
            const dbDrug = dbDrugs.find(d => d.name.toLowerCase() === name.toLowerCase());
            if (dbDrug) return dbDrug;
            const defDrug = defaultDrugs.find(d => d.name.toLowerCase() === name.toLowerCase());
            return defDrug || { name, category: "other", interactions: [] };
        });

        // 1. Phân loại thuốc hướng tâm thần
        activeDrugs.forEach(drug => {
            if (drug.category === "psychotropic") {
                classifications.push({
                    name: drug.name,
                    type: "Hướng tâm thần",
                    warning: "Thuốc hướng tâm thần (Cần lập đơn thuốc kiểm soát đặc biệt theo quy chế)."
                });
            }
        });

        // 2. Kiểm tra tương tác thuốc chéo (Drug-Drug Interaction)
        for (let i = 0; i < activeDrugs.length; i++) {
            for (let j = i + 1; j < activeDrugs.length; j++) {
                const drugA = activeDrugs[i];
                const drugB = activeDrugs[j];

                const interactsA = (drugA.interactions || []).some(name => name.toLowerCase() === drugB.name.toLowerCase());
                const interactsB = (drugB.interactions || []).some(name => name.toLowerCase() === drugA.name.toLowerCase());

                if (interactsA || interactsB) {
                    warnings.push({
                        type: "INTERACTION",
                        severity: "HIGH",
                        message: `Tương tác thuốc nguy hại giữa ${drugA.name} và ${drugB.name}. Nguy cơ gây ức chế hệ thần kinh trung ương hoặc biến đổi nồng độ hoạt chất trong huyết thanh.`
                    });
                }
            }
        }

        // 3. Cảnh báo liều lượng Corticosteroid theo BMI
        let bmi = null;
        if (latestVital && latestVital.weight && latestVital.height) {
            bmi = Number((latestVital.weight / Math.pow(latestVital.height / 100, 2)).toFixed(2));
        }

        if (bmi) {
            const hasCorticosteroid = activeDrugs.some(d => d.category === "corticosteroid");
            if (hasCorticosteroid && (bmi < 18.5 || bmi > 25.0)) {
                warnings.push({
                    type: "BMI_DOSAGE",
                    severity: "MEDIUM",
                    message: `Bệnh nhân có chỉ số BMI hiện tại là ${bmi} (ngoài dải an toàn 18.5 - 25.0). Cân nhắc điều chỉnh liều Corticosteroid phù hợp để tránh nguy cơ suy thượng thận cấp hoặc hội chứng Cushing.`
                });
            }
        }

        // 4. Cảnh báo dị ứng ADR (Thuốc cản từ/Gadolinium)
        const hasGadoliniumOrder = (orders || []).some(o => {
            const oName = typeof o === "string" ? o.toLowerCase() : o.name.toLowerCase();
            return oName.includes("cản từ") || oName.includes("gadolinium") || oName.includes("tương phản") || oName.includes("mri");
        });

        if (hasGadoliniumOrder && allergies.includes("Gadolinium")) {
            warnings.push({
                type: "ALLERGY_ADR",
                severity: "CRITICAL",
                message: "Cảnh báo dị ứng nghiêm trọng (ADR): Người bệnh có tiền sử dị ứng với thuốc tương phản cản từ Gadolinium. Không sử dụng thuốc cản từ khi chụp MRI sọ não!"
            });
        }
        return successResponse(res, { warnings, classifications, bmi, allergies }, "Kiểm tra dược lâm sàng thành công.");
    } catch (error) {
        console.error("Lỗi kiểm tra dược lâm sàng:", error);
        return errorResponse(res, "Lỗi kiểm tra dược lâm sàng hệ thống.", 500);
    }
};