import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useAppDialog } from '../components/ui/AppDialog';
import { get, post } from '../services/api.service';
import { WorkButton, WorkCard, StatTiles, fmtDate, workStyles as w } from '../components/staff/WorkUI';

// Ban Giám đốc: gói dịch vụ, dung lượng và sao lưu. Quản trị nền tảng: toàn vẹn nhật ký và chuẩn hóa dữ liệu.

const PLATFORM_ROLES = ['admin', 'system_admin'];
const STORAGE_ROLES = ['admin', 'hospital_admin'];

const ComplianceCenterScreen = ({ navigation }) => {
  const { dialog, confirm, notify } = useAppDialog();
  const [role, setRole] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [capacity, setCapacity] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async (currentRole) => {
    setLoading(true);
    try {
      if (currentRole === 'hospital_admin') {
        const res = await get('/admin/subscription-dashboard');
        setSubscription(res || null);
      }
      if (STORAGE_ROLES.includes(currentRole)) {
        const res = await get('/api/v1/drive-storage/capacity-check');
        setCapacity(res?.data || null);
      }
    } catch (err) {
      notify('Không tải được dữ liệu', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    get('/auth/me')
      .then((res) => { setRole(res?.user?.role || null); return load(res?.user?.role); })
      .catch(() => setLoading(false));
  }, [load]);

  const run = async (key, action, successTitle) => {
    setBusy(key);
    try {
      const res = await action();
      notify(successTitle, res?.message || 'Đã hoàn tất.', 'success');
      return res;
    } catch (err) {
      notify('Chưa thực hiện được', err.message || 'Vui lòng thử lại.', 'error');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const checkIntegrity = async () => {
    setBusy('integrity');
    try {
      const res = await get('/admin/compliance/audit-integrity');
      setIntegrity(res);
    } catch (err) {
      notify('Chưa kiểm tra được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const migrateEmr = async () => {
    const ok = await confirm({
      title: 'Chuẩn hóa dữ liệu EMR',
      message: 'Chuyển các hồ sơ bệnh án cũ về định dạng hiện tại.',
      note: 'Thao tác ghi trực tiếp vào dữ liệu thật. Hãy sao lưu trước khi chạy.',
      confirmText: 'Chạy chuẩn hóa',
      type: 'danger',
    });
    if (ok) await run('migrate', () => post('/admin/compliance/migrate-emr', {}), 'Đã chuẩn hóa');
  };

  const sub = subscription?.subscription;
  const usage = subscription?.usage;

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="ComplianceCenter">
      <View style={w.root}>
        <PageHeader
          bar
          title="Tuân thủ và dữ liệu"
          subtitle="Tình trạng gói dịch vụ, lưu trữ và toàn vẹn nhật ký."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={() => load(role)} />}
        />
        <ScrollView>
          <PageContainer style={w.page}>
            {loading ? <ActivityIndicator color={Colors.brandGreen} /> : null}

            {sub ? (
              <>
                <Text style={w.section}>Gói dịch vụ</Text>
                <StatTiles items={[
                  { label: 'Gói hiện tại', value: sub.plan || '—' },
                  { label: 'Hết hạn', value: fmtDate(sub.expiresAt) },
                  { label: 'Còn lại (ngày)', value: sub.daysUntilExpiry ?? '—' },
                  { label: 'Bệnh nhân', value: `${usage?.currentPatientCount ?? 0}/${usage?.maxPatients ?? 0}` },
                ]} />
                {(subscription.warnings || []).map((warning) => <Text key={warning} style={w.statusAlert}>{warning}</Text>)}
              </>
            ) : null}

            {STORAGE_ROLES.includes(role) ? (
              <>
                <Text style={w.section}>Lưu trữ và sao lưu</Text>
                {capacity ? (
                  <WorkCard tone={capacity.alertLevel === 'critical' ? 'alert' : undefined}>
                    <View style={w.head}>
                      <Text style={w.title}>Đã dùng {capacity.usagePercentage}%</Text>
                      <Text style={w.meta}>{Math.round(capacity.usedCapacityMb).toLocaleString('vi-VN')} / {Math.round(capacity.totalCapacityMb).toLocaleString('vi-VN')} MB</Text>
                    </View>
                    <Text style={w.meta}>{capacity.alertMessage}</Text>
                  </WorkCard>
                ) : null}
                {/* Sao lưu/dọn tệp lên Google Drive chưa được tích hợp (máy chủ trả 501). Trước đây nút bấm báo
                    thông báo sao lưu thành công dù không có gì được ghi, nên bỏ nút và nói rõ tình trạng. */}
                <WorkCard>
                  <Text style={w.meta}>Sao lưu dữ liệu của viện được thực hiện tự động (bản mã hóa) và theo yêu cầu bởi quản trị nền tảng. Đồng bộ và dọn tệp trên Google Drive chưa được kích hoạt.</Text>
                </WorkCard>
              </>
            ) : null}

            {PLATFORM_ROLES.includes(role) ? (
              <>
                <Text style={w.section}>Toàn vẹn nhật ký kiểm toán</Text>
                <WorkCard tone={integrity && !integrity.valid ? 'alert' : undefined}>
                  {integrity ? (
                    <>
                      <Text style={integrity.valid ? w.status : w.statusAlert}>{integrity.valid ? 'Chuỗi nhật ký nguyên vẹn' : 'Phát hiện nhật ký bị can thiệp'}</Text>
                      <Text style={w.meta}>{integrity.valid ? `Đã kiểm tra ${integrity.verifiedCount ?? 0} bản ghi.` : integrity.reason}</Text>
                      {integrity.legacyUnverifiedCount > 0 ? <Text style={w.meta}>{integrity.legacyUnverifiedCount} bản ghi cũ chỉ kiểm tra được liên kết, không băm lại được nội dung.</Text> : null}
                    </>
                  ) : <Text style={w.meta}>Kiểm tra toàn bộ chuỗi băm của nhật ký kiểm toán.</Text>}
                  <View style={w.actions}>
                    <WorkButton label="Kiểm tra ngay" busy={busy === 'integrity'} onPress={checkIntegrity} />
                    <WorkButton label="Chuẩn hóa dữ liệu EMR" variant="ghost" busy={busy === 'migrate'} onPress={migrateEmr} />
                  </View>
                </WorkCard>
              </>
            ) : null}
          </PageContainer>
        </ScrollView>
      </View>
      {dialog}
    </ResponsiveLayout>
  );
};

export default ComplianceCenterScreen;
