import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  SafeAreaView, Modal, Alert, useWindowDimensions, ActivityIndicator,
  TextInput, Image, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { useDocumentVault } from '../controllers/useDocumentVault';
import { DOC_TYPE_INFO, GROUPS } from '../models/documentVault.model';

const GROUP_ORDER = [1, 2, 3, 5];

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
};

const RecordVaultScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const { vault, loading, reloadVault, saveDocument, deleteDocument, getDocsByType } = useDocumentVault();

  const [docModal, setDocModal] = useState(null);       // { type, info }
  const [uploadModal, setUploadModal] = useState(null); // { type, info, imageUri }
  const [hospitalInput, setHospitalInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [uploadSaving, setUploadSaving] = useState(false);

  // Reload vault every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      reloadVault();
    }, [reloadVault])
  );

  const openDocModal = useCallback((type, info) => {
    setDocModal({ type, info });
  }, []);

  const closeDocModal = useCallback(() => setDocModal(null), []);

  const handleFillManual = useCallback(() => {
    if (!docModal) return;
    const { type } = docModal;
    closeDocModal();
    navigation.navigate('DocumentForm', { type });
  }, [docModal, navigation, closeDocModal]);

  const handleEditDoc = useCallback((type, doc) => {
    closeDocModal();
    navigation.navigate('DocumentForm', { type, docId: doc.id });
  }, [navigation, closeDocModal]);

  const handleDeleteDoc = useCallback((type, doc) => {
    Alert.alert(
      'Xóa tài liệu',
      'Bạn có chắc muốn xóa tài liệu này không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa', style: 'destructive',
          onPress: async () => {
            await deleteDocument(type, doc.id);
            await reloadVault();
          },
        },
      ],
    );
  }, [deleteDocument, reloadVault]);

  const handlePickImage = useCallback(async () => {
    if (!docModal) return;

    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf';
      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const uri = URL.createObjectURL(file);
        const { type, info } = docModal;
        closeDocModal();
        setHospitalInput('');
        setDateInput('');
        setUploadModal({ type, info, imageUri: uri });
      };
      input.click();
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Cần cấp quyền truy cập thư viện ảnh để tiếp tục.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
      base64: false,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const imageUri = result.assets[0].uri;
      const { type, info } = docModal;
      closeDocModal();
      setHospitalInput('');
      setDateInput('');
      setUploadModal({ type, info, imageUri });
    }
  }, [docModal, closeDocModal]);

  const handleCameraCapture = useCallback(async () => {
    if (!docModal) return;

    if (Platform.OS === 'web') {
      // Web: dùng input[capture] để mở camera
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const uri = URL.createObjectURL(file);
        const { type, info } = docModal;
        closeDocModal();
        setHospitalInput('');
        setDateInput('');
        setUploadModal({ type, info, imageUri: uri });
      };
      input.click();
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Cần cấp quyền camera để chụp ảnh.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
      base64: false,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const imageUri = result.assets[0].uri;
      const { type, info } = docModal;
      closeDocModal();
      setHospitalInput('');
      setDateInput('');
      setUploadModal({ type, info, imageUri });
    }
  }, [docModal, closeDocModal]);

  const handleSaveUpload = useCallback(async () => {
    if (!uploadModal) return;
    setUploadSaving(true);
    try {
      await saveDocument(
        uploadModal.type,
        {},
        'upload',
        uploadModal.imageUri,
        { hospitalName: hospitalInput.trim(), visitDate: dateInput.trim() }
      );
      await reloadVault();
      setUploadModal(null);
      Alert.alert('Đã lưu', 'Ảnh tài liệu đã được lưu vào kho hồ sơ.');
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể lưu ảnh. Vui lòng thử lại.');
    } finally {
      setUploadSaving(false);
    }
  }, [uploadModal, hospitalInput, dateInput, saveDocument, reloadVault]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#15803D" />
      </View>
    );
  }

  const docsByGroup = (groupId) =>
    Object.entries(DOC_TYPE_INFO).filter(([, info]) => info.group === groupId);

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="RecordVault">
      <SafeAreaView style={styles.container}>
        {width <= 768 && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Quay lại</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Kho Hồ Sơ Sức Khỏe</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.pageTitle}>Khai báo bệnh án</Text>
          <Text style={styles.pageSubtitle}>
            Lưu trữ bản sao 12 loại tài liệu y tế nhận được từ bệnh viện. Tất cả dữ liệu được lưu cục bộ trên thiết bị của bạn.
          </Text>

          {GROUP_ORDER.map((groupId) => (
            <View key={groupId} style={styles.group}>
              <Text style={styles.groupTitle}>{GROUPS[groupId]}</Text>
              {docsByGroup(groupId).map(([type, info]) => {
                const docs = getDocsByType(type);
                return (
                  <TouchableOpacity
                    key={type}
                    style={styles.docCard}
                    onPress={() => openDocModal(type, info)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.cardLeft}>
                      <View style={styles.iconBox}>
                        <Text style={styles.iconText}>{info.icon}</Text>
                      </View>
                      <View style={styles.cardMeta}>
                        <Text style={styles.cardLabel}>{info.label}</Text>
                        {docs.length > 0 && (
                          <Text style={styles.cardCount}>{docs.length} tài liệu đã lưu</Text>
                        )}
                      </View>
                    </View>
                    {docs.length > 0 ? (
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{docs.length}</Text>
                      </View>
                    ) : (
                      <Text style={styles.addIcon}>＋</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* ── Doc type options modal ── */}
        <Modal
          visible={!!docModal}
          transparent
          animationType="slide"
          onRequestClose={closeDocModal}
        >
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeDocModal} />
          <View style={styles.sheet}>
            {docModal && (
              <>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>
                  {docModal.info.icon}  {docModal.info.label}
                </Text>

                {/* Upload */}
                <TouchableOpacity style={styles.uploadBtn} onPress={handlePickImage} activeOpacity={0.8}>
                  <Text style={styles.uploadSubIcon}>🖼️</Text>
                  <View>
                    <Text style={styles.sheetBtnLabel}>Tải ảnh lên</Text>
                    <Text style={styles.sheetBtnSub}>Chụp hoặc chọn ảnh/PDF từ thiết bị</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnPrimary]} onPress={handleFillManual}>
                  <Text style={styles.sheetBtnIcon}>✏️</Text>
                  <View>
                    <Text style={[styles.sheetBtnLabel, styles.sheetBtnLabelPrimary]}>Điền thủ công</Text>
                    <Text style={[styles.sheetBtnSub, styles.sheetBtnSubPrimary]}>Nhập thông tin theo mẫu biểu chính thức</Text>
                  </View>
                </TouchableOpacity>

                {/* Saved docs list */}
                {getDocsByType(docModal.type).length > 0 && (
                  <View style={styles.savedSection}>
                    <Text style={styles.savedTitle}>Tài liệu đã lưu</Text>
                    {getDocsByType(docModal.type).map((doc) => (
                      <View key={doc.id} style={styles.savedRow}>
                        <View style={styles.savedInfo}>
                          <Text style={styles.savedLabel} numberOfLines={1}>
                            {doc.hospitalName || 'Không rõ bệnh viện'}
                          </Text>
                          <Text style={styles.savedDate}>
                            {doc.visitDate || formatDate(doc.createdAt)}
                            {doc.source === 'upload' ? '  ·  Ảnh tải lên' : '  ·  Điền thủ công'}
                          </Text>
                        </View>
                        <View style={styles.savedActions}>
                          {doc.source === 'manual' && (
                            <TouchableOpacity style={styles.savedEditBtn} onPress={() => handleEditDoc(docModal.type, doc)}>
                              <Text style={styles.savedEditText}>Sửa</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={styles.savedDeleteBtn} onPress={() => handleDeleteDoc(docModal.type, doc)}>
                            <Text style={styles.savedDeleteText}>Xóa</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity style={styles.cancelBtn} onPress={closeDocModal}>
                  <Text style={styles.cancelBtnText}>Đóng</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Modal>

        {/* ── Upload metadata modal ── */}
        <Modal
          visible={!!uploadModal}
          transparent
          animationType="slide"
          onRequestClose={() => setUploadModal(null)}
        >
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setUploadModal(null)} />
          <View style={styles.sheet}>
            {uploadModal && (
              <>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>Lưu ảnh tài liệu</Text>
                <Text style={styles.sheetSubtitle}>{uploadModal.info.icon}  {uploadModal.info.label}</Text>

                {/* Preview */}
                <Image
                  source={{ uri: uploadModal.imageUri }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />

                {/* Metadata fields */}
                <View style={styles.metaField}>
                  <Text style={styles.metaLabel}>Tên bệnh viện</Text>
                  <TextInput
                    style={styles.metaInput}
                    value={hospitalInput}
                    onChangeText={setHospitalInput}
                    placeholder="VD: BV Tâm Trí Đà Nẵng"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={styles.metaField}>
                  <Text style={styles.metaLabel}>Ngày khám / ngày tài liệu</Text>
                  <TextInput
                    style={styles.metaInput}
                    value={dateInput}
                    onChangeText={setDateInput}
                    placeholder="dd/mm/yyyy"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnPrimary, { marginTop: 8 }]} onPress={handleSaveUpload} disabled={uploadSaving}>
                  {uploadSaving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={styles.sheetBtnIcon}>💾</Text>
                      <Text style={[styles.sheetBtnLabel, styles.sheetBtnLabelPrimary]}>Lưu vào kho hồ sơ</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setUploadModal(null)}>
                  <Text style={styles.cancelBtnText}>Hủy</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  backBtn: { paddingVertical: 4, marginRight: 16 },
  backBtnText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  scroll: { paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 40 },
  pageTitle: { fontSize: 22, fontWeight: 'bold', color: '#0F172A', marginBottom: 6 },
  pageSubtitle: { fontSize: 13, color: '#64748B', lineHeight: 20, marginBottom: 24 },
  group: { marginBottom: 28 },
  groupTitle: {
    fontSize: 12, fontWeight: 'bold', color: '#15803D',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 12, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: '#D1FAE5',
  },
  docCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  iconText: { fontSize: 22 },
  cardMeta: { flex: 1 },
  cardLabel: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  cardCount: { fontSize: 11, color: '#15803D', marginTop: 2 },
  countBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#15803D', alignItems: 'center', justifyContent: 'center',
  },
  countBadgeText: { fontSize: 12, color: '#FFFFFF', fontWeight: 'bold' },
  addIcon: { fontSize: 22, color: '#CBD5E1' },
  // Modal base
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12,
    maxHeight: '88%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  sheetSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 14 },
  // Upload row (two sub-buttons)
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10, backgroundColor: '#F8FAFC',
  },
  uploadSubIcon: { fontSize: 22 },
  // Main sheet button
  sheetBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10,
    backgroundColor: '#F8FAFC',
  },
  sheetBtnPrimary: { backgroundColor: '#15803D', borderColor: '#15803D' },
  sheetBtnIcon: { fontSize: 22, marginRight: 14 },
  sheetBtnLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  sheetBtnLabelPrimary: { color: '#FFFFFF' },
  sheetBtnSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  sheetBtnSubPrimary: { color: '#D1FAE5' },
  // Saved docs
  savedSection: { marginTop: 14, marginBottom: 4 },
  savedTitle: {
    fontSize: 11, fontWeight: 'bold', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  savedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  savedInfo: { flex: 1 },
  savedLabel: { fontSize: 13, fontWeight: '500', color: '#0F172A' },
  savedDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  savedActions: { flexDirection: 'row', gap: 8 },
  savedEditBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, backgroundColor: '#EFF6FF',
  },
  savedEditText: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  savedDeleteBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, backgroundColor: '#FEF2F2',
  },
  savedDeleteText: { fontSize: 12, color: '#DC2626', fontWeight: '600' },
  cancelBtn: {
    marginTop: 8, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  // Upload metadata modal
  imagePreview: {
    width: '100%', height: 180, borderRadius: 12,
    backgroundColor: '#F1F5F9', marginBottom: 16,
  },
  metaField: { marginBottom: 12 },
  metaLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 5 },
  metaInput: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: '#0F172A', backgroundColor: '#F8FAFC',
  },
});

export default RecordVaultScreen;
