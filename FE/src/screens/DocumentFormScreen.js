import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  SafeAreaView, TextInput, Alert, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ResponsiveLayout from '../components/ResponsiveLayout';
import { useDocumentVault } from '../controllers/useDocumentVault';
import { DOC_TYPE_INFO, VAULT_KEY, createEmptyFormData } from '../models/documentVault.model';

/* ─── Shared UI components ─── */

const F = ({ label, value, onChange, placeholder, multi, keyboard, half, noMargin }) => (
  <View style={[s.field, half && s.fieldHalf, noMargin && s.noMargin]}>
    {label ? <Text style={s.label}>{label}</Text> : null}
    <TextInput
      style={[s.input, multi && s.textArea]}
      value={value || ''}
      onChangeText={onChange}
      placeholder={placeholder || ''}
      placeholderTextColor="#94A3B8"
      multiline={multi}
      textAlignVertical={multi ? 'top' : 'center'}
      keyboardType={keyboard || 'default'}
    />
  </View>
);

const Row = ({ children }) => <View style={s.row}>{children}</View>;

const SectionTitle = ({ children }) => <Text style={s.sectionTitle}>{children}</Text>;

const Checkbox = ({ label, checked, onToggle, indent }) => (
  <TouchableOpacity style={[s.cbRow, indent && s.cbIndent]} onPress={onToggle} activeOpacity={0.7}>
    <View style={[s.cb, checked && s.cbChecked]}>
      {checked && <Text style={s.cbTick}>✓</Text>}
    </View>
    <Text style={[s.cbLabel, checked && s.cbLabelActive]}>{label}</Text>
  </TouchableOpacity>
);

