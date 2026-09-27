import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

/**
 * Component: ClinicalDisclaimerBanner
 * Mục đích: Tuyên bố miễn trừ trách nhiệm pháp lý lâm sàng và định vị CDSS / Research Use Only (RUO)
 * Căn cứ: Luật Khám bệnh, chữa bệnh 15/2023/QH15 & Nghị định 98/2021/NĐ-CP (Quản lý Trang thiết bị y tế SaMD)
 */
export const ClinicalDisclaimerBanner = ({ isDoctor = true, compact = false }) => {
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <AlertTriangle size={13} color="#B45309" style={{ marginRight: 6, marginTop: 1, flexShrink: 0 }} />
        <Text style={styles.compactText}>
          <Text style={{ fontWeight: '700' }}>CDSS Khuyến cáo:</Text> Kết quả phân tích AI chỉ mang tính chất hỗ trợ gợi ý (Research Use Only). Quyết định chẩn đoán và điều trị cuối cùng bắt buộc do Bác sĩ chuyên khoa phê duyệt và ký số.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.iconBox}>
        <AlertTriangle size={20} color="#D97706" />
      </View>
      <View style={styles.textBox}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            THÔNG BÁO AN TOÀN LÂM SÀNG & MIỄN TRỪ TRÁCH NHIỆM (CDSS / RUO)
          </Text>
          <View style={styles.badge}>
            <ShieldCheck size={11} color="#047857" style={{ marginRight: 3 }} />
            <Text style={styles.badgeText}>Tuân thủ Luật KBCB 2023</Text>
          </View>
        </View>
        <Text style={styles.description}>
          Hệ thống NeuroScan AI hoạt động dưới vai trò <Text style={styles.bold}>Hệ thống Hỗ trợ Ra Quyết định Lâm sàng (CDSS)</Text> và trong phạm vi nghiên cứu nội bộ (Research Use Only). Bản đồ nhiệt Grad-CAM và Bounding Box khoanh vùng u não là kết quả phân tích tự động từ mô hình Deep Learning.
        </Text>
        <Text style={[styles.description, { marginTop: 4 }]}>
          {isDoctor
            ? "⚠️ Kết quả AI KHÔNG THAY THẾ kết luận chuyên môn độc lập của Bác sĩ Chẩn đoán Hình ảnh. Bác sĩ vui lòng đối chiếu lâm sàng và thực hiện ký số xác nhận."
            : "ℹ️ Kết quả này chưa phải là kết luận y khoa cuối cùng cho đến khi được Bác sĩ Chẩn đoán Hình ảnh thẩm định và đóng dấu ký số điện tử."}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    borderWidth: 1.2,
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
    alignItems: 'flex-start',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 6,
  },
  compactText: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
    flex: 1,
  },
  iconBox: {
    marginRight: 10,
    marginTop: 2,
  },
  textBox: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#10B981',
  },
  badgeText: {
    fontSize: 10,
    color: '#065F46',
    fontWeight: '700',
  },
  description: {
    fontSize: 11.5,
    color: '#78350F',
    lineHeight: 17,
  },
  bold: {
    fontWeight: '700',
    color: '#451A03',
  },
});

export default ClinicalDisclaimerBanner;
