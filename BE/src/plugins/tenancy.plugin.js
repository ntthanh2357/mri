import { tenantStorage } from "../middlewares/tenant.middleware.js";

export const tenancyPlugin = (schema) => {
  const applyTenancy = function(next) {
    try {
      const store = tenantStorage.getStore();
      const queryOpts = typeof this.getOptions === "function" ? this.getOptions() : {};

      // 1. Cho phép bỏ qua có chủ đích qua query options (dành cho batch job, migration, hệ thống chuyển viện)
      if (queryOpts && queryOpts.bypassTenancy === true) {
        return next();
      }

      // 2. Nếu có store và là Super Admin / bypassTenancy
      if (store && (store.isSuperAdmin || store.bypassTenancy)) {
        return next();
      }

      // 3. Nếu có store và có hospitalId: Ép buộc hospitalId theo tenant context hiện tại để chống IDOR
      if (store && store.hospitalId) {
        if (typeof this.where === "function") {
          this.where({ hospitalId: store.hospitalId });
        }
        return next();
      }

      // 4. Fail-safe: Nếu store tồn tại nhưng không có hospitalId và không phải Super Admin
      // Tuyệt đối không cho phép truy vấn mở toàn hệ thống -> Ép về điều kiện rỗng
      if (store && !store.hospitalId && !store.isSuperAdmin) {
        if (typeof this.where === "function") {
          this.where({ _id: null });
        }
        return next();
      }

      // 5. Fail-safe: Nếu store không tồn tại (AsyncLocalStorage Context Loss):
      // Nếu query hoàn toàn không có hospitalId và không có _id cụ thể -> Ép về rỗng để chặn rò rỉ dữ liệu
      const currentFilter = typeof this.getQuery === "function" ? this.getQuery() : {};
      if (!currentFilter || (!currentFilter.hospitalId && !currentFilter._id)) {
        if (typeof this.where === "function") {
          this.where({ _id: null });
        }
      }
      next();
    } catch (err) {
      next(err);
    }
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

