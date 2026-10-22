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
import PageContainer from '../components/layout/PageContainer';
import { StaffBanner, RECEPTION_IMAGES, BannerStats, PillTabs } from '../components/reception/ReceptionUI';
import { Pill as TabList, AlertTriangle as TabAlert, CalendarX as TabExpiry, Plus as BtnAdd } from 'lucide-react';
import Layout from '../constants/layout';
import { get, post, put, del } from '../services/api.service';
import { Pill, AlertTriangle, Plus, Search, Edit2, Trash2, CheckCircle2, Save, Package, Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { batchesOf, batchCountOf, daysLeftOf, displayExpiry, earliestActiveBatch, expiryStatus } from '../utils/batchUtils';

const CATEGORY_LABELS = {
  chemotherapy: 'Hóa trị & Điều trị đích U Não',
  anti_edema: 'Chống phù não (Mannitol)',
  corticosteroid: 'Kháng viêm & Chống phù (Dexamethasone)',
  anticonvulsant: 'Chống động kinh / Co giật u não',
  pain_reliever: 'Giảm đau sau mổ u não',
  antibiotic: 'Kháng sinh ngoại thần kinh',
  psychotropic: 'Hướng thần / An thần',
  cardiovascular: 'Tim mạch',
  other: 'Khác',
};

const CATEGORY_COLORS = {
  chemotherapy: { bg: '#FDF2F8', text: '#BE185D', border: '#FBCFE8' },
  anti_edema: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  corticosteroid: { bg: '#ECFDF5', text: '#059669', border: '#D1FAE5' },
  anticonvulsant: { bg: '#EEF2FF', text: '#4F46E5', border: '#E0E7FF' },
  pain_reliever: { bg: '#FFF7ED', text: '#EA580C', border: '#FFEDD5' },
  antibiotic: { bg: '#F0FDFA', text: '#0D9488', border: '#CCFBF1' },
  psychotropic: { bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF' },
  cardiovascular: { bg: '#FEF2F2', text: '#B91C1C', border: '#FEE2E2' },
  other: { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
};

export default function DrugManagementScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  // Màn rộng: cột co giãn theo chiều ngang (trước đây cột cố định → bảng chỉ dùng ~650px, chip phân nhóm xuống 3 dòng)
  const fluidTable = width >= Layout.wide;
  const col = (w, flex) => (fluidTable ? { flex, minWidth: w } : { width: w });

  // Cho phép menu điều hướng thẳng tab (params.tab: 'alerts' | 'expiry')
  const [activeTab, setActiveTab] = useState(['alerts', 'expiry'].includes(route?.params?.tab) ? route.params.tab : 'list'); // 'list' | 'alerts' | 'expiry'
  const [currentUser, setCurrentUser] = useState(null);
  const [drugs, setDrugs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  // UC-PHA-07: lô sắp hết hạn & chi tiết lô đang mở rộng
  const [expiring, setExpiring] = useState([]);
  const [expandedDrugId, setExpandedDrugId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCategoryFilterDropdown, setShowCategoryFilterDropdown] = useState(false);

  // Form State for Add / Edit
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [drugName, setDrugName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [category, setCategory] = useState('other');
  const [showCategoryFormDropdown, setShowCategoryFormDropdown] = useState(false);
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
  // UC-PHA-07: thông tin lô khi nhập kho
  const [stockBatchNumber, setStockBatchNumber] = useState('');
  const [stockExpiryDate, setStockExpiryDate] = useState('');
  const [stockSupplier, setStockSupplier] = useState('');

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

  // Fetch Expiry Alerts theo lô (UC-PHA-07)
  const fetchExpiryAlerts = async () => {
    try {
      const res = await get('/api/drugs/alerts/expiring?days=30');
      if (res && res.success) {
        setExpiring(res.data?.alerts || []);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách lô sắp hết hạn:', err);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Menu điều hướng lại khi màn đã mở (React Navigation không remount cùng màn)
  // — đồng bộ tab theo params mỗi lần navigate. Phụ thuộc object params (không phải
  // params.tab) vì cùng giá trị 'list' → 'list' không đổi → effect không chạy lại
  // (bug: đứng tab 'Hết hạn theo lô' rồi bấm menu 'Danh mục thuốc' không về được).
  useEffect(() => {
    const t = route?.params?.tab;
    setActiveTab(['alerts', 'expiry'].includes(t) ? t : 'list');
  }, [route?.params]);

  useEffect(() => {
    fetchDrugs();
    fetchAlerts();
    fetchExpiryAlerts();
  }, [searchQuery, selectedCategory]);

  // Phân quyền theo đặc tả vai trò (UC-PHA-07): dược sĩ điều chỉnh kho
  // (nhập lô / xuất FEFO / kiểm kê); hospital_admin giữ CRUD danh mục thuốc.
  const isHospitalAdmin = currentUser?.role === 'hospital_admin';
  const canManageCatalog = ['hospital_admin', 'admin', 'system_admin'].includes(currentUser?.role);
  const canManageStock = canManageCatalog || currentUser?.role === 'pharmacist';

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
        // UC-PHA-07: khai báo lô khi nhập kho (để trống → hệ thống tự sinh lô mới)
        ...(stockAction === 'add' && stockBatchNumber.trim() ? {
          batchNumber: stockBatchNumber.trim(),
          expiryDate: stockExpiryDate ? new Date(stockExpiryDate).toISOString() : undefined,
          supplier: stockSupplier.trim() || undefined,
        } : {}),
      });

      if (res && res.success) {
        Alert.alert('Thành công', res.message || 'Cập nhật tồn kho thành công.');
        setShowStockModal(false);
        setStockQty('');
        setStockBatchNumber('');
        setStockExpiryDate('');
        setStockSupplier('');
        fetchDrugs();
        fetchAlerts();
        fetchExpiryAlerts();
        // Update selected drug in view if applicable
        if (selectedDrug?._id === stockDrug._id) {
          setSelectedDrug(res.data?.drug);
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
    setShowForm(false);
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
    setStockBatchNumber('');
    setStockExpiryDate('');
    setStockSupplier('');
    setShowStockModal(true);
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute={activeTab !== 'list' ? `DrugManagement_${activeTab}` : 'DrugManagement'}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <PageContainer>
          <View style={styles.bannerBlock}>
            <StaffBanner
              image={RECEPTION_IMAGES.tabletScan}
              tone="teal"
              eyebrow="Khoa Dược"
              title={canManageStock ? 'Kho thuốc' : 'Danh mục thuốc'}
              subtitle={canManageStock
                ? 'Danh mục thuốc, tồn kho theo lô (FEFO), hạn dùng và tương tác thuốc của bệnh viện.'
                : 'Tra cứu thuốc đang có, tồn kho và hạn dùng trước khi kê đơn.'}
              right={(
                <BannerStats items={[
                  { icon: TabList, value: drugs.length, label: 'Loại thuốc' },
                  { icon: TabAlert, value: alerts.length, label: 'Tồn kho thấp' },
                  { icon: TabExpiry, value: expiring.length, label: 'Sắp hết hạn' },
                ]} />
              )}
            >
              {canManageCatalog && !showForm && !isEditing ? (
                <View style={styles.bannerBtns}>
                  <TouchableOpacity style={styles.bannerBtn} onPress={() => { setActiveTab('list'); setShowForm(true); }}>
                    <BtnAdd size={16} color="#064E4A" />
                    <Text style={styles.bannerBtnText}>Thêm thuốc</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </StaffBanner>
            <PillTabs
              tabs={[
                { key: 'list', label: 'Danh mục và tồn kho', icon: TabList },
                { key: 'alerts', label: 'Cảnh báo tồn kho thấp', icon: TabAlert, count: alerts.length, warn: true },
                { key: 'expiry', label: 'Hết hạn theo lô', icon: TabExpiry, count: expiring.length, warn: true },
              ]}
              value={activeTab}
              onChange={setActiveTab}
            />
          </View>
          {activeTab === 'list' ? (
            <View style={isDesktop ? styles.desktopRow : styles.mobileColumn}>
              {/* Form / Edit Column (Only for hospital_admin) */}
              {isHospitalAdmin && (showForm || isEditing) && (
                <View style={isDesktop ? styles.formColumn : styles.fullWidth}>
                  <View style={styles.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      {isEditing ? <Edit2 size={16} color={Colors.brandNavy} /> : <Plus size={16} color={Colors.brandNavy} />}
                      <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
                        {isEditing ? 'Cập nhật thông tin thuốc' : 'Thêm thuốc vào danh mục'}
                      </Text>
                    </View>
                    <Text style={styles.cardSub}>
                      Các trường có dấu (*) là bắt buộc. Thuốc mới sẽ hiển thị trong phần kê đơn của bác sĩ.
                    </Text>

                    <View style={styles.fieldRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.label}>Tên thương mại *</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Ví dụ: Keppra"
                          placeholderTextColor={Colors.secondary}
                          value={drugName}
                          onChangeText={setDrugName}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Hoạt chất chính</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Ví dụ: Levetiracetam"
                          placeholderTextColor={Colors.secondary}
                          value={activeIngredient}
                          onChangeText={setActiveIngredient}
                        />
                      </View>
                    </View>

                    <View style={[styles.fieldRow, { zIndex: 30 }]}>
                      <View style={{ flex: 1, marginRight: 8, position: 'relative', zIndex: 20 }}>
                        <Text style={styles.label}>Phân loại dược lý</Text>
                        <TouchableOpacity
                          style={[styles.selectWrapper, { justifyContent: 'center', paddingHorizontal: 10 }]}
                          onPress={() => setShowCategoryFormDropdown(!showCategoryFormDropdown)}
                        >
                          <Text style={{ fontSize: 13, color: Colors.brandNavy }}>{CATEGORY_LABELS[category]}</Text>
                        </TouchableOpacity>
                        {showCategoryFormDropdown && (
                          <ScrollView style={[styles.dropdownMenu, { maxHeight: 220 }]}>
                            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                              <TouchableOpacity
                                key={k}
                                style={styles.dropdownOption}
                                onPress={() => { setCategory(k); setShowCategoryFormDropdown(false); }}
                              >
                                <Text style={styles.dropdownOptionText}>{v}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Hãng sản xuất</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Ví dụ: GlaxoSmithKline"
                          placeholderTextColor={Colors.secondary}
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
                        placeholderTextColor={Colors.secondary}
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
                          placeholderTextColor={Colors.secondary}
                          value={price}
                          onChangeText={setPrice}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Hạn sử dụng (YYYY-MM-DD)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Ví dụ: 2027-12-31"
                          placeholderTextColor={Colors.secondary}
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
                        placeholderTextColor={Colors.secondary}
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
                            placeholderTextColor={Colors.secondary}
                            value={quantity}
                            onChangeText={setQuantity}
                          />
                        </View>
                        <View style={{ flex: 0.8, marginRight: 8 }}>
                          <Text style={styles.label}>Đơn vị</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="Viên"
                            placeholderTextColor={Colors.secondary}
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
                            placeholderTextColor={Colors.secondary}
                            value={minStock}
                            onChangeText={setMinStock}
                          />
                        </View>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <TouchableOpacity
                        style={[styles.cancelBtn, { flex: 1 }]}
                        onPress={resetForm}
                      >
                        <Text style={styles.cancelBtnText}>{isEditing ? 'Hủy chỉnh sửa' : 'Đóng'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.submitButton, submitting && styles.buttonDisabled, { flex: 2 }]}
                        onPress={handleSaveDrug}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <Save size={15} color="#FFFFFF" />
                            <Text style={styles.submitButtonText}>
                              {isEditing ? 'Cập nhật thuốc' : 'Lưu vào danh mục'}
                            </Text>
                          </View>
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
                      <View style={{ flex: 2, position: 'relative', justifyContent: 'center' }}>
                        <TextInput
                          style={[styles.searchInput, { width: '100%', paddingLeft: 34 }]}
                          placeholder="Tìm kiếm theo tên thuốc, hoạt chất, hãng sản xuất..."
                          placeholderTextColor={Colors.secondary}
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                        />
                        <View style={{ position: 'absolute', left: 12 }}>
                          <Search size={14} color={Colors.secondary} />
                        </View>
                      </View>
                      <View style={{ flex: 1, position: 'relative', zIndex: 20 }}>
                        <TouchableOpacity
                          style={[styles.selectWrapper, { justifyContent: 'center', paddingHorizontal: 10 }]}
                          onPress={() => setShowCategoryFilterDropdown(!showCategoryFilterDropdown)}
                        >
                          <Text style={{ fontSize: 13, color: Colors.brandNavy }}>
                            {selectedCategory === 'all' ? 'Tất cả phân nhóm' : CATEGORY_LABELS[selectedCategory]}
                          </Text>
                        </TouchableOpacity>
                        {showCategoryFilterDropdown && (
                          <ScrollView style={[styles.dropdownMenu, { maxHeight: 220 }]}>
                            <TouchableOpacity
                              style={styles.dropdownOption}
                              onPress={() => { setSelectedCategory('all'); setShowCategoryFilterDropdown(false); }}
                            >
                              <Text style={styles.dropdownOptionText}>Tất cả phân nhóm</Text>
                            </TouchableOpacity>
                            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                              <TouchableOpacity
                                key={k}
                                style={styles.dropdownOption}
                                onPress={() => { setSelectedCategory(k); setShowCategoryFilterDropdown(false); }}
                              >
                                <Text style={styles.dropdownOptionText}>{v}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    </View>
                  </View>

                  {loading ? (
                    <View style={styles.loadingBox}>
                      <ActivityIndicator size="large" color={Colors.brandGreen} />
                      <Text style={{ color: '#64748B', marginTop: 10, fontSize: 13 }}>Đang tải dữ liệu thuốc...</Text>
                    </View>
                  ) : drugs.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>Không tìm thấy dược phẩm nào phù hợp.</Text>
                    </View>
                  ) : (
                    <View style={styles.tableCard}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={!fluidTable} contentContainerStyle={fluidTable ? styles.tableFluid : null}>
                        <View style={[styles.table, fluidTable && styles.tableFluid]}>
                          {/* Header Row */}
                          <View style={styles.tableHeaderRow}>
                            <View style={[styles.tableHead, col(180, 2.2)]}>
                              <Text style={styles.tableHeadText}>Tên thuốc / Hoạt chất</Text>
                            </View>
                            <View style={[styles.tableHead, col(130, 1.7)]}>
                              <Text style={styles.tableHeadText}>Phân nhóm</Text>
                            </View>
                            <View style={[styles.tableHead, col(150, 1.3)]}>
                              <Text style={styles.tableHeadText}>Tồn kho</Text>
                            </View>
                            <View style={[styles.tableHead, col(110, 0.9), styles.alignEnd]}>
                              <Text style={styles.tableHeadText}>Đơn giá</Text>
                            </View>
                            <View style={[styles.tableHead, col(110, 0.9)]}>
                              <Text style={styles.tableHeadText}>Hạn dùng</Text>
                            </View>
                            {canManageStock && (
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
                            // UC-PHA-07: hiển thị theo lô — đếm lô, lô sớm nhất, hạn dùng hiển thị
                            const nBatches = batchCountOf(item);
                            const earliest = earliestActiveBatch(item);
                            const earliestDays = earliest?.expiryDate ? daysLeftOf(earliest.expiryDate) : null;
                            const dateStr = displayExpiry(item);
                            const isExpanded = expandedDrugId === item._id;
                            return (
                              <View key={item._id}>
                              <View style={styles.tableTr}>
                                <View style={[styles.tableCell, col(180, 2.2)]}>
                                  <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    onPress={() => setExpandedDrugId(isExpanded ? null : item._id)}
                                    disabled={nBatches === 0}
                                  >
                                    <Text style={styles.drugNameText}>{item.name}</Text>
                                    {nBatches > 0 && (
                                      <View style={[styles.batchCountTag, { flexDirection: 'row', alignItems: 'center', gap: 2 }]}>
                                        <Text style={styles.batchCountTagText}>{nBatches} lô</Text>
                                        {isExpanded ? <ChevronUp size={11} color="#0369A1" /> : <ChevronDown size={11} color="#0369A1" />}
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                  {item.activeIngredient ? (
                                    <Text style={styles.ingredientText}>({item.activeIngredient})</Text>
                                  ) : null}
                                </View>
                                <View style={[styles.tableCell, col(130, 1.7)]}>
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
                                      fontSize: 12,
                                      fontWeight: 'bold',
                                    }}>
                                      {CATEGORY_LABELS[item.category]}
                                    </Text>
                                  </View>
                                </View>
                                <View style={[styles.tableCell, col(150, 1.3)]}>
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
                                <View style={[styles.tableCell, col(110, 0.9), styles.alignEnd]}>
                                  <Text style={styles.priceText}>{priceStr}đ</Text>
                                </View>
                                <View style={[styles.tableCell, col(110, 0.9)]}>
                                  <Text style={[styles.expiryText, earliestDays !== null && expiryStatus(earliestDays) === 'expired' && styles.expiryTextDanger]}>
                                    {dateStr}
                                  </Text>
                                  {earliestDays !== null && earliestDays <= 30 && (
                                    <Text style={[
                                      styles.expiryCountdown,
                                      expiryStatus(earliestDays) === 'expired' && styles.expiryCountdownExpired,
                                      expiryStatus(earliestDays) === 'critical' && styles.expiryCountdownCritical,
                                      expiryStatus(earliestDays) === 'warning' && styles.expiryCountdownWarn,
                                    ]}>
                                      {earliestDays < 0 ? `hết hạn ${Math.abs(earliestDays)} ngày` : `còn ${earliestDays} ngày`}
                                    </Text>
                                  )}
                                </View>
                                {canManageStock && (
                                  <View style={[styles.tableCell, { width: 140, flexDirection: 'row', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }]}>
                                    <TouchableOpacity
                                      onPress={() => openStockModal(item)}
                                      style={[styles.tblBtnStock, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                                    >
                                      <Plus size={12} color={Colors.brandGreenPressed} />
                                      <Text style={styles.tblBtnStockText}>Kho</Text>
                                    </TouchableOpacity>
                                    {canManageCatalog && (
                                      <TouchableOpacity
                                        onPress={() => startEdit(item)}
                                        style={[styles.tblBtnEdit, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                                      >
                                        <Edit2 size={12} color="#475569" />
                                        <Text style={styles.tblBtnEditText}>Sửa</Text>
                                      </TouchableOpacity>
                                    )}
                                    {canManageCatalog && (
                                      <TouchableOpacity
                                        onPress={() => handleDeleteDrug(item._id, item.name)}
                                        style={styles.tblBtnDel}
                                      >
                                        <Trash2 size={12} color="#991B1B" />
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                )}
                              </View>
                              {isExpanded && nBatches > 0 && (
                                <View style={styles.batchPanel}>
                                  <Text style={styles.batchPanelTitle}>Tồn kho theo lô — xuất theo FEFO (hết hạn sớm trước)</Text>
                                  {batchesOf(item).map((b, bi) => {
                                    const dLeft = daysLeftOf(b.expiryDate);
                                    const st = expiryStatus(dLeft);
                                    const qty = Number(b.quantity) || 0;
                                    return (
                                      <View key={b.batchNumber || `batch-${bi}`} style={styles.batchRow}>
                                        <View style={{ flex: 1.1 }}>
                                          <Text style={styles.batchNumberText}>{b.batchNumber || 'Không rõ lô'}</Text>
                                          <Text style={styles.batchSubText}>{b.supplier || '—'}</Text>
                                        </View>
                                        <View style={{ flex: 0.6, alignItems: 'flex-end' }}>
                                          <Text style={[styles.batchQtyText, qty === 0 && { color: '#94A3B8' }]}>{qty} {item.stock?.unit}</Text>
                                        </View>
                                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                          <Text style={styles.batchExpiryText}>
                                            {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('vi-VN') : 'Không thời hạn'}
                                          </Text>
                                          {dLeft !== null && (
                                            <View style={[
                                              styles.expiryBadge,
                                              st === 'expired' && styles.expiryBadgeExpired,
                                              st === 'critical' && styles.expiryBadgeCritical,
                                              st === 'warning' && styles.expiryBadgeWarn,
                                            ]}>
                                              <Text style={[
                                                styles.expiryBadgeText,
                                                st === 'expired' && styles.expiryBadgeTextExpired,
                                                st === 'critical' && styles.expiryBadgeTextCritical,
                                                st === 'warning' && styles.expiryBadgeTextWarn,
                                              ]}>
                                                {dLeft < 0 ? `ĐÃ HẾT HẠN ${Math.abs(dLeft)} ngày` : `còn ${dLeft} ngày`}
                                              </Text>
                                            </View>
                                          )}
                                        </View>
                                      </View>
                                    );
                                  })}
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
          ) : activeTab === 'expiry' ? (
            // Expiry Tab (UC-PHA-07 — lô sắp hết hạn & đã hết hạn)
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Clock size={16} color="#B91C1C" />
                <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Lô thuốc sắp hết hạn & đã hết hạn</Text>
              </View>
              <Text style={styles.cardSub}>
                Các lô còn hàng có hạn dùng trong 30 ngày tới, kể cả lô đã hết hạn (dead stock chờ kiểm định / tiêu hủy theo quy chế GPP). Mọi lần xuất kho đều theo FEFO và tuyệt đối không cấp phát lô đã hết hạn.
              </Text>

              {expiring.length === 0 ? (
                <View style={[styles.emptyBox, { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }]}>
                  <CheckCircle2 size={14} color="#059669" />
                  <Text style={[styles.emptyText, { color: '#059669', marginBottom: 0 }]}>
                    Không có lô nào sắp hết hạn trong 30 ngày tới.
                  </Text>
                </View>
              ) : (
                <View style={styles.alertsList}>
                  {expiring.map((row, idx) => {
                    const st = expiryStatus(row.daysLeft);
                    return (
                      <View
                        key={`${row.drugId}-${row.batchNumber || 'legacy'}-${idx}`}
                        style={[styles.alertItem, !row.isExpired && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.alertDrugName, !row.isExpired && { color: '#92400E' }]}>{row.name}</Text>
                          <Text style={[styles.alertDetails, !row.isExpired && { color: '#A16207' }]}>
                            Lô: <Text style={{ fontWeight: 'bold' }}>{row.batchNumber || 'Không rõ lô'}</Text> | Tồn lô:{' '}
                            <Text style={{ fontWeight: 'bold' }}>{row.quantity} {row.unit}</Text>
                            {row.supplier ? ` | NCC: ${row.supplier}` : ''}
                          </Text>
                          <Text style={[styles.alertStockText, !row.isExpired && { color: '#A16207' }]}>
                            Hạn dùng: {row.expiryDate ? new Date(row.expiryDate).toLocaleDateString('vi-VN') : '—'}
                            {row.legacy ? ' | (Thuốc chưa theo dõi lô — dùng hạn dùng danh mục)' : ''}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <View
                            style={[
                              styles.expiryBadge,
                              st === 'expired' && styles.expiryBadgeExpired,
                              st === 'critical' && styles.expiryBadgeCritical,
                              st === 'warning' && styles.expiryBadgeWarn,
                            ]}
                          >
                            <Text
                              style={[
                                styles.expiryBadgeText,
                                st === 'expired' && styles.expiryBadgeTextExpired,
                                st === 'critical' && styles.expiryBadgeTextCritical,
                                st === 'warning' && styles.expiryBadgeTextWarn,
                              ]}
                            >
                              {row.isExpired ? `ĐÃ HẾT HẠN ${Math.abs(row.daysLeft)} ngày` : `còn ${row.daysLeft} ngày`}
                            </Text>
                          </View>
                          {canManageStock && (
                            <TouchableOpacity
                              style={[styles.alertActionBtn, { backgroundColor: '#0E7490', flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                              onPress={() => openStockModal(drugs.find(d => d._id === row.drugId) || { _id: row.drugId, name: row.name, stock: { unit: row.unit, quantity: row.totalStock } })}
                            >
                              <Plus size={12} color="#FFFFFF" />
                              <Text style={styles.alertActionBtnText}>Nhập lô thay thế</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ) : (
            // Alerts Tab
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <AlertTriangle size={16} color="#B45309" />
                <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Danh sách thuốc cần nhập kho bổ sung</Text>
              </View>
              <Text style={styles.cardSub}>
                Hiển thị tất cả các loại thuốc có lượng tồn kho nhỏ hơn ngưỡng cài đặt cảnh báo của khoa dược.
              </Text>

              {alerts.length === 0 ? (
                <View style={[styles.emptyBox, { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }]}>
                  <CheckCircle2 size={14} color="#059669" />
                  <Text style={[styles.emptyText, { color: '#059669', marginBottom: 0 }]}>
                    Tuyệt vời! Hiện tại không có loại thuốc nào dưới ngưỡng an toàn.
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
                          <Text style={{ fontWeight: 'bold', color: '#B91C1C' }}>
                            {item.shortage} {item.stock?.unit}
                          </Text>
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <Text style={styles.alertStockText}>
                          Tồn kho hiện tại: {item.stock?.quantity} / Ngưỡng: {item.stock?.minStock}
                        </Text>
                        {canManageStock && (
                          <TouchableOpacity
                            style={[styles.alertActionBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                            onPress={() => openStockModal(item)}
                          >
                            <Plus size={12} color="#FFFFFF" />
                            <Text style={styles.alertActionBtnText}>Nhập kho ngay</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
          </PageContainer>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Package size={18} color={Colors.brandGreen} />
                <Text style={styles.modalTitle}>Cập nhật tồn kho dược phẩm</Text>
              </View>
              <Text style={styles.modalSub}>
                Thuốc: <Text style={{ fontWeight: 'bold', color: Colors.brandNavy }}>{stockDrug.name}</Text> | Đơn vị: {stockDrug.stock?.unit}
              </Text>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, stockAction === 'add' && styles.modalActionBtnActive]}
                  onPress={() => setStockAction('add')}
                >
                  <Text style={[styles.modalActionText, stockAction === 'add' && styles.modalActionTextActive]}>
                    Nhập kho (Thêm)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalActionBtn, stockAction === 'subtract' && styles.modalActionBtnActive]}
                  onPress={() => setStockAction('subtract')}
                >
                  <Text style={[styles.modalActionText, stockAction === 'subtract' && styles.modalActionTextActive]}>
                    Xuất kho (Bớt)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalActionBtn, stockAction === 'set' && styles.modalActionBtnActive]}
                  onPress={() => setStockAction('set')}
                >
                  <Text style={[styles.modalActionText, stockAction === 'set' && styles.modalActionTextActive]}>
                    Đặt cố định
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Số lượng thay đổi *</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="Nhập số lượng, ví dụ: 100"
                  placeholderTextColor={Colors.secondary}
                  value={stockQty}
                  onChangeText={setStockQty}
                />
              </View>

              {stockAction === 'add' && (
                <View style={styles.batchFieldGroup}>
                  <Text style={styles.batchFieldGroupLabel}>Nhập kho theo lô (UC-PHA-07) — điền số lô để truy vết hạn dùng</Text>
                  <View style={styles.fieldRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>Số lô</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="VD: LO-DPK-0326 (trống = tự sinh)"
                        placeholderTextColor={Colors.secondary}
                        value={stockBatchNumber}
                        onChangeText={setStockBatchNumber}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Hạn dùng lô (YYYY-MM-DD)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="VD: 2028-06-30"
                        placeholderTextColor={Colors.secondary}
                        value={stockExpiryDate}
                        onChangeText={setStockExpiryDate}
                      />
                    </View>
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Nhà cung cấp</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="VD: Sanofi Vietnam"
                      placeholderTextColor={Colors.secondary}
                      value={stockSupplier}
                      onChangeText={setStockSupplier}
                    />
                  </View>
                  <Text style={styles.batchHint}>
                    Nhập cùng số lô đã có → cộng dồn vào lô đó (cập nhật hạn dùng nếu khai mới).
                  </Text>
                </View>
              )}
              {stockAction === 'subtract' && (
                <Text style={styles.batchHint}>
                  Hệ thống tự xuất theo nguyên tắc FEFO: lô hết hạn sớm nhất được xuất trước; lô đã hết hạn bị loại khỏi xuất kho (chờ tiêu hủy).
                </Text>
              )}

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
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Save size={14} color="#FFFFFF" />
                      <Text style={styles.modalSubmitText}>Lưu thay đổi</Text>
                    </View>
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
  bannerBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18, marginBottom: 30 },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999 },
  bannerBtnText: { color: '#064E4A', fontWeight: '800', fontSize: 13 },
  bannerGhost: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999 },
  bannerGhostText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  bannerBlock: { marginBottom: 18 },
  container: { flex: 1, backgroundColor: '#F3F7FC' },
  scroll: { paddingTop: 20, paddingBottom: 40 },
  desktopRow: { flexDirection: 'row', gap: 20 },
  mobileColumn: { flexDirection: 'column', gap: 20 },
  formColumn: { flex: 1 },
  listColumn: { flex: 1.8 },
  fullWidth: { width: '100%' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#334155', marginBottom: 6 },
  cardSub: { fontSize: 12, color: '#64748B', marginBottom: 16, lineHeight: 16 },
  field: { marginBottom: 14 },
  fieldRow: { flexDirection: 'row', marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#475569', marginBottom: 4 },
  input: { height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, fontSize: 13, backgroundColor: '#F8FAFC', color: Colors.brandNavy, outlineStyle: 'none' },
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
    color: Colors.brandNavy,
    outlineStyle: 'none',
    cursor: 'pointer',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 50,
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownOptionText: {
    fontSize: 13,
    color: Colors.brandNavy,
  },
  submitButton: { height: 40, backgroundColor: Colors.brandGreen, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { opacity: 0.7 },
  submitButtonText: { fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' },
  cancelBtn: { height: 40, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  cancelBtnText: { fontSize: 13, fontWeight: 'bold', color: '#64748B' },
  // RN-web 0.21: mọi View mặc định position:relative + zIndex:0 (stacking context).
  // zIndex lồng sâu (20/50 trên wrapper/menu) KHÔNG thắng được sibling SAU nó trong
  // DOM cùng z:0 → bảng thuốc vẽ đè lên dropdown đang mở. Fix: nâng zIndex tại
  // CHÍNH sibling cạnh tranh (listHeader) để cả nhánh dropdown nổi trên bảng.
  listHeader: { marginBottom: 16, zIndex: 30 },
  searchInput: { height: 38, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 12, fontSize: 12, backgroundColor: '#F8FAFC', color: Colors.brandNavy, outlineStyle: 'none' },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  emptyBox: { paddingVertical: 60, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 10 },
  emptyText: { color: Colors.secondary, fontSize: 12 },
  tableCard: { width: '100%' },
  table: { flexDirection: 'column' },
  tableFluid: { flexGrow: 1, width: '100%' },
  alignEnd: { alignItems: 'flex-end' },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  tableHead: { paddingVertical: 12, paddingHorizontal: 10, justifyContent: 'center' },
  tableHeadText: { fontSize: 12, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' },
  tableTr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
  tableCell: { paddingVertical: 12, paddingHorizontal: 10, justifyContent: 'center' },
  drugNameText: { fontSize: 13, fontWeight: 'bold', color: Colors.brandNavy },
  ingredientText: { fontSize: 12, color: '#64748B', marginTop: 1 },
  qtyText: { fontSize: 13, fontWeight: 'bold', color: '#334155' },
  qtyTextLow: { color: '#B91C1C' },
  miniAlertTag: { backgroundColor: '#FEE2E2', paddingVertical: 1, paddingHorizontal: 5, borderRadius: 4 },
  miniAlertTagText: { color: '#991B1B', fontSize: 12, fontWeight: 'bold' },
  priceText: { fontSize: 13, fontWeight: '600', color: Colors.brandNavy },
  expiryText: { fontSize: 12, color: '#64748B' },
  tblBtnStock: { backgroundColor: Colors.brandGreenSoft, borderWidth: 1, borderColor: Colors.brandGreenSoft, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  tblBtnStockText: { color: Colors.brandGreenPressed, fontSize: 12, fontWeight: 'bold' },
  tblBtnEdit: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  tblBtnEditText: { color: '#475569', fontSize: 12 },
  tblBtnDel: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  tblBtnDelText: { color: '#991B1B', fontSize: 12 },
  alertsList: { gap: 10 },
  alertItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', borderRadius: 12 },
  alertDrugName: { fontSize: 14, fontWeight: 'bold', color: '#991B1B' },
  alertDetails: { fontSize: 12, color: '#7F1D1D', marginTop: 2 },
  alertStockText: { fontSize: 12, color: '#7F1D1D' },
  alertActionBtn: { backgroundColor: '#B91C1C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  alertActionBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },

  // UC-PHA-07: chip số lô + panel chi tiết lô trong bảng danh mục
  batchCountTag: { backgroundColor: '#E0F2FE', paddingVertical: 1, paddingHorizontal: 5, borderRadius: 4 },
  batchCountTagText: { color: '#0369A1', fontSize: 11, fontWeight: 'bold' },
  expiryTextDanger: { color: '#B91C1C', fontWeight: 'bold' },
  expiryCountdown: { fontSize: 11, marginTop: 2, color: '#64748B' },
  expiryCountdownExpired: { color: '#B91C1C', fontWeight: 'bold' },
  expiryCountdownCritical: { color: '#C2410C', fontWeight: 'bold' },
  expiryCountdownWarn: { color: '#B45309' },
  batchPanel: { backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 10 },
  batchPanelTitle: { fontSize: 10, fontWeight: 'bold', color: '#0369A1', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.3 },
  batchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  batchNumberText: { fontSize: 12, fontWeight: 'bold', color: '#0F2B46' },
  batchSubText: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  batchQtyText: { fontSize: 12, fontWeight: 'bold', color: '#334155' },
  batchExpiryText: { fontSize: 12, color: '#475569' },
  expiryBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, backgroundColor: '#F1F5F9', marginTop: 2 },
  expiryBadgeExpired: { backgroundColor: '#FEE2E2' },
  expiryBadgeCritical: { backgroundColor: '#FFEDD5' },
  expiryBadgeWarn: { backgroundColor: '#FEF9C3' },
  expiryBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#475569' },
  expiryBadgeTextExpired: { color: '#991B1B' },
  expiryBadgeTextCritical: { color: '#C2410C' },
  expiryBadgeTextWarn: { color: '#A16207' },
  batchFieldGroup: { backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', borderRadius: 8, padding: 10, marginBottom: 14 },
  batchFieldGroupLabel: { fontSize: 11, fontWeight: 'bold', color: '#0369A1', marginBottom: 8 },
  batchHint: { fontSize: 11, color: '#64748B', marginBottom: 12, lineHeight: 15 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, borderHeight: 1, borderWidth: 1, borderColor: '#E2E8F0', padding: 24, width: '100%', maxWidth: 450, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.brandNavy, marginBottom: 4 },
  modalSub: { fontSize: 12, color: '#64748B', marginBottom: 20 },
  modalActionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modalActionBtn: { flex: 1, paddingVertical: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, alignItems: 'center', backgroundColor: '#F8FAFC' },
  modalActionBtnActive: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  modalActionText: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },
  modalActionTextActive: { color: Colors.brandGreen },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalCancelBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  modalCancelText: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },
  modalSubmitBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: Colors.brandGreen, justifyContent: 'center', alignItems: 'center' },
  modalSubmitText: { fontSize: 12, fontWeight: 'bold', color: '#FFFFFF' },
});
