import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useAppDialog } from '../components/ui/AppDialog';
import { get } from '../services/api.service';
import { WorkCard, StatTiles, EmptyNote, workStyles as w } from '../components/staff/WorkUI';

// Báo cáo vận hành khoa và thống kê lâm sàng cho Ban Giám đốc, Trưởng khoa.

const ClinicalReportsScreen = ({ navigation }) => {
  const { dialog, notify } = useAppDialog();
  const [operation, setOperation] = useState(null);
  const [clinical, setClinical] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [opRes, clinicalRes] = await Promise.all([
        get('/api/v1/reports/department-operation'),
        get('/api/v1/reports/clinical-analytics'),
      ]);
      setOperation(opRes?.data || null);
      setClinical(clinicalRes?.data || null);
    } catch (err) {
      notify('Không tải được báo cáo', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const regions = clinical?.brainRegionDistribution || [];
  const regionRows = Array.isArray(regions)
    ? regions.map((r) => ({ name: r._id || r.region || 'Chưa phân loại', count: r.count ?? 0 }))
    : Object.entries(regions).map(([name, count]) => ({ name, count }));
  const maxCount = Math.max(1, ...regionRows.map((r) => r.count));

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="ClinicalReports">
      <View style={w.root}>
        <PageHeader
          bar
          title="Báo cáo vận hành và lâm sàng"
          subtitle="Số liệu toàn thời gian của viện."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={load} />}
        />
        <ScrollView>
          <PageContainer style={w.page}>
            {loading ? <ActivityIndicator color={Colors.brandGreen} /> : (
              <>
                <Text style={w.section}>Vận hành phòng chụp và phân công</Text>
                {operation ? (
                  <StatTiles items={[
                    { label: 'Ca đã xếp lịch', value: operation.mriSlotMetrics?.totalSlotsScheduled ?? 0 },
                    { label: 'Ca đã hoàn tất', value: operation.mriSlotMetrics?.completedSlots ?? 0 },
                    { label: 'Tỷ lệ hoàn tất', value: `${operation.mriSlotMetrics?.utilizationRate ?? 0}%` },
                    { label: 'Tổng phân công', value: operation.assignmentMetrics?.totalAssignments ?? 0 },
                    { label: 'Phân công quá hạn', value: operation.assignmentMetrics?.overdueAssignments ?? 0 },
                    { label: 'Đúng hạn', value: `${operation.assignmentMetrics?.onTimeRate ?? 0}%` },
                  ]} />
                ) : <EmptyNote text="Chưa có dữ liệu vận hành." />}

                <Text style={w.section}>Thống kê lâm sàng</Text>
                {clinical ? (
                  <StatTiles items={[
                    { label: 'Ca đã phân tích', value: clinical.totalAnalyzedCases ?? 0 },
                    { label: 'Nguy cơ ác tính cao', value: clinical.highMalignancyCount ?? 0 },
                    { label: 'Tỷ lệ ác tính cao', value: `${clinical.highMalignancyRatePercentage ?? 0}%` },
                    { label: 'Có đẩy lệch đường giữa', value: clinical.midlineShiftCasesCount ?? 0 },
                  ]} />
                ) : <EmptyNote text="Chưa có dữ liệu lâm sàng." />}

                {regionRows.length > 0 ? (
                  <WorkCard>
                    <Text style={w.title}>Phân bố vùng não</Text>
                    {regionRows.map((row) => (
                      <View key={row.name} style={{ gap: 2 }}>
                        <View style={w.head}>
                          <Text style={w.meta}>{row.name}</Text>
                          <Text style={[w.meta, { fontVariant: ['tabular-nums'] }]}>{row.count}</Text>
                        </View>
                        <View style={{ height: 8, borderRadius: 4, backgroundColor: Colors.border }}>
                          <View style={{ height: 8, borderRadius: 4, width: `${Math.round((row.count / maxCount) * 100)}%`, backgroundColor: Colors.brandGreen }} />
                        </View>
                      </View>
                    ))}
                  </WorkCard>
                ) : null}
              </>
            )}
          </PageContainer>
        </ScrollView>
      </View>
      {dialog}
    </ResponsiveLayout>
  );
};

export default ClinicalReportsScreen;
