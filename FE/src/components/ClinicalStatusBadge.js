import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Clock,
  Stethoscope,
  Activity,
  Scan,
  RotateCcw,
  Cpu,
  FileText,
  CheckCircle2,
  XCircle,
  Lock,
  AlertTriangle,
  Flame,
  ShieldCheck,
} from 'lucide-react';

const STATUS_MAP = {
  'đang chờ': {
    label: 'Đang chờ',
    icon: Clock,
    bg: '#FEF3C7',
    border: '#FDE68A',
    text: '#B45309',
  },
  'chờ khám bệnh': {
    label: 'Chờ khám bệnh',
    icon: Stethoscope,
    bg: '#E0F2FE',
    border: '#BAE6FD',
    text: '#0369A1',
  },
  'đang khám': {
    label: 'Đang khám',
    icon: Activity,
    bg: '#DBEAFE',
    border: '#BFDBFE',
    text: '#1D4ED8',
  },
  'chờ chụp': {
    label: 'Chờ chụp MRI',
    icon: Scan,
    bg: '#F3E8FF',
    border: '#E9D5FF',
    text: '#7E22CE',
  },
  'chờ chụp lại': {
    label: 'Chờ chụp lại',
    icon: RotateCcw,
    bg: '#FFEDD5',
    border: '#FED7AA',
    text: '#C2410C',
  },
  'đang chụp': {
    label: 'Đang chụp MRI',
    icon: Activity,
    bg: '#CFFAFE',
    border: '#A5F3FC',
    text: '#0E7490',
  },
  'chờ kết quả AI': {
    label: 'Chờ AI phân tích',
    icon: Cpu,
    bg: '#FEF9C3',
    border: '#FEF08A',
    text: '#A16207',
  },
  'chờ bác sĩ đọc': {
    label: 'Chờ bác sĩ đọc',
    icon: FileText,
    bg: '#ECFDF5',
    border: '#A7F3D0',
    text: '#047857',
  },
  'hoàn tất': {
    label: 'Hoàn tất',
    icon: CheckCircle2,
    bg: '#F0FDF4',
    border: '#BBF7D0',
    text: '#15803D',
  },
  'đã hủy': {
    label: 'Đã hủy',
    icon: XCircle,
    bg: '#FEF2F2',
    border: '#FECACA',
    text: '#B91C1C',
  },
  'đã đóng': {
    label: 'Đã đóng',
    icon: Lock,
    bg: '#F1F5F9',
    border: '#E2E8F0',
    text: '#475569',
  },
  'cấp cứu': {
    label: 'Cấp cứu',
    icon: Flame,
    bg: '#FEF2F2',
    border: '#F87171',
    text: '#DC2626',
    bold: true,
  },
  'khẩn': {
    label: 'Khẩn cấp',
    icon: AlertTriangle,
    bg: '#FFF7ED',
    border: '#FDBA74',
    text: '#C2410C',
    bold: true,
  },
};

const ClinicalStatusBadge = ({ status = '', size = 'md', style }) => {
  const normStatus = (status || '').toString().toLowerCase().trim();
  const config = STATUS_MAP[normStatus] || {
    label: status || 'Không rõ',
    icon: Activity,
    bg: '#F1F5F9',
    border: '#E2E8F0',
    text: '#475569',
  };

  const IconComponent = config.icon;
  const isSmall = size === 'sm';
  const iconSize = isSmall ? 12 : 14;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingVertical: isSmall ? 3 : 5,
          paddingHorizontal: isSmall ? 8 : 10,
        },
        style,
      ]}
    >
      <IconComponent size={iconSize} color={config.text} strokeWidth={2.2} />
      <Text
        style={[
          styles.badgeText,
          {
            color: config.text,
            fontSize: isSmall ? 11 : 12,
            fontWeight: config.bold ? '700' : '600',
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    letterSpacing: 0.2,
  },
});

export default ClinicalStatusBadge;
