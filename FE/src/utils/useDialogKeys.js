import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Phím tắt cho hộp thoại trên web: Enter = nút chính (Tiếp tục / OK / Xác nhận), Esc = hủy / đóng.
 * Bắt ở pha capture và chặn lan truyền để Enter không kích hoạt thêm ô nhập / nút bên dưới hộp thoại.
 */
export const useDialogKeys = (visible, { onEnter, onEscape } = {}) => {
  const handlers = useRef({ onEnter, onEscape });
  handlers.current = { onEnter, onEscape };

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || typeof document === 'undefined') return undefined;
    const onKeyDown = (e) => {
      if (e.repeat || e.isComposing) return; // giữ phím / đang gõ tiếng Việt (IME) thì bỏ qua
      const { onEnter: enter, onEscape: escape } = handlers.current;
      if (e.key === 'Enter' && enter) {
        e.preventDefault();
        e.stopPropagation();
        enter();
      } else if (e.key === 'Escape' && escape) {
        e.preventDefault();
        e.stopPropagation();
        escape();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [visible]);
};

export default useDialogKeys;
