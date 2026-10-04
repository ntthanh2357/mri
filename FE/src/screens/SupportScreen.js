import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PressableScale from '../components/PressableScale';
import FadeIn from '../components/FadeIn';
import PageHeroBanner from '../components/PageHeroBanner';
import Colors from '../constants/colors';
import { useSupport } from '../controllers/useSupport';
import styles from './SupportScreen.styles';

// Liên hệ thống nhất với trang Welcome/Login.
const HOTLINE = { label: '0236 3650 676', url: 'tel:02363650676' };
const EMAIL = { label: 'support@neuroscan.com', url: 'mailto:support@neuroscan.com?subject=Yêu cầu hỗ trợ' };

// Câu trả lời về bảo mật giữ nguyên văn bản gốc — là cam kết thực tế, chỉ đổi khi chủ dự án xác nhận.
const SECURITY_FAQ = {
  q: 'Dữ liệu hình ảnh được lưu trữ ở đâu và có an toàn không?',
  a: 'Toàn bộ dữ liệu được mã hóa AES-256 và lưu trên máy chủ đám mây riêng tư đạt tiêu chuẩn bảo mật y tế HIPAA.',
};

const PATIENT_FAQS = [
  { q: 'Làm sao để xem kết quả phim MRI/CT của tôi?', a: 'Vào mục “Phim MRI & CT”, chọn phim cần xem. Trong trang kết quả, bấm “Giải thích kết quả” để đọc bản giải thích dễ hiểu do AI tạo.' },
  { q: 'Kết quả AI có thay thế chẩn đoán của bác sĩ không?', a: 'Không. AI chỉ hỗ trợ tham khảo. Kết luận cuối cùng là của bác sĩ chuyên khoa đã đọc và ký kết quả — hãy trao đổi với bác sĩ điều trị trước khi quyết định.' },
  { q: 'Thanh toán gói Premium như thế nào?', a: 'Vào “Mua Premium”, bấm “Nâng cấp ngay” rồi quét mã VietQR bằng ứng dụng ngân hàng. Nếu đã trừ tiền mà gói chưa kích hoạt sau vài phút, hãy gửi yêu cầu hỗ trợ kèm thời gian thanh toán.' },
  SECURITY_FAQ,
];

const STAFF_FAQS = [
  { q: 'Làm thế nào để thêm bác sĩ mới vào hệ thống?', a: 'Vào Bảng điều khiển phòng khám → nhấn nút "Thêm bác sĩ" góc trên bên phải. Điền đầy đủ thông tin để cấp quyền tài khoản.' },
  SECURITY_FAQ,
  { q: 'Làm sao để xuất toàn bộ hồ sơ bệnh nhân?', a: 'Vào Hồ sơ bệnh nhân → chọn bệnh nhân cụ thể → nhấn "Xuất sao kê". Hệ thống hỗ trợ tải file PDF chẩn đoán chi tiết.' },
  { q: 'Tôi có thể tích hợp NeuroScan AI với phần mềm HIS hiện tại không?', a: 'Có, hệ thống hỗ trợ tích hợp API RESTful và chuẩn HL7 FHIR. Vui lòng liên hệ đội ngũ kỹ thuật để nhận tài liệu tích hợp.' },
];

const TOPICS = ['Lỗi kỹ thuật phần mềm', 'Câu hỏi về thuật toán AI', 'Thanh toán & Nâng cấp Premium', 'Yêu cầu tính năng mới'];

const STATUS = {
  open: { bg: Colors.brandGreenSoft, text: Colors.brandGreen, label: 'Đang mở', icon: 'circle' },
  in_progress: { bg: Colors.infoBg, text: '#0369A1', label: 'Đang xử lý', icon: 'loader' },
  resolved: { bg: '#F1F5F9', text: Colors.slateMuted, label: 'Đã giải quyết', icon: 'check' },
  closed: { bg: '#F1F5F9', text: Colors.slateMuted, label: 'Đã đóng', icon: 'x' },
};

const SupportScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const { role, tickets, loadingTickets, sending, fetchTickets, sendTicket } = useSupport();
  const isPatient = role === 'patient';
  const faqs = isPatient ? PATIENT_FAQS : STAFF_FAQS;

  const [openFaq, setOpenFaq] = useState(null);
  const [topic, setTopic] = useState(null);
  const [message, setMessage] = useState('');
  const [showTopics, setShowTopics] = useState(false);
  const [formError, setFormError] = useState('');
  const scrollRef = useRef(null);
  const formY = useRef(0);

  const openLink = async (url) => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error('Linking error:', err);
      Alert.alert('Không mở được liên kết', 'Hãy gọi hoặc gửi email thủ công theo thông tin trên màn hình.');
    }
  };

  const contacts = [
    { icon: 'phone', title: 'Gọi hotline', desc: HOTLINE.label, onPress: () => openLink(HOTLINE.url) },
    { icon: 'mail', title: 'Gửi email', desc: EMAIL.label, onPress: () => openLink(EMAIL.url) },
    { icon: 'edit-3', title: 'Gửi yêu cầu', desc: 'Phản hồi trong 2 giờ', onPress: () => scrollRef.current?.scrollTo({ y: formY.current - 16, animated: true }) },
  ];

  const handleSend = async () => {
    if (!topic) return setFormError('Chọn chủ đề cho yêu cầu.');
    if (!message.trim()) return setFormError('Nhập nội dung mô tả vấn đề.');
    setFormError('');
    const res = await sendTicket(topic, message);
    if (res.ok) {
      setMessage('');
      setTopic(null);
    }
    Alert.alert(res.ok ? 'Đã gửi yêu cầu' : 'Chưa gửi được', res.message);
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="Support">
      <SafeAreaView style={styles.container}>
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backButton} accessibilityRole="button">
              <Feather name="arrow-left" size={16} color={Colors.slateMuted} />
              <Text style={styles.backButtonText}>Quay lại</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Hỗ trợ</Text>
          </View>
        )}

        <ScrollView ref={scrollRef} contentContainerStyle={[styles.scrollContainer, isDesktop && styles.scrollContainerDesktop]} keyboardShouldPersistTaps="handled">
          <PageHeroBanner
            source={require('../../assets/images/support-hero.jpg')}
            tone="light"
            title={isPatient ? 'Chúng tôi có thể giúp gì cho bạn?' : 'Trung tâm hỗ trợ & vận hành'}
            subtitle="Gọi hotline, gửi email hoặc gửi yêu cầu. Đội ngũ hỗ trợ sẽ phản hồi sớm nhất."
            wide={width > 980}
            style={styles.titleContainer}
          />

          <View style={[styles.contactRow, !isDesktop && styles.contactColumn]}>
            {contacts.map((c, i) => (
              <FadeIn key={c.title} delay={80 + i * 80} style={styles.contactCell}>
                <PressableScale containerStyle={styles.contactCellInner} style={styles.contactCard} hoverStyle={styles.contactCardHover} onPress={c.onPress} accessibilityLabel={`${c.title}: ${c.desc}`}>
                  <View style={styles.contactIconBg}>
                    <Feather name={c.icon} size={18} color={Colors.brandGreen} />
                  </View>
                  <View style={styles.contactText}>
                    <Text style={styles.contactTitle}>{c.title}</Text>
                    <Text style={styles.contactDesc}>{c.desc}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={Colors.secondary} />
                </PressableScale>
              </FadeIn>
            ))}
          </View>

          {/* Ticket */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Yêu cầu hỗ trợ của tôi</Text>
            <PressableScale style={styles.linkBtn} hoverStyle={styles.linkBtnHover} onPress={fetchTickets} accessibilityLabel="Tải lại danh sách yêu cầu">
              <Feather name="rotate-cw" size={13} color={Colors.brandGreen} />
              <Text style={styles.linkBtnText}>Tải lại</Text>
            </PressableScale>
          </View>
          <View style={styles.ticketsCard}>
            {loadingTickets ? (
              <ActivityIndicator size="small" color={Colors.brandGreen} style={{ marginVertical: 20 }} />
            ) : tickets.length === 0 ? (
              <View style={styles.emptyBox}>
                <Image source={require('../../assets/images/illus-support.png')} style={styles.emptyIllus} resizeMode="contain" accessible={false} />
                <Text style={styles.emptyText}>Bạn chưa gửi yêu cầu hỗ trợ nào.</Text>
              </View>
            ) : (
              tickets.map((tk, idx) => {
                const st = STATUS[tk.status] || { bg: '#F1F5F9', text: Colors.slateMuted, label: tk.status, icon: 'circle' };
                return (
                  <FadeIn key={tk._id} delay={idx * 60} style={[styles.ticketRow, idx === tickets.length - 1 && styles.lastTicketRow]}>
                    <View style={styles.ticketLeft}>
                      <Text style={styles.ticketTopic}>{tk.topic}</Text>
                      <Text style={styles.ticketSubject}>{tk.message}</Text>
                      <Text style={styles.ticketMeta}>
                        #{tk._id?.toString().slice(-6).toUpperCase()} · gửi ngày {new Date(tk.createdAt).toLocaleDateString('vi-VN')}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <Feather name={st.icon} size={11} color={st.text} />
                      <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
                    </View>
                  </FadeIn>
                );
              })
            )}
          </View>

          {/* FAQ */}
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Câu hỏi thường gặp</Text>
          <View style={styles.faqList}>
            {faqs.map((faq, i) => {
              const opened = openFaq === i;
              return (
                <View key={faq.q} style={[styles.faqCard, opened && styles.faqCardOpen]}>
                  <PressableScale
                    style={styles.faqQuestionRow}
                    hoverStyle={styles.faqQuestionRowHover}
                    onPress={() => setOpenFaq(opened ? null : i)}
                    accessibilityState={{ expanded: opened }}
                  >
                    <Text style={styles.faqQuestion}>{faq.q}</Text>
                    <Feather name={opened ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.secondary} />
                  </PressableScale>
                  {opened && (
                    <FadeIn distance={6} style={styles.faqAnswerContainer}>
                      <Text style={styles.faqAnswer}>{faq.a}</Text>
                    </FadeIn>
                  )}
                </View>
              );
            })}
          </View>

          {/* Form */}
          <View style={styles.formCard} onLayout={(e) => { formY.current = e.nativeEvent.layout.y; }}>
            <Text style={styles.formTitle}>Gửi yêu cầu hỗ trợ</Text>
            <Text style={styles.formDesc}>Đội ngũ hỗ trợ phản hồi trong vòng 2 giờ làm việc.</Text>

            <Text style={styles.label}>Chủ đề</Text>
            <PressableScale
              style={[styles.dropdownTrigger, showTopics && styles.dropdownTriggerOpen]}
              hoverStyle={styles.dropdownTriggerHover}
              onPress={() => setShowTopics(!showTopics)}
              accessibilityLabel={`Chủ đề: ${topic || 'chưa chọn'}`}
              accessibilityState={{ expanded: showTopics }}
            >
              <Text style={[styles.dropdownTriggerText, !topic && styles.dropdownPlaceholder]}>{topic || 'Chọn chủ đề…'}</Text>
              <Feather name={showTopics ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.secondary} />
            </PressableScale>
            {showTopics && (
              <FadeIn distance={6} style={styles.dropdownMenu}>
                {TOPICS.map((t) => (
                  <PressableScale
                    key={t}
                    style={[styles.dropdownOption, t === topic && styles.dropdownOptionActive]}
                    hoverStyle={styles.dropdownOptionHover}
                    onPress={() => { setTopic(t); setShowTopics(false); setFormError(''); }}
                    accessibilityState={{ selected: t === topic }}
                  >
                    <Text style={[styles.dropdownOptionText, t === topic && styles.dropdownOptionTextActive]}>{t}</Text>
                    {t === topic && <Feather name="check" size={16} color={Colors.brandGreen} />}
                  </PressableScale>
                ))}
              </FadeIn>
            )}

            <Text style={styles.label}>Mô tả vấn đề</Text>
            <TextInput
              style={styles.textarea}
              placeholder="Ví dụ: Đã thanh toán Premium lúc 9:30 nhưng tài khoản chưa nâng cấp…"
              placeholderTextColor={Colors.secondary}
              accessibilityLabel="Mô tả vấn đề"
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={(t) => { setMessage(t); if (formError) setFormError(''); }}
            />
            {formError ? (
              <Text style={styles.formError} accessibilityLiveRegion="polite">
                <Feather name="alert-circle" size={13} color={Colors.error} /> {formError}
              </Text>
            ) : null}

            <PressableScale style={styles.sendBtn} hoverStyle={styles.sendBtnHover} onPress={handleSend} disabled={sending}>
              {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.sendBtnText}>Gửi yêu cầu</Text>}
            </PressableScale>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

export default SupportScreen;
