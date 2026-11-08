import { Schema, model } from "mongoose";

// Mốc đầu chuỗi audit, có chữ ký bằng khóa ngoài DB. Người chỉ có quyền ghi DB
// không tạo được chữ ký hợp lệ, nên xóa bản ghi cuối chuỗi sẽ bị phát hiện.
const auditChainAnchorSchema = new Schema(
  {
    _id: { type: String, default: "head" },
    sequenceNumber: { type: Number, required: true },
    currentHash: { type: String, required: true },
    // Từ số thứ tự này trở đi mọi bản ghi phải ở định dạng v2. Ký cùng mốc nên không sửa lén được.
    v2FromSequence: { type: Number, required: true },
    signature: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

export const AuditChainAnchor = model("AuditChainAnchor", auditChainAnchorSchema);
export default AuditChainAnchor;
