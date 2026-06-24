import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TextInput,
  TouchableOpacity, SafeAreaView, ActivityIndicator, Platform,
} from 'react-native';
import { get, put, post } from '../services/api.service';
import Colors from '../constants/colors';

const FIELD = (label, key, opts = {}) => ({ label, key, ...opts });

const SECTIONS = [
  {
    title: 'Thông tin chung',
    fields: [
      FIELD('Tên viết tắt (nếu có)', 'nameShort'),
      FIELD('Mã số thuế', 'taxCode', { keyboard: 'numeric' }),
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
      FIELD('Phường/Xã', 'addressWard'),
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await get('/api/v1/hospital/me');
        const h = res.data?.hospital;
        setHospital(h);
        // Pre-fill if already submitted before
        if (h) {
          setForm({
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
      } catch {
        setError('Không thể tải thông tin bệnh viện.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await put('/api/v1/hospital/onboarding', form);
      setSuccess(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'Gửi thông tin thất bại. Vui lòng thử lại.');
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

  if (success || hospital?.status === 'submitted' || hospital?.status === 'active') {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.successBox}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>
            {hospital?.status === 'active' ? 'Tài khoản đã được kích hoạt' : 'Đã gửi thông tin thành công'}
          </Text>
          <Text style={styles.successSub}>
            {hospital?.status === 'active'
              ? 'Bệnh viện của bạn đã được xác thực. Từ lần đăng nhập tiếp theo, sử dụng email đăng nhập chính thức.'
              : 'Hệ thống đang xem xét hồ sơ. Bạn sẽ nhận thông báo khi tài khoản được kích hoạt.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Khai báo Thông tin Bệnh viện</Text>
        <Text style={styles.headerSub}>Điền đầy đủ để hoàn tất đăng ký tài khoản</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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

        {/* GPKD upload note */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Giấy phép hoạt động</Text>
          <View style={styles.uploadNote}>
            <Text style={styles.uploadNoteText}>
              Vui lòng gửi file PDF/ảnh GPKD về email: <Text style={styles.highlight}>support@neuroscan.ai</Text>{'\n'}
              (Tính năng upload trực tiếp sẽ sớm được cập nhật)
            </Text>
          </View>
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
            : <Text style={styles.submitBtnText}>Gửi thông tin xác thực</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
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
  uploadNote: {
    backgroundColor: '#FFF7ED', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  uploadNoteText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  highlight: { color: '#D97706', fontWeight: 'bold' },
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
});
