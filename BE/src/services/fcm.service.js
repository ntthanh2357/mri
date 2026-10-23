import admin from "firebase-admin";

let isFirebaseInitialized = false;

// Đăng ký Firebase Admin nếu chưa khởi tạo
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    isFirebaseInitialized = true;
    console.log("✅ FCM Service: Firebase Admin SDK đã khởi tạo thành công.");
  } else {
    console.log("ℹ️ FCM Service: FIREBASE_SERVICE_ACCOUNT chưa được cấu hình. Push notification sẽ không được gửi.");
  }
} catch (err) {
  console.warn("⚠️ FCM Service: Lỗi khởi tạo Firebase Admin:", err.message);
}

/**
 * Gửi Push Notification qua FCM đến thiết bị di động
 * @param {string|string[]} targetTokens - Token hoặc danh sách FCM tokens
 * @param {object} payload - { title, body, data }
 */
export const sendFcmNotification = async (targetTokens, { title, body, data = {} }) => {
  const tokens = Array.isArray(targetTokens)
    ? targetTokens.filter(t => typeof t === 'string' && t.trim() !== '')
    : (typeof targetTokens === 'string' && targetTokens.trim() !== '' ? [targetTokens] : []);

  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, message: "Không có FCM token hợp lệ." };
  }

  // Chưa có Firebase Credentials thì không gửi được, báo đúng là chưa gửi
  if (!isFirebaseInitialized) {
    console.warn(`📱 [FCM Not Configured] Bỏ qua push tới ${tokens.length} thiết bị (FIREBASE_SERVICE_ACCOUNT chưa cấu hình).`);
    return { successCount: 0, failureCount: tokens.length, skipped: true, reason: "FCM_NOT_CONFIGURED" };
  }

  try {
    const message = {
      notification: { title, body },
      data: Object.keys(data).reduce((acc, key) => {
        acc[key] = String(data[key]);
        return acc;
      }, {}),
    };

    if (tokens.length === 1) {
      const response = await admin.messaging().send({
        token: tokens[0],
        ...message
      });
      return { successCount: 1, failureCount: 0, responseId: response };
    } else {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        ...message
      });
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses
      };
    }
  } catch (err) {
    console.error("❌ Lỗi gửi Push Notification qua FCM:", err.message);
    return { successCount: 0, failureCount: tokens.length, error: err.message };
  }
};

export default { sendFcmNotification };
