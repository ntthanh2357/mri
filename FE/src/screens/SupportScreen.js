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
import styles from './SupportScreen.styles';

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

;

export default SupportScreen;
