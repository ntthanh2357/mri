import { get, post, put } from '../client.js';

export const loginApi = (credentials) => post('/auth/login', credentials);
export const registerApi = (payload) => post('/auth/register', payload);
export const getMeApi = () => get('/auth/me');
export const updateProfileApi = (profileData) => put('/auth/profile', profileData);
export const changePasswordApi = (payload) => put('/auth/password', payload);
export const forgotPasswordApi = (email) => post('/auth/forgot-password', { email });
export const verifyOtpApi = (payload) => post('/auth/verify-otp', payload);
export const phoneLoginRequestApi = (phone) => post('/auth/phone-login-request', { phone });
export const phoneLoginVerifyApi = (payload) => post('/auth/phone-login-verify', payload);
export const logoutAllDevicesApi = () => post('/auth/logout/all', {});

export default {
  loginApi,
  registerApi,
  getMeApi,
  updateProfileApi,
  changePasswordApi,
  forgotPasswordApi,
  verifyOtpApi,
  phoneLoginRequestApi,
  phoneLoginVerifyApi,
  logoutAllDevicesApi,
};
