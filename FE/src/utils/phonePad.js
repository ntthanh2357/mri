import { Dimensions } from 'react-native';

// Điện thoại: màn hình hẹp hơn 640px
export const PHONE_MAX_WIDTH = 640;
export const isPhoneWidth = () => Dimensions.get('window').width < PHONE_MAX_WIDTH;

// Lề trang gọn hơn trên điện thoại (máy tính giữ nguyên lề cũ)
export const phonePad = () => (isPhoneWidth() ? { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 40 } : null);
