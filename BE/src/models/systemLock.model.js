import { Schema, model } from "mongoose";

const systemLockSchema = new Schema(
  {
    lockKey: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    holder: {
      type: String,
      required: true
    },
    acquiredAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // TTL Index: MongoDB tự động thu hồi khóa sau khi hết hạn
    }
  },
  { timestamps: true }
);

export const SystemLock = model("SystemLock", systemLockSchema);

/**
 * Thu nhận Khóa Phân Tán (Distributed Lock) trong MongoDB
 * Đảm bảo chỉ 1 node/instance duy nhất thực thi cron job hoặc tác vụ đối soát tại 1 thời điểm
 * @param {string} lockKey - Tên định danh của khóa (vd: "cron_reconcile_payos_inventory")
 * @param {object} options - ttlSeconds (thời hạn khóa), holder (định danh node)
 */
export async function acquireDistributedLock(lockKey, { ttlSeconds = 300, holder = `node_${process.pid}_${Date.now()}` } = {}) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  try {
    // 1. Dọn khóa quá hạn nếu có
    await SystemLock.deleteMany({ lockKey, expiresAt: { $lte: new Date() } });

    // 2. Thử tạo khóa mới nguyên tử (atomic insert)
    const lock = await SystemLock.create({
      lockKey,
      holder,
      acquiredAt: new Date(),
      expiresAt
    });

    return { acquired: true, lockKey, holder, lockId: lock._id };
  } catch (err) {
    if (err.code === 11000) {
      // Đã có instance khác đang nắm giữ khóa còn hiệu lực
      return { acquired: false, lockKey, reason: "LOCKED_BY_ANOTHER_INSTANCE" };
    }
    console.error("[DistributedLock Error]", err.message);
    return { acquired: false, lockKey, error: err.message };
  }
}

/**
 * Giải phóng Khóa Phân Tán sau khi hoàn tất tác vụ
 */
export async function releaseDistributedLock(lockKey, holder) {
  try {
    await SystemLock.deleteOne({ lockKey, holder });
    return true;
  } catch (err) {
    console.error("[DistributedLock Release Error]", err.message);
    return false;
  }
}
