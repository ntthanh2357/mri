import { tenantStorage } from "../middlewares/tenant.middleware.js";

export const tenancyPlugin = (schema) => {
  const applyTenancy = function(next) {
    const store = tenantStorage.getStore();
    if (store && store.hospitalId) {
      // Ép buộc hospitalId theo tenant context hiện tại để chống IDOR và Query Tampering
      this.where({ hospitalId: store.hospitalId });
    }
    next();
  };

  // Các hook truy vấn y khoa
  schema.pre("find", applyTenancy);
  schema.pre("findOne", applyTenancy);
  schema.pre("countDocuments", applyTenancy);
  
  // Các hook cập nhật
  schema.pre("findOneAndUpdate", applyTenancy);
  schema.pre("updateOne", applyTenancy);
  schema.pre("updateMany", applyTenancy);

  // Các hook xóa
  schema.pre("findOneAndDelete", applyTenancy);
  schema.pre("deleteOne", applyTenancy);
  schema.pre("deleteMany", applyTenancy);

  // Hook lưu bản ghi mới (Luôn ép buộc hospitalId từ context nếu đang trong phiên đa viện)
  schema.pre("validate", function(next) {
    const store = tenantStorage.getStore();
    if (store && store.hospitalId) {
      this.hospitalId = store.hospitalId;
    }
    next();
  });
};

export default tenancyPlugin;
