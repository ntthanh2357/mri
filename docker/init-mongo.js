/**
 * NeuroScan AI - MongoDB Least-Privilege Initialization Script
 * Tự động tạo người dùng chuyên dụng với quyền tối thiểu (Least-Privilege: readWrite)
 * trên cơ sở dữ liệu 'neuroscan', chặn nguy cơ ứng dụng chạy với quyền root/admin.
 */
db = db.getSiblingDB("neuroscan");

const appUser = process.env.MONGO_APP_USERNAME || "neuroscan_app";
const appPassword = process.env.MONGO_APP_PASSWORD || "ChangeThisSecretInProduction_123!";

if (!db.getUser(appUser)) {
  db.createUser({
    user: appUser,
    pwd: appPassword,
    roles: [
      {
        role: "readWrite",
        db: "neuroscan",
      },
    ],
  });
  print(`[SECURITY] Đã tạo thành công DB user "${appUser}" với đặc quyền tối thiểu [readWrite] trên CSDL "neuroscan".`);
}
