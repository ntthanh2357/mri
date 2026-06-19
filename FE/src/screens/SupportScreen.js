import React, { useState } from 'react';
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
} from 'react-native';
import ResponsiveLayout from '../components/ResponsiveLayout';

const SupportScreen = ({ navigation }) => {
  const [openFaq, setOpenFaq] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState('Chưa chọn chủ đề...');
  const [message, setMessage] = useState('');
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);

  const contactOptions = [
    { icon: '💬', title: 'Chat trực tiếp', desc: 'Phản hồi trong 2 phút', action: 'Bắt đầu chat', color: '#166534' },
    { icon: '📞', title: 'Hotline', desc: '1800 1234 — 24/7', action: 'Gọi ngay', color: '#2563EB' },
    { icon: '✉️', title: 'Gửi email', desc: 'support@neuroscan.ai', action: 'Soạn email', color: '#7C3AED' },
  ];

  const tickets = [];

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

  const handleSendTicket = () => {
    if (!message || selectedTopic === 'Chưa chọn chủ đề...') {
      Alert.alert('Lỗi', 'Vui lòng chọn chủ đề và nhập nội dung mô tả vấn đề.');
      return;
    }
    Alert.alert('Thành công', 'Yêu cầu hỗ trợ của bạn đã được gửi đi! Đội kỹ thuật sẽ liên hệ lại trong tối đa 2 giờ.');
    setMessage('');
    setSelectedTopic('Chưa chọn chủ đề...');
  };

  const handleContactAction = (option) => {
    Alert.alert('Liên kết liên lạc', `Bắt đầu kết nối qua kênh: ${option.title} (${option.desc})`);
  };

  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

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
          {contactOptions.map((opt, i) => (
            <TouchableOpacity key={i} style={styles.contactCard} onPress={() => handleContactAction(opt)}>
              <View style={[styles.contactIconBg, { backgroundColor: opt.color }]}>
                <Text style={styles.contactIconText}>{opt.icon}</Text>
              </View>
              <Text style={styles.contactTitle}>{opt.title}</Text>
              <Text style={styles.contactDesc}>{opt.desc}</Text>
              <Text style={[styles.contactLink, { color: opt.color }]}>{opt.action} →</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Support Tickets */}
        <Text style={styles.sectionTitle}>Yêu cầu hỗ trợ của tôi (Ticket)</Text>
        <View style={styles.ticketsCard}>
          {tickets.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>Hiện tại bạn chưa gửi yêu cầu hỗ trợ nào.</Text>
            </View>
          ) : (
            tickets.map((tk, idx) => (
              <View key={tk.id} style={[styles.ticketRow, idx === tickets.length - 1 && styles.lastTicketRow]}>
                <View style={styles.ticketLeft}>
                  <Text style={styles.ticketId}>{tk.id}</Text>
                  <Text style={styles.ticketSubject} numberOfLines={1}>{tk.subject}</Text>
                  <Text style={styles.ticketPriority}>Độ ưu tiên: {tk.priority}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: tk.color }]}>
                  <Text style={[styles.statusText, { color: tk.textColor }]}>{tk.status}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* FAQs */}
        <Text style={styles.sectionTitle}>Câu hỏi thường gặp</Text>
        <View style={styles.faqList}>
          {faqs.map((faq, i) => {
            const isOpened = openFaq === i;
            return (
              <View key={i} style={styles.faqCard}>
                <TouchableOpacity style={styles.faqQuestionRow} onPress={() => setOpenFaq(isOpened ? null : i)}>
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <Text style={styles.faqArrow}>{isOpened ? '▲' : '▼'}</Text>
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
            <Text style={styles.dropdownArrow}>{showTopicDropdown ? '▲' : '▼'}</Text>
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

          <TouchableOpacity style={styles.sendBtn} onPress={handleSendTicket}>
            <Text style={styles.sendBtnText}>Gửi yêu cầu hỗ trợ</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingVertical: 4,
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  titleContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  contactCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
  },
  contactIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactIconText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  contactTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 2,
    textAlign: 'center',
  },
  contactDesc: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 12,
  },
  contactLink: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 'auto',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  ticketsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastTicketRow: {
    borderBottomWidth: 0,
  },
  ticketLeft: {
    flex: 1,
    paddingRight: 10,
  },
  ticketId: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  ticketSubject: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  ticketPriority: {
    fontSize: 10,
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  faqList: {
    gap: 10,
    marginBottom: 24,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    paddingRight: 10,
  },
  faqArrow: {
    fontSize: 10,
    color: '#94A3B8',
  },
  faqAnswerContainer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 8,
  },
  faqAnswer: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  formDesc: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '550',
    color: '#334155',
    marginBottom: 6,
  },
  dropdownTrigger: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  dropdownTriggerText: {
    fontSize: 13,
    color: '#334155',
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#94A3B8',
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    marginTop: -10,
    marginBottom: 14,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownOptionText: {
    fontSize: 13,
    color: '#475569',
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  sendBtn: {
    height: 48,
    backgroundColor: '#15803D',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default SupportScreen;
