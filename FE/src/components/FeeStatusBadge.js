import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle, ShieldCheck, CreditCard, AlertCircle } from 'lucide-react';

/**
 * Component: Huy hiệu trạng thái Viện phí y tế đa năng
 * Phân loại tự động: Cấp cứu vs BHYT bảo lãnh vs Đã thanh toán vs Chưa đóng phí
 */
const FeeStatusBadge = ({ visit, invoice }) => {
  const isEmergency = visit?.priority === 'khẩn cấp' || visit?.priority === 'cấp cứu';
  const hasBHYT = Boolean(visit?.patientId?.insuranceNumber || visit?.patientId?.profile?.insuranceNumber);
  const isPaid = invoice?.status === 'paid' || invoice?.status === 'đã thanh toán';

  if (isEmergency) {
    return (
      <View style={[styles.badge, styles.emergencyBadge]}>
        <AlertCircle size={12} color="#B91C1C" style={{ marginRight: 4 }} />
        <Text style={[styles.badgeText, styles.emergencyText]}>CẤP CỨU: Chụp trước, thu sau</Text>
      </View>
    );
  }

  if (hasBHYT) {
    return (
      <View style={[styles.badge, styles.bhytBadge]}>
        <ShieldCheck size={12} color="#15803D" style={{ marginRight: 4 }} />
        <Text style={[styles.badgeText, styles.bhytText]}>BHYT: Đã bảo lãnh</Text>
      </View>
    );
  }

  if (isPaid) {
    return (
      <View style={[styles.badge, styles.paidBadge]}>
        <CreditCard size={12} color="#166534" style={{ marginRight: 4 }} />
        <Text style={[styles.badgeText, styles.paidText]}>Đã đóng viện phí</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, styles.unpaidBadge]}>
      <AlertTriangle size={12} color="#B45309" style={{ marginRight: 4 }} />
      <Text style={[styles.badgeText, styles.unpaidText]}>CHƯA ĐÓNG PHÍ MRI</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emergencyBadge: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  emergencyText: {
    color: '#B91C1C',
  },
  bhytBadge: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  bhytText: {
    color: '#15803D',
  },
  paidBadge: {
    backgroundColor: '#F0FDF4',
    borderColor: '#22C55E',
  },
  paidText: {
    color: '#166534',
  },
  unpaidBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  unpaidText: {
    color: '#B45309',
  },
});

export default FeeStatusBadge;
