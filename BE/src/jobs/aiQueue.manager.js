/**
 * NeuroScan AI - Asynchronous AI Job Worker Queue Manager
 * Quản lý hàng đợi suy luận AI, kiểm soát đồng thời (Concurrency Control = 2),
 * và ưu tiên lập lịch cho ca cấp cứu (Priority Queue) để bảo vệ máy chủ AI FastAPI không bị nghẽn.
 */

import { EventEmitter } from "events";

class AiQueueManager extends EventEmitter {
  constructor(concurrency = 2) {
    super();
    this.concurrency = concurrency;
    this.queue = [];         // Hàng đợi các job đang chờ
    this.runningJobs = new Map(); // Map jobId -> timestamp bắt đầu
    this.stats = {
      totalEnqueued: 0,
      totalCompleted: 0,
      totalFailed: 0,
    };
  }

  /**
   * Đưa một job AI vào hàng đợi xử lý
   * @param {Object} item { jobId, hospitalId, priority, executeFn }
   * priority: 1 = Cấp cứu (được chèn lên đầu hàng đợi), 5 = Thường (xếp cuối)
   */
  enqueue(item) {
    const { jobId, priority = 5, executeFn } = item;
    if (!jobId || typeof executeFn !== "function") {
      throw new Error("AiQueueManager: Cần cung cấp jobId và executeFn");
    }

    this.stats.totalEnqueued++;

    // Lập lịch ưu tiên: Nếu priority == 1 (cấp cứu), chèn vào sau các ca cấp cứu khác nhưng đứng trước ca thường
    if (priority === 1) {
      const firstNormalIndex = this.queue.findIndex(j => j.priority > 1);
      if (firstNormalIndex === -1) {
        this.queue.push(item);
      } else {
        this.queue.splice(firstNormalIndex, 0, item);
      }
      console.log(`🚨 [AiQueue] Ca cấp cứu #${jobId} được ưu tiên đưa lên đầu hàng đợi.`);
    } else {
      this.queue.push(item);
      console.log(`📥 [AiQueue] Job #${jobId} được xếp vào hàng đợi (vị trí: ${this.queue.length}).`);
    }

    // Kích hoạt worker xử lý
    setImmediate(() => this._processNext());
    return { queued: true, position: this.queue.findIndex(j => j.jobId === jobId) + 1 };
  }

  async _processNext() {
    if (this.runningJobs.size >= this.concurrency) {
      return; // Đã đạt giới hạn số lượng tác vụ AI chạy đồng thời
    }

    if (this.queue.length === 0) {
      return; // Không còn job trong hàng đợi
    }

    const nextJob = this.queue.shift();
    const { jobId, hospitalId, executeFn } = nextJob;

    this.runningJobs.set(jobId.toString(), Date.now());
    console.log(`⚙️ [AiQueue] Đang xử lý Job #${jobId} (Đang chạy: ${this.runningJobs.size}/${this.concurrency})`);

    try {
      await executeFn(jobId, hospitalId);
      this.stats.totalCompleted++;
      console.log(`✅ [AiQueue] Job #${jobId} hoàn tất thành công.`);
      this.emit("jobCompleted", { jobId });
    } catch (err) {
      this.stats.totalFailed++;
      console.error(`❌ [AiQueue] Job #${jobId} thất bại:`, err.message);
      this.emit("jobFailed", { jobId, error: err.message });
    } finally {
      this.runningJobs.delete(jobId.toString());
      // Tiếp tục lấy job tiếp theo trong hàng đợi
      setImmediate(() => this._processNext());
    }
  }

  getStats() {
    return {
      concurrency: this.concurrency,
      runningCount: this.runningJobs.size,
      queuedCount: this.queue.length,
      totalEnqueued: this.stats.totalEnqueued,
      totalCompleted: this.stats.totalCompleted,
      totalFailed: this.stats.totalFailed,
      queuedJobIds: this.queue.map(j => ({ id: j.jobId, priority: j.priority })),
    };
  }
}

export const aiQueueManager = new AiQueueManager(2);
export default aiQueueManager;
