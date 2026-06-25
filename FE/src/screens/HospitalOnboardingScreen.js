import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TextInput,
  TouchableOpacity, SafeAreaView, ActivityIndicator, Platform, Alert, Modal,
} from 'react-native';
import { get, put, post, postFormData } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import * as DocumentPicker from 'expo-document-picker';
import Colors from '../constants/colors';

const FIELD = (label, key, opts = {}) => ({ label, key, ...opts });

const SECTIONS = [
  {
    title: 'Thông tin chung',
    fields: [
      FIELD('Tên bệnh viện (đầy đủ)', 'name', { required: true }),
      FIELD('Tên viết tắt (nếu có)', 'nameShort'),
      FIELD('Mã số thuế', 'taxCode', { required: true, keyboard: 'numeric' }),
    ],
  },
  {
    title: 'Thông tin đăng nhập hệ thống',
    note: 'Email này sẽ trở thành tên đăng nhập chính thức sau khi được xác thực.',
    fields: [
      FIELD('Email đăng nhập chính thức', 'loginEmail', { required: true, keyboard: 'email-address' }),
    ],
  },
  {
    title: 'Địa chỉ & Liên hệ',
    fields: [
      FIELD('Số nhà, đường', 'addressStreet', { required: true }),
      FIELD('Phường/Xã', 'addressWard', { required: true }),
      FIELD('Quận/Huyện', 'addressDistrict', { required: true }),
      FIELD('Tỉnh/Thành phố', 'addressProvince', { required: true }),
      FIELD('Số điện thoại liên hệ', 'phone', { required: true, keyboard: 'phone-pad' }),
      FIELD('Email liên hệ (chung)', 'contactEmail', { required: true, keyboard: 'email-address' }),
      FIELD('Website (nếu có)', 'website'),
      FIELD('Fax (nếu có)', 'fax'),
    ],
  },
  {
    title: 'Người đại diện pháp luật',
    fields: [
      FIELD('Họ và tên', 'legalRepName', { required: true }),
      FIELD('Chức vụ (VD: Giám đốc)', 'legalRepPosition', { required: true }),
      FIELD('Số điện thoại di động', 'legalRepPhone', { required: true, keyboard: 'phone-pad' }),
      FIELD('Email', 'legalRepEmail', { required: true, keyboard: 'email-address' }),
    ],
  },
  {
    title: 'Người liên hệ kỹ thuật (IT)',
    fields: [
      FIELD('Họ và tên IT phụ trách', 'itName', { required: true }),
      FIELD('Số điện thoại IT', 'itPhone', { required: true, keyboard: 'phone-pad' }),
      FIELD('Email IT', 'itEmail', { required: true, keyboard: 'email-address' }),
    ],
  },
];

