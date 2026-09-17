import { Visit } from "../models/visit.model.js";
import { User } from "../models/user.model.js";
import { PeerReview } from "../models/peerReview.model.js";
import { ImagingResult } from "../models/imagingResult.model.js";
import { createNotificationInternal } from "../controllers/notification.controller.js";
import { sendFcmNotification } from "../services/fcm.service.js";

/**
 * A.6 — Scheduled Job Nhắc lịch chụp MRI 24h trước
 */
export const runMriReminderJob = async () => {
  try {
    const now = new Date();
    const targetStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const targetEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

    const upcomingVisits = await Visit.find({
      status: 'đang chờ',
      date: { $gte: targetStart, $lte: targetEnd },
      reminderSent: { $ne: true }
    }).setOptions({ bypassTenancy: true }).populate("patientId", "profile.name email profile.fcmToken");

    let count = 0;
    for (const visit of upcomingVisits) {
      if (visit.patientId) {
        await createNotificationInternal({
          hospitalId: visit.hospitalId,
          recipientId: visit.patientId._id,
          senderId: visit.doctorId || visit.patientId._id,
          type: "appointment_reminder",
          title: "⏰ Nhắc lịch chụp MRI (24h nữa)",
          message: `Kính gửi ${visit.patientId.profile?.name || 'quý khách'}, bạn có lịch hẹn chụp MRI vào ${new Date(visit.date).toLocaleString('vi-VN')}. Vui lòng đến trước 15 phút.`,
          relatedId: visit._id,
        });

        if (visit.patientId.profile?.fcmToken) {
          sendFcmNotification(visit.patientId.profile.fcmToken, {
            title: "⏰ Nhắc lịch chụp MRI",
            body: `Lịch hẹn MRI lúc ${new Date(visit.date).toLocaleTimeString('vi-VN')} ngày mai.`,
            data: { visitId: String(visit._id), type: "reminder" }
          }).catch(e => console.warn("FCM error:", e.message));
        }

        visit.reminderSent = true;
        await visit.save();
        count++;
      }
    }
    return { success: true, remindedCount: count };
  } catch (err) {
    console.error("❌ Lỗi runMriReminderJob:", err.message);
    return { success: false, error: err.message };
  }
};

/**
 * U.2 — Scheduled Job Nhắc gia hạn Premium (7 ngày trước expiry)
 */
export const runPremiumRenewalJob = async () => {
  try {
    const now = new Date();
    const targetStart = new Date(now.getTime() + 6.5 * 24 * 60 * 60 * 1000);
    const targetEnd = new Date(now.getTime() + 7.5 * 24 * 60 * 60 * 1000);

    const expiringUsers = await User.find({
      isPremium: true,
      autoRenew: true,
      premiumUntil: { $gte: targetStart, $lte: targetEnd },
      renewalReminderSent: { $ne: true }
    });

    let count = 0;
    for (const user of expiringUsers) {
      await createNotificationInternal({
        hospitalId: user.hospitalId || user._id,
        recipientId: user._id,
        senderId: user._id,
        type: "system",
        title: "💎 Nhắc gia hạn gói Premium",
        message: `Gói Premium của bạn sẽ hết hạn vào ${new Date(user.premiumUntil).toLocaleDateString('vi-VN')}. Hệ thống sẽ tự động tạo link gia hạn.`,
        relatedId: user._id,
      });

      user.renewalReminderSent = true;
      await user.save();
      count++;
    }
    return { success: true, remindedUsers: count };
  } catch (err) {
    console.error("❌ Lỗi runPremiumRenewalJob:", err.message);
    return { success: false, error: err.message };
  }
};

/**
 * P.2 — Scheduled Job Lấy mẫu ngẫu nhiên 5% ca đã ký để Bình duyệt QA (Peer Review)
 */
export const runPeerReviewSamplingJob = async () => {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Lấy tất cả ImagingResult đã ký trong tuần qua chưa từng được bình duyệt
    const signedResults = await ImagingResult.find({
      isSigned: true,
      signedAt: { $gte: oneWeekAgo },
      peerReviewId: null
    }).setOptions({ bypassTenancy: true });

    if (signedResults.length === 0) {
      return { success: true, sampledCount: 0, message: "Không có ca mới cần bình duyệt." };
    }

    // Chọn ngẫu nhiên 5% (tối thiểu 1 ca nếu có dữ liệu)
    const sampleSize = Math.max(1, Math.ceil(signedResults.length * 0.05));
    const shuffled = [...signedResults].sort(() => 0.5 - Math.random());
    const sampled = shuffled.slice(0, sampleSize);

    let createdCount = 0;
    for (const item of sampled) {
      const review = new PeerReview({
        hospitalId: item.hospitalId,
        imagingResultId: item._id,
        visitId: item.visitId,
        primaryDoctorId: item.signedBy, // BUG-04 FIX: field is 'signedBy' not 'signedByDoctorId'
        requestType: 'random_qa',       // BUG-03 FIX: field is 'requestType' not 'samplingType'
        status: 'pending',
      });
      await review.save();

      item.peerReviewId = review._id;
      await item.save();
      createdCount++;
    }

    return { success: true, sampledCount: createdCount };
  } catch (err) {
    console.error("❌ Lỗi runPeerReviewSamplingJob:", err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Khởi tạo định kỳ chạy background jobs
 */
export const startBackgroundJobs = () => {
  console.log("⏱️  Background Scheduler đã được kích hoạt.");

  // Chạy nhắc lịch MRI mỗi 1 giờ
  setInterval(() => {
    runMriReminderJob();
  }, 60 * 60 * 1000);

  // Chạy nhắc Premium mỗi 12 giờ
  setInterval(() => {
    runPremiumRenewalJob();
  }, 12 * 60 * 60 * 1000);

  // Chạy Peer Review QA sampling mỗi 24 giờ
  setInterval(() => {
    runPeerReviewSamplingJob();
  }, 24 * 60 * 60 * 1000);
};

export default {
  runMriReminderJob,
  runPremiumRenewalJob,
  runPeerReviewSamplingJob,
  startBackgroundJobs
};
