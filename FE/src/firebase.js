// Mocks for native mobile platforms (Android/iOS) to prevent importing web firebase libraries
export const auth = null;
export const googleProvider = null;
export const signInWithGoogleWeb = async () => {
  return null;
};
const app = null;
export default app;
