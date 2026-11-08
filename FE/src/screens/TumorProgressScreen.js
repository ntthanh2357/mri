import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useAppDialog } from '../components/ui/AppDialog';
import { get } from '../services/api.service';
import { WorkCard, EmptyNote, WorkButton, fmtDate, workStyles as w } from '../components/staff/WorkUI';

// Diễn tiến khối u qua các lần chụp theo tiêu chuẩn RANO, mở từ màn kết quả CĐHA.

const RANO = {
  CR: 'Đáp ứng hoàn toàn',
  PR: 'Đáp ứng một phần',
  SD: 'Bệnh ổn định',
  PD: 'Bệnh tiến triển',
};

const TumorProgressScreen = ({ navigation, route }) => {
  const { dialog, notify } = useAppDialog();
  const medicalId = route.params?.medicalId;
  const patientName = route.params?.patientName;
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!medicalId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await get(`/api/v1/imaging/patient/${encodeURIComponent(medicalId)}/rano-timeline`);
      const rows = res?.timeline || res?.data?.timeline || res?.data || [];
      setTimeline(Array.isArray(rows) ? rows : []);
    } catch (err) {
      notify('Không tải được diễn tiến', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  }, [medicalId, notify]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const maxCross = Math.max(1, ...timeline.map((t) => t.crossProductMm2 || 0));

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="DoctorPatientList">
      <View style={w.root}>
        <PageHeader
          bar
          title="Diễn tiến khối u"
          subtitle={[patientName, medicalId].filter(Boolean).join(' · ') || 'Theo tiêu chuẩn RANO'}
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={load} />}
        />
        <ScrollView>
          <PageContainer style={w.page}>
            {loading ? <ActivityIndicator color={Colors.brandGreen} />
              : !medicalId ? <EmptyNote text="Hãy mở màn hình này từ một kết quả CĐHA của bệnh nhân." />
                : timeline.length === 0 ? <EmptyNote text="Chưa có lần chụp nào có số đo khối u." />
                  : timeline.map((item) => {
                    const progressive = item.ranoCategory === 'PD';
                    return (
                      <WorkCard key={item.imagingResultId} tone={progressive || item.criticalFinding?.isCritical ? 'alert' : undefined}>
                        <View style={w.head}>
                          <Text style={w.title}>{fmtDate(item.reportDate)} · {item.procedure || 'MRI'}</Text>
                          <Text style={progressive ? w.statusAlert : w.status}>{RANO[item.ranoCategory] || item.ranoCategory || 'Chưa đánh giá'}</Text>
                        </View>
                        <Text style={w.meta}>
                          Kích thước {item.d1Mm} x {item.d2Mm} x {item.d3Mm} mm · Tích hai đường kính {item.crossProductMm2} mm²
                          {item.changePercent !== null && item.changePercent !== undefined ? ` · Thay đổi ${item.changePercent}%` : ''}
                        </Text>
                        <View style={{ height: 8, borderRadius: 4, backgroundColor: Colors.border }}>
                          <View style={{ height: 8, borderRadius: 4, width: `${Math.round(((item.crossProductMm2 || 0) / maxCross) * 100)}%`, backgroundColor: progressive ? '#B91C1C' : Colors.brandGreen }} />
                        </View>
                        <Text style={w.meta}>Đẩy lệch đường giữa {item.midlineShiftMm} mm{item.isSigned ? '' : ' · Báo cáo chưa ký'}</Text>
                        {item.isPseudoprogressionSuspected ? <Text style={w.statusAlert}>Nghi ngờ giả tiến triển sau xạ trị</Text> : null}
                        <View style={w.actions}>
                          <WorkButton
                            label="Mở báo cáo"
                            variant="ghost"
                            onPress={() => navigation.navigate('ImagingResult', { resultId: item.imagingResultId, visitId: item.visitId })}
                          />
                        </View>
                      </WorkCard>
                    );
                  })}
          </PageContainer>
        </ScrollView>
      </View>
      {dialog}
    </ResponsiveLayout>
  );
};

export default TumorProgressScreen;
