// Loader hook cho test Node: thay module native (react-native, AsyncStorage, navigation, expo-notifications)
// bằng bản giả chạy được trên Node, và cho phép import tương đối không đuôi ".js" như Metro bundler.
const STUBS = {
  "react-native": `export const Platform = { OS: globalThis.__RN_PLATFORM__ || "web", select: (o) => o[globalThis.__RN_PLATFORM__ || "web"] ?? o.default };`,
  "@react-native-async-storage/async-storage": `const m = new Map(); export default { getItem: async (k) => (m.has(k) ? m.get(k) : null), setItem: async (k, v) => { m.set(k, String(v)); }, removeItem: async (k) => { m.delete(k); } };`,
  "@react-navigation/native": `export const createNavigationContainerRef = () => ({ isReady: () => false, navigate: () => {}, reset: () => {}, getCurrentRoute: () => null });`,
  "expo-notifications": `export const cancelAllScheduledNotificationsAsync = async () => {}; export const cancelScheduledNotificationAsync = async () => {}; export const getAllScheduledNotificationsAsync = async () => []; export const setNotificationHandler = () => {};`,
};

export async function resolve(specifier, context, next) {
  if (Object.prototype.hasOwnProperty.call(STUBS, specifier)) {
    return { url: `data:text/javascript,${encodeURIComponent(STUBS[specifier])}`, shortCircuit: true };
  }
  try {
    return await next(specifier, context);
  } catch (err) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[cm]?js$/.test(specifier)) {
      return next(`${specifier}.js`, context);
    }
    throw err;
  }
}
