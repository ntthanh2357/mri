import React from 'react';
import {
  Building2,
  CreditCard,
  FileText,
  ClipboardList,
  Pill,
  LogOut,
  Share2,
  Droplets,
  FlaskConical,
  Scan,
  Brain,
  PenTool,
} from 'lucide-react';

const ICON_MAP = {
  kham_benh: Building2,
  vien_phi: CreditCard,
  tom_tat_hsba: FileText,
  chi_dinh_dv: ClipboardList,
  toa_thuoc: Pill,
  giay_ra_vien: LogOut,
  chuyen_tuyen: Share2,
  huyet_hoc: Droplets,
  hoa_sinh: FlaskConical,
  ct_scan: Scan,
  mri: Brain,
  cam_ket_pt: PenTool,
};

export default function DocTypeIcon({ type, size = 20, color = '#0891B2', style }) {
  const IconComponent = ICON_MAP[type] || FileText;
  return <IconComponent size={size} color={color} style={style} />;
}
