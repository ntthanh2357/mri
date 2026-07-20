import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
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
} from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import styles from './SupportScreen.styles';
import { get, post } from '../services/api.service';

const SupportScreen = ({ navigation }) => {
  const [openFaq, setOpenFaq] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState('Chưa chọn chủ đề...');
  const [message, setMessage] = useState('');
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);

  // Ticket state
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [sendingTicket, setSendingTicket] = useState(false);

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const contactOptions = [
    { icon: '💬', title: 'Chat trực tiếp', desc: 'Phản hồi trong 2 phút', action: 'Bắt đầu chat', color: '#166534', url: null },
    { icon: '📞', title: 'Hotline', desc: '1800 1234 — 24/7', action: 'Gọi ngay', color: '#2563EB', url: 'tel:18001234' },
    { icon: '✉️', title: 'Gửi email', desc: 'support@neuroscan.ai', action: 'Soạn email', color: '#7C3AED', url: 'mailto:support@neuroscan.ai?subject=Yêu cầu hỗ trợ kỹ thuật' },
  ];

  const faqs = [
    { q: 'Làm thế nào để thêm bác sĩ mới vào hệ thống?', a: 'Vào Bảng điều khiển phòng khám → nhấn nút "Thêm bác sĩ" góc trên bên phải. Điền đầy đủ thông tin để cấp quyền tài khoản.' },
    { q: 'Dữ liệu hình ảnh được lưu trữ ở đâu và có an toàn không?', a: 'Toàn bộ dữ liệu được mã hóa AES-256 và lưu trên máy chủ đám mây riêng tư đạt tiêu chuẩn bảo mật y tế HIPAA.' },
    { q: 'Làm sao để xuất toàn bộ hồ sơ bệnh nhân?', a: 'Vào Hồ sơ bệnh nhân → chọn bệnh nhân cụ thể → nhấn "Xuất sao kê". Hệ thống hỗ trợ tải file PDF chẩn đoán chi tiết.' },
    { q: 'Tôi có thể tích hợp NeuroScan AI với phần mềm HIS hiện tại không?', a: 'Có, hệ thống hỗ trợ tích hợp API RESTful và chuẩn HL7 FHIR. Vui lòng liên hệ đội ngũ kỹ thuật để nhận tài liệu tích hợp.' },
  ];

  const topics = [
    'Lỗi kỹ thuật phần mềm',
    'Câu hỏi về thuật toán AI',
    'Thanh toán & Nâng cấp Premium',
    'Yêu cầu tính năng mới',
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

  // ── Gửi ticket mới ─────────────────────────────────────────────────────────
  const handleSendTicket = async () => {
    if (!message || selectedTopic === 'Chưa chọn chủ đề...') {
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
        Alert.alert('Thành công ✅', res.message || 'Yêu cầu hỗ trợ đã được ghi nhận!');
        setMessage('');
        setSelectedTopic('Chưa chọn chủ đề...');
        // Refresh danh sách ticket
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

  // ── Chuyển màu badge theo trạng thái ticket ─────────────────────────────────
  const getStatusBadge = (status) => {
    switch (status) {
      case 'open': return { bg: '#DCFCE7', text: '#166534', label: 'Đang mở' };
      case 'in_progress': return { bg: '#DBEAFE', text: '#1D4ED8', label: 'Đang xử lý' };
      case 'resolved': return { bg: '#F1F5F9', text: '#475569', label: 'Đã giải quyết' };
      case 'closed': return { bg: '#FEE2E2', text: '#991B1B', label: 'Đã đóng' };
      default: return { bg: '#F1F5F9', text: '#475569', label: status };
    }
  };

  return (
    <ResponsiveLayout
      navigation={navigation}
      activeRoute="Support"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        {!isDesktop && (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Quay lại</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Hỗ trợ Kỹ thuật</Text>
          </View>
        )}

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Trung tâm Hỗ trợ & Vận hành</Text>
        </View>

        {/* Contact Grid */}
        <View style={styles.contactRow}>
          {contactOptions.map((opt, i) => {
            return (
              <TouchableOpacity key={i} style={styles.contactCard} onPress={() => handleContactAction(opt)}>
                <View style={[styles.contactIconBg, { backgroundColor: opt.color, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 20 }}>{opt.icon}</Text>
                </View>
                <Text style={styles.contactTitle}>{opt.title}</Text>
                <Text style={styles.contactDesc}>{opt.desc}</Text>
                <Text style={[styles.contactLink, { color: opt.color }]}>{opt.action} →</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Support Tickets */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 16 }}>🛟</Text>
            <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Yêu cầu hỗ trợ của tôi (Ticket)</Text>
          </View>
          <TouchableOpacity onPress={fetchTickets} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}>
            <Text style={{ fontSize: 12 }}>🔄</Text>
            <Text style={{ fontSize: 12, color: '#15803D', fontWeight: '600' }}>Làm mới</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.ticketsCard}>
          {loadingTickets ? (
            <ActivityIndicator size="small" color="#15803D" style={{ marginVertical: 20 }} />
          ) : tickets.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>Hiện tại bạn chưa gửi yêu cầu hỗ trợ nào.</Text>
            </View>
          ) : (
            tickets.map((tk, idx) => {
              const badge = getStatusBadge(tk.status);
              const createdDate = new Date(tk.createdAt).toLocaleDateString('vi-VN');
              return (
                <View key={tk._id} style={[styles.ticketRow, idx === tickets.length - 1 && styles.lastTicketRow]}>
                  <View style={styles.ticketLeft}>
                    <Text style={styles.ticketId}>#{tk._id?.toString().slice(-6).toUpperCase()} — {tk.topic}</Text>
                    <Text style={styles.ticketSubject} numberOfLines={1}>{tk.message}</Text>
                    <Text style={styles.ticketPriority}>Ngày gửi: {createdDate}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* FAQs */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24, marginBottom: 12 }}>
          <Text style={{ fontSize: 16 }}>❓</Text>
          <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Câu hỏi thường gặp</Text>
        </View>
        <View style={styles.faqList}>
          {faqs.map((faq, i) => {
            const isOpened = openFaq === i;
            return (
              <View key={i} style={styles.faqCard}>
                <TouchableOpacity style={styles.faqQuestionRow} onPress={() => setOpenFaq(isOpened ? null : i)}>
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <Text style={{ fontSize: 14, color: '#64748B' }}>{isOpened ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {isOpened && (
                  <View style={styles.faqAnswerContainer}>
                    <Text style={styles.faqAnswer}>{faq.a}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Quick Message Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Gửi tin nhắn hỗ trợ nhanh</Text>
          <Text style={styles.formDesc}>Nhận phản hồi từ đội kỹ thuật trong vòng 2 giờ</Text>

          {/* Custom Dropdown Selector */}
          <Text style={styles.label}>Chủ đề hỗ trợ</Text>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            onPress={() => setShowTopicDropdown(!showTopicDropdown)}
          >
            <Text style={styles.dropdownTriggerText}>{selectedTopic}</Text>
            <Text style={{ fontSize: 14, color: '#64748B' }}>{showTopicDropdown ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showTopicDropdown && (
            <View style={styles.dropdownMenu}>
              {topics.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={styles.dropdownOption}
                  onPress={() => {
                    setSelectedTopic(t);
                    setShowTopicDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownOptionText}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Description Message area */}
          <Text style={styles.label}>Mô tả chi tiết sự cố</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Nhập mô tả lỗi hiển thị, lỗi thanh toán hoặc góp ý tính năng..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            value={message}
            onChangeText={setMessage}
          />

          <TouchableOpacity
            style={[styles.sendBtn, sendingTicket && { opacity: 0.6 }]}
            onPress={handleSendTicket}
            disabled={sendingTicket}
          >
            {sendingTicket ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendBtnText}>Gửi yêu cầu hỗ trợ</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
    </ResponsiveLayout>
  );
};

;

export default SupportScreen;
