import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useAppDialog } from '../components/ui/AppDialog';
import { get, post, put } from '../services/api.service';
import { WorkButton, WorkCard, WorkField, ChoiceChips, EmptyNote, fmtDateTime, personName, workStyles as w } from '../components/staff/WorkUI';

// Bình duyệt phim lần 2: bác sĩ được phân công đọc độc lập, sau đó chốt kết luận cuối.

const STATUS = {
  pending: 'Chưa có người đọc',
  in_review: 'Đang đọc độc lập',
  awaiting_final: 'Chờ kết luận cuối',
  completed: 'Đã kết luận',
  cancelled: 'Đã hủy',
};
const TYPE = { conflict: 'Có mâu thuẫn', random_qa: 'Lấy mẫu QA', manual: 'Yêu cầu thủ công' };
const MALIGNANCY = [
  { value: 'low', label: 'Thấp' },
  { value: 'moderate', label: 'Trung bình' },
  { value: 'high', label: 'Cao' },
  { value: 'not_applicable', label: 'Không áp dụng' },
];
const FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'in_review', label: 'Đang đọc' },
  { value: 'awaiting_final', label: 'Chờ kết luận' },
  { value: 'completed', label: 'Đã kết luận' },
];
const SAMPLING_ROLES = ['hospital_admin', 'department_head'];
const READER_ROLES = ['doctor', 'radiologist', 'department_head'];
const emptyForm = { conclusion: '', findings: '', malignancyLevel: 'not_applicable', agreeWithAi: null };

