import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Colors from '../constants/colors';
import { apiRequest } from '../utils/apiClient';

function mapApiDataset(raw) {
  return {
    id: raw._id ?? raw.id ?? '',
    name: raw.name ?? '',
    description: raw.description ?? '',
    priceVND: typeof raw.price === 'number' ? raw.price : 0,
    status: raw.status ?? 'pending',
    createdAt: raw.createdAt ? new Date(raw.createdAt).toLocaleDateString('vi-VN') : '',
    sampleCount: raw.sampleCount ?? 0,
    salesCount: raw.salesCount ?? 0,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    thumbnail: raw.thumbnail ?? 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=200&auto=format&fit=crop&q=60',
    isPublic: raw.isPublic ?? true,
  };
}

const STATUS_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'published', label: 'Đã xuất bản' },
  { value: 'draft', label: 'Nháp' },
  { value: 'archived', label: 'Archive' },
];

const STATUS_STYLE = {
  published: { bg: '#d1fae5', color: '#047857' },
  pending: { bg: '#dbeafe', color: '#1d4ed8' },
  draft: { bg: '#fef3c7', color: '#b45309' },
  archived: { bg: '#f1f5f9', color: '#475569' },
};

export default function AdminDatasetsView() {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState({ name: '', description: '', priceVND: '100000' });
  const [formError, setFormError] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [priceEditId, setPriceEditId] = useState(null);
  const [priceInput, setPriceInput] = useState('');
  const [priceError, setPriceError] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);

  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest('/admin/datasets');
      setDatasets((response.datasets ?? []).map(mapApiDataset));
    } catch (err) {
      setError(err.message ?? 'Không thể tải danh sách dataset.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDatasets(); }, []);

  const filteredDatasets = datasets.filter((d) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.tags.some((t) => t.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async () => {
    setFormError(null);
    if (!formData.name.trim()) {
      setFormError('Vui lòng nhập tên dataset.');
      return;
    }
    setCreateLoading(true);
    try {
      await apiRequest('/admin/datasets', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: Number(formData.priceVND) || 0,
          status: 'pending',
        }),
      });
      await fetchDatasets();
      setShowCreate(false);
      setFormData({ name: '', description: '', priceVND: '100000' });
    } catch (err) {
      setFormError(err.message ?? 'Tạo dataset thất bại.');
    } finally {
      setCreateLoading(false);
    }
  };

  const openPriceEdit = (ds) => {
    setPriceEditId(ds.id);
    setPriceInput(String(ds.priceVND));
    setPriceError(null);
  };

  const cancelPriceEdit = () => {
    setPriceEditId(null);
    setPriceInput('');
    setPriceError(null);
  };

  const handlePriceUpdate = async (id) => {
    const newPrice = parseFloat(priceInput);
    if (isNaN(newPrice) || newPrice < 0) {
      setPriceError('Giá không hợp lệ.');
      return;
    }
    setPriceLoading(true);
    setPriceError(null);
    try {
      await apiRequest(`/admin/datasets/${id}/price`, {
        method: 'PUT',
        body: JSON.stringify({ price: newPrice }),
      });
      setDatasets((prev) => prev.map((d) => (d.id === id ? { ...d, priceVND: newPrice } : d)));
      setPriceEditId(null);
      setPriceInput('');
    } catch (err) {
      setPriceError(err.message ?? 'Cập nhật giá thất bại.');
    } finally {
      setPriceLoading(false);
    }
  };

  const totalRevenue = datasets.reduce((sum, d) => sum + d.salesCount * d.priceVND, 0);
  const totalSamples = datasets.reduce((s, d) => s + d.sampleCount, 0);
  const totalSales = datasets.reduce((s, d) => s + d.salesCount, 0);

  const stats = [
    { label: 'Tổng Dataset', value: datasets.length.toLocaleString('vi-VN'), icon: '🗄️', color: '#6366f1' },
    { label: 'Tổng mẫu', value: totalSamples.toLocaleString('vi-VN'), icon: '📄', color: '#2563eb' },
    { label: 'Doanh thu', value: `${(totalRevenue / 1000000).toFixed(1)}M`, icon: '💰', color: '#059669' },
    { label: 'Lượt bán', value: totalSales.toLocaleString('vi-VN'), icon: '📈', color: '#d97706' },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Quản lý Dataset</Text>
          <Text style={styles.subtitle}>Tạo, định giá và quản lý dữ liệu huấn luyện</Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.createBtnText}>+ Tạo mới</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        {stats.map((s, idx) => (
          <View key={idx} style={styles.statCard}>
            <View>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
            <View style={[styles.statIcon, { backgroundColor: s.color + '1A' }]}>
              <Text style={{ fontSize: 16 }}>{s.icon}</Text>
            </View>
          </View>
        ))}
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Tìm dataset theo tên, mô tả, tags..."
        placeholderTextColor={Colors.secondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity key={f.value} onPress={() => setStatusFilter(f.value)} style={[styles.filterChip, statusFilter === f.value && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, statusFilter === f.value && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 24 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchDatasets}><Text style={styles.retryText}>Thử lại</Text></TouchableOpacity>
        </View>
      ) : filteredDatasets.length === 0 ? (
        <Text style={styles.emptyText}>Không tìm thấy dataset nào phù hợp.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {filteredDatasets.map((ds) => {
            const st = STATUS_STYLE[ds.status] || STATUS_STYLE.archived;
            return (
              <View key={ds.id} style={styles.card}>
                <Image source={{ uri: ds.thumbnail }} style={styles.thumbnail} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={1}>{ds.name}</Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>{ds.description}</Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      {ds.sampleCount > 0 ? `📄 ${ds.sampleCount.toLocaleString('vi-VN')} mẫu` : `📅 ${ds.createdAt}`}
                    </Text>
                    <View style={[styles.pill, { backgroundColor: st.bg }]}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: st.color }}>{ds.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  {ds.tags.length > 0 && (
                    <View style={styles.tagRow}>
                      {ds.tags.map((tag) => (
                        <View key={tag} style={styles.tagPill}>
                          <Text style={{ fontSize: 9.5, fontWeight: '700', color: '#4338ca' }}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.priceRow}>
                    <View>
                      <Text style={styles.priceLabel}>Giá bán</Text>
                      <Text style={styles.priceValue}>{(ds.priceVND / 1000).toFixed(0)}K VND</Text>
                    </View>
                  </View>

                  {priceEditId === ds.id ? (
                    <View style={{ gap: 6 }}>
                      <TextInput
                        style={styles.priceInput}
                        keyboardType="numeric"
                        value={priceInput}
                        onChangeText={(v) => { setPriceInput(v); setPriceError(null); }}
                        placeholder="Nhập giá mới (VND)"
                        editable={!priceLoading}
                      />
                      {!!priceError && <Text style={styles.errorTextSmall}>{priceError}</Text>}
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity style={[styles.smallBtn, { flex: 1, backgroundColor: '#4f46e5' }]} onPress={() => handlePriceUpdate(ds.id)} disabled={priceLoading}>
                          <Text style={styles.smallBtnText}>{priceLoading ? '...' : 'Lưu'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.smallBtn, { flex: 1, backgroundColor: '#f1f5f9' }]} onPress={cancelPriceEdit} disabled={priceLoading}>
                          <Text style={[styles.smallBtnText, { color: Colors.secondary }]}>Hủy</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.updatePriceBtn} onPress={() => openPriceEdit(ds)}>
                      <Text style={styles.updatePriceBtnText}>💲 Cập nhật giá</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={showCreate} animationType="fade" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.centerOverlay}>
          <View style={styles.centerSheet}>
            <Text style={styles.modalTitle}>Tạo Dataset mới</Text>
            {!!formError && <Text style={styles.errorTextSmall}>{formError}</Text>}
            <View style={{ gap: 10, marginTop: 10 }}>
              <View>
                <Text style={styles.inputLabel}>Tên Dataset</Text>
                <TextInput style={styles.modalInput} placeholder="VD: MRI Brain Tumor 2026" value={formData.name} onChangeText={(v) => setFormData({ ...formData, name: v })} />
              </View>
              <View>
                <Text style={styles.inputLabel}>Mô tả</Text>
                <TextInput
                  style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Mô tả chi tiết về dataset này..."
                  value={formData.description}
                  onChangeText={(v) => setFormData({ ...formData, description: v })}
                  multiline
                />
              </View>
              <View>
                <Text style={styles.inputLabel}>Giá bán (VND)</Text>
                <TextInput style={styles.modalInput} keyboardType="numeric" value={formData.priceVND} onChangeText={(v) => setFormData({ ...formData, priceVND: v })} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <TouchableOpacity style={[styles.smallBtn, { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 11 }]} onPress={() => setShowCreate(false)}>
                  <Text style={[styles.smallBtnText, { color: Colors.secondary }]}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallBtn, { flex: 1, backgroundColor: '#4f46e5', paddingVertical: 11 }]} onPress={handleCreate} disabled={createLoading}>
                  <Text style={styles.smallBtnText}>{createLoading ? 'Đang tạo...' : 'Tạo Dataset'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '800', color: Colors.black },
  subtitle: { fontSize: 11, color: Colors.secondary, marginTop: 2 },
  createBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  createBtnText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: { fontSize: 9.5, fontWeight: '700', color: Colors.secondary, textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontWeight: '800', color: Colors.black, marginTop: 3 },
  statIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  searchInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.black,
  },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  filterChipText: { fontSize: 11, fontWeight: '600', color: Colors.secondary },
  filterChipTextActive: { color: Colors.white },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecdd3', borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 },
  errorText: { fontSize: 12, color: '#b91c1c', fontWeight: '600', textAlign: 'center' },
  errorTextSmall: { fontSize: 11, color: '#e11d48', fontWeight: '700' },
  retryText: { fontSize: 11, color: '#b91c1c', fontWeight: '700', textDecorationLine: 'underline' },
  emptyText: { fontSize: 12, color: Colors.secondary, padding: 24, textAlign: 'center' },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  thumbnail: { width: '100%', height: 110, backgroundColor: '#e2e8f0' },
  cardBody: { padding: 12, gap: 6 },
  cardName: { fontSize: 13, fontWeight: '800', color: Colors.black },
  cardDesc: { fontSize: 11, color: Colors.secondary },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  metaText: { fontSize: 10.5, color: Colors.secondary, fontWeight: '600' },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tagPill: { backgroundColor: '#eef2ff', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8, marginTop: 2 },
  priceLabel: { fontSize: 9.5, color: Colors.secondary },
  priceValue: { fontSize: 15, fontWeight: '800', color: Colors.black },
  updatePriceBtn: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  updatePriceBtnText: { fontSize: 11, fontWeight: '700', color: Colors.secondary },
  priceInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12 },
  smallBtn: { paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  smallBtnText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 20 },
  centerSheet: { backgroundColor: Colors.white, borderRadius: 18, padding: 18 },
  modalTitle: { fontSize: 14, fontWeight: '800', color: Colors.black },
  inputLabel: { fontSize: 11, fontWeight: '700', color: Colors.secondary, marginBottom: 4 },
  modalInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: Colors.black },
});