const RadioGroup = ({ label, options, value, onChange }) => (
  <View style={s.field}>
    {label ? <Text style={s.label}>{label}</Text> : null}
    <View style={s.radioRow}>
      {options.map((opt) => (
        <TouchableOpacity key={opt.value} style={[s.radioBtn, value === opt.value && s.radioBtnActive]} onPress={() => onChange(opt.value)}>
          <Text style={[s.radioBtnText, value === opt.value && s.radioBtnTextActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const DynamicRows = ({ rows, onChange, columns, addLabel }) => {
  const addRow = () => {
    const empty = {};
    columns.forEach((c) => { empty[c.key] = ''; });
    onChange([...rows, empty]);
  };
  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx));
  const updateCell = (idx, key, val) => {
    const next = rows.map((r, i) => i === idx ? { ...r, [key]: val } : r);
    onChange(next);
  };
  return (
    <View>
      {rows.map((row, idx) => (
        <View key={idx} style={s.dynRow}>
          {columns.map((col) => (
            <View key={col.key} style={[s.dynCell, col.flex && { flex: col.flex }]}>
              <Text style={s.dynCellLabel}>{col.label}</Text>
              <TextInput
                style={s.dynInput}
                value={row[col.key] || ''}
                onChangeText={(v) => updateCell(idx, col.key, v)}
                placeholder={col.placeholder || ''}
                placeholderTextColor="#94A3B8"
                keyboardType={col.keyboard || 'default'}
              />
            </View>
          ))}
          {rows.length > 1 && (
            <TouchableOpacity style={s.dynRemove} onPress={() => removeRow(idx)}>
              <Text style={s.dynRemoveText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity style={s.addRowBtn} onPress={addRow}>
        <Text style={s.addRowBtnText}>＋ {addLabel || 'Thêm dòng'}</Text>
      </TouchableOpacity>
    </View>
  );
};

/* ─── Form renderers ─── */

const renderKhamBenh = (d, set) => (
  <>
    <SectionTitle>PHIẾU THÔNG TIN KHÁM BỆNH</SectionTitle>
    <Row>
      <F label="Họ tên" value={d.hoTen} onChange={(v) => set('hoTen', v)} half placeholder="Họ và tên" />
      <F label="Điện thoại" value={d.dienThoai} onChange={(v) => set('dienThoai', v)} half keyboard="phone-pad" />
    </Row>
    <Row>
      <F label="Giới tính" value={d.gioiTinh} onChange={(v) => set('gioiTinh', v)} half placeholder="Nam / Nữ" />
      <F label="Tuổi" value={d.tuoi} onChange={(v) => set('tuoi', v)} half keyboard="number-pad" />
    </Row>
    <F label="Ngày tiếp nhận" value={d.ngayTiepNhan} onChange={(v) => set('ngayTiepNhan', v)} placeholder="dd/mm/yyyy" />
    <F label="Địa chỉ" value={d.diaChi} onChange={(v) => set('diaChi', v)} />
    <Row>
      <F label="Phường/Xã" value={d.phuongXa} onChange={(v) => set('phuongXa', v)} half />
      <F label="Tỉnh thành" value={d.tinhThanh} onChange={(v) => set('tinhThanh', v)} half />
    </Row>
    <F label="Yêu cầu / Lý do khám" value={d.yeuCau} onChange={(v) => set('yeuCau', v)} multi />
    <SectionTitle>Sinh hiệu (Vital Signs)</SectionTitle>
    <Row>
      <F label="Mạch (lần/phút)" value={d.mach} onChange={(v) => set('mach', v)} half keyboard="decimal-pad" />
      <F label="Huyết áp (mmHg)" value={d.huyetAp} onChange={(v) => set('huyetAp', v)} half />
    </Row>
    <Row>
      <F label="Chiều cao (cm)" value={d.chieuCao} onChange={(v) => set('chieuCao', v)} half keyboard="decimal-pad" />
      <F label="Cân nặng (kg)" value={d.canNang} onChange={(v) => set('canNang', v)} half keyboard="decimal-pad" />
    </Row>
    <Row>
      <F label="Nhịp thở (lần/phút)" value={d.nhipTho} onChange={(v) => set('nhipTho', v)} half keyboard="decimal-pad" />
      <F label="BMI" value={d.bmi} onChange={(v) => set('bmi', v)} half keyboard="decimal-pad" />
    </Row>
    <Row>
      <F label="Nhiệt độ (°C)" value={d.nhietDo} onChange={(v) => set('nhietDo', v)} half keyboard="decimal-pad" />
      <F label="SpO2 (%)" value={d.spo2} onChange={(v) => set('spo2', v)} half keyboard="decimal-pad" />
    </Row>
  </>
);

const renderVienPhi = (d, set) => (
  <>
    <SectionTitle>PHIẾU THU VIỆN PHÍ</SectionTitle>
    <Row>
      <F label="Số phiếu" value={d.soPhieu} onChange={(v) => set('soPhieu', v)} half />
      <F label="Mã bệnh nhân" value={d.maBenhNhan} onChange={(v) => set('maBenhNhan', v)} half />
    </Row>
    <F label="Họ và tên" value={d.hoTen} onChange={(v) => set('hoTen', v)} />
    <Row>
      <F label="Ngày sinh" value={d.ngaySinh} onChange={(v) => set('ngaySinh', v)} half placeholder="dd/mm/yyyy" />
      <F label="Giới tính" value={d.gioiTinh} onChange={(v) => set('gioiTinh', v)} half placeholder="Nam / Nữ" />
    </Row>
    <F label="Địa chỉ" value={d.diaChi} onChange={(v) => set('diaChi', v)} />
    <Row>
      <F label="Số BHYT" value={d.soBHYT} onChange={(v) => set('soBHYT', v)} half />
      <F label="Đối tượng" value={d.doiTuong} onChange={(v) => set('doiTuong', v)} half />
    </Row>
    <Row>
      <F label="Số điện thoại" value={d.sdt} onChange={(v) => set('sdt', v)} half keyboard="phone-pad" />
      <F label="In lần thứ" value={d.inLanThu} onChange={(v) => set('inLanThu', v)} half keyboard="number-pad" />
    </Row>
    <SectionTitle>Danh sách dịch vụ</SectionTitle>
    <DynamicRows
      rows={d.dichVus}
      onChange={(v) => set('dichVus', v)}
      addLabel="Thêm dịch vụ"
      columns={[
        { key: 'tenDichVu', label: 'Tên dịch vụ', flex: 3, placeholder: 'Tên xét nghiệm/dịch vụ' },
        { key: 'soLuong', label: 'SL', flex: 1, keyboard: 'number-pad', placeholder: '1' },
        { key: 'donGia', label: 'Đơn giá', flex: 2, keyboard: 'decimal-pad', placeholder: '0' },
        { key: 'thanhTien', label: 'Thành tiền', flex: 2, keyboard: 'decimal-pad', placeholder: '0' },
      ]}
    />
    <Row>
      <F label="Tổng chi phí (VNĐ)" value={d.tongChiPhi} onChange={(v) => set('tongChiPhi', v)} half keyboard="decimal-pad" />
    </Row>
    <F label="Số tiền bằng chữ" value={d.soTienBangChu} onChange={(v) => set('soTienBangChu', v)} />
  </>
);

const renderTomTatHSBA = (d, set) => (
  <>
    <SectionTitle>GIẤY ĐỀ NGHỊ CUNG CẤP HỒ SƠ BỆNH ÁN</SectionTitle>
    <RadioGroup
      label="Loại yêu cầu"
      value={d.loaiYeuCau}
      onChange={(v) => set('loaiYeuCau', v)}
      options={[
        { value: 'ban_tom_tat', label: 'Cung cấp bản tóm tắt HSBA' },
        { value: 'doc_xem', label: 'Đọc, xem, ghi chép HSBA' },
      ]}
    />
    <F label="Tên người viết đơn" value={d.tenNguoiViet} onChange={(v) => set('tenNguoiViet', v)} />
    <F label="Địa chỉ" value={d.diaChi} onChange={(v) => set('diaChi', v)} />
    <Row>
      <F label="Số CCCD/Hộ chiếu" value={d.cccd} onChange={(v) => set('cccd', v)} half />
      <F label="Điện thoại" value={d.dienThoai} onChange={(v) => set('dienThoai', v)} half keyboard="phone-pad" />
    </Row>
    <RadioGroup
      label="Vai trò người làm đơn"
      value={d.vaiTro}
      onChange={(v) => set('vaiTro', v)}
      options={[
        { value: 'nguoi_benh', label: 'Là người bệnh' },
        { value: 'than_nhan', label: 'Là thân nhân' },
      ]}
    />
    {d.vaiTro === 'than_nhan' && (
      <F label="Quan hệ với người bệnh" value={d.quanHe} onChange={(v) => set('quanHe', v)} placeholder="Con / Vợ / Chồng / Bố / Mẹ..." />
    )}
    <Row>
      <F label="Ngày nhập viện" value={d.ngayNhapVien} onChange={(v) => set('ngayNhapVien', v)} half placeholder="dd/mm/yyyy" />
      <F label="Ngày ra viện" value={d.ngayRaVien} onChange={(v) => set('ngayRaVien', v)} half placeholder="dd/mm/yyyy" />
    </Row>
    <Row>
      <F label="Số hồ sơ bệnh án" value={d.soHoSo} onChange={(v) => set('soHoSo', v)} half />
      <F label="Mã số người bệnh" value={d.maSoBenhNhan} onChange={(v) => set('maSoBenhNhan', v)} half />
    </Row>
    <F label="Yêu cầu cụ thể / Mục đích sử dụng" value={d.mucDich} onChange={(v) => set('mucDich', v)} multi />
  </>
);

const renderChiDinhDV = (d, set) => (
  <>
    <SectionTitle>PHIẾU CHỈ ĐỊNH DỊCH VỤ</SectionTitle>
    <Row>
      <F label="Số bệnh án (SBA)" value={d.soBA} onChange={(v) => set('soBA', v)} half />
      <F label="Số BHYT" value={d.soBHYT} onChange={(v) => set('soBHYT', v)} half />
    </Row>
    <RadioGroup
      label="Loại"
      value={d.loai}
      onChange={(v) => set('loai', v)}
      options={[
        { value: 'thuong', label: 'Thường' },
        { value: 'cap_cuu', label: 'Cấp cứu' },
      ]}
    />
    <F label="Họ và tên bệnh nhân" value={d.hoTen} onChange={(v) => set('hoTen', v)} />
    <Row>
      <F label="Giới tính" value={d.gioiTinh} onChange={(v) => set('gioiTinh', v)} half placeholder="Nam / Nữ" />
      <F label="Tuổi" value={d.tuoi} onChange={(v) => set('tuoi', v)} half keyboard="number-pad" />
    </Row>
    <Row>
      <F label="Điện thoại" value={d.dienThoai} onChange={(v) => set('dienThoai', v)} half keyboard="phone-pad" />
      <F label="Khoa" value={d.khoa} onChange={(v) => set('khoa', v)} half />
    </Row>
    <F label="Địa chỉ" value={d.diaChi} onChange={(v) => set('diaChi', v)} />
    <F label="Chẩn đoán" value={d.chanDoan} onChange={(v) => set('chanDoan', v)} multi />
    <SectionTitle>Danh sách chỉ định</SectionTitle>
    <DynamicRows
      rows={d.dichVus}
      onChange={(v) => set('dichVus', v)}
      addLabel="Thêm dịch vụ"
      columns={[
        { key: 'yeuCau', label: 'Yêu cầu dịch vụ', flex: 3, placeholder: 'Tên xét nghiệm/hình ảnh' },
        { key: 'soLuong', label: 'SL', flex: 1, keyboard: 'number-pad', placeholder: '1' },
        { key: 'donGia', label: 'Đơn giá', flex: 2, keyboard: 'decimal-pad', placeholder: '0' },
      ]}
    />
    <Row>
      <F label="Bác sĩ điều trị" value={d.bacSiDieuTri} onChange={(v) => set('bacSiDieuTri', v)} half />
      <F label="Ngày giờ" value={d.ngayGio} onChange={(v) => set('ngayGio', v)} half placeholder="dd/mm/yyyy hh:mm" />
    </Row>
  </>
);

const renderToaThuoc = (d, set) => (
  <>
    <SectionTitle>TOA THUỐC ĐIỀU TRỊ</SectionTitle>
    <Row>
      <F label="Mã y tế" value={d.maYTe} onChange={(v) => set('maYTe', v)} half />
      <F label="Số hồ sơ" value={d.soHoSo} onChange={(v) => set('soHoSo', v)} half />
    </Row>
    <F label="Họ và tên bệnh nhân" value={d.hoTen} onChange={(v) => set('hoTen', v)} />
    <Row>
      <F label="Giới tính" value={d.gioiTinh} onChange={(v) => set('gioiTinh', v)} half placeholder="Nam / Nữ" />
      <F label="Tuổi" value={d.tuoi} onChange={(v) => set('tuoi', v)} half keyboard="number-pad" />
    </Row>
    <F label="Họ tên bố/mẹ/người giám hộ (nếu dưới 72 tháng tuổi)" value={d.nguoiGiamHo} onChange={(v) => set('nguoiGiamHo', v)} />
    <Row>
      <F label="CMND/CCCD số" value={d.cmnd} onChange={(v) => set('cmnd', v)} half />
      <F label="Đối tượng" value={d.doiTuong} onChange={(v) => set('doiTuong', v)} half />
    </Row>
    <F label="Địa chỉ" value={d.diaChi} onChange={(v) => set('diaChi', v)} />
    <F label="Chẩn đoán" value={d.chanDoan} onChange={(v) => set('chanDoan', v)} multi />
    <F label="Bệnh kèm theo" value={d.benhKemTheo} onChange={(v) => set('benhKemTheo', v)} />
    <SectionTitle>Danh sách thuốc</SectionTitle>
    <DynamicRows
      rows={d.thuocs}
      onChange={(v) => set('thuocs', v)}
      addLabel="Thêm thuốc"
      columns={[
        { key: 'tenThuoc', label: 'Tên thuốc', flex: 3, placeholder: 'Tên thuốc + hàm lượng' },
        { key: 'soLuong', label: 'SL', flex: 1, keyboard: 'number-pad', placeholder: '0' },
        { key: 'lieu', label: 'Liều dùng', flex: 2, placeholder: 'VD: 1 viên/ngày' },
        { key: 'cachDung', label: 'Cách dùng', flex: 2, placeholder: 'Sau ăn/Trước ăn' },
      ]}
    />
    <F label="Lời dặn của bác sĩ" value={d.loiDan} onChange={(v) => set('loiDan', v)} multi />
    <Text style={s.noteText}>Khi đi tái khám nhớ mang theo đơn thuốc này.</Text>
  </>
);

const renderGiayRaVien = (d, set) => (
  <>
    <SectionTitle>GIẤY RA VIỆN</SectionTitle>
    <F label="Họ tên người bệnh" value={d.hoTen} onChange={(v) => set('hoTen', v)} />
    <Row>
      <F label="Ngày/tháng/năm sinh" value={d.ngaySinh} onChange={(v) => set('ngaySinh', v)} half placeholder="dd/mm/yyyy" />
      <F label="Tuổi" value={d.tuoi} onChange={(v) => set('tuoi', v)} half keyboard="number-pad" />
    </Row>
    <Row>
      <F label="Giới tính" value={d.gioiTinh} onChange={(v) => set('gioiTinh', v)} half placeholder="Nam / Nữ" />
      <F label="Dân tộc" value={d.danToc} onChange={(v) => set('danToc', v)} half />
    </Row>
    <F label="Nghề nghiệp" value={d.ngheNghiep} onChange={(v) => set('ngheNghiep', v)} />
    <Row>
      <F label="Số CCCD/CMND" value={d.cccd} onChange={(v) => set('cccd', v)} half />
      <F label="Ngày cấp" value={d.ngayCap} onChange={(v) => set('ngayCap', v)} half placeholder="dd/mm/yyyy" />
    </Row>
    <Row>
      <F label="Mã số BHXH" value={d.maBHXH} onChange={(v) => set('maBHXH', v)} half />
      <F label="Thẻ BHYT số" value={d.soBHYT} onChange={(v) => set('soBHYT', v)} half />
    </Row>
    <F label="Địa chỉ" value={d.diaChi} onChange={(v) => set('diaChi', v)} />
    <SectionTitle>Vào viện lúc</SectionTitle>
    <Row>
      <F label="Giờ" value={d.vaoVienGio} onChange={(v) => set('vaoVienGio', v)} half keyboard="number-pad" placeholder="hh" />
      <F label="Phút" value={d.vaoVienPhut} onChange={(v) => set('vaoVienPhut', v)} half keyboard="number-pad" placeholder="mm" />
    </Row>
    <Row>
      <F label="Ngày" value={d.vaoVienNgay} onChange={(v) => set('vaoVienNgay', v)} half keyboard="number-pad" placeholder="dd" />
      <F label="Tháng" value={d.vaoVienThang} onChange={(v) => set('vaoVienThang', v)} half keyboard="number-pad" placeholder="mm" />
      <F label="Năm" value={d.vaoVienNam} onChange={(v) => set('vaoVienNam', v)} half keyboard="number-pad" placeholder="yyyy" />
    </Row>
    <SectionTitle>Ra viện lúc</SectionTitle>
    <Row>
      <F label="Giờ" value={d.raVienGio} onChange={(v) => set('raVienGio', v)} half keyboard="number-pad" placeholder="hh" />
      <F label="Phút" value={d.raVienPhut} onChange={(v) => set('raVienPhut', v)} half keyboard="number-pad" placeholder="mm" />
    </Row>
    <Row>
      <F label="Ngày" value={d.raVienNgay} onChange={(v) => set('raVienNgay', v)} half keyboard="number-pad" placeholder="dd" />
      <F label="Tháng" value={d.raVienThang} onChange={(v) => set('raVienThang', v)} half keyboard="number-pad" placeholder="mm" />
      <F label="Năm" value={d.raVienNam} onChange={(v) => set('raVienNam', v)} half keyboard="number-pad" placeholder="yyyy" />
    </Row>
    <F label="Chẩn đoán" value={d.chanDoan} onChange={(v) => set('chanDoan', v)} multi />
    <F label="Phương pháp điều trị" value={d.phuongPhapDieuTri} onChange={(v) => set('phuongPhapDieuTri', v)} multi />
    <F label="Ghi chú" value={d.ghiChu} onChange={(v) => set('ghiChu', v)} multi />
  </>
);

const renderChuyenTuyen = (d, set) => (
  <>
    <SectionTitle>PHIẾU CHUYỂN CƠ SỞ KCB (MS: GCT)</SectionTitle>
    <F label="Kính gửi" value={d.kinhGui} onChange={(v) => set('kinhGui', v)} placeholder="Tên cơ sở y tế tiếp nhận" />
    <F label="Cơ sở KCB chuyển đến" value={d.coSoKCB} onChange={(v) => set('coSoKCB', v)} />
    <SectionTitle>Thông tin người bệnh</SectionTitle>
    <F label="Họ và tên người bệnh" value={d.hoTen} onChange={(v) => set('hoTen', v)} />
    <Row>
      <F label="Giới tính" value={d.gioiTinh} onChange={(v) => set('gioiTinh', v)} half placeholder="Nam / Nữ" />
      <F label="Năm sinh" value={d.namSinh} onChange={(v) => set('namSinh', v)} half keyboard="number-pad" />
    </Row>
    <F label="Địa chỉ" value={d.diaChi} onChange={(v) => set('diaChi', v)} />
    <Row>
      <F label="Dân tộc" value={d.danToc} onChange={(v) => set('danToc', v)} half />
      <F label="Quốc tịch" value={d.quocTich} onChange={(v) => set('quocTich', v)} half />
    </Row>
    <Row>
      <F label="Nghề nghiệp" value={d.ngheNghiep} onChange={(v) => set('ngheNghiep', v)} half />
      <F label="Nơi làm việc" value={d.noiLamViec} onChange={(v) => set('noiLamViec', v)} half />
    </Row>
    <Row>
      <F label="Số thẻ BHYT" value={d.soBHYT} onChange={(v) => set('soBHYT', v)} half />
      <F label="Thời hạn sử dụng" value={d.thoiHanBHYT} onChange={(v) => set('thoiHanBHYT', v)} half />
    </Row>
    <SectionTitle>Đã được khám tại</SectionTitle>
    <DynamicRows
      rows={d.daKhamTais}
      onChange={(v) => set('daKhamTais', v)}
      addLabel="Thêm cơ sở đã khám"
      columns={[
        { key: 'cap', label: 'Cấp', flex: 1, placeholder: 'I / II / III' },
        { key: 'tuNgay', label: 'Từ ngày', flex: 2, placeholder: 'dd/mm/yyyy' },
        { key: 'denNgay', label: 'Đến ngày', flex: 2, placeholder: 'dd/mm/yyyy' },
      ]}
    />
    <SectionTitle>Tóm tắt bệnh án</SectionTitle>
    <F label="Dấu hiệu lâm sàng" value={d.dauHieuLamSang} onChange={(v) => set('dauHieuLamSang', v)} multi />
    <F label="Kết quả xét nghiệm cận lâm sàng" value={d.ketQuaXN} onChange={(v) => set('ketQuaXN', v)} multi />
    <F label="Chẩn đoán bệnh chính" value={d.chanDoanBenhChinh} onChange={(v) => set('chanDoanBenhChinh', v)} multi />
    <F label="Phương pháp/thủ thuật đã thực hiện" value={d.phuongPhap} onChange={(v) => set('phuongPhap', v)} multi />
    <F label="Thời gian thực hiện" value={d.thoiGianPP} onChange={(v) => set('thoiGianPP', v)} />
    <F label="Kỹ thuật/thuốc điều trị chính đã sử dụng" value={d.thuocDieuTri} onChange={(v) => set('thuocDieuTri', v)} multi />
    <F label="Tình trạng người bệnh lúc chuyển" value={d.tinhTrang} onChange={(v) => set('tinhTrang', v)} multi />
    <RadioGroup
      label="Lý do chuyển viện"
      value={d.lyDoChuyen}
      onChange={(v) => set('lyDoChuyen', v)}
      options={[
        { value: 'phu_hop_cm', label: 'Phù hợp chuyên môn' },
        { value: 'khong_phu_hop', label: 'Không phù hợp khả năng' },
        { value: 'theo_yeu_cau', label: 'Theo yêu cầu BN' },
      ]}
    />
    <F label="Hướng điều trị" value={d.huongDieuTri} onChange={(v) => set('huongDieuTri', v)} multi />
    <Row>
      <F label="Thời gian chuyển" value={d.thoiGianChuyen} onChange={(v) => set('thoiGianChuyen', v)} half />
      <F label="Phương tiện vận chuyển" value={d.phuongTien} onChange={(v) => set('phuongTien', v)} half />
    </Row>
    <F label="Người hộ tống" value={d.nguoiHoTong} onChange={(v) => set('nguoiHoTong', v)} />
  </>
);

const renderHuyetHoc = (d, set) => (
  <>
    <SectionTitle>PHIẾU KẾT QUẢ XÉT NGHIỆM HUYẾT HỌC</SectionTitle>
    <Row>
      <F label="Số vào viện" value={d.soVaoVien} onChange={(v) => set('soVaoVien', v)} half />
      <F label="Số phiếu" value={d.soPhieu} onChange={(v) => set('soPhieu', v)} half />
    </Row>
    <Row>
      <F label="Mã y tế" value={d.maYTe} onChange={(v) => set('maYTe', v)} half />
      <F label="Năm sinh" value={d.namSinh} onChange={(v) => set('namSinh', v)} half keyboard="number-pad" />
    </Row>
    <Row>
      <F label="Giới tính" value={d.gioiTinh} onChange={(v) => set('gioiTinh', v)} half placeholder="Nam / Nữ" />
      <F label="Khoa" value={d.khoa} onChange={(v) => set('khoa', v)} half />
    </Row>
    <F label="Địa chỉ" value={d.diaChi} onChange={(v) => set('diaChi', v)} />
    <F label="Chẩn đoán" value={d.chanDoan} onChange={(v) => set('chanDoan', v)} multi />
    <Row>
      <F label="Giờ nhận mẫu" value={d.gioNhanMau} onChange={(v) => set('gioNhanMau', v)} half placeholder="hh:mm dd/mm/yyyy" />
      <F label="Đối tượng" value={d.doiTuong} onChange={(v) => set('doiTuong', v)} half />
    </Row>
    <Row>
      <F label="Nơi lấy mẫu" value={d.noiLayMau} onChange={(v) => set('noiLayMau', v)} half />
      <F label="BS chỉ định XN" value={d.bsChiDinhXN} onChange={(v) => set('bsChiDinhXN', v)} half />
    </Row>
    <SectionTitle>Tổng phân tích tế bào máu ngoại vi</SectionTitle>
    <Text style={s.refRange}>CSBT: WBC 4–10 × 10⁹/L  |  RBC 4–5 × 10¹²/L  |  HGB 120–160 g/L  |  PLT 150–450 × 10⁹/L</Text>
    <Row><F label="WBC (×10⁹/L)" value={d.wbc} onChange={(v) => set('wbc', v)} half keyboard="decimal-pad" />
      <F label="RBC (×10¹²/L)" value={d.rbc} onChange={(v) => set('rbc', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="NEU (%)" value={d.neuPct} onChange={(v) => set('neuPct', v)} half keyboard="decimal-pad" />
      <F label="NEU# (×10⁹/L)" value={d.neuAbs} onChange={(v) => set('neuAbs', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="LYM (%)" value={d.lymPct} onChange={(v) => set('lymPct', v)} half keyboard="decimal-pad" />
      <F label="LYM# (×10⁹/L)" value={d.lymAbs} onChange={(v) => set('lymAbs', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="MONO (%)" value={d.monoPct} onChange={(v) => set('monoPct', v)} half keyboard="decimal-pad" />
      <F label="MONO# (×10⁹/L)" value={d.monoAbs} onChange={(v) => set('monoAbs', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="EOS (%)" value={d.eosPct} onChange={(v) => set('eosPct', v)} half keyboard="decimal-pad" />
      <F label="EOS# (×10⁹/L)" value={d.eosAbs} onChange={(v) => set('eosAbs', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="BAS (%)" value={d.basPct} onChange={(v) => set('basPct', v)} half keyboard="decimal-pad" />
      <F label="BAS# (×10⁹/L)" value={d.basAbs} onChange={(v) => set('basAbs', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="HGB (g/L)" value={d.hgb} onChange={(v) => set('hgb', v)} half keyboard="decimal-pad" />
      <F label="HCT (%)" value={d.hct} onChange={(v) => set('hct', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="MCV (fL)" value={d.mcv} onChange={(v) => set('mcv', v)} half keyboard="decimal-pad" />
      <F label="MCH (pg)" value={d.mch} onChange={(v) => set('mch', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="MCHC (g/L)" value={d.mchc} onChange={(v) => set('mchc', v)} half keyboard="decimal-pad" />
      <F label="RDW (%)" value={d.rdw} onChange={(v) => set('rdw', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="PLT (×10⁹/L)" value={d.plt} onChange={(v) => set('plt', v)} half keyboard="decimal-pad" />
      <F label="MPV (fL)" value={d.mpv} onChange={(v) => set('mpv', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="PCT" value={d.pct_plt} onChange={(v) => set('pct_plt', v)} half keyboard="decimal-pad" />
      <F label="PDW" value={d.pdw} onChange={(v) => set('pdw', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="HFLC (%)" value={d.hflcPct} onChange={(v) => set('hflcPct', v)} half keyboard="decimal-pad" />
      <F label="HFLC# (×10⁹/L)" value={d.hflcAbs} onChange={(v) => set('hflcAbs', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="IG (%)" value={d.igPct} onChange={(v) => set('igPct', v)} half keyboard="decimal-pad" />
      <F label="IG# (×10⁹/L)" value={d.igAbs} onChange={(v) => set('igAbs', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="NRBC (%)" value={d.nrbcPct} onChange={(v) => set('nrbcPct', v)} half keyboard="decimal-pad" />
      <F label="NRBC# (×10⁹/L)" value={d.nrbcAbs} onChange={(v) => set('nrbcAbs', v)} half keyboard="decimal-pad" /></Row>
    <Row>
      <F label="Bác sĩ xét nghiệm" value={d.bacSiXN} onChange={(v) => set('bacSiXN', v)} half />
      <F label="Trưởng khoa XN" value={d.truongKhoa} onChange={(v) => set('truongKhoa', v)} half />
    </Row>
  </>
);

const renderHoaSinh = (d, set) => (
  <>
    <SectionTitle>PHIẾU XÉT NGHIỆM HOÁ SINH MÁU</SectionTitle>
    <Row>
      <F label="Bệnh viện" value={d.benhVien} onChange={(v) => set('benhVien', v)} half />
      <RadioGroup label="Loại" value={d.loai} onChange={(v) => set('loai', v)}
        options={[{ value: 'thuong', label: 'Thường' }, { value: 'cap_cuu', label: 'Cấp cứu' }]} />
    </Row>
    <Row>
      <F label="Số" value={d.so} onChange={(v) => set('so', v)} half />
    </Row>
    <F label="Họ tên người bệnh" value={d.hoTen} onChange={(v) => set('hoTen', v)} />
    <Row>
      <F label="Tuổi" value={d.tuoi} onChange={(v) => set('tuoi', v)} half keyboard="number-pad" />
      <F label="Giới tính" value={d.gioiTinh} onChange={(v) => set('gioiTinh', v)} half placeholder="Nam / Nữ" />
    </Row>
    <F label="Địa chỉ" value={d.diaChi} onChange={(v) => set('diaChi', v)} />
    <F label="Số thẻ BHYT" value={d.soBHYT} onChange={(v) => set('soBHYT', v)} />
    <Row>
      <F label="Khoa" value={d.khoa} onChange={(v) => set('khoa', v)} half />
      <F label="Buồng/Giường" value={d.buong} onChange={(v) => set('buong', v)} half />
    </Row>
    <F label="Chẩn đoán" value={d.chanDoan} onChange={(v) => set('chanDoan', v)} multi />

    <SectionTitle>Kết quả xét nghiệm</SectionTitle>
    <Text style={s.refRange}>CSBT: Urê 2.5–7.5 | Glucose 3.9–6.4 | Cholesterol 3.9–5.2 | Albumin 35–50 | Protein TP 65–82 (mmol/L hoặc g/L)</Text>
    <Row><F label="Urê (mmol/L)" value={d.ure} onChange={(v) => set('ure', v)} half keyboard="decimal-pad" />
      <F label="Glucose (mmol/L)" value={d.glucose} onChange={(v) => set('glucose', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="Creatinin Nam (μmol/L)" value={d.creatininNam} onChange={(v) => set('creatininNam', v)} half keyboard="decimal-pad" />
      <F label="Creatinin Nữ (μmol/L)" value={d.creatininNu} onChange={(v) => set('creatininNu', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="Acid Uric (μmol/L)" value={d.acidUric} onChange={(v) => set('acidUric', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="Bilirubin TP (μmol/L)" value={d.bilirubinTP} onChange={(v) => set('bilirubinTP', v)} half keyboard="decimal-pad" />
      <F label="Bilirubin TT" value={d.bilirubinTT} onChange={(v) => set('bilirubinTT', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="Bilirubin GT" value={d.bilirubinGT} onChange={(v) => set('bilirubinGT', v)} half keyboard="decimal-pad" />
      <F label="Protein TP (g/L)" value={d.proteinTP} onChange={(v) => set('proteinTP', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="Albumin (g/L)" value={d.albumin} onChange={(v) => set('albumin', v)} half keyboard="decimal-pad" />
      <F label="Globulin (g/L)" value={d.globulin} onChange={(v) => set('globulin', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="Tỷ lệ A/G" value={d.tyLeAG} onChange={(v) => set('tyLeAG', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="Cholesterol (mmol/L)" value={d.cholesterol} onChange={(v) => set('cholesterol', v)} half keyboard="decimal-pad" />
      <F label="Triglycerid (mmol/L)" value={d.triglycerid} onChange={(v) => set('triglycerid', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="HDL-cholesterol" value={d.hdlCho} onChange={(v) => set('hdlCho', v)} half keyboard="decimal-pad" />
      <F label="LDL-cholesterol" value={d.ldlCho} onChange={(v) => set('ldlCho', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="Na+ (mmol/L)" value={d.naPlus} onChange={(v) => set('naPlus', v)} half keyboard="decimal-pad" />
      <F label="K+ (mmol/L)" value={d.kPlus} onChange={(v) => set('kPlus', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="Cl- (mmol/L)" value={d.clMinus} onChange={(v) => set('clMinus', v)} half keyboard="decimal-pad" />
      <F label="Calci (mmol/L)" value={d.calci} onChange={(v) => set('calci', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="Calci ion hoá" value={d.calciIon} onChange={(v) => set('calciIon', v)} half keyboard="decimal-pad" />
      <F label="Phospho (mmol/L)" value={d.phospho} onChange={(v) => set('phospho', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="Sắt (μmol/L)" value={d.sat} onChange={(v) => set('sat', v)} half keyboard="decimal-pad" />
      <F label="Magiê (mmol/L)" value={d.magie} onChange={(v) => set('magie', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="AST/GOT (U/L)" value={d.ast} onChange={(v) => set('ast', v)} half keyboard="decimal-pad" />
      <F label="ALT/GPT (U/L)" value={d.alt} onChange={(v) => set('alt', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="Amylase (U/L)" value={d.amylase} onChange={(v) => set('amylase', v)} half keyboard="decimal-pad" />
      <F label="CK (U/L)" value={d.ck} onChange={(v) => set('ck', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="CK-MB (U/L)" value={d.ckMb} onChange={(v) => set('ckMb', v)} half keyboard="decimal-pad" />
      <F label="LDH (U/L)" value={d.ldh} onChange={(v) => set('ldh', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="GGT (U/L)" value={d.ggt} onChange={(v) => set('ggt', v)} half keyboard="decimal-pad" />
      <F label="Cholinesterase" value={d.cholinesterase} onChange={(v) => set('cholinesterase', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="Phosphatase kiềm (U/L)" value={d.phosphataseKiem} onChange={(v) => set('phosphataseKiem', v)} half keyboard="decimal-pad" />
      <F label="Fibrinogen (g/L)" value={d.fibrinogen} onChange={(v) => set('fibrinogen', v)} half keyboard="decimal-pad" /></Row>

    <SectionTitle>Khí máu động mạch</SectionTitle>
    <Row><F label="pH động mạch" value={d.pH} onChange={(v) => set('pH', v)} half keyboard="decimal-pad" />
      <F label="pCO2 (mmHg)" value={d.pCO2} onChange={(v) => set('pCO2', v)} half keyboard="decimal-pad" /></Row>
    <Row><F label="pO2 (mmHg)" value={d.pO2} onChange={(v) => set('pO2', v)} half keyboard="decimal-pad" />
      <F label="HCO3 chuẩn (mmol/L)" value={d.hco3} onChange={(v) => set('hco3', v)} half keyboard="decimal-pad" /></Row>
    <F label="Kiềm dư (mmol/L)" value={d.kiemDu} onChange={(v) => set('kiemDu', v)} />
    <Row>
      <F label="Bác sĩ điều trị" value={d.bacSiDieuTri} onChange={(v) => set('bacSiDieuTri', v)} half />
      <F label="Trưởng khoa XN" value={d.truongKhoaXN} onChange={(v) => set('truongKhoaXN', v)} half />
    </Row>
  </>
);

const renderImaging = (d, set, isMRI) => (
  <>
    <SectionTitle>{isMRI ? 'KẾT QUẢ MRI SỌ NÃO' : 'KẾT QUẢ CT-SCAN SỌ NÃO'}</SectionTitle>
    <F label="Họ và tên" value={d.hoTen} onChange={(v) => set('hoTen', v)} />
    <Row>
      <F label="Giới tính" value={d.gioiTinh} onChange={(v) => set('gioiTinh', v)} half placeholder="Nam / Nữ" />
      <F label="Năm sinh" value={d.namSinh} onChange={(v) => set('namSinh', v)} half keyboard="number-pad" />
    </Row>
    <F label="Địa chỉ" value={d.diaChi} onChange={(v) => set('diaChi', v)} />
    <Row>
      <F label="Ngày chỉ định" value={d.ngayChiDinh} onChange={(v) => set('ngayChiDinh', v)} half placeholder="dd/mm/yyyy" />
      <F label="Bác sĩ chỉ định" value={d.bacSiChiDinh} onChange={(v) => set('bacSiChiDinh', v)} half />
    </Row>
    <Row>
      <F label="Nơi chỉ định" value={d.noiChiDinh} onChange={(v) => set('noiChiDinh', v)} half />
      <F label="Số bệnh án" value={d.soBA} onChange={(v) => set('soBA', v)} half />
    </Row>
    <F label="Chẩn đoán lâm sàng" value={d.chanDoan} onChange={(v) => set('chanDoan', v)} multi />
    <Text style={s.noteText}>
      Chỉ định: {isMRI ? 'Chụp cộng hưởng từ sọ não (0.2–1.5T) — Chụp MRI không thuốc' : 'Chụp cắt lớp vi tính sọ não — CT-Scan không thuốc/có cản quang'}
    </Text>
    <F label="Kỹ thuật" value={d.kyThuat} onChange={(v) => set('kyThuat', v)} multi />
    <F label="Mô tả hình ảnh" value={d.moTaHinhAnh} onChange={(v) => set('moTaHinhAnh', v)} multi placeholder="Mô tả chi tiết các cấu trúc, vị trí tổn thương, kích thước..." />
    <F label="Kết luận" value={d.ketLuan} onChange={(v) => set('ketLuan', v)} multi placeholder="Kết luận chẩn đoán hình ảnh..." />
    <Row>
      <F label="Bác sĩ chuyên khoa" value={d.bacSiChuyenKhoa} onChange={(v) => set('bacSiChuyenKhoa', v)} half />
      <F label="Ngày giờ ký" value={d.ngayGio} onChange={(v) => set('ngayGio', v)} half placeholder="dd/mm/yyyy hh:mm" />
    </Row>
  </>
);

const renderCamKetPT = (d, set) => {
  const toggleNested = (key, field) => {
    set(key, { ...d[key], [field]: !d[key][field] });
  };
  return (
    <>
      <SectionTitle>GIẤY CAM KẾT CHẤP THUẬN PHẪU THUẬT / THỦ THUẬT / GÂY MÊ HỒI SỨC</SectionTitle>

      <SectionTitle>I. Bác sỹ phẫu thuật / thủ thuật / gây mê hồi sức</SectionTitle>
      <Row>
        <F label="Tên bác sĩ" value={d.tenBS} onChange={(v) => set('tenBS', v)} half />
        <F label="Chức danh" value={d.chucDanh} onChange={(v) => set('chucDanh', v)} half />
      </Row>
      <Row>
        <F label="Khoa" value={d.khoa} onChange={(v) => set('khoa', v)} half />
        <F label="Bác sĩ gây mê" value={d.bsGayMe} onChange={(v) => set('bsGayMe', v)} half />
      </Row>
      <F label="Tên người bệnh" value={d.tenBN} onChange={(v) => set('tenBN', v)} />
      <F label="Chẩn đoán" value={d.chanDoan} onChange={(v) => set('chanDoan', v)} multi />

      <Text style={s.label}>Đã tư vấn:</Text>
      <Checkbox label="Chẩn đoán" checked={d.tuVan.chanDoan} onToggle={() => toggleNested('tuVan', 'chanDoan')} indent />
      <Checkbox label="Lý do phẫu thuật" checked={d.tuVan.lyDoPT} onToggle={() => toggleNested('tuVan', 'lyDoPT')} indent />
      <Checkbox label="Rủi ro nếu không phẫu thuật" checked={d.tuVan.ruiRo} onToggle={() => toggleNested('tuVan', 'ruiRo')} indent />
      <Checkbox label="Kết quả dự kiến" checked={d.tuVan.ketQua} onToggle={() => toggleNested('tuVan', 'ketQua')} indent />

      <Text style={[s.label, { marginTop: 12 }]}>Phương pháp phẫu thuật dự kiến:</Text>
      <Checkbox label="Mổ mở" checked={d.phuongPhapPT.moMo} onToggle={() => toggleNested('phuongPhapPT', 'moMo')} indent />
      <Checkbox label="Nội soi" checked={d.phuongPhapPT.noiSoi} onToggle={() => toggleNested('phuongPhapPT', 'noiSoi')} indent />
      <Checkbox label="Thủ thuật" checked={d.phuongPhapPT.thuThuat} onToggle={() => toggleNested('phuongPhapPT', 'thuThuat')} indent />

      <Text style={[s.label, { marginTop: 12 }]}>Phương pháp gây mê:</Text>
      <Checkbox label="Mê nội khí quản (NKQ)" checked={d.phuongPhapGayMe.meNKQ} onToggle={() => toggleNested('phuongPhapGayMe', 'meNKQ')} indent />
      <Checkbox label="Mê mask thanh quản" checked={d.phuongPhapGayMe.meMask} onToggle={() => toggleNested('phuongPhapGayMe', 'meMask')} indent />
      <Checkbox label="Mê tĩnh mạch" checked={d.phuongPhapGayMe.meTinhMach} onToggle={() => toggleNested('phuongPhapGayMe', 'meTinhMach')} indent />
      <Checkbox label="Tê tủy sống" checked={d.phuongPhapGayMe.teTuySong} onToggle={() => toggleNested('phuongPhapGayMe', 'teTuySong')} indent />
      <Checkbox label="Tê ngoài màng cứng" checked={d.phuongPhapGayMe.teNgoaiMang} onToggle={() => toggleNested('phuongPhapGayMe', 'teNgoaiMang')} indent />
      <Checkbox label="Tê đám rối thần kinh" checked={d.phuongPhapGayMe.teDamRoi} onToggle={() => toggleNested('phuongPhapGayMe', 'teDamRoi')} indent />
      <Checkbox label="Tiền mê + Tê tại chỗ" checked={d.phuongPhapGayMe.tienMeTeTaiCho} onToggle={() => toggleNested('phuongPhapGayMe', 'tienMeTeTaiCho')} indent />
      <Checkbox label="Khác" checked={d.phuongPhapGayMe.khacGayMe} onToggle={() => toggleNested('phuongPhapGayMe', 'khacGayMe')} indent />

      <RadioGroup
        label="Điều trị khác ngoài phẫu thuật"
        value={d.dieuTriKhac}
        onChange={(v) => set('dieuTriKhac', v)}
        options={[{ value: 'khong', label: 'Không' }, { value: 'co', label: 'Có (ghi rõ)' }]}
      />
      {d.dieuTriKhac === 'co' && (
        <F label="Ghi rõ điều trị khác" value={d.ghiRoDieuTri} onChange={(v) => set('ghiRoDieuTri', v)} multi />
      )}

      <Text style={[s.label, { marginTop: 12 }]}>Nguy cơ tai biến:</Text>
      <Checkbox label="Phản ứng thuốc" checked={d.nguyCo.phanUngThuoc} onToggle={() => toggleNested('nguyCo', 'phanUngThuoc')} indent />
      <Checkbox label="Suy hô hấp / tuần hoàn" checked={d.nguyCo.suuHoHap} onToggle={() => toggleNested('nguyCo', 'suuHoHap')} indent />
      <Checkbox label="Chảy máu" checked={d.nguyCo.chayMau} onToggle={() => toggleNested('nguyCo', 'chayMau')} indent />
      <Checkbox label="Nhiễm trùng" checked={d.nguyCo.nhiemTrung} onToggle={() => toggleNested('nguyCo', 'nhiemTrung')} indent />
      <Checkbox label="Tử vong" checked={d.nguyCo.tuVong} onToggle={() => toggleNested('nguyCo', 'tuVong')} indent />
      <Checkbox label="Khác" checked={d.nguyCo.nguyCo_khac} onToggle={() => toggleNested('nguyCo', 'nguyCo_khac')} indent />

      <SectionTitle>II. Người bệnh / Thân nhân</SectionTitle>
      <Row>
        <F label="Họ tên người bệnh" value={d.tenBNII} onChange={(v) => set('tenBNII', v)} half />
        <F label="Năm sinh" value={d.namSinhBN} onChange={(v) => set('namSinhBN', v)} half keyboard="number-pad" />
      </Row>
      <Row>
        <F label="Họ tên thân nhân" value={d.tenThanNhan} onChange={(v) => set('tenThanNhan', v)} half />
        <F label="Năm sinh TN" value={d.namSinhTN} onChange={(v) => set('namSinhTN', v)} half keyboard="number-pad" />
      </Row>
      <F label="Quan hệ với người bệnh" value={d.quanHe} onChange={(v) => set('quanHe', v)} placeholder="Con / Vợ / Chồng / Bố / Mẹ..." />
      <RadioGroup
        label="Quyết định"
        value={d.quyetDinh}
        onChange={(v) => set('quyetDinh', v)}
        options={[
          { value: 'dong_y', label: 'Đồng ý phẫu thuật' },
          { value: 'khong_dong_y', label: 'Không đồng ý' },
        ]}
      />
    </>
  );
};

/* ─── Main Screen ─── */

const DocumentFormScreen = ({ route, navigation }) => {
  const { type, docId } = route.params || {};
  const info = DOC_TYPE_INFO[type];
  const { saveDocument } = useDocumentVault();

  const [formData, setFormData] = useState(() => createEmptyFormData(type));
  const [hospitalName, setHospitalName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(!docId);

  // Load existing doc directly from AsyncStorage to avoid timing issue
  useEffect(() => {
    if (!docId) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(VAULT_KEY);
        if (raw) {
          const vault = JSON.parse(raw);
          const doc = (vault[type] || []).find((d) => d.id === docId);
          if (doc) {
            setFormData({ ...createEmptyFormData(type), ...doc.formData });
            setHospitalName(doc.hospitalName || '');
            setVisitDate(doc.visitDate || '');
          }
        }
      } catch (e) {
        console.error('Load doc error:', e);
      } finally {
        setInitialLoaded(true);
      }
    })();
  }, [docId, type]);

  const set = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveDocument(type, formData, 'manual', null, {
        docId: docId || undefined,
        hospitalName,
        visitDate,
      });
      Alert.alert('Đã lưu', 'Tài liệu đã được lưu vào kho hồ sơ của bạn.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể lưu. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const renderForm = () => {
    switch (type) {
      case 'kham_benh':    return renderKhamBenh(formData, set);
      case 'vien_phi':     return renderVienPhi(formData, set);
      case 'tom_tat_hsba': return renderTomTatHSBA(formData, set);
      case 'chi_dinh_dv':  return renderChiDinhDV(formData, set);
      case 'toa_thuoc':    return renderToaThuoc(formData, set);
      case 'giay_ra_vien': return renderGiayRaVien(formData, set);
      case 'chuyen_tuyen': return renderChuyenTuyen(formData, set);
      case 'huyet_hoc':    return renderHuyetHoc(formData, set);
      case 'hoa_sinh':     return renderHoaSinh(formData, set);
      case 'ct_scan':      return renderImaging(formData, set, false);
      case 'mri':          return renderImaging(formData, set, true);
      case 'cam_ket_pt':   return renderCamKetPT(formData, set);
      default:             return <Text style={s.errText}>Loại tài liệu không xác định.</Text>;
    }
  };

  if (!info) {
    return (
      <View style={s.errContainer}>
        <Text style={s.errText}>Không tìm thấy loại tài liệu.</Text>
      </View>
    );
  }

  if (!initialLoaded) {
    return (
      <View style={s.errContainer}>
        <ActivityIndicator size="large" color="#15803D" />
      </View>
    );
  }

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="RecordVault">
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backBtnText}>← Quay lại</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{info.icon} {info.label}</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Common meta fields */}
          <View style={s.metaCard}>
            <Text style={s.metaTitle}>Thông tin lượt khám</Text>
            <Row>
              <F label="Tên bệnh viện" value={hospitalName} onChange={setHospitalName} half placeholder="VD: BV Tâm Trí Đà Nẵng" />
              <F label="Ngày khám / ngày tài liệu" value={visitDate} onChange={setVisitDate} half placeholder="dd/mm/yyyy" />
            </Row>
          </View>

          {/* Form content */}
          <View style={s.formCard}>
            {renderForm()}
          </View>

          {/* Save button */}
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={s.saveBtnText}>Lưu tài liệu</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </ResponsiveLayout>
  );
};

/* ─── Styles ─── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  errContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errText: { color: '#DC2626', fontSize: 14 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  backBtn: { paddingVertical: 4, marginRight: 12 },
  backBtnText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  headerTitle: { fontSize: 15, fontWeight: 'bold', color: '#0F172A', flex: 1 },
  scroll: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 40 },
  metaCard: {
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#D1FAE5',
    borderRadius: 14, padding: 14, marginBottom: 12,
  },
  metaTitle: { fontSize: 12, fontWeight: 'bold', color: '#15803D', marginBottom: 10 },
  formCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: 'bold', color: '#0F172A',
    marginTop: 16, marginBottom: 12,
    paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  row: { flexDirection: 'row', gap: 10 },
  field: { marginBottom: 12, flex: 1 },
  fieldHalf: { flex: 1 },
  noMargin: { marginBottom: 0 },
  label: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 11, paddingVertical: 9,
    fontSize: 13, color: '#0F172A', backgroundColor: '#F8FAFC',
  },
  textArea: { minHeight: 76, paddingTop: 9 },
  radioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radioBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  radioBtnActive: { backgroundColor: '#15803D', borderColor: '#15803D' },
  radioBtnText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  radioBtnTextActive: { color: '#FFFFFF' },
  cbRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, paddingVertical: 2 },
  cbIndent: { marginLeft: 8 },
  cb: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
    borderColor: '#CBD5E1', backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1, flexShrink: 0,
  },
  cbChecked: { backgroundColor: '#15803D', borderColor: '#15803D' },
  cbTick: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold', lineHeight: 16 },
  cbLabel: { fontSize: 13, color: '#475569', flex: 1, lineHeight: 20 },
  cbLabelActive: { color: '#0F172A', fontWeight: '500' },
  dynRow: { flexDirection: 'row', gap: 6, marginBottom: 10, alignItems: 'flex-start' },
  dynCell: { flex: 1 },
  dynCellLabel: { fontSize: 10, color: '#94A3B8', marginBottom: 3, fontWeight: '600' },
  dynInput: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 7, fontSize: 12, color: '#0F172A', backgroundColor: '#F8FAFC',
  },
  dynRemove: {
    marginTop: 16, paddingHorizontal: 8, paddingVertical: 8,
    borderRadius: 8, backgroundColor: '#FEF2F2',
  },
  dynRemoveText: { fontSize: 12, color: '#DC2626' },
  addRowBtn: {
    paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: '#D1FAE5', borderStyle: 'dashed',
    alignItems: 'center', marginBottom: 8, backgroundColor: '#F0FDF4',
  },
  addRowBtnText: { fontSize: 13, color: '#15803D', fontWeight: '600' },
  refRange: {
    fontSize: 11, color: '#64748B', backgroundColor: '#F8FAFC',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    marginBottom: 10, lineHeight: 16,
  },
  noteText: {
    fontSize: 12, color: '#64748B', fontStyle: 'italic',
    marginTop: 4, marginBottom: 8, lineHeight: 18,
  },
  saveBtn: {
    paddingVertical: 16, borderRadius: 14,
    backgroundColor: '#15803D', alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: 'bold', color: '#FFFFFF' },
});

export default DocumentFormScreen;
