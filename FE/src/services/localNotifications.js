import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Thông báo hẹn sẵn trên điện thoại (không cần máy chủ đẩy, chạy được cả trên Expo Go).
// Bản web: localNotifications.web.js (không làm gì). Kế hoạch lập ở utils/notificationPlan.js.

const PREFIX = 'neuroscan-'; // chỉ đụng tới thông báo do app này hẹn
const CHANNEL = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const ensurePermission = async () => {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
};

const cancelPending = async () => {
  const list = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(list.filter((n) => n.identifier?.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
};

/** Hết phiên (đăng xuất, bị thu hồi, hết hạn): huỷ thông báo đã hẹn và xoá thông báo còn trong khay. */
export const cancelScheduled = async () => {
  await cancelPending();
  await Notifications.dismissAllNotificationsAsync();
};

/** Thay toàn bộ thông báo đã hẹn bằng `plan` [{ key, date, title, body }]. Trả { ok, count } hoặc { ok: false, reason }. */
export const syncScheduled = async (plan) => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Nhắc uống thuốc và lịch khám',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE, // màn khoá chỉ hiện "có thông báo"
    });
  }
  if (!(await ensurePermission())) return { ok: false, reason: 'denied' };
  await cancelPending();
  for (const item of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: PREFIX + item.key,
      content: { title: item.title, body: item.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.date, channelId: CHANNEL },
    });
  }
  return { ok: true, count: plan.length };
};
