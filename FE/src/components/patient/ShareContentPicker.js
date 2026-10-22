import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import RecordFilterBar from './RecordFilterBar';
import { SHARE_SECTIONS } from '../../utils/recordShare';
import { sectionState, selectedIn, isItemOn, countBySection, sectionLabel, sectionIcon, isFiltering } from '../../utils/shareCatalog';

// UC-PAT-09 — Bệnh nhân chọn nội dung chia sẻ: tick cả nhóm, hoặc mở danh sách "Tất cả tài liệu" để tìm,
// phân loại và tick từng mục. Trạng thái nằm ở hook useShareCatalog.

const PAGE = 60; // số dòng hiện mỗi lượt (danh sách dài thì bấm "Hiện thêm")
const BOX = { all: 'check-square', some: 'minus-square', none: 'square' };
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');

const GroupTile = ({ sec, state, picked, total, pending, failed, onToggle, onOpen }) => (
  <View style={[styles.tile, state !== 'none' && styles.tileOn]}>
    <Pressable onPress={onToggle} accessibilityRole="checkbox" aria-checked={state === 'some' ? 'mixed' : state === 'all'} accessibilityLabel={sec.label}
      style={({ hovered }) => [styles.tileMain, hovered && styles.tileHover]}>
      <Feather name={BOX[state]} size={20} color={state === 'none' ? Colors.slateMuted : Colors.brandGreen} />
      <Feather name={sec.icon} size={16} color={Colors.slateMuted} />
      <View style={styles.grow}>
        <Text style={styles.tileText}>{sec.label}</Text>
        <Text style={styles.tileCount}>{pending ? 'Đang tải…' : failed ? 'Không tải được danh sách' : total ? `Chọn ${picked}/${total} mục` : 'Chưa có mục nào'}</Text>
      </View>
    </Pressable>
    {total ? (
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Chọn từng mục trong ${sec.label}`} hitSlop={4}
        style={({ hovered }) => [styles.tileOpen, hovered && styles.tileHover]}>
        <Feather name="list" size={18} color={Colors.brandGreen} />
      </Pressable>
    ) : null}
  </View>
);

const ItemRow = ({ item, on, onToggle }) => (
  <Pressable onPress={onToggle} accessibilityRole="checkbox" aria-checked={on}
    accessibilityLabel={`${sectionLabel(item.section)}: ${item.title}${item.date ? `, ngày ${fmtDay(item.date)}` : ''}`}
    style={({ hovered }) => [styles.row, hovered && styles.rowHover]}>
    <Feather name={on ? 'check-square' : 'square'} size={20} color={on ? Colors.brandGreen : Colors.slateMuted} />
    <View style={styles.rowIcon}><Feather name={sectionIcon(item.section)} size={15} color={Colors.brandGreen} /></View>
    <View style={styles.grow}>
      <Text style={styles.rowTitle}>{item.title}</Text>
      {item.sub ? <Text style={styles.rowSub}>{item.sub}</Text> : null}
      <Text style={styles.rowMeta}>
        {[sectionLabel(item.section), item.date ? fmtDay(item.date) : null, item.source === 'self' ? 'bệnh nhân tự khai' : null].filter(Boolean).join(', ')}
      </Text>
    </View>
  </Pressable>
);

const ShareContentPicker = ({ catalog }) => {
  const { loading, error, items, truncated, selection, filter, setFilter, visible, toggleSection, toggleItem, setVisibleOn, reload } = catalog;
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => { setLimit(PAGE); }, [filter]);

  const counts = countBySection(items);
  const pickedVisible = visible.filter((it) => isItemOn(selection, it)).length;
  const browserRef = useRef(null);
  // Bấm "chọn từng mục" ở ô nhóm: lọc danh sách theo nhóm đó và đưa danh sách vào tầm nhìn (web; trên app danh sách nằm ngay dưới)
  const openSection = (key) => {
    setFilter({ ...filter, section: key });
    browserRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  const pending = loading && !items.length;
  const failed = !!error && !items.length; // không biết bệnh án có gì: không ghi "chưa có mục nào"

  return (
    <View style={styles.stack}>
      <Text style={styles.label}>Chọn theo nhóm</Text>
      <View style={styles.tiles}>
        {SHARE_SECTIONS.map((sec) => (
          <GroupTile key={sec.key} sec={sec} state={sectionState(selection, items, sec.key)} total={counts[sec.key] || 0} pending={pending} failed={failed}
            picked={selectedIn(selection, items, sec.key).length} onToggle={() => toggleSection(sec.key)} onOpen={() => openSection(sec.key)} />
        ))}
      </View>

      <View ref={browserRef} style={styles.browser}>
        <View style={styles.head}>
          <Feather name="layers" size={17} color={Colors.brandGreen} />
          <Text style={styles.title}>{pending ? 'Tất cả tài liệu' : `Tất cả tài liệu (${items.length})`}</Text>
        </View>
        <Text style={styles.note}>Tìm và tick từng mục. Nhóm chọn đủ sẽ gồm cả mục mới phát sinh sau này; nhóm chỉ chọn một số mục thì cố định đúng các mục đó.</Text>

        {pending ? (
          <View style={styles.state}><ActivityIndicator size="small" color={Colors.brandGreen} /><Text style={styles.note}>Đang tải danh sách tài liệu…</Text></View>
        ) : error && !items.length ? (
          <View style={styles.state}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={reload} accessibilityRole="button" style={styles.linkBtn}><Text style={styles.linkText}>Tải lại</Text></Pressable>
          </View>
        ) : (
          <>
            <RecordFilterBar filter={filter} onChange={setFilter} counts={counts} total={items.length} />
            <View style={styles.bulk}>
              <Text style={styles.bulkText} accessibilityLiveRegion="polite">
                {isFiltering(filter) ? `Tìm thấy ${visible.length} mục` : `${visible.length} mục`}, đã chọn {pickedVisible}
              </Text>
              {visible.length ? (
                <View style={styles.bulkActions}>
                  <Pressable onPress={() => setVisibleOn(true)} disabled={pickedVisible === visible.length} accessibilityRole="button" hitSlop={6}
                    style={[styles.linkBtn, pickedVisible === visible.length && styles.disabled]}>
                    <Text style={styles.linkText}>Chọn tất cả đang hiện</Text>
                  </Pressable>
                  <Pressable onPress={() => setVisibleOn(false)} disabled={!pickedVisible} accessibilityRole="button" hitSlop={6} style={[styles.linkBtn, !pickedVisible && styles.disabled]}>
                    <Text style={styles.linkText}>Bỏ chọn đang hiện</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {visible.length ? (
              <ScrollView style={styles.list} nestedScrollEnabled>
                {visible.slice(0, limit).map((it) => <ItemRow key={it.key} item={it} on={isItemOn(selection, it)} onToggle={() => toggleItem(it)} />)}
                {visible.length > limit ? (
                  <Pressable onPress={() => setLimit((n) => n + PAGE)} accessibilityRole="button" style={styles.more}>
                    <Text style={styles.linkText}>Hiện thêm {Math.min(PAGE, visible.length - limit)} mục</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            ) : (
              <View style={styles.state}>
                <Feather name="search" size={22} color={Colors.slateMuted} />
                <Text style={styles.note}>{items.length ? 'Không có mục nào khớp. Hãy thử từ khoá khác hoặc xoá bộ lọc.' : 'Bệnh án của bạn chưa có tài liệu nào.'}</Text>
              </View>
            )}
            {truncated.length ? (
              <Text style={styles.note}>Nhóm {truncated.map(sectionLabel).join(', ')} có rất nhiều mục nên chỉ hiện các mục mới nhất. Chọn cả nhóm thì vẫn chia sẻ đầy đủ.</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stack: { gap: 10 },
  grow: { flex: 1, minWidth: 0 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.slateMuted },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexGrow: 1, flexBasis: 260, flexDirection: 'row', alignItems: 'stretch', borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, overflow: 'hidden' },
  tileOn: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  tileMain: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  tileOpen: { width: 48, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: Colors.border },
  tileHover: { backgroundColor: Colors.brandGreenSoft },
  tileText: { fontSize: 15, color: Colors.slateDark },
  tileCount: { fontSize: 13, color: Colors.slateMuted, fontVariant: ['tabular-nums'] },
  browser: { gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.brandNavy },
  note: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  error: { fontSize: 14, color: Colors.warningText },
  state: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  bulk: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  bulkText: { fontSize: 14, fontWeight: '600', color: Colors.slateDark, fontVariant: ['tabular-nums'] },
  bulkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  linkBtn: { minHeight: 36, justifyContent: 'center' },
  linkText: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen },
  disabled: { opacity: 0.45 },
  list: { maxHeight: 440, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowHover: { backgroundColor: Colors.brandGreenSoft },
  rowIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.slateDark },
  rowSub: { fontSize: 14, lineHeight: 20, color: Colors.slateDark },
  rowMeta: { fontSize: 13, color: Colors.slateMuted, fontVariant: ['tabular-nums'] },
  more: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});

export default ShareContentPicker;
