import { useEffect, useState } from 'react';
import { get } from '../services/api.service';

/** Role của người đang đăng nhập (`null` khi đang tải hoặc không lấy được). */
export function useCurrentRole() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    let alive = true;
    get('/auth/me')
      .then((data) => alive && setRole(data?.user?.role || null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return role;
}
