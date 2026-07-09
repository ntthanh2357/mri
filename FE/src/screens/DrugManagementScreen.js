import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Modal,
} from 'react-native';
import Colors from '../constants/colors';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { get, post, put, del } from '../services/api.service';

const CATEGORY_LABELS = {
  anticonvulsant: 'Động kinh',
  corticosteroid: 'Kháng viêm (Corticoid)',
  psychotropic: 'Hướng thần',
  pain_reliever: 'Giảm đau',
  antibiotic: 'Kháng sinh',
  cardiovascular: 'Tim mạch',
  other: 'Khác',
};

const CATEGORY_COLORS = {
  anticonvulsant: { bg: '#EEF2FF', text: '#4F46E5', border: '#E0E7FF' },
  corticosteroid: { bg: '#ECFDF5', text: '#059669', border: '#D1FAE5' },
  psychotropic: { bg: '#FDF2F8', text: '#DB2777', border: '#FCE7F3' },
  pain_reliever: { bg: '#FFF7ED', text: '#EA580C', border: '#FFEDD5' },
  antibiotic: { bg: '#F0FDFA', text: '#0D9488', border: '#CCFBF1' },
  cardiovascular: { bg: '#FEF2F2', text: '#DC2626', border: '#FEE2E2' },
  other: { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
};

export default function DrugManagementScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'alerts'
  const [currentUser, setCurrentUser] = useState(null);
  const [drugs, setDrugs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Form State for Add / Edit
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [drugName, setDrugName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [category, setCategory] = useState('other');
  const [manufacturer, setManufacturer] = useState('');
  const [dosageInstructions, setDosageInstructions] = useState('');
  const [price, setPrice] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [interactions, setInteractions] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [unit, setUnit] = useState('Viên');
  const [minStock, setMinStock] = useState('10');

  // Stock Adjustment Modal State
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockDrug, setStockDrug] = useState(null);
  const [stockAction, setStockAction] = useState('add'); // 'add' | 'subtract' | 'set'
  const [stockQty, setStockQty] = useState('');

  // Fetch Current User
  const fetchCurrentUser = async () => {
    try {
      const res = await get('/auth/me');
      if (res && res.user) {
        setCurrentUser(res.user);
      }
    } catch (err) {
      console.error('Lỗi lấy thông tin cá nhân:', err);
    }
  };

  // Fetch Drugs List
  const fetchDrugs = async () => {
    setLoading(true);
    try {
      let url = '/api/drugs?';
      if (selectedCategory !== 'all') url += `category=${selectedCategory}&`;
      if (searchQuery.trim()) url += `search=${encodeURIComponent(searchQuery)}&`;
      
      const res = await get(url);
      if (res && res.success) {
        setDrugs(res.data?.drugs || []);
      }
    } catch (err) {
      console.error('Lỗi tải danh mục thuốc:', err);
      Alert.alert('Thất bại', 'Không thể tải danh sách thuốc.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Low Stock Alerts
  const fetchAlerts = async () => {
    try {
      const res = await get('/api/drugs/alerts/low-stock');
      if (res && res.success) {
        setAlerts(res.data?.alerts || []);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách cảnh báo thuốc:', err);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    fetchDrugs();
    fetchAlerts();
  }, [searchQuery, selectedCategory]);

  const isHospitalAdmin = currentUser?.role === 'hospital_admin';

  // Handle Create or Update Drug
  const handleSaveDrug = async () => {
    if (!drugName.trim()) {
      Alert.alert('Thiếu thông tin', 'Tên thuốc không được để trống.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: drugName.trim(),
        activeIngredient: activeIngredient.trim(),
        category,
        manufacturer: manufacturer.trim(),
        dosageInstructions: dosageInstructions.trim(),
        price: Number(price) || 0,
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
        interactions: interactions
          ? interactions.split(',').map((i) => i.trim()).filter(Boolean)
          : [],
        stock: {
          quantity: Number(quantity) || 0,
          unit: unit.trim() || 'Viên',
          minStock: Number(minStock) || 10,
        },
      };

      let res;
      if (isEditing && selectedDrug) {
        res = await put(`/api/drugs/${selectedDrug._id}`, payload);
      } else {
        res = await post('/api/drugs', payload);
      }

      if (res && res.success) {
        Alert.alert('Thành công', isEditing ? 'Đã cập nhật thông tin thuốc.' : 'Đã thêm thuốc mới thành công.');
        resetForm();
        fetchDrugs();
        fetchAlerts();
      }
    } catch (err) {
      console.error('Lỗi lưu thuốc:', err);
      Alert.alert('Thất bại', err.message || 'Không thể lưu thông tin thuốc.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Drug
  const handleDeleteDrug = (drugId, name) => {
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc chắn muốn xóa thuốc "${name}" khỏi danh mục không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await del(`/api/drugs/${drugId}`);
              if (res && res.success) {
                Alert.alert('Đã xóa', `Đã xóa thuốc "${name}" thành công.`);
                if (selectedDrug?._id === drugId) resetForm();
                fetchDrugs();
                fetchAlerts();
              }
            } catch (err) {
              console.error('Lỗi khi xóa thuốc:', err);
              Alert.alert('Lỗi', 'Không thể xóa thuốc này.');
            }
          },
        },
      ]
    );
  };

  // Handle Stock Adjustment
  const handleStockUpdate = async () => {
    if (!stockQty.trim() || isNaN(Number(stockQty)) || Number(stockQty) <= 0) {
      Alert.alert('Lỗi nhập liệu', 'Vui lòng nhập số lượng hợp lệ lớn hơn 0.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await post(`/api/drugs/${stockDrug._id}/stock`, {
        action: stockAction,
        quantity: Number(stockQty),
      });

      if (res && res.success) {
        Alert.alert('Thành công', res.message || 'Cập nhật tồn kho thành công.');
        setShowStockModal(false);
        setStockQty('');
        fetchDrugs();
        fetchAlerts();
        // Update selected drug in view if applicable
        if (selectedDrug?._id === stockDrug._id) {
          setSelectedDrug(res.drug);
        }
      }
    } catch (err) {
      console.error('Lỗi cập nhật tồn kho:', err);
      Alert.alert('Thất bại', err.message || 'Không thể cập nhật tồn kho.');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Button Press
  const startEdit = (drug) => {
    setIsEditing(true);
    setSelectedDrug(drug);
    setDrugName(drug.name);
    setActiveIngredient(drug.activeIngredient || '');
    setCategory(drug.category || 'other');
    setManufacturer(drug.manufacturer || '');
    setDosageInstructions(drug.dosageInstructions || '');
    setPrice(String(drug.price || 0));
    setExpiryDate(drug.expiryDate ? drug.expiryDate.split('T')[0] : '');
    setInteractions(drug.interactions ? drug.interactions.join(', ') : '');
    setQuantity(String(drug.stock?.quantity || 0));
    setUnit(drug.stock?.unit || 'Viên');
    setMinStock(String(drug.stock?.minStock || 10));
  };

  // Reset Form
  const resetForm = () => {
    setIsEditing(false);
    setSelectedDrug(null);
    setDrugName('');
    setActiveIngredient('');
    setCategory('other');
    setManufacturer('');
    setDosageInstructions('');
    setPrice('');
    setExpiryDate('');
    setInteractions('');
    setQuantity('0');
    setUnit('Viên');
    setMinStock('10');
  };

  const openStockModal = (drug) => {
    setStockDrug(drug);
    setStockAction('add');
    setStockQty('');
    setShowStockModal(true);
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="DrugManagement">
      <SafeAreaView style={styles.container}>
        {/* Main Content Area */}
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.titleContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.title}>Quản lý kho dược phẩm & lâm sàng</Text>
                <Text style={styles.subtitle}>
                  Quản lý danh mục thuốc sử dụng tại bệnh viện, theo dõi tồn kho, hạn sử dụng và cấu hình tương tác lâm sàng.
                </Text>
              </View>
              {alerts.length > 0 && (
                <View style={styles.alertHeaderBadge}>
                  <Text style={styles.alertHeaderBadgeText}>⚠️ {alerts.length} thuốc sắp hết</Text>
                </View>
              )}
            </View>
          </View>

          {/* Quick tab filters */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'list' && styles.tabButtonActive]}
              onPress={() => setActiveTab('list')}
            >
              <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>
                📋 Danh mục thuốc & Tồn kho
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'alerts' && styles.tabButtonActive]}
              onPress={() => setActiveTab('alerts')}
            >
              <Text style={[styles.tabText, activeTab === 'alerts' && styles.tabTextActive]}>
                ⚠️ Cảnh báo tồn kho thấp ({alerts.length})
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'list' ? (
            <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
              {/* Form / Edit Column (Only for hospital_admin) */}
              {isHospitalAdmin && (
                <View style={isDesktop ? styles.formColumn : styles.fullWidth}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                      {isEditing ? '✏️ Cập nhật thông tin thuốc' : '➕ Thêm thuốc vào danh mục'}
                    </Text>
                    <Text style={styles.cardSub}>
                      Các trường có dấu (*) là bắt buộc. Thuốc mới sẽ hiển thị trong phần kê đơn của bác sĩ.
                    </Text>

                    <View style={styles.fieldRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.label}>Tên thương mại *</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Ví dụ: Keppra"
                          placeholderTextColor="#94A3B8"
                          value={drugName}
                          onChangeText={setDrugName}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Hoạt chất chính</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Ví dụ: Levetiracetam"
                          placeholderTextColor="#94A3B8"
                          value={activeIngredient}
                          onChangeText={setActiveIngredient}
                        />
                      </View>
                    </View>

                    <View style={styles.fieldRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.label}>Phân loại dược lý</Text>
                        <View style={styles.selectWrapper}>
                           <select
                             value={category}
                             onChange={(e) => setCategory(e.target.value)}
                             style={{
                               width: '100%',
                               height: '100%',
                               borderWidth: 0,
                               backgroundColor: 'transparent',
                               paddingHorizontal: 10,
                               fontSize: 13,
                               color: '#0F172A',
                               outline: 'none',
                               cursor: 'pointer',
                             }}
                           >
                            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Hãng sản xuất</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Ví dụ: GlaxoSmithKline"
                          placeholderTextColor="#94A3B8"
                          value={manufacturer}
                          onChangeText={setManufacturer}
                        />
                      </View>
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Chỉ định & Liều lượng khuyến cáo</Text>
                      <TextInput
                        style={[styles.input, { height: 60 }]}
                        multiline
                        numberOfLines={3}
                        placeholder="Ví dụ: 500mg uống 2 lần mỗi ngày sau ăn..."
                        placeholderTextColor="#94A3B8"
                        value={dosageInstructions}
                        onChangeText={setDosageInstructions}
                      />
                    </View>

                    <View style={styles.fieldRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.label}>Đơn giá bán lẻ (VND)</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          placeholder="Ví dụ: 12000"
                          placeholderTextColor="#94A3B8"
                          value={price}
                          onChangeText={setPrice}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Hạn sử dụng (YYYY-MM-DD)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Ví dụ: 2027-12-31"
                          placeholderTextColor="#94A3B8"
                          value={expiryDate}
                          onChangeText={setExpiryDate}
                        />
                      </View>
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Hoạt chất tương tác chéo gây hại (cách nhau bằng dấu phẩy)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ví dụ: Depakine, Tegretol"
                        placeholderTextColor="#94A3B8"
                        value={interactions}
                        onChangeText={setInteractions}
                      />
                    </View>

                    {/* Stock Setup - only for creating new drug */}
                    {!isEditing && (
                      <View style={styles.fieldRow}>
                        <View style={{ flex: 1.2, marginRight: 8 }}>
                          <Text style={styles.label}>Số lượng ban đầu</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#94A3B8"
                            value={quantity}
                            onChangeText={setQuantity}
                          />
                        </View>
                        <View style={{ flex: 0.8, marginRight: 8 }}>
                          <Text style={styles.label}>Đơn vị</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Viên"
                            placeholderTextColor="#94A3B8"
                            value={unit}
                            onChangeText={setUnit}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Ngưỡng báo động</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            placeholder="10"
                            placeholderTextColor="#94A3B8"
                            value={minStock}
                            onChangeText={setMinStock}
                          />
                        </View>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      {isEditing && (
                        <TouchableOpacity
                          style={[styles.cancelBtn, { flex: 1 }]}
                          onPress={resetForm}
                        >
                          <Text style={styles.cancelBtnText}>Hủy chỉnh sửa</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.submitButton, submitting && styles.buttonDisabled, { flex: 2 }]}
                        onPress={handleSaveDrug}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.submitButtonText}>
                            {isEditing ? '💾 Cập nhật thuốc' : '💾 Lưu vào danh mục'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* List Column */}
              <View style={isDesktop ? styles.listColumn : styles.fullWidth}>
                <View style={styles.card}>
                  <View style={styles.listHeader}>
                    <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12, width: '100%' }}>
                      <TextInput
                        style={[styles.searchInput, { flex: 2 }]}
                        placeholder="Tìm kiếm theo tên thuốc, hoạt chất, hãng sản xuất..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                      />
                      <View style={[styles.selectWrapper, { flex: 1 }]}>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          style={{
                            width: '100%',
                            height: '100%',
                            borderWidth: 0,
                            backgroundColor: 'transparent',
                            paddingHorizontal: 10,
                            fontSize: 13,
                            color: '#0F172A',
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="all">Tất cả phân nhóm</option>
                          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </View>
                    </View>
                  </View>

                  {loading ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                      <Text style={{ color: '#64748B', marginTop: 10, fontSize: 13 }}>Đang tải dữ liệu thuốc...</Text>
                    </View>
                  ) : drugs.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>Không tìm thấy dược phẩm nào phù hợp.</Text>
                    </View>
                  ) : (
                    <View style={styles.tableCard}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View style={styles.table}>
                          {/* Header Row */}
                          <View style={styles.tableHeaderRow}>
                            <View style={[styles.tableHead, { width: 180 }]}>
                              <Text style={styles.tableHeadText}>Tên thuốc / Hoạt chất</Text>
                            </View>
                            <View style={[styles.tableHead, { width: 130 }]}>
                              <Text style={styles.tableHeadText}>Phân nhóm</Text>
                            </View>
                            <View style={[styles.tableHead, { width: 100 }]}>
                              <Text style={styles.tableHeadText}>Tồn kho</Text>
                            </View>
                            <View style={[styles.tableHead, { width: 110 }]}>
                              <Text style={styles.tableHeadText}>Đơn giá (VND)</Text>
                            </View>
                            <View style={[styles.tableHead, { width: 110 }]}>
                              <Text style={styles.tableHeadText}>Hạn dùng</Text>
                            </View>
                            {isHospitalAdmin && (
                              <View style={[styles.tableHead, { width: 140, alignItems: 'flex-end' }]}>
                                <Text style={styles.tableHeadText}>Thao tác</Text>
                              </View>
                            )}
                          </View>

                          {/* Data Rows */}
                          {drugs.map((item) => {
                            const isLow = item.stock?.quantity < item.stock?.minStock;
                            const catStyle = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other;
                            const priceStr = item.price ? item.price.toLocaleString('vi-VN') : '—';
                            const dateStr = item.expiryDate
                              ? new Date(item.expiryDate).toLocaleDateString('vi-VN')
                              : 'Không thời hạn';
                            return (
                              <View key={item._id} style={styles.tableTr}>
                                <View style={[styles.tableCell, { width: 180 }]}>
                                  <Text style={styles.drugNameText}>{item.name}</Text>
                                  {item.activeIngredient ? (
                                    <Text style={styles.ingredientText}>({item.activeIngredient})</Text>
                                  ) : null}
                                </View>
                                <View style={[styles.tableCell, { width: 130 }]}>
                                  <View style={{
                                    backgroundColor: catStyle.bg,
                                    borderColor: catStyle.border,
                                    borderWidth: 1,
                                    paddingVertical: 2,
                                    paddingHorizontal: 8,
                                    borderRadius: 6,
                                    alignSelf: 'flex-start'
                                  }}>
                                    <Text style={{
                                      color: catStyle.text,
                                      fontSize: 11,
                                      fontWeight: 'bold',
                                    }}>
                                      {CATEGORY_LABELS[item.category]}
                                    </Text>
                                  </View>
                                </View>
                                <View style={[styles.tableCell, { width: 100 }]}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={[styles.qtyText, isLow && styles.qtyTextLow]}>
                                      {item.stock?.quantity} {item.stock?.unit}
                                    </Text>
                                    {isLow && (
                                      <View style={styles.miniAlertTag}>
                                        <Text style={styles.miniAlertTagText}>Cảnh báo hết</Text>
                                      </View>
                                    )}
                                  </View>
                                </View>
                                <View style={[styles.tableCell, { width: 110 }]}>
                                  <Text style={styles.priceText}>{priceStr}đ</Text>
                                </View>
                                <View style={[styles.tableCell, { width: 110 }]}>
                                  <Text style={styles.expiryText}>{dateStr}</Text>
                                </View>
                                {isHospitalAdmin && (
                                  <View style={[styles.tableCell, { width: 140, flexDirection: 'row', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }]}>
                                    <TouchableOpacity
                                      onPress={() => openStockModal(item)}
                                      style={styles.tblBtnStock}
                                    >
                                      <Text style={styles.tblBtnStockText}>📦 Kho</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() => startEdit(item)}
                                      style={styles.tblBtnEdit}
                                    >
                                      <Text style={styles.tblBtnEditText}>✏️</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() => handleDeleteDrug(item._id, item.name)}
                                      style={styles.tblBtnDel}
                                    >
                                      <Text style={styles.tblBtnDelText}>🗑️</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : (
            // Alerts Tab
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚠️ Danh sách thuốc cần nhập kho bổ sung</Text>
              <Text style={styles.cardSub}>
                Hiển thị tất cả các loại thuốc có lượng tồn kho nhỏ hơn ngưỡng cài đặt cảnh báo của khoa dược.
              </Text>

              {alerts.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={[styles.emptyText, { color: '#059669' }]}>
                    ✅ Tuyệt vời! Hiện tại không có loại thuốc nào dưới ngưỡng an toàn.
                  </Text>
                </View>
              ) : (
                <View style={styles.alertsList}>
                  {alerts.map((item) => (
                    <View key={item._id} style={styles.alertItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.alertDrugName}>{item.name}</Text>
                        <Text style={styles.alertDetails}>
                          Nhóm: {CATEGORY_LABELS[item.category]} | Thiếu hụt:{' '}
                          <Text style={{ fontWeight: 'bold', color: '#DC2626' }}>
                            {item.shortage} {item.stock?.unit}
                          </Text>
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <Text style={styles.alertStockText}>
                          Tồn kho hiện tại: {item.stock?.quantity} / Ngưỡng: {item.stock?.minStock}
                        </Text>
                        {isHospitalAdmin && (
                          <TouchableOpacity
                            style={styles.alertActionBtn}
                            onPress={() => openStockModal(item)}
                          >
                            <Text style={styles.alertActionBtnText}>➕ Nhập kho ngay</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Stock Adjustment Modal Dialog */}
      {showStockModal && stockDrug && (
        <Modal
          visible={showStockModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowStockModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>📦 Cập nhật tồn kho dược phẩm</Text>
              <Text style={styles.modalSub}>
                Thuốc: <Text style={{ fontWeight: 'bold', color: '#0F172A' }}>{stockDrug.name}</Text> | Đơn vị: {stockDrug.stock?.unit}
              </Text>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, stockAction === 'add' && styles.modalActionBtnActive]}
                  onPress={() => setStockAction('add')}
                >
                  <Text style={[styles.modalActionText, stockAction === 'add' && styles.modalActionTextActive]}>
                    ➕ Nhập kho (Thêm)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalActionBtn, stockAction === 'subtract' && styles.modalActionBtnActive]}
                  onPress={() => setStockAction('subtract')}
                >
                  <Text style={[styles.modalActionText, stockAction === 'subtract' && styles.modalActionTextActive]}>
                    ➖ Xuất kho (Bớt)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalActionBtn, stockAction === 'set' && styles.modalActionBtnActive]}
                  onPress={() => setStockAction('set')}
                >
                  <Text style={[styles.modalActionText, stockAction === 'set' && styles.modalActionTextActive]}>
                    💾 Đặt cố định
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Số lượng thay đổi *</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="Nhập số lượng, ví dụ: 100"
                  placeholderTextColor="#94A3B8"
                  value={stockQty}
                  onChangeText={setStockQty}
                />
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowStockModal(false)}
                >
                  <Text style={styles.modalCancelText}>Hủy bỏ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, submitting && styles.buttonDisabled]}
                  onPress={handleStockUpdate}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>💾 Lưu thay đổi</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ResponsiveLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 24, gap: 20 },
  titleContainer: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 },
  alertHeaderBadge: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  alertHeaderBadgeText: {
    color: '#DC2626',
    fontWeight: 'bold',
    fontSize: 12,
  },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 16 },
  tabButton: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', marginRight: 8 },
  tabButtonActive: { borderBottomWidth: 2, borderBottomColor: '#15803D' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#15803D', fontWeight: 'bold' },
  desktopRow: { flexDirection: 'row', gap: 20 },
  mobileColumn: { flexDirection: 'column', gap: 20 },
  formColumn: { flex: 1 },
  listColumn: { flex: 1.8 },
  fullWidth: { width: '100%' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#334155', marginBottom: 6 },
  cardSub: { fontSize: 11, color: '#64748B', marginBottom: 16, lineHeight: 16 },
  field: { marginBottom: 14 },
  fieldRow: { flexDirection: 'row', marginBottom: 14 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 },
  input: { height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, fontSize: 13, backgroundColor: '#F8FAFC', color: '#0F172A', outlineStyle: 'none' },
  selectWrapper: {
    height: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  htmlSelect: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 10,
    fontSize: '13px',
    color: '#0F172A',
    outlineStyle: 'none',
    cursor: 'pointer',
  },
  submitButton: { height: 40, backgroundColor: '#15803D', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { opacity: 0.7 },
  submitButtonText: { fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' },
  cancelBtn: { height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  cancelBtnText: { fontSize: 13, fontWeight: 'bold', color: '#64748B' },
  listHeader: { marginBottom: 16 },
  searchInput: { height: 38, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, fontSize: 12, backgroundColor: '#F8FAFC', color: '#0F172A', outlineStyle: 'none' },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  emptyBox: { paddingVertical: 60, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 10 },
  emptyText: { color: '#94A3B8', fontSize: 12 },
  tableCard: { width: '100%' },
  table: { flexDirection: 'column' },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  tableHead: { paddingVertical: 12, paddingHorizontal: 10, justifyContent: 'center' },
  tableHeadText: { fontSize: 11, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' },
  tableTr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
  tableCell: { paddingVertical: 12, paddingHorizontal: 10, justifyContent: 'center' },
  drugNameText: { fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
  ingredientText: { fontSize: 11, color: '#64748B', marginTop: 1 },
  qtyText: { fontSize: 13, fontWeight: 'bold', color: '#334155' },
  qtyTextLow: { color: '#DC2626' },
  miniAlertTag: { backgroundColor: '#FEE2E2', paddingVertical: 1, paddingHorizontal: 5, borderRadius: 4 },
  miniAlertTagText: { color: '#991B1B', fontSize: 9, fontWeight: 'bold' },
  priceText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  expiryText: { fontSize: 12, color: '#64748B' },
  tblBtnStock: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#DCFCE7', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  tblBtnStockText: { color: '#166534', fontSize: 11, fontWeight: 'bold' },
  tblBtnEdit: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  tblBtnEditText: { color: '#475569', fontSize: 11 },
  tblBtnDel: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  tblBtnDelText: { color: '#991B1B', fontSize: 11 },
  alertsList: { gap: 10 },
  alertItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', borderRadius: 12 },
  alertDrugName: { fontSize: 14, fontWeight: 'bold', color: '#991B1B' },
  alertDetails: { fontSize: 12, color: '#7F1D1D', marginTop: 2 },
  alertStockText: { fontSize: 12, color: '#7F1D1D' },
  alertActionBtn: { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  alertActionBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, borderHeight: 1, borderWidth: 1, borderColor: '#E2E8F0', padding: 24, width: '100%', maxWidth: 450, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  modalSub: { fontSize: 12, color: '#64748B', marginBottom: 20 },
  modalActionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modalActionBtn: { flex: 1, paddingVertical: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, alignItems: 'center', backgroundColor: '#F8FAFC' },
  modalActionBtnActive: { borderColor: '#15803D', backgroundColor: '#DCFCE7' },
  modalActionText: { fontSize: 11, fontWeight: 'bold', color: '#64748B' },
  modalActionTextActive: { color: '#15803D' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalCancelBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  modalCancelText: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },
  modalSubmitBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#15803D', justifyContent: 'center', alignItems: 'center' },
  modalSubmitText: { fontSize: 12, fontWeight: 'bold', color: '#FFFFFF' },
});
