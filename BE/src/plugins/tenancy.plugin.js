import { tenantStorage } from "../middlewares/tenant.middleware.js";

export const tenancyPlugin = (schema) => {
  const applyTenancy = function(next) {
    const store = tenantStorage.getStore();
    if (store && store.hospitalId) {
      const query = this.getQuery();
      // Chỉ tự động chèn hospitalId nếu câu truy vấn chưa chỉ định rõ hospitalId
      if (query.hospitalId === undefined) {
        this.where({ hospitalId: store.hospitalId });
      }
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

  // Hook lưu bản ghi mới (Tự động gán hospitalId trước khi validate)
  schema.pre("validate", function(next) {
    const store = tenantStorage.getStore();
    if (store && store.hospitalId && !this.hospitalId) {
      this.hospitalId = store.hospitalId;
    }
    next();
  });
};

export default tenancyPlugin;
