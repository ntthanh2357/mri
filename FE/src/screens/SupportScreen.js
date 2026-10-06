import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import {
  MessageCircle, PhoneCall, Mail, Search, ChevronDown, Send, RefreshCw, LifeBuoy, Clock3,
  Bug, Brain, CreditCard, Lightbulb, Headphones, CheckCircle2, Inbox,
} from 'lucide-react';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { get, post } from '../services/api.service';
import { getFaqsForRole } from '../constants/supportFaqs';
import { Reveal } from '../components/ui/Motion';
import { ReceptionBanner, EmptyState } from '../components/reception/ReceptionUI';

const SUPPORT_IMAGES = {
  hero: require('../../assets/reception/support_headset.jpg'),
  team: require('../../assets/reception/support_office.jpg'),
};

const SupportScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [faqSearch, setFaqSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [message, setMessage] = useState('');

  // Ticket state
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [sendingTicket, setSendingTicket] = useState(false);

  const { width } = useWindowDimensions();
  const isWide = width > 1180;

  const contactOptions = [
    { icon: MessageCircle, title: 'Chat trực tiếp', desc: 'Phản hồi trong 2 phút', action: 'Bắt đầu chat', color: '#0F9D6B', bg: '#E3F7EF', url: null },
    { icon: PhoneCall, title: 'Hotline 24/7', desc: '1800 1234', action: 'Gọi ngay', color: '#1A5FD0', bg: '#E7F0FE', url: 'tel:18001234' },
    { icon: Mail, title: 'Gửi email', desc: 'support@neuroscan.ai', action: 'Soạn email', color: '#7C3AED', bg: '#F3EEFF', url: 'mailto:support@neuroscan.ai?subject=Yêu cầu hỗ trợ kỹ thuật' },
  ];

  const faqGroups = getFaqsForRole(user?.role);
  const keyword = faqSearch.trim().toLowerCase();
  const visibleGroups = faqGroups
    .map((g) => ({ ...g, items: g.items.filter((f) => !keyword || f.q.toLowerCase().includes(keyword) || f.a.toLowerCase().includes(keyword)) }))
    .filter((g) => g.items.length > 0);

  const topics = [
    { label: 'Lỗi kỹ thuật phần mềm', icon: Bug, color: '#DC2626' },
    { label: 'Câu hỏi về thuật toán AI', icon: Brain, color: '#7C3AED' },
    { label: 'Thanh toán & Nâng cấp Premium', icon: CreditCard, color: '#D97706' },
    { label: 'Yêu cầu tính năng mới', icon: Lightbulb, color: '#0F9D6B' },
  ];

  // ── Lấy danh sách ticket từ API ────────────────────────────────────────────
  const fetchTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const res = await get('/api/v1/support/tickets');
      if (res && res.success) {
        setTickets(res.tickets || []);
      }
    } catch (err) {
      console.warn('Không thể tải danh sách ticket:', err.message);
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // ── Lấy thông tin người dùng để hiển thị FAQ theo vai trò ──────────────────
  useEffect(() => {
    get('/auth/me')
      .then((res) => setUser(res.user))
      .catch((err) => console.warn('Không thể tải thông tin người dùng:', err.message));
  }, []);

  // ── Gửi ticket mới ─────────────────────────────────────────────────────────
  const handleSendTicket = async () => {
    if (!message.trim() || !selectedTopic) {
      Alert.alert('Lỗi', 'Vui lòng chọn chủ đề và nhập nội dung mô tả vấn đề.');
      return;
    }
    setSendingTicket(true);
    try {
      const res = await post('/api/v1/support/tickets', {
        topic: selectedTopic,
        message: message.trim(),
        priority: 'medium',
      });
      if (res && res.success) {
        Alert.alert('Thành công', res.message || 'Yêu cầu hỗ trợ đã được ghi nhận!');
        setMessage('');
        setSelectedTopic('');
        fetchTickets();
      } else {
        Alert.alert('Lỗi', res?.message || 'Không thể gửi yêu cầu. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Lỗi gửi ticket:', err);
      Alert.alert('Lỗi kết nối', 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.');
    } finally {
      setSendingTicket(false);
    }
  };

  // ── Xử lý nút liên hệ ──────────────────────────────────────────────────────
  const handleContactAction = async (option) => {
    if (!option.url) {
      Alert.alert(option.title, 'Tính năng đang được phát triển. Vui lòng sử dụng email hoặc hotline.');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(option.url);
      if (canOpen) {
        await Linking.openURL(option.url);
      } else {
        Alert.alert('Không thể mở', `Thiết bị không hỗ trợ mở liên kết: ${option.url}`);
      }
    } catch (err) {
      console.error('Linking error:', err);
      Alert.alert('Lỗi', 'Không thể mở liên kết. Vui lòng thử lại.');
    }
  };

  // ── Màu & bước tiến độ theo trạng thái ticket ──────────────────────────────
  const getStatusBadge = (status) => {
    switch (status) {
      case 'open': return { bg: '#D5F5E7', text: '#0B7A53', label: 'Đang mở', step: 1 };
      case 'in_progress': return { bg: '#DBEAFE', text: '#1D4ED8', label: 'Đang xử lý', step: 2 };
      case 'resolved': return { bg: '#F1F5F9', text: '#475569', label: 'Đã giải quyết', step: 3 };
      case 'closed': return { bg: '#FEE2E2', text: '#991B1B', label: 'Đã đóng', step: 3 };
      default: return { bg: '#F1F5F9', text: '#475569', label: status, step: 1 };
    }
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="Support" user={user}>
      <ScrollView style={s.page} contentContainerStyle={s.pageContent} keyboardShouldPersistTaps="handled">
        <ReceptionBanner
          image={SUPPORT_IMAGES.hero}
          tone="navy"
          eyebrow="Trung tâm hỗ trợ kỹ thuật"
          title="Chúng tôi luôn sẵn sàng hỗ trợ bạn"
          subtitle="Đội kỹ thuật NeuroScan trực 24/7 — tra cứu câu hỏi thường gặp hoặc gửi yêu cầu, chúng tôi phản hồi trong vòng 2 giờ."
        >
            <View style={s.onDuty}>
              <View style={s.onDutyRow}>
                <View style={s.liveDot} dataSet={{ anim: 'ping' }} />
                <Text style={s.onDutyLabel}>Đội kỹ thuật đang trực</Text>
              </View>
              <View style={s.onDutyStats}>
                <View>
                  <Text style={s.onDutyValue}>&lt; 2 giờ</Text>
                  <Text style={s.onDutySub}>Thời gian phản hồi</Text>
                </View>
                <View style={s.onDutyDivider} />
                <View>
                  <Text style={s.onDutyValue}>24/7</Text>
                  <Text style={s.onDutySub}>Hotline 1800 1234</Text>
                </View>
              </View>
            </View>
        </ReceptionBanner>

        {/* Kênh liên hệ */}
        <View style={s.contactRow}>
          {contactOptions.map((opt, i) => {
            const Icon = opt.icon;
            return (
              <Reveal key={opt.title} delay={i * 100} style={{ width: isWide ? '32.4%' : '100%' }}>
                <TouchableOpacity style={s.contactCard} onPress={() => handleContactAction(opt)} dataSet={{ hover: 'lift' }}>
                  <View style={[s.contactIcon, { backgroundColor: opt.bg }]}><Icon size={24} color={opt.color} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.contactTitle}>{opt.title}</Text>
                    <Text style={s.contactDesc}>{opt.desc}</Text>
                  </View>
                  <View style={[s.contactAction, { backgroundColor: opt.color }]}>
                    <Text style={s.contactActionText}>{opt.action}</Text>
                  </View>
                </TouchableOpacity>
              </Reveal>
            );
          })}
        </View>

        <View style={[s.twoCol, isWide && { flexDirection: 'row' }]}>
          {/* FAQ theo vai trò */}
          <View style={[{ gap: 14 }, isWide && { flex: 1.35 }]}>
            <View style={s.sectionHead}>
              <View>
                <Text style={s.sectionTitle}>Câu hỏi thường gặp</Text>
                <Text style={s.sectionSub}>Chọn lọc theo vai trò của bạn</Text>
              </View>
            </View>
            <View style={s.searchBox}>
              <Search size={16} color="#94A3B8" />
              <TextInput
                style={s.searchInput}
                placeholder="Tìm câu hỏi, ví dụ: BHYT, OTP, hóa đơn..."
                placeholderTextColor="#94A3B8"
                value={faqSearch}
                onChangeText={setFaqSearch}
              />
            </View>

            {visibleGroups.length === 0 ? (
              <View style={s.card}>
                <EmptyState icon={Search} title="Không tìm thấy câu hỏi phù hợp" text="Hãy thử từ khóa khác hoặc gửi yêu cầu hỗ trợ cho đội kỹ thuật." />
              </View>
            ) : visibleGroups.map((group, gi) => (
              <Reveal key={group.category} delay={gi * 80} style={s.faqGroup}>
                <Text style={s.faqCategory}>{group.category}</Text>
                {group.items.map((faq, i) => {
                  const faqKey = `${group.category}-${i}`;
                  const isOpened = openFaq === faqKey;
                  return (
                    <View key={faqKey} style={[s.faqItem, isOpened && s.faqItemOpen, i === 0 && { borderTopWidth: 0 }]}>
                      <TouchableOpacity style={s.faqQuestionRow} onPress={() => setOpenFaq(isOpened ? null : faqKey)} dataSet={{ hover: 'tint' }}>
                        <View style={[s.faqDot, isOpened && { backgroundColor: '#1A5FD0' }]} />
                        <Text style={[s.faqQuestion, isOpened && { color: '#1A5FD0' }]}>{faq.q}</Text>
                        <View style={{ transform: [{ rotate: isOpened ? '180deg' : '0deg' }] }}>
                          <ChevronDown size={18} color={isOpened ? '#1A5FD0' : '#94A3B8'} />
                        </View>
                      </TouchableOpacity>
                      {isOpened && (
                        <View style={s.faqAnswerBox} dataSet={{ anim: 'page' }}>
                          <Text style={s.faqAnswer}>{faq.a}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </Reveal>
            ))}
          </View>

          {/* Gửi yêu cầu & ticket */}
          <View style={[{ gap: 18 }, isWide && { flex: 1 }]}>
            <Reveal delay={100} style={s.formCard}>
              <View style={s.formHead}>
                <View style={s.formIcon}><Headphones size={22} color="#FFFFFF" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.formTitle}>Gửi yêu cầu hỗ trợ</Text>
                  <Text style={s.formSub}>Phản hồi từ đội kỹ thuật trong vòng 2 giờ</Text>
                </View>
              </View>

              <Text style={s.label}>Chủ đề</Text>
              <View style={s.topicGrid}>
                {topics.map((t) => {
                  const Icon = t.icon;
                  const active = selectedTopic === t.label;
                  return (
                    <TouchableOpacity
                      key={t.label}
                      style={[s.topic, active && { borderColor: t.color, backgroundColor: `${t.color}12` }]}
                      onPress={() => setSelectedTopic(t.label)}
                      dataSet={active ? undefined : { hover: 'lift' }}
                    >
                      <Icon size={18} color={t.color} />
                      <Text style={[s.topicText, active && { color: t.color }]} numberOfLines={2}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.label}>Mô tả chi tiết sự cố</Text>
              <TextInput
                style={s.textarea}
                placeholder="Mô tả lỗi bạn gặp, màn hình nào, thao tác gì trước đó..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                value={message}
                onChangeText={setMessage}
              />

              <TouchableOpacity
                style={[s.sendBtn, sendingTicket && { opacity: 0.6 }]}
                onPress={handleSendTicket}
                disabled={sendingTicket}
                dataSet={{ hover: 'glow' }}
              >
                {sendingTicket ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                  <>
                    <Send size={16} color="#FFFFFF" />
                    <Text style={s.sendBtnText}>Gửi yêu cầu hỗ trợ</Text>
                  </>
                )}
              </TouchableOpacity>
            </Reveal>

            <Reveal delay={160} style={s.card}>
              <View style={s.ticketHead}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <LifeBuoy size={18} color="#1A5FD0" />
                  <Text style={s.cardTitle}>Yêu cầu của tôi</Text>
                </View>
                <TouchableOpacity style={s.refreshBtn} onPress={fetchTickets} dataSet={{ hover: 'tint' }}>
                  <RefreshCw size={14} color="#1A5FD0" />
                  <Text style={s.refreshText}>Làm mới</Text>
                </TouchableOpacity>
              </View>
              {loadingTickets ? (
                <ActivityIndicator size="small" color="#1A5FD0" style={{ marginVertical: 20 }} />
              ) : tickets.length === 0 ? (
                <EmptyState icon={Inbox} title="Bạn chưa gửi yêu cầu nào" text="Các yêu cầu đã gửi sẽ hiển thị tại đây cùng tiến độ xử lý." />
              ) : tickets.map((tk) => {
                const badge = getStatusBadge(tk.status);
                return (
                  <View key={tk._id} style={s.ticket}>
                    <View style={s.ticketTop}>
                      <Text style={s.ticketId}>#{tk._id?.toString().slice(-6).toUpperCase()} · {tk.topic}</Text>
                      <View style={[s.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[s.badgeText, { color: badge.text }]}>{badge.label}</Text>
                      </View>
                    </View>
                    <Text style={s.ticketMsg} numberOfLines={2}>{tk.message}</Text>
                    <View style={s.ticketSteps}>
                      {['Đã gửi', 'Đang xử lý', 'Hoàn tất'].map((label, idx) => (
                        <View key={label} style={s.ticketStep}>
                          <View style={[s.ticketStepBar, idx < badge.step && { backgroundColor: badge.text }]} />
                          <Text style={[s.ticketStepText, idx < badge.step && { color: badge.text }]}>{label}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={s.ticketFoot}>
                      <Clock3 size={12} color="#94A3B8" />
                      <Text style={s.ticketDate}>Gửi ngày {new Date(tk.createdAt).toLocaleDateString('vi-VN')}</Text>
                    </View>
                  </View>
                );
              })}
            </Reveal>
          </View>
        </View>

        {/* Đội ngũ kỹ thuật */}
        <Reveal style={[s.team, isWide && { flexDirection: 'row' }]}>
          <Image source={SUPPORT_IMAGES.team} style={[s.teamImage, isWide && { width: '42%', height: '100%', minHeight: 240 }]} resizeMode="cover" />
          <View style={s.teamBody}>
            <Text style={s.teamEyebrow}>ĐỘI NGŨ KỸ THUẬT</Text>
            <Text style={s.teamTitle}>Kỹ sư hệ thống & chuyên viên hỗ trợ lâm sàng</Text>
            <Text style={s.teamText}>
              Phụ trách vận hành hệ thống bệnh án điện tử, Mini-PACS và AI Engine; hỗ trợ người dùng qua hotline, email và ticket.
            </Text>
            {['Trực hotline 24/7, kể cả ngày lễ', 'Ưu tiên xử lý sự cố ảnh hưởng ca cấp cứu', 'Theo dõi tiến độ từng yêu cầu ngay trên trang này'].map((t) => (
              <View key={t} style={s.teamPoint}>
                <CheckCircle2 size={16} color="#6FDDB2" />
                <Text style={s.teamPointText}>{t}</Text>
              </View>
            ))}
          </View>
        </Reveal>
      </ScrollView>
    </ResponsiveLayout>
  );
};

const isWeb = Platform.OS === 'web';
const shadow = isWeb ? { boxShadow: '0 12px 30px -20px rgba(11,42,91,0.35)' } : { elevation: 2 };

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F8FC' },
  pageContent: { padding: 28, paddingBottom: 56, maxWidth: 1360, width: '100%', alignSelf: 'center', gap: 22 },

  onDuty: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 18, padding: 16, marginTop: 18, alignSelf: 'flex-start', minWidth: 300 },
  onDutyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' },
  onDutyLabel: { color: '#A7F3D0', fontSize: 12, fontWeight: '700' },
  onDutyStats: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  onDutyValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  onDutySub: { color: '#DBEAFE', fontSize: 11 },
  onDutyDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.25)' },

  contactRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', ...shadow },
  contactIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  contactTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  contactDesc: { fontSize: 13, color: '#64748B', marginTop: 2 },
  contactAction: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  contactActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  twoCol: { gap: 22, alignItems: 'flex-start' },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#0B2A5B' },
  sectionSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14 },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 14, color: '#0F172A', ...(isWeb ? { outlineStyle: 'none' } : {}) },

  faqGroup: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', ...shadow },
  faqCategory: { fontSize: 12, fontWeight: '800', color: '#0F9D6B', letterSpacing: 1.2, textTransform: 'uppercase', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6 },
  faqItem: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  faqItemOpen: { backgroundColor: '#F7FAFF' },
  faqQuestionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 18 },
  faqDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBD5E1' },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A', lineHeight: 20 },
  faqAnswerBox: { paddingLeft: 38, paddingRight: 18, paddingBottom: 16 },
  faqAnswer: { fontSize: 13, color: '#475569', lineHeight: 21 },

  formCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#E2E8F0', ...shadow },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  formIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#1A5FD0', alignItems: 'center', justifyContent: 'center' },
  formTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  formSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 8, marginTop: 4 },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 12 },
  topic: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  topicText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#334155' },
  textarea: { minHeight: 110, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC', textAlignVertical: 'top' },
  sendBtn: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0F9D6B', paddingVertical: 14, borderRadius: 14 },
  sendBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', width: '100%', ...shadow },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  ticketHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  refreshText: { color: '#1A5FD0', fontSize: 12, fontWeight: '700' },
  ticket: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, marginBottom: 10, gap: 8 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  ticketId: { fontSize: 11, color: '#64748B', fontWeight: '700', flex: 1 },
  badge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  ticketMsg: { fontSize: 13, color: '#0F172A', lineHeight: 19 },
  ticketSteps: { flexDirection: 'row', gap: 6 },
  ticketStep: { flex: 1, gap: 4 },
  ticketStepBar: { height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' },
  ticketStepText: { fontSize: 10, color: '#94A3B8', fontWeight: '700' },
  ticketFoot: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ticketDate: { fontSize: 11, color: '#94A3B8' },

  team: { backgroundColor: '#0B2A5B', borderRadius: 24, overflow: 'hidden', ...(isWeb ? { boxShadow: '0 24px 50px -28px rgba(11,42,91,0.6)' } : {}) },
  teamImage: { width: '100%', height: 220 },
  teamBody: { flex: 1, padding: 28, justifyContent: 'center' },
  teamEyebrow: { color: '#6FDDB2', fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  teamTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 8 },
  teamText: { color: '#DBEAFE', fontSize: 14, lineHeight: 22, marginTop: 8, marginBottom: 14 },
  teamPoint: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  teamPointText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});

export default SupportScreen;
