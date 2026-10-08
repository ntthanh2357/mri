import { useEffect } from 'react';
import { Platform } from 'react-native';
import { createPortal } from 'react-dom';

/**
 * Đưa modal ra thẳng document.body (chỉ web).
 * ScrollView của react-native-web dùng transform nên `position: fixed` bên trong
 * bị neo theo vùng cuộn: overlay chỉ che một đoạn và nội dung phía sau vẫn cuộn được.
 * Render qua portal giúp overlay phủ kín màn hình; đồng thời khóa cuộn trang khi mở.
 */
const Portal = ({ children }) => {
  const isWeb = Platform.OS === 'web' && typeof document !== 'undefined';

  useEffect(() => {
    if (!isWeb) return undefined;
    const scrollers = Array.from(document.querySelectorAll('#root div')).filter((el) => {
      const s = window.getComputedStyle(el);
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight;
    });
    const saved = scrollers.map((el) => [el, el.style.overflowY]);
    scrollers.forEach((el) => { el.style.overflowY = 'hidden'; });
    return () => saved.forEach(([el, v]) => { el.style.overflowY = v; });
  }, [isWeb]);

  if (!isWeb) return children;
  return createPortal(<div id="ns-portal">{children}</div>, document.body);
};

export default Portal;
