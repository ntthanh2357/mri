export const VAULT_KEY = '@neuroscan_doc_vault';

export const DOC_TYPES = {
  KHAM_BENH: 'kham_benh',
  VIEN_PHI: 'vien_phi',
  TOM_TAT_HSBA: 'tom_tat_hsba',
  CHI_DINH_DV: 'chi_dinh_dv',
  TOA_THUOC: 'toa_thuoc',
  GIAY_RA_VIEN: 'giay_ra_vien',
  CHUYEN_TUYEN: 'chuyen_tuyen',
  HUYET_HOC: 'huyet_hoc',
  HOA_SINH: 'hoa_sinh',
  CT_SCAN: 'ct_scan',
  MRI: 'mri',
  CAM_KET_PT: 'cam_ket_pt',
};

export const DOC_TYPE_INFO = {
  kham_benh:    { label: 'Phiếu thông tin khám bệnh', group: 1, icon: '🏥' },
  vien_phi:     { label: 'Phiếu thu viện phí',         group: 1, icon: '🧾' },
  tom_tat_hsba: { label: 'Tóm tắt hồ sơ bệnh án',     group: 1, icon: '📄' },
  chi_dinh_dv:  { label: 'Phiếu chỉ định dịch vụ',    group: 2, icon: '📋' },
  toa_thuoc:    { label: 'Toa thuốc điều trị',          group: 2, icon: '💊' },
  giay_ra_vien: { label: 'Giấy ra viện',                group: 2, icon: '🏠' },
  chuyen_tuyen: { label: 'Phiếu chuyển tuyến TT01',   group: 2, icon: '🚑' },
  huyet_hoc:    { label: 'Kết quả xét nghiệm huyết học', group: 3, icon: '🩸' },
  hoa_sinh:     { label: 'Kết quả hóa sinh máu',       group: 3, icon: '🧪' },
  ct_scan:      { label: 'Kết quả CT-Scan',             group: 3, icon: '🖼️' },
  mri:          { label: 'Kết quả MRI',                 group: 3, icon: '🧠' },
  cam_ket_pt:   { label: 'Giấy cam kết phẫu thuật',    group: 5, icon: '✍️' },
};

export const GROUPS = {
  1: 'Nhóm 1 — Hành chính & tài chính',
  2: 'Nhóm 2 — Lâm sàng (nhận từ bác sĩ)',
  3: 'Nhóm 3 — Cận lâm sàng',
  5: 'Nhóm 5 — Pháp lý / có chữ ký',
};