const PeerReviewScreen = ({ navigation }) => {
  const { dialog, confirm, notify } = useAppDialog();
  const [me, setMe] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(null);
  const [readingFor, setReadingFor] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [finalFor, setFinalFor] = useState(null);
  const [finalText, setFinalText] = useState('');

  const myId = String(me?._id || me?.id || '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(`/api/v1/peer-reviews?limit=50${filter ? `&status=${filter}` : ''}`);
      setReviews(res?.data?.reviews || []);
    } catch (err) {
      notify('Không tải được danh sách', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, notify]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { get('/auth/me').then((res) => setMe(res?.user || null)).catch(() => {}); }, []);

  const runSampling = async () => {
    const ok = await confirm({
      title: 'Lấy mẫu QA ngẫu nhiên',
      message: 'Hệ thống chọn ngẫu nhiên các ca đã ký trong tuần để bình duyệt lần 2.',
      confirmText: 'Lấy mẫu',
      type: 'info',
    });
    if (!ok) return;
    setBusy('sampling');
    try {
      const res = await post('/api/v1/peer-reviews/random-qa-sampling', {});
      notify('Đã lấy mẫu', res?.message || `Đã chọn ${res?.data?.sampled ?? 0} ca.`, 'success');
      await load();
    } catch (err) {
      notify('Chưa lấy được mẫu', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const submitReading = async (review) => {
    if (!form.conclusion.trim()) {
      notify('Thiếu kết luận', 'Vui lòng nhập kết luận đọc phim của bạn.', 'error');
      return;
    }
    setBusy(review._id);
    try {
      const res = await post(`/api/v1/peer-reviews/${review._id}/submit-reading`, {
        conclusion: form.conclusion.trim(),
        findings: form.findings.trim(),
        malignancyLevel: form.malignancyLevel,
        agreeWithAi: form.agreeWithAi,
      });
      notify(
        res?.data?.isConflicting ? 'Có mâu thuẫn giữa các lần đọc' : 'Đã nộp kết quả',
        res?.data?.isConflicting ? 'Mức độ ác tính khác với lần đọc trước. Cần kết luận cuối.' : 'Kết quả đọc độc lập đã được lưu.',
        res?.data?.isConflicting ? 'info' : 'success',
      );
      setReadingFor(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      notify('Chưa nộp được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const submitFinal = async (review) => {
    if (!finalText.trim()) {
      notify('Thiếu kết luận cuối', 'Vui lòng nhập kết luận cuối.', 'error');
      return;
    }
    setBusy(review._id);
    try {
      await put(`/api/v1/peer-reviews/${review._id}/finalize`, { finalConclusion: finalText.trim() });
      notify('Đã kết luận', 'Đã lưu kết luận cuối của bình duyệt.', 'success');
      setFinalFor(null);
      setFinalText('');
      await load();
    } catch (err) {
      notify('Chưa lưu được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const renderReview = (review) => {
    const isReader = READER_ROLES.includes(me?.role) && (review.reviewerIds || []).some((id) => String(id?._id || id) === myId);
    const submitted = (review.readings || []).some((r) => String(r.reviewerId?._id || r.reviewerId) === myId);
    const open = !['completed', 'cancelled'].includes(review.status);
    const canRead = isReader && !submitted && open;
    const conflicting = (review.readings || []).some((r) => r.isConflicting);
    const image = review.imagingResultId || {};
    return (
      <WorkCard key={review._id} tone={conflicting && open ? 'alert' : undefined}>
        <View style={w.head}>
          <Text style={w.title}>{image.patientName || 'Ca chụp'} · {image.procedure || 'MRI'}</Text>
          <Text style={conflicting && open ? w.statusAlert : w.status}>{conflicting && open ? 'Có mâu thuẫn' : STATUS[review.status]}</Text>
        </View>
        <Text style={w.meta}>{TYPE[review.requestType] || review.requestType} · Tạo bởi {personName(review.createdBy)} · {fmtDateTime(review.createdAt)}</Text>
        {review.conflictReason ? <Text style={w.meta}>Lý do: {review.conflictReason}</Text> : null}
        {(review.readings || []).length > 0 && !canRead ? (
          (review.readings || []).map((r, i) => (
            <Text key={i} style={w.body}>Lần đọc {i + 1}: {r.conclusion} ({MALIGNANCY.find((m) => m.value === r.malignancyLevel)?.label || '—'})</Text>
          ))
        ) : null}
        {canRead && (review.readings || []).length > 0 ? <Text style={w.meta}>Kết quả các lần đọc khác được ẩn để bạn đọc độc lập.</Text> : null}
        {review.finalConclusion ? <Text style={w.body}>Kết luận cuối: {review.finalConclusion}</Text> : null}

        {readingFor === review._id ? (
          <View style={{ gap: 8 }}>
            <WorkField label="Mô tả hình ảnh" multiline value={form.findings} onChangeText={(v) => setForm((p) => ({ ...p, findings: v }))} />
            <WorkField label="Kết luận của bạn" multiline value={form.conclusion} onChangeText={(v) => setForm((p) => ({ ...p, conclusion: v }))} />
            <ChoiceChips label="Mức độ ác tính" options={MALIGNANCY} value={form.malignancyLevel} onChange={(v) => setForm((p) => ({ ...p, malignancyLevel: v }))} />
            <ChoiceChips
              label="So với kết quả AI"
              options={[{ value: null, label: 'Không đánh giá' }, { value: true, label: 'Đồng ý' }, { value: false, label: 'Không đồng ý' }]}
              value={form.agreeWithAi}
              onChange={(v) => setForm((p) => ({ ...p, agreeWithAi: v }))}
            />
            <View style={w.actions}>
              <WorkButton label="Nộp kết quả đọc" busy={busy === review._id} onPress={() => submitReading(review)} />
              <WorkButton label="Hủy" variant="ghost" onPress={() => setReadingFor(null)} />
            </View>
          </View>
        ) : finalFor === review._id ? (
          <View style={{ gap: 8 }}>
            <WorkField label="Kết luận cuối" multiline value={finalText} onChangeText={setFinalText} />
            <View style={w.actions}>
              <WorkButton label="Lưu kết luận cuối" busy={busy === review._id} onPress={() => submitFinal(review)} />
              <WorkButton label="Hủy" variant="ghost" onPress={() => setFinalFor(null)} />
            </View>
          </View>
        ) : (
          <View style={w.actions}>
            {canRead ? <WorkButton label="Đọc độc lập" onPress={() => { setForm(emptyForm); setReadingFor(review._id); }} /> : null}
            {review.status === 'awaiting_final' ? <WorkButton label="Kết luận cuối" variant={canRead ? 'ghost' : 'primary'} onPress={() => { setFinalText(''); setFinalFor(review._id); }} /> : null}
          </View>
        )}
      </WorkCard>
    );
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="PeerReview">
      <View style={w.root}>
        <PageHeader
          bar
          title="Bình duyệt phim lần 2"
          subtitle="Bác sĩ thứ hai đọc độc lập để kiểm soát chất lượng kết quả CĐHA."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={load} />}
        />
        <ScrollView>
          <PageContainer style={w.page}>
            <ChoiceChips options={FILTERS} value={filter} onChange={setFilter} />
            {SAMPLING_ROLES.includes(me?.role) ? (
              <View style={w.actions}>
                <WorkButton label="Lấy mẫu QA ngẫu nhiên" variant="ghost" busy={busy === 'sampling'} onPress={runSampling} />
              </View>
            ) : null}
            {loading ? <ActivityIndicator color={Colors.brandGreen} />
              : reviews.length === 0 ? <EmptyNote text="Không có ca bình duyệt nào." />
                : reviews.map(renderReview)}
          </PageContainer>
        </ScrollView>
      </View>
      {dialog}
    </ResponsiveLayout>
  );
};

export default PeerReviewScreen;
