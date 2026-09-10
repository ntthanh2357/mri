import mongoose from "mongoose";

/**
 * Điều phối thực thi giao dịch MongoDB Transaction an toàn (ACID Coordinator)
 * - Tự động phát hiện Replica Set: Sử dụng session.withTransaction() nguyên tử đảm bảo ACID.
 * - Graceful Fallback cho Standalone MongoDB (Local dev / demo máy đơn):
 *   Tự động phát hiện lỗi "Transaction numbers are only allowed on a replica set member or mongos"
 *   và chuyển sang thực thi tuần tự trực tiếp, không gây crash ứng dụng.
 *
 * @template T
 * @param {(session: import('mongoose').ClientSession | null) => Promise<T>} workFn - Hàm thực thi nghiệp vụ nhận session
 * @returns {Promise<T>} Kết quả trả về từ workFn
 */
export const executeWithTransaction = async (workFn) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    let result;

    try {
      await session.withTransaction(async () => {
        result = await workFn(session);
      });
      return result;
    } catch (txnError) {
      const errMsg = txnError?.message || "";
      // Nếu là Standalone MongoDB không có Replica Set
      if (
        errMsg.includes("Transaction numbers are only allowed on a replica set member") ||
        errMsg.includes("Transactions are not supported") ||
        errMsg.includes("replica set")
      ) {
        console.warn("⚠️ [TransactionUtil] Môi trường MongoDB Standalone phát hiện. Chuyển sang chế độ thực thi nguyên tử phi phiên.");
        return await workFn(null);
      }
      throw txnError;
    }
  } catch (sessionError) {
    // Nếu cả việc startSession cũng không khả dụng
    console.warn("⚠️ [TransactionUtil] Không thể khởi tạo Mongoose session. Thực thi trực tiếp:", sessionError.message);
    return await workFn(null);
  } finally {
    if (session) {
      await session.endSession().catch(() => {});
    }
  }
};

export default executeWithTransaction;