export const createEmptyFormData = (type) => {
  switch (type) {
    case 'kham_benh':
      return {
        hoTen: '', dienThoai: '', gioiTinh: '', tuoi: '', ngayTiepNhan: '',
        diaChi: '', phuongXa: '', tinhThanh: '', yeuCau: '',
        mach: '', huyetAp: '', chieuCao: '', canNang: '', nhipTho: '', bmi: '', nhietDo: '', spo2: '',
      };
    case 'vien_phi':
      return {
        soPhieu: '', maBenhNhan: '', hoTen: '', ngaySinh: '', diaChi: '', gioiTinh: '',
        soBHYT: '', doiTuong: '', sdt: '', inLanThu: '1',
        dichVus: [{ tenDichVu: '', soLuong: '1', donGia: '', thanhTien: '' }],
        tongChiPhi: '', soTienBangChu: '',
      };
    case 'tom_tat_hsba':
      return {
        loaiYeuCau: 'ban_tom_tat',
        tenNguoiViet: '', diaChi: '', cccd: '', dienThoai: '',
        vaiTro: 'nguoi_benh', quanHe: '',
        ngayNhapVien: '', ngayRaVien: '', soHoSo: '', maSoBenhNhan: '',
        yeuCauCuThe: '', mucDich: '',
      };
    case 'chi_dinh_dv':
      return {
        soBA: '', soBHYT: '', loai: 'thuong',
        hoTen: '', gioiTinh: '', tuoi: '', dienThoai: '', diaChi: '', khoa: '', chanDoan: '',
        dichVus: [{ yeuCau: '', soLuong: '1', donGia: '' }],
        bacSiDieuTri: '', ngayGio: '',
      };
    case 'toa_thuoc':
      return {
        maYTe: '', soHoSo: '', hoTen: '', gioiTinh: '', tuoi: '',
        nguoiGiamHo: '', cmnd: '', diaChi: '', doiTuong: '', chanDoan: '', benhKemTheo: '',
        thuocs: [{ tenThuoc: '', lieu: '', soLuong: '', cachDung: '' }],
        loiDan: '',
      };
    case 'giay_ra_vien':
      return {
        hoTen: '', ngaySinh: '', tuoi: '', gioiTinh: '', danToc: '', ngheNghiep: '',
        cccd: '', ngayCap: '', maBHXH: '', soBHYT: '', diaChi: '',
        vaoVienGio: '', vaoVienPhut: '', vaoVienNgay: '', vaoVienThang: '', vaoVienNam: '',
        raVienGio: '', raVienPhut: '', raVienNgay: '', raVienThang: '', raVienNam: '',
        chanDoan: '', phuongPhapDieuTri: '', ghiChu: '',
      };
    case 'chuyen_tuyen':
      return {
        kinhGui: '', coSoKCB: '',
        hoTen: '', gioiTinh: '', namSinh: '', diaChi: '', danToc: '', quocTich: 'Việt Nam',
        ngheNghiep: '', noiLamViec: '', soBHYT: '', thoiHanBHYT: '',
        daKhamTais: [{ cap: '', tuNgay: '', denNgay: '' }],
        dauHieuLamSang: '', ketQuaXN: '', chanDoanBenhChinh: '',
        phuongPhap: '', thoiGianPP: '', thuocDieuTri: '', tinhTrang: '',
        lyDoChuyen: 'phu_hop_cm',
        huongDieuTri: '', thoiGianChuyen: '', phuongTien: '', nguoiHoTong: '',
      };
    case 'huyet_hoc':
      return {
        soVaoVien: '', soPhieu: '', maYTe: '',
        namSinh: '', gioiTinh: '', diaChi: '', khoa: '', chanDoan: '',
        gioNhanMau: '', doiTuong: '', noiLayMau: '', bsChiDinhXN: '',
        wbc: '', neuPct: '', neuAbs: '', lymPct: '', lymAbs: '',
        monoPct: '', monoAbs: '', eosPct: '', eosAbs: '', basPct: '', basAbs: '',
        rbc: '', hgb: '', hct: '', mcv: '', mch: '', mchc: '', rdw: '',
        plt: '', mpv: '', pct_plt: '', pdw: '',
        hflcPct: '', hflcAbs: '', igPct: '', igAbs: '', nrbcPct: '', nrbcAbs: '',
        bacSiXN: '', truongKhoa: '',
      };
    case 'hoa_sinh':
      return {
        soYTe: '', benhVien: '', loai: 'thuong', so: '',
        hoTen: '', tuoi: '', gioiTinh: '', diaChi: '', soBHYT: '',
        khoa: '', buong: '', giuong: '', chanDoan: '',
        ure: '', glucose: '', creatininNam: '', creatininNu: '', acidUric: '',
        bilirubinTP: '', bilirubinTT: '', bilirubinGT: '',
        proteinTP: '', albumin: '', globulin: '', tyLeAG: '',
        cholesterol: '', triglycerid: '', hdlCho: '', ldlCho: '',
        naPlus: '', kPlus: '', clMinus: '', calci: '', calciIon: '', phospho: '',
        sat: '', magie: '', ast: '', alt: '', amylase: '',
        ck: '', ckMb: '', ldh: '', ggt: '', cholinesterase: '', phosphataseKiem: '', fibrinogen: '',
        pH: '', pCO2: '', pO2: '', hco3: '', kiemDu: '',
        bacSiDieuTri: '', truongKhoaXN: '',
      };
    case 'ct_scan':
    case 'mri':
      return {
        gioiTinh: '', namSinh: '', hoTen: '', diaChi: '',
        ngayChiDinh: '', bacSiChiDinh: '', noiChiDinh: '', soBA: '', chanDoan: '',
        kyThuat: '', moTaHinhAnh: '', ketLuan: '',
        bacSiChuyenKhoa: '', ngayGio: '',
      };
    case 'cam_ket_pt':
      return {
        tenBS: '', chucDanh: '', khoa: '', bsGayMe: '',
        tenBN: '', chanDoan: '',
        tuVan: { chanDoan: false, lyDoPT: false, ruiRo: false, ketQua: false },
        phuongPhapPT: { moMo: false, noiSoi: false, thuThuat: false },
        phuongPhapGayMe: { meNKQ: false, meMask: false, meTinhMach: false, teTuySong: false, teNgoaiMang: false, teDamRoi: false, tienMeTeTaiCho: false, khacGayMe: false },
        dieuTriKhac: 'khong', ghiRoDieuTri: '',
        nguyCo: { phanUngThuoc: false, suuHoHap: false, chayMau: false, nhiemTrung: false, tuVong: false, nguyCo_khac: false },
        tenBNII: '', namSinhBN: '', tenThanNhan: '', namSinhTN: '', quanHe: '',
        quyetDinh: 'dong_y',
      };
    default:
      return {};
  }
};
