import { useCallback, useEffect, useMemo, useState } from 'react';
import { get } from '../services/api.service';
import {
  prepareItems, filterItems, sharePayload, initialSelection, toggleSectionAll, toggleItem, setItemsOn, NO_FILTER,
} from '../utils/shareCatalog';

/**
 * UC-PAT-09 — Danh mục các mục trong bệnh án để bệnh nhân chọn chia sẻ: tick theo nhóm hoặc từng mục,
 * tìm kiếm và phân loại. `docsVersion` đổi (vừa lưu / xoá giấy tờ tự quét) thì tải lại danh mục.
 */
export function useShareCatalog(docsVersion = '') {
  const [state, setState] = useState({ loading: true, items: [], truncated: [], error: null });
  const [selection, setSelection] = useState(initialSelection); // mặc định tick sẵn tất cả
  const [filter, setFilter] = useState(NO_FILTER);

  const load = useCallback(async () => {
    try {
      const res = await get('/api/v1/patient/record-shares/catalog');
      setState({ loading: false, items: prepareItems(res?.data?.items), truncated: res?.data?.truncated || [], error: null });
    } catch (err) {
      console.error('Lỗi tải danh mục chia sẻ:', err);
      setState((s) => ({ ...s, loading: false, error: 'Không tải được danh sách tài liệu. Hãy bấm Tải lại.' }));
    }
  }, []);

  useEffect(() => { load(); }, [load, docsVersion]);

  const { items } = state;
  const visible = useMemo(() => filterItems(items, filter), [items, filter]);
  const payload = useMemo(() => sharePayload(selection, items), [selection, items]);

  return {
    ...state, selection, filter, setFilter, visible, payload, reload: load,
    toggleSection: (key) => setSelection((cur) => toggleSectionAll(cur, items, key)),
    toggleItem: (item) => setSelection((cur) => toggleItem(cur, items, item)),
    setVisibleOn: (on) => setSelection((cur) => setItemsOn(cur, items, visible, on)),
  };
}
