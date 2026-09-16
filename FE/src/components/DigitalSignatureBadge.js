import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, Clock } from 'lucide-react';

/**
 * Component: Con dấu Chữ ký số Điện tử Bác sĩ Chẩn đoán Hình ảnh
 * Tuân thủ Thông tư 46/2018/TT-BYT về EMR và bệnh án điện tử không in phim
 */
const DigitalSignatureBadge = ({ isSigned, radiologist, signedAt, doctorCchn }) => {
  if (isSigned) {
    const formattedDate = signedAt 
      ? new Date(signedAt).toLocaleString('vi-VN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        })
      : 'Vừa ký';

    return (
      <View style={styles.signedContainer}>
        <View style={styles.stampHeader}>
          <CheckCircle2 size={16} color="#059669" />
          <Text style={styles.stampTitle}>ĐÃ KÝ SỐ ĐIỆN TỬ BỞI BÁC SĨ CĐHA</Text>
        </View>
        <Text style={styles.stampText}>
          Bác sĩ ký duyệt: <Text style={styles.stampBold}>{radiologist || 'Bác sĩ CĐHA'}</Text>
        </Text>
        {Boolean(doctorCchn) && (
          <Text style={styles.stampText}>
            Chứng chỉ hành nghề: <Text style={styles.stampBold}>{doctorCchn}</Text>
          </Text>
        )}
        <Text style={styles.stampTimestamp}>Thời điểm ký số: {formattedDate}</Text>
      </View>
    );
  }

  return (
    <View style={styles.pendingContainer}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Clock size={14} color="#D97706" />
        <Text style={styles.pendingText}>
          Đang chờ Bác sĩ Chẩn đoán hình ảnh thẩm định và ký số điện tử
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  signedContainer: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#059669',
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
  },
  stampHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  stampTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#059669',
    letterSpacing: 0.5,
  },
  stampText: {
    fontSize: 12,
    color: '#1E293B',
    marginTop: 2,
  },
  stampBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  stampTimestamp: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 4,
  },
  pendingContainer: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
  },
  pendingText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default DigitalSignatureBadge;