export default function HospitalOnboardingScreen({ navigation }) {
  const [hospital, setHospital] = useState(null);
  const [form, setForm] = useState({});
  const [licenseFile, setLicenseFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/v1/hospital/me');
        const h = res.hospital || res.data?.hospital;
        setHospital(h);
        if (h) {
          setLicenseFile(h.licenseFile || null);
          setForm({
            name: h.name || '',
            nameShort: h.nameShort || '',
            taxCode: h.taxCode || '',
            loginEmail: h.loginEmail || '',
            addressStreet: h.address?.street || '',
            addressWard: h.address?.ward || '',
            addressDistrict: h.address?.district || '',
            addressProvince: h.address?.province || '',
            phone: h.phone || '',
            contactEmail: h.contactEmail || '',
            website: h.website || '',
            fax: h.fax || '',
            legalRepName: h.legalRep?.name || '',
            legalRepPosition: h.legalRep?.position || '',
            legalRepPhone: h.legalRep?.phone || '',
            legalRepEmail: h.legalRep?.email || '',
            itName: h.itContact?.name || '',
            itPhone: h.itContact?.phone || '',
            itEmail: h.itContact?.email || '',
          });
        }
      } catch (err) {
        console.error('Error loading hospital details:', err);
        setError('Không thể tải thông tin bệnh viện.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePickLicense = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        setUploadingFile(true);
        setError('');

        let fileObj;
        if (Platform.OS === 'web') {
          const resp = await fetch(asset.uri);
          const blob = await resp.blob();
          fileObj = new File([blob], asset.name, { type: asset.mimeType || blob.type });
        } else {
          fileObj = { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' };
        }

        const formData = new FormData();
        formData.append('file', fileObj);

        const uploadRes = await postFormData('/api/v1/hospital/onboarding/license', formData);
        setLicenseFile(uploadRes.licenseFile);
      }
    } catch (err) {
      setError(err?.message || 'Tải lên Giấy phép hoạt động thất bại.');
    } finally {
      setUploadingFile(false);
    }
  };

  const hasVietnameseTones = (str) => {
    return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/.test(str);
  };

  const validateVNPhone = (p) => {
    if (!p) return false;
    const cleaned = p.toString().replace(/[\s.-]/g, '');
    return /^(0|\+84)(3|5|7|8|9|2)\d{8,9}$/.test(cleaned);
  };

  const validateURL = (url) => {
    if (!url) return true;
    try {
      const checkUrl = url.includes('://') ? url : 'http://' + url;
      const parts = checkUrl.split('://')[1];
      if (!parts) return false;
      const host = parts.split('/')[0];
      return host.includes('.') && host.length > 3;
    } catch {
      return false;
    }
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async () => {
    setError('');

    // Check license file
    if (!licenseFile) {
      setError('Vui lòng tải lên Giấy phép hoạt động (ảnh hoặc file PDF).');
      return;
    }

    // Required fields check
    const requiredFields = [
      { key: 'name', label: 'Tên bệnh viện (đầy đủ)' },
      { key: 'taxCode', label: 'Mã số thuế' },
      { key: 'loginEmail', label: 'Email đăng nhập chính thức' },
      { key: 'addressStreet', label: 'Số nhà, đường' },
      { key: 'addressWard', label: 'Phường/Xã' },
      { key: 'addressDistrict', label: 'Quận/Huyện' },
      { key: 'addressProvince', label: 'Tỉnh/Thành phố' },
      { key: 'phone', label: 'Số điện thoại liên hệ' },
      { key: 'contactEmail', label: 'Email liên hệ' },
      { key: 'legalRepName', label: 'Họ và tên người đại diện pháp luật' },
      { key: 'legalRepPosition', label: 'Chức vụ người đại diện' },
      { key: 'legalRepPhone', label: 'Số điện thoại di động người đại diện' },
      { key: 'legalRepEmail', label: 'Email người đại diện' },
      { key: 'itName', label: 'Họ và tên IT phụ trách' },
      { key: 'itPhone', label: 'Số điện thoại IT' },
      { key: 'itEmail', label: 'Email IT' }
    ];

    for (const f of requiredFields) {
      if (!form[f.key] || !form[f.key].toString().trim()) {
        setError(`Trường "${f.label}" là bắt buộc.`);
        return;
      }
    }

    // 1. Accents validation for hospital name
    if (!hasVietnameseTones(form.name)) {
      setError('Tên bệnh viện bắt buộc phải viết bằng tiếng Việt có dấu.');
      return;
    }

    // 2. Tax code numeric format check
    if (!/^\d+$/.test(form.taxCode.toString().trim())) {
      setError('Mã số thuế phải là định dạng số.');
      return;
    }

    // 3. Email validations
    if (!validateEmail(form.loginEmail)) {
      setError('Email đăng nhập chính thức không đúng định dạng.');
      return;
    }
    if (!validateEmail(form.contactEmail)) {
      setError('Email liên hệ không đúng định dạng.');
      return;
    }
    if (!validateEmail(form.legalRepEmail)) {
      setError('Email người đại diện không đúng định dạng.');
      return;
    }
    if (!validateEmail(form.itEmail)) {
      setError('Email IT không đúng định dạng.');
      return;
    }

    // Email overlap checks
    if (form.loginEmail.toLowerCase() === form.contactEmail.toLowerCase()) {
      setError('Email đăng nhập chính thức không được trùng với Email liên hệ chung.');
      return;
    }
    if (form.loginEmail.toLowerCase() === form.itEmail.toLowerCase()) {
      setError('Email đăng nhập chính thức không được trùng với Email IT phụ trách.');
      return;
    }

    // 4. Vietnamese phone validation
    if (!validateVNPhone(form.phone)) {
      setError('Số điện thoại liên hệ không hợp lệ (định dạng Việt Nam).');
      return;
    }
    if (!validateVNPhone(form.legalRepPhone)) {
      setError('Số điện thoại di động người đại diện không hợp lệ (định dạng Việt Nam).');
      return;
    }
    if (!validateVNPhone(form.itPhone)) {
      setError('Số điện thoại IT không hợp lệ (định dạng Việt Nam).');
      return;
    }

    // 5. Website URL validation (if provided)
    if (form.website && !validateURL(form.website)) {
      setError('Website không đúng định dạng URL.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await put('/api/v1/hospital/onboarding', form);
      setSuccess(true);
      if (res && res.hospital) {
        setHospital(res.hospital);
      }
      setShowSuccessModal(true);
    } catch (err) {
      setError(err?.message || 'Gửi thông tin thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="HospitalOnboarding">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.headerTitle}>Khai báo Thông tin Bệnh viện</Text>
              <Text style={styles.headerSub}>Điền đầy đủ để hoàn tất đăng ký tài khoản</Text>
            </View>
            {hospital?.status !== 'provisioned' && (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.navigate('ClinicDashboard')}
              >
                <Text style={styles.backBtnText}>← Quay lại Dashboard</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Status Banner */}
          {(hospital?.status === 'submitted' || hospital?.status === 'active' || success) && (
            <View style={[
              styles.statusBanner,
              hospital?.status === 'active' ? styles.statusBannerActive : styles.statusBannerPending
            ]}>
              <Text style={[
                styles.statusBannerTitle,
                hospital?.status === 'active' ? styles.statusBannerTitleActive : styles.statusBannerTitlePending
              ]}>
                {hospital?.status === 'active' ? '✓ Tài khoản đã hoạt động' : '⏳ Hồ sơ đang chờ phê duyệt'}
              </Text>
              <Text style={styles.statusBannerText}>
                {hospital?.status === 'active'
                  ? 'Thông tin bệnh viện đã được xác thực chính thức. Bạn vẫn có thể cập nhật thông tin khi cần thiết.'
                  : 'Thông tin của bệnh viện đã được gửi lên hệ thống và đang chờ Admin duyệt. Bạn vẫn có thể chỉnh sửa và cập nhật lại.'}
              </Text>
            </View>
          )}

          {/* Hospital name (read-only from system) */}
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Bệnh viện</Text>
            <Text style={styles.infoValue}>{hospital?.name || '—'}</Text>
            <Text style={styles.infoLabel} numberOfLines={1}>Mã tài khoản tạm: {hospital?.code || '—'}</Text>
          </View>

          {SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.note && <Text style={styles.sectionNote}>{section.note}</Text>}
              {section.fields.map((field) => (
                <View key={field.key} style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>
                    {field.label}
                    {field.required && <Text style={styles.required}> *</Text>}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={form[field.key] || ''}
                    onChangeText={(v) => setForm((prev) => ({ ...prev, [field.key]: v }))}
                    keyboardType={field.keyboard || 'default'}
                    autoCapitalize={field.keyboard === 'email-address' ? 'none' : 'sentences'}
                    placeholderTextColor="#94A3B8"
                    placeholder={field.required ? 'Bắt buộc' : 'Tùy chọn'}
                  />
                </View>
              ))}
            </View>
          ))}

          {/* GPKD upload section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giấy phép hoạt động <Text style={styles.required}>*</Text></Text>
            <Text style={styles.sectionNote}>Tải lên tài liệu PDF hoặc hình ảnh giấy phép kinh doanh/hoạt động.</Text>
            {licenseFile ? (
              <View style={styles.uploadedFileRow}>
                <Text style={styles.uploadedFileIcon}>📄</Text>
                <Text style={styles.uploadedFileName} numberOfLines={1}>
                  {licenseFile.split('/').pop() || 'Giấy phép hoạt động'}
                </Text>
                <TouchableOpacity onPress={() => setLicenseFile(null)} style={styles.removeFileBtn}>
                  <Text style={styles.removeFileText}>Xóa</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadBtn} onPress={handlePickLicense} disabled={uploadingFile}>
                {uploadingFile ? (
                  <ActivityIndicator color="#15803D" size="small" />
                ) : (
                  <View style={styles.uploadBtnContent}>
                    <Text style={styles.uploadBtnIcon}>📤</Text>
                    <Text style={styles.uploadBtnText}>Nhấp để tải lên (PDF/Ảnh)</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.submitBtnText}>
                  {hospital?.status === 'submitted' || hospital?.status === 'active'
                    ? 'Cập nhật thông tin bệnh viện'
                    : 'Gửi thông tin xác thực'}
                </Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Success Redirect Modal */}
        <Modal visible={showSuccessModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.successCard}>
              <View style={styles.successIconCircle}>
                <Text style={styles.successIconText}>✓</Text>
              </View>
              <Text style={styles.successModalTitle}>Gửi hồ sơ thành công! 🎉</Text>
              <Text style={styles.successModalMessage}>
                Thông tin đăng ký của bệnh viện đã được ghi nhận và đang chờ ban quản trị hệ thống phê duyệt chính thức. Bạn hiện có thể truy cập ngay vào Dashboard quản trị phòng khám.
              </Text>
              <TouchableOpacity
                style={styles.successBtn}
                onPress={() => {
                  setShowSuccessModal(false);
                  navigation.replace('ClinicDashboard');
                }}
              >
                <Text style={styles.successBtnText}>Đi tới Dashboard Phòng khám →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ResponsiveLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  scroll: { padding: 16, gap: 16 },
  infoBox: {
    backgroundColor: '#EFF6FF', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#BFDBFE',
  },
  infoLabel: { fontSize: 11, color: '#3B82F6', marginTop: 2 },
  infoValue: { fontSize: 16, fontWeight: 'bold', color: '#1E40AF' },
  section: {
    backgroundColor: '#fff', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#E2E8F0',
  },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#334155', marginBottom: 4 },
  sectionNote: { fontSize: 11, color: '#F59E0B', marginBottom: 10, lineHeight: 16 },
  fieldWrap: { marginTop: 12 },
  fieldLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  required: { color: '#EF4444' },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'web' ? 10 : 8,
    fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC',
  },
  uploadedFileRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4',
    borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 10, padding: 12,
  },
  uploadedFileIcon: { fontSize: 18, marginRight: 8 },
  uploadedFileName: { flex: 1, fontSize: 13, color: '#166534', fontWeight: '600' },
  removeFileBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  removeFileText: { fontSize: 12, color: '#EF4444', fontWeight: 'bold' },
  uploadBtn: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 10,
    paddingVertical: 18, alignItems: 'center', backgroundColor: '#F8FAFC',
  },
  uploadBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  uploadBtnIcon: { fontSize: 16 },
  uploadBtnText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center' },
  submitBtn: {
    backgroundColor: Colors.primary || '#15803D', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  successBox: { alignItems: 'center', padding: 32, maxWidth: 320 },
  successIcon: { fontSize: 48, color: '#15803D', marginBottom: 12 },
  successTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A', textAlign: 'center', marginBottom: 8 },
  successSub: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  statusBanner: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusBannerActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  statusBannerPending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  statusBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusBannerTitleActive: {
    color: '#166534',
  },
  statusBannerTitlePending: {
    color: '#92400E',
  },
  statusBannerText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#15803D',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#BBF7D0',
  },
  successIconText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#15803D',
  },
  successModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'center',
  },
  successModalMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  successBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#15803D',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
