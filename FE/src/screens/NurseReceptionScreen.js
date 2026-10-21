import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { get, post, put } from '../services/api.service';
import ResponsiveLayout from '../components/ResponsiveLayout';
import ClinicalStatusBadge from '../components/ClinicalStatusBadge';
import {
  ClipboardList, ShieldCheck, Search, Sparkles, UserPlus, Wallet, Stethoscope, HeartPulse, ScanLine,
  BadgeCheck, Hourglass, Inbox, RefreshCw, ArrowRight, Check, X, Banknote, QrCode, ReceiptText,
  Printer, Undo2, Lock, Siren, IdCard, Ticket,
} from 'lucide-react';
import QueueDesk from '../components/staff/QueueDesk';
import { useQueueDesk } from '../controllers/useQueueDesk';
import QRCodeLib from 'qrcode';
import { Reveal } from '../components/ui/Motion';
import { useAppDialog } from '../components/ui/AppDialog';
import { ReceptionBanner, RECEPTION_IMAGES, Avatar, EmptyState, formatVnd, personName } from '../components/reception/ReceptionUI';

// UC-REC-03 — Phòng khám chuyên khoa Thần kinh để phân luồng
const CLINIC_ROOMS = ['Phòng khám Thần kinh 01', 'Phòng khám Thần kinh 02', 'Phòng khám Thần kinh 03'];
// UC-REC-09 — Lý do hoàn trả viện phí thường gặp
const REFUND_REASONS = [
  'Hủy chỉ định chụp MRI do chống chỉ định (máy tạo nhịp tim / kim loại từ tính)',
  'Bệnh nhân sợ buồng kín, không thể chụp',
  'Thu trùng / thu nhầm dịch vụ',
  'Bệnh nhân hủy dịch vụ trước khi thực hiện',
];
// UC-REC-02 — Kiểm tra mã thẻ BHYT theo cấu trúc của BHXH (chưa kết nối cổng giám định → lễ tân xác minh tay)
// Mã thẻ 15 ký tự: [2 chữ mã đối tượng][1 số mức hưởng 1–5][2 số mã tỉnh][10 số mã BHXH]
const BHYT_OBJECT_CODES = [
  'DN', 'HX', 'CH', 'NN', 'TK', 'HC', 'XK', 'HT', 'TB', 'NO', 'CT', 'XB', 'TN', 'CS', 'XN', 'MS',
  'QN', 'CA', 'CY', 'HG', 'TC', 'CC', 'CK', 'CB', 'KC', 'HD', 'TE', 'BT', 'HN', 'DT', 'DK', 'XD',
  'TS', 'TQ', 'TA', 'TY', 'HS', 'SV', 'GB', 'GD', 'ND', 'TH', 'TV', 'TL', 'XV', 'PV', 'AK', 'CN',
];
const BHYT_LEVEL_RATE = { 1: 100, 2: 100, 3: 95, 4: 80, 5: 100 };

const parseBhytCard = (raw) => {
  const cardNumber = String(raw || '').replace(/\s/g, '').toUpperCase();
  if (!cardNumber) return { ok: false, empty: true, error: 'Chưa nhập mã thẻ.' };
  if (!/^[A-Z]{2}\d{13}$/.test(cardNumber)) {
    return { ok: false, error: `Cần 15 ký tự: 2 chữ cái + 13 chữ số (đang có ${cardNumber.length} ký tự).` };
  }
  const objectCode = cardNumber.slice(0, 2);
  if (!BHYT_OBJECT_CODES.includes(objectCode)) return { ok: false, error: `Mã đối tượng "${objectCode}" không có trong danh mục của BHXH.` };
  const benefitLevel = Number(cardNumber[2]);
  const coverageRate = BHYT_LEVEL_RATE[benefitLevel];
  if (!coverageRate) return { ok: false, error: `Ký tự thứ 3 (mức hưởng) phải từ 1 đến 5, thẻ đang ghi "${cardNumber[2]}".` };
  return { ok: true, cardNumber, objectCode, benefitLevel, coverageRate };
};

// Ô ngày: người dùng chỉ gõ số, hệ thống tự chèn dấu '-' theo dạng YYYY-MM-DD (gõ 20271231 → 2027-12-31)
// Kiểm tra ngày có thật trên lịch (tháng 1–12, ngày theo tháng, năm nhuận) → trả về câu báo lỗi hoặc null
const dateIssue = (str, { minYear = 1900, maxYear = 2100, notFuture = false } = {}) => {
  if (!str) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return 'Sai định dạng ngày tháng';
  const [y, m, d] = str.split('-').map(Number);
  const invalid = y < minYear || y > maxYear || m < 1 || m > 12 || d < 1 || d > new Date(y, m, 0).getDate()
    || (notFuture && new Date(y, m - 1, d) > new Date());
  return invalid ? 'Ngày không hợp lệ' : null;
};

const formatDateDigits = (text) => {
  const d = String(text || '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
};

// Email liên hệ thật (tài khoản tạo tại quầy trước đây dùng địa chỉ nội bộ *.local)
const hasRealEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '')) && !String(email).toLowerCase().endsWith('.local');

const normName = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
// Đặt thông tin in trên thẻ cạnh hồ sơ → 'ok' | 'mismatch' | 'na' (một bên chưa có dữ liệu)
const compareHolderRows = (profile = {}, holder = {}) => {
  const year = Number(String(holder.birthDate || '').slice(0, 4)) || null;
  const row = (label, card, file, same) => ({ label, card: card || '—', file: file || '—', state: !card || !file ? 'na' : same ? 'ok' : 'mismatch' });
  return [
    row('Họ tên', holder.name, profile?.name, normName(holder.name) === normName(profile?.name)),
    row('Năm sinh', year ? String(year) : '', profile?.birthYear ? String(profile.birthYear) : '', year === Number(profile?.birthYear)),
    row('Giới tính', holder.gender, profile?.gender, holder.gender === profile?.gender),
  ];
};

const NurseReceptionScreen = ({ route, navigation }) => {
  const { dialog, confirm: confirmDialog, notify } = useAppDialog();
  const [activeTab, setActiveTab] = useState(route.params?.tab || 'createVisit'); // 'createVisit' | 'callQueue' | 'myQueue' | 'billing'
  // UC-PAT-03: số thứ tự bệnh nhân lấy online
  const queueDesk = useQueueDesk();
  const queueWaiting = queueDesk.tickets.filter((t) => ['waiting', 'arrived', 'missed'].includes(t.status)).length;
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(route.params?.user || null);

  useEffect(() => {
    if (route.params?.tab) {
      setActiveTab(route.params.tab);
    }
  }, [route.params?.tab]);

  // createVisit Tab State
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [searchPatient, setSearchPatient] = useState('');

  const [selectedPatientId, setSelectedPatientId] = useState('');
  // Tiếp nhận số → sang form tạo lượt khám, chọn sẵn bệnh nhân (kể cả khi danh sách bệnh nhân chưa có người này)
  const serveFromQueue = (patient) => {
    if (!patient?._id) return;
    setPatients((prev) => (prev.some((p) => p._id === patient._id) ? prev : [patient, ...prev]));
    setSelectedPatientId(patient._id);
    setActiveTab('createVisit');
  };
  // Từ trang "Tiếp nhận" (điều dưỡng): đã tiếp nhận số online → mở sẵn form tạo lượt khám cho bệnh nhân đó
  useEffect(() => {
    if (route.params?.queuePatient) serveFromQueue(route.params.queuePatient);
  }, [route.params?.queuePatient]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedNurseId, setSelectedNurseId] = useState('');
  const [reason, setReason] = useState('');
  const [visitType, setVisitType] = useState('Ngoại trú');

  // myQueue / All Visits State
  const [visits, setVisits] = useState([]);

  // billing State
  const [invoices, setInvoices] = useState([]);

  // BHYT Card state
  const [showBhytModal, setShowBhytModal] = useState(false);
  const [bhytCardNumber, setBhytCardNumber] = useState('');
  const [bhytExpiryDate, setBhytExpiryDate] = useState('');
  const [bhytRegistrationPlace, setBhytRegistrationPlace] = useState('');
  const [bhytTreatmentType, setBhytTreatmentType] = useState('outpatient');
  const [bhytIsOutOfNetwork, setBhytIsOutOfNetwork] = useState(false);
  const [bhytHasTransferForm, setBhytHasTransferForm] = useState(false);
  const [savingBhyt, setSavingBhyt] = useState(false);
  const [applyingBhytId, setApplyingBhytId] = useState(null);
  // UC-REC-02 (đơn giản hóa): lễ tân đối chiếu thẻ gốc bằng tay rồi tick xác nhận
  const [bhytVerified, setBhytVerified] = useState(false);
  // Đối soát thông tin in trên thẻ với hồ sơ bệnh nhân
  const [holderName, setHolderName] = useState('');
  const [holderBirthDate, setHolderBirthDate] = useState('');
  const [holderGender, setHolderGender] = useState('');
  const [mismatchNote, setMismatchNote] = useState('');
  // Thẻ đang dùng: của bệnh nhân đang mở modal + tóm tắt của cả viện (gắn nhãn ở danh sách)
  const [activeCard, setActiveCard] = useState(null);
  const [activeCards, setActiveCards] = useState({});

  const fetchActiveCards = async () => {
    try {
      const res = await get('/api/v1/bhyt/active-cards');
      const map = {};
      (res?.data || []).forEach((c) => { map[String(c.patientId)] = c; });
      setActiveCards(map);
    } catch { /* nhãn BHYT chỉ để tham khảo, lỗi thì bỏ qua */ }
  };

  // UC-PAT-02 — thẻ BHYT bệnh nhân tự khai trên app, lễ tân đối chiếu thẻ thật rồi xác nhận
  const [declared, setDeclared] = useState({ loading: false, data: null });
  const loadDeclaredCard = async (pid) => {
    setDeclared({ loading: true, data: null });
    try {
      const res = await get(`/api/v1/patient/profile/identity?patientId=${pid}`);
      setDeclared({ loading: false, data: res?.data?.bhyt?.cardNumber ? res.data : null });
    } catch {
      setDeclared({ loading: false, data: null });
    }
  };
  // Điền sẵn mã thẻ / hạn / nơi ĐK theo thẻ tự khai — lễ tân vẫn phải đối chiếu thẻ gốc và tick xác nhận
  const fillFromDeclared = () => {
    const b = declared.data?.bhyt;
    if (!b) return;
    setBhytCardNumber(String(b.cardNumber || '').replace(/s/g, '').toUpperCase());
    if (b.registrationPlace) setBhytRegistrationPlace(b.registrationPlace);
    if (b.expiresAt) setBhytExpiryDate(new Date(b.expiresAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }));
  };
  /** Sau khi lưu thẻ thật: khớp số thẻ tự khai → xác nhận; khác → báo bệnh nhân thông tin chưa đúng. */
  const reviewDeclaredCard = async (savedCard) => {
    const b = declared.data?.bhyt;
    if (!b?.cardNumber || b.status === 'verified') return '';
    const action = String(b.cardNumber).replace(/s/g, '').toUpperCase() === savedCard ? 'verify' : 'reject';
    try {
      await put(`/api/v1/patient/profile/identity/bhyt-review?patientId=${selectedPatientId}`, { action });
      return action === 'verify' ? ' Đã xác nhận thẻ bệnh nhân tự khai trên app.' : ' Số thẻ bệnh nhân tự khai không khớp thẻ gốc, đã báo bệnh nhân kiểm tra lại.';
    } catch {
      return '';
    }
  };

  // Mở modal: nạp thẻ đang dùng để xem lại, form để trống cho trường hợp khai báo thẻ mới / gia hạn
  const openBhytModal = async (pid = selectedPatientId) => {
    if (pid !== selectedPatientId) setSelectedPatientId(pid);
    setBhytCardNumber('');
    setBhytExpiryDate('');
    setBhytRegistrationPlace('');
    setBhytIsOutOfNetwork(false);
    setBhytHasTransferForm(false);
    setBhytVerified(false);
    setHolderName(''); // không điền sẵn từ hồ sơ: lễ tân nhập theo thẻ, hệ thống so ngầm
    setHolderBirthDate('');
    setHolderGender('');
    setMismatchNote('');
    setActiveCard(null);
    setShowBhytModal(true);
    loadDeclaredCard(pid);
    try {
      const res = await get(`/api/v1/bhyt/${pid}/active`);
      setActiveCard(res?.data || null);
    } catch { setActiveCard(null); }
  };

  // Kiểm tra mã thẻ ngay khi nhập: mã đối tượng, mức hưởng → tỷ lệ chi trả tự động
  const cardCheck = parseBhytCard(bhytCardNumber);
  const bhytCoverageRate = cardCheck.ok ? cardCheck.coverageRate : null;
  const expiryError = dateIssue(bhytExpiryDate, { minYear: 2000, maxYear: 2100 });
  const expiryValid = !!bhytExpiryDate && !expiryError;
  const expiryExpired = expiryValid && new Date(`${bhytExpiryDate}T23:59:59`) < new Date();
  const birthError = dateIssue(holderBirthDate, { minYear: 1900, maxYear: new Date().getFullYear(), notFuture: true });
  const bhytPatient = patients.find((x) => x._id === selectedPatientId);
  // Ngày sinh sai thì không đem đi đối soát (chỉ báo lỗi ngày)
  const holderRows = compareHolderRows(bhytPatient?.profile, { name: holderName, birthDate: birthError ? '' : holderBirthDate, gender: holderGender });
  const holderMismatches = holderRows.filter((r) => r.state === 'mismatch').map((r) => r.label);
  const canSaveBhyt = cardCheck.ok && expiryValid && !expiryExpired && !birthError && bhytVerified
    && (!holderMismatches.length || mismatchNote.trim().length > 0);

  const handleBhytCardChange = (text) => setBhytCardNumber(text.replace(/\s/g, '').toUpperCase());

  const handleSaveBhyt = async () => {
    if (!selectedPatientId) {
      notify('Thông báo', 'Vui lòng chọn bệnh nhân trước khi khai báo thẻ BHYT.');
      return;
    }
    if (!cardCheck.ok) { notify('Thông báo', cardCheck.error); return; }
    if (!expiryValid) { notify('Hạn thẻ không hợp lệ', expiryError || 'Vui lòng nhập hạn thẻ (gõ 8 số, VD: 20271231).'); return; }
    if (birthError) { notify('Ngày sinh không hợp lệ', birthError); return; }
    if (expiryExpired) { notify('Thẻ đã hết hạn', 'Thẻ BHYT đã quá hạn sử dụng. Bệnh nhân cần gia hạn thẻ hoặc tự chi trả.', 'error'); return; }
    if (holderMismatches.length && !mismatchNote.trim()) {
      notify('Thông báo', `Thông tin trên thẻ lệch với hồ sơ (${holderMismatches.join(', ')}). Kiểm tra lại hoặc ghi lý do chênh lệch.`);
      return;
    }
    if (!bhytVerified) {
      notify('Thông báo', 'Vui lòng đối chiếu thẻ BHYT gốc với giấy tờ tùy thân của bệnh nhân rồi tick xác nhận.');
      return;
    }
    setSavingBhyt(true);
    try {
      const res = await post(`/api/v1/bhyt/${selectedPatientId}`, {
        cardNumber: cardCheck.cardNumber,
        expiresAt: bhytExpiryDate,
        registrationPlace: bhytRegistrationPlace.trim(),
        treatmentType: bhytTreatmentType,
        isOutOfNetwork: bhytIsOutOfNetwork,
        hasTransferForm: bhytHasTransferForm,
        holderName: holderName.trim(),
        holderBirthDate: holderBirthDate.trim(),
        holderGender,
        mismatchNote: mismatchNote.trim(),
        manuallyVerified: true,
      });
      if (res && res.success) {
        setShowBhytModal(false);
        setBhytVerified(false);
        fetchActiveCards();
        const reviewNote = await reviewDeclaredCard(cardCheck.cardNumber);
        notify('Thành công', `Đã lưu thẻ BHYT ${cardCheck.objectCode} — mức hưởng ${cardCheck.benefitLevel} (${bhytCoverageRate}%).${activeCard && !cardCheck.cardNumber.endsWith(activeCard.cardMasked.slice(-4)) ? ' Thẻ cũ đã chuyển vào lịch sử.' : ''} Khi thu ngân, bấm "Áp dụng BHYT" để khấu trừ vào hóa đơn.${reviewNote}`);
      } else {
        notify('Lỗi', res?.message || 'Không thể lưu BHYT.');
      }
    } catch (err) {
      notify('Lỗi', err.message || 'Không thể lưu thông tin thẻ BHYT.');
    } finally {
      setSavingBhyt(false);
    }
  };

  // Máy chủ tự dùng thẻ đang hiệu lực của bệnh nhân trên hóa đơn và báo rõ lý do nếu không áp dụng được
  const handleApplyBhyt = async (invoice) => {
    setApplyingBhytId(invoice._id);
    try {
      const applyRes = await put(`/api/v1/bhyt/apply-to-invoice/${invoice._id}`, {});
      if (applyRes && applyRes.success) {
        const d = applyRes.data || {};
        if (d.patientCopayAmount === 0 && d.bhytAmount > 0) {
          // BHYT chi trả 100% → bệnh nhân không phải trả gì: tự xác nhận thanh toán, bỏ qua bước thu tiền
          await confirmBhytFullPayment(invoice._id, d.bhytAmount);
        } else {
          notify('Đã áp dụng BHYT', `BHYT chi trả ${formatVnd(d.bhytAmount)} (${d.coverageRate}%) — bệnh nhân còn trả ${formatVnd(d.patientCopayAmount)}.`);
          fetchInvoices();
        }
      } else {
        notify('Lỗi', applyRes.message || 'Không thể áp dụng BHYT.');
      }
    } catch (err) {
      notify('Chưa áp dụng được BHYT', err.message || 'Không thể áp dụng BHYT vào hóa đơn.', 'error');
    } finally {
      setApplyingBhytId(null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!user) {
      get('/auth/me')
        .then(res => { if (isMounted) setUser(res.user); })
        .catch(() => { if (isMounted) notify("Lỗi", "Vui lòng đăng nhập lại"); });
    }
    return () => { isMounted = false; };
  }, [user]);

  useEffect(() => {
    if (route.params?.tab) {
      setActiveTab(route.params.tab);
    }
  }, [route.params?.tab]);

  useEffect(() => {
    let isMounted = true;
    if (activeTab === 'createVisit') {
      fetchStaffAndPatients();
    } else if (activeTab === 'myQueue') {
      fetchVisits();
    } else if (activeTab === 'billing') {
      fetchInvoices();
    }
    return () => { isMounted = false; };
  }, [activeTab]);

  // ── UC-REC-01: tra cứu bệnh nhân (tên / email / mã y tế lọc tại chỗ; SĐT / CCCD tra trên máy chủ) ──
  const [serverMatchIds, setServerMatchIds] = useState([]);
  useEffect(() => {
    if (!searchPatient.trim()) { setServerMatchIds([]); return undefined; }
    const timer = setTimeout(async () => {
      try {
        const res = await get(`/api/patients?all=true&search=${encodeURIComponent(searchPatient.trim())}`);
        if (res && res.success && Array.isArray(res.data)) {
          setServerMatchIds(res.data.map((p) => p._id));
          // Trộn và loại bỏ trùng lặp với danh sách bệnh nhân hiện tại
          setPatients(prev => {
            const map = new Map();
            [...res.data, ...prev].forEach(p => map.set(p._id, p));
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn('Lỗi tìm kiếm bệnh nhân trực tiếp:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchPatient]);

  const fetchStaffAndPatients = async () => {
    setLoading(true);
    try {
      // [BUG FIX]: Truyền ?all=true để tải trọn vẹn danh sách bệnh nhân cơ sở thay vì bị cắt ở 20 người
      const ptRes = await get('/api/patients?all=true');
      if (ptRes.success) setPatients(ptRes.data || []);
      fetchActiveCards();

      // Fetch Staff
      const stRes = await get('/api/v1/visits/staff');
      setDoctors(stRes.doctors || []);
      setNurses(stRes.nurses || []);
    } catch (err) {
      console.error(err);
      notify('Lỗi', err.message || 'Không thể tải danh sách bệnh nhân và nhân sự.');
    } finally {
      setLoading(false);
    }
  };

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const res = await get('/api/v1/visits/my-queue');
      setVisits(res.visits || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      // Receptionist views all unpaid invoices
      const res = await get('/api/v1/invoices');
      setInvoices(res.invoices || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── UC-REC-01: tạo hồ sơ bệnh nhân mới tại quầy ─────────────────────────────
  const EMPTY_PATIENT = { name: '', phone: '', cccd: '', birthYear: '', gender: '', address: '', email: '', priority: 'trung bình' };
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState(EMPTY_PATIENT);
  const [creatingPatient, setCreatingPatient] = useState(false);

  const openNewPatient = () => {
    // Điền sẵn từ ô tìm kiếm: 12 số → CCCD, 10 số → SĐT, còn lại → họ tên
    const q = searchPatient.trim();
    const digits = q.replace(/\D/g, '');
    setNewPatient({
      ...EMPTY_PATIENT,
      cccd: /^\d{12}$/.test(q) ? q : '',
      phone: /^(0|\+84)\d{9,10}$/.test(q.replace(/\s/g, '')) ? q.replace(/\s/g, '') : '',
      name: digits.length < 6 ? q : '',
    });
    setShowNewPatient(true);
  };

  const handleCreatePatient = async () => {
    const emergency = newPatient.priority === 'khẩn cấp';
    if (!emergency && !newPatient.name.trim()) { notify('Thông báo', 'Vui lòng nhập họ tên bệnh nhân.'); return; }
    if (!emergency && !newPatient.phone.trim() && !newPatient.cccd.trim()) { notify('Thông báo', 'Cần ít nhất số điện thoại hoặc CCCD để định danh bệnh nhân.'); return; }
    if (!emergency && !hasRealEmail(newPatient.email)) { notify('Thiếu email', 'Vui lòng nhập email hợp lệ của bệnh nhân để nhận thông báo lịch khám, dời lịch chụp và hoàn tiền.'); return; }
    setCreatingPatient(true);
    try {
      const { priority, ...profile } = newPatient;
      const res = await post('/api/patients', {
        ...profile,
        emergency,
        birthYear: newPatient.birthYear ? Number(newPatient.birthYear) : null,
      });
      const p = res.data;
      setPatients((prev) => [p, ...prev]);
      setSelectedPatientId(p._id);
      setVisitPriority(priority); // mang mức ưu tiên sang bước 4 của lượt khám
      setSearchPatient('');
      setShowNewPatient(false);
      notify(
        emergency ? 'Đã tạo hồ sơ cấp cứu' : 'Thành công',
        `Đã tạo hồ sơ cho ${p.profile?.name} — mã y tế ${p.profile?.medicalId}. Bệnh nhân đã được chọn ở bước 1${emergency ? ', mức ưu tiên đã đặt sẵn là CẤP CỨU' : ''}.`,
        emergency ? 'info' : undefined,
      );
    } catch (err) {
      notify('Lỗi', err.message || 'Không thể tạo hồ sơ bệnh nhân.');
    } finally {
      setCreatingPatient(false);
    }
  };

  // ── UC-REC-04: bổ sung email nhận thông báo cho bệnh nhân cũ chưa có email ─────
  const [emailDraft, setEmailDraft] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  useEffect(() => { setEmailDraft(''); }, [selectedPatientId]);
  const handleSavePatientEmail = async () => {
    if (!selectedPatientId || !hasRealEmail(emailDraft)) return;
    setSavingEmail(true);
    try {
      const res = await put(`/api/patients/${selectedPatientId}/email`, { email: emailDraft });
      setPatients((prev) => prev.map((p) => (p._id === selectedPatientId ? { ...p, email: res?.data?.email || emailDraft } : p)));
      notify('Đã lưu email', `Bệnh nhân sẽ nhận thông báo lịch khám, dời lịch chụp và hoàn tiền qua ${emailDraft}.`);
    } catch (err) {
      notify('Lỗi', err.message || 'Không thể cập nhật email.');
    } finally {
      setSavingEmail(false);
    }
  };

  // ── UC-REC-03: tạo lượt khám = cấp số thứ tự + phân luồng phòng khám + cờ ưu tiên ──
  const [visitPriority, setVisitPriority] = useState('trung bình');
  const [clinicRoom, setClinicRoom] = useState(CLINIC_ROOMS[0]);
  const [queueTicket, setQueueTicket] = useState(null);

  const handleCreateVisit = async () => {
    if (!selectedPatientId || !selectedDoctorId || !selectedNurseId || !reason.trim()) {
      notify('Thông báo', 'Vui lòng hoàn thành đủ 4 bước: chọn bệnh nhân, bác sĩ, điều dưỡng và nhập lý do khám.');
      return;
    }
    setLoading(true);
    try {
      const res = await post('/api/v1/visits', {
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        nurseId: selectedNurseId,
        reason: reason.trim(),
        visitType,
        priority: visitPriority,
        clinicRoom,
      });
      const patient = patients.find((p) => p._id === selectedPatientId);
      const doctor = doctors.find((d) => d._id === selectedDoctorId);
      setQueueTicket({ ...res.visit, patientName: personName(patient), medicalId: patient?.profile?.medicalId, doctorName: personName(doctor) });
      setSelectedPatientId('');
      setSelectedDoctorId('');
      setSelectedNurseId('');
      setReason('');
      setVisitType('Ngoại trú');
      setVisitPriority('trung bình');
    } catch (error) {
      if (/^Bệnh nhân đang trong hàng chờ/.test(error.message || '')) {
        // Đã có lượt khám chưa kết thúc → không tạo trùng, gợi ý mở hàng chờ
        const goQueue = await confirmDialog({
          title: 'Bệnh nhân đang trong hàng chờ',
          message: error.message,
          confirmText: 'Xem hàng chờ',
          cancelText: 'Đóng',
          type: 'info',
        });
        if (goQueue) setActiveTab('myQueue');
      } else {
        notify('Lỗi', error.message || 'Tạo lượt khám thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── In phiếu (web): mở cửa sổ in với nội dung HTML ─────────────────────────
  const printHtml = (title, body) => {
    if (typeof window === 'undefined') return;
    const w = window.open('', '_blank', 'width=420,height=640');
    if (!w) { notify('Thông báo', 'Trình duyệt đang chặn cửa sổ in. Vui lòng cho phép pop-up cho trang này.'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:Arial,sans-serif;padding:18px;color:#0f172a}h2{margin:0}small{color:#64748b}
      table{width:100%;border-collapse:collapse;margin-top:10px}td{padding:5px 0;border-bottom:1px dashed #cbd5e1;font-size:13px}
      .r{text-align:right}.big{font-size:56px;font-weight:900;text-align:center;margin:10px 0}.c{text-align:center}</style></head>
      <body>${body}<script>window.onload=()=>{window.print();}</script></body></html>`);
    w.document.close();
  };

  const printQueueTicket = (t) => printHtml('Phiếu số thứ tự', `
    <div class="c"><h2>NeuroScan AI</h2><small>Bệnh viện chuyên khoa U não</small></div>
    <p class="c" style="margin-top:14px">PHIẾU SỐ THỨ TỰ KHÁM</p>
    <div class="big">${t.priority === 'khẩn cấp' ? 'CC-' : ''}${String(t.queueNumber).padStart(3, '0')}</div>
    <table><tr><td>Bệnh nhân</td><td class="r">${t.patientName}</td></tr>
    <tr><td>Mã y tế</td><td class="r">${t.medicalId || '—'}</td></tr>
    <tr><td>Phòng khám</td><td class="r">${t.clinicRoom}</td></tr>
    <tr><td>Bác sĩ</td><td class="r">${t.doctorName}</td></tr>
    <tr><td>Ưu tiên</td><td class="r">${t.priority === 'khẩn cấp' ? 'CẤP CỨU' : 'Thường'}</td></tr></table>
    <p class="c"><small>${new Date(t.createdAt || Date.now()).toLocaleString('vi-VN')}</small></p>`);

  // ── UC-REC-07: in biên lai viện phí ────────────────────────────────────────
  const printReceipt = (inv) => {
    const bhyt = inv.bhytInfo?.bhytAmount || 0;
    const rows = (inv.items || []).map((it) => `<tr><td>${it.description}</td><td class="r">${formatVnd(it.amount)}</td></tr>`).join('');
    printHtml('Biên lai viện phí', `
      <div class="c"><h2>NeuroScan AI</h2><small>BIÊN LAI THU VIỆN PHÍ</small></div>
      <p><small>Bệnh nhân:</small> <b>${personName(inv.patientId)}</b><br/><small>Mã HĐ: #${String(inv._id).slice(-8).toUpperCase()} · ${new Date(inv.paidAt || Date.now()).toLocaleString('vi-VN')}</small></p>
      <table>${rows}
      <tr><td><b>Tổng chi phí</b></td><td class="r"><b>${formatVnd(inv.totalAmount)}</b></td></tr>
      <tr><td>BHYT chi trả${bhyt ? ` (${inv.bhytInfo.coverageRate}%)` : ''}</td><td class="r">-${formatVnd(bhyt)}</td></tr>
      <tr><td><b>Bệnh nhân đã trả</b></td><td class="r"><b>${formatVnd(owedOf(inv))}</b></td></tr></table>
      <p><small>Hình thức: ${inv.paymentMethod || 'tiền mặt'}</small></p>
      <p class="c" style="margin-top:28px"><small>Người thu tiền</small><br/><br/><b>${personName(user)}</b></p>`);
  };

  // BHYT chi trả 100%: ghi nhận "đã thanh toán" bằng BHYT (vẫn qua luồng thu tiền để trừ kho thuốc & đóng lượt khám)
  const confirmBhytFullPayment = async (invoiceId, bhytAmount) => {
    try {
      await put(`/api/v1/invoices/${invoiceId}/pay`, { paymentMethod: 'bhyt' });
      await fetchInvoices();
      notify('BHYT chi trả 100%', `BHYT chi trả toàn bộ${bhytAmount ? ` ${formatVnd(bhytAmount)}` : ''}, bệnh nhân không phải trả tiền. Hóa đơn đã tự chuyển sang "Đã thanh toán".`);
    } catch (err) {
      await fetchInvoices();
      notify('Chưa xác nhận được', err.message || 'Không thể xác nhận thanh toán bằng BHYT.', 'error');
    }
  };

  // Đối soát VietQR: hỏi PayOS mọi mã từng tạo cho hóa đơn (tiền về muộn / phát hiện thu trùng)
  const reconcileVietQR = async (invoiceId, { silent = false } = {}) => {
    try {
      const check = await post(`/api/v1/invoices/${invoiceId}/payos-check`);
      await fetchInvoices();
      if (silent) return check;
      if (check?.duplicate) {
        notify('Phát hiện thu trùng', `${check.duplicate.note} Số tiền dư: ${formatVnd(check.duplicate.amount)}.`, 'error');
      } else if (check?.paid) {
        notify('Đối soát VietQR', 'Hóa đơn đã thanh toán, không có khoản thu trùng.', 'success');
      } else {
        notify('Đối soát VietQR', check?.payosStatus === 'PROCESSING'
          ? 'Giao dịch đang được ngân hàng xử lý. Chờ vài phút rồi kiểm tra lại — không thu thêm tiền.'
          : 'PayOS chưa ghi nhận khoản chuyển khoản nào cho hóa đơn này.', 'info');
      }
      return check;
    } catch (err) {
      if (!silent) notify('Lỗi', err.message || 'Không đối soát được với PayOS.');
      return null;
    }
  };

  const handlePayInvoice = async (invoiceId, confirmNoTransfer = false) => {
    try {
      await put(`/api/v1/invoices/${invoiceId}/pay`, { paymentMethod: 'cash', confirmNoTransfer: confirmNoTransfer === true });
      const res = await get('/api/v1/invoices');
      const list = res.invoices || [];
      setInvoices(list);
      const paid = list.find((i) => i._id === invoiceId);
      const wantPrint = await confirmDialog({
        title: 'Đã thu tiền mặt',
        message: `Hóa đơn của ${personName(paid?.patientId)} đã chuyển sang "Đã thanh toán".`,
        confirmText: 'In biên lai',
        cancelText: 'Đóng',
        type: 'success',
      });
      if (wantPrint && paid) printReceipt(paid);
    } catch (err) {
      const msg = err.message || '';
      if (/^Hóa đơn đang có mã VietQR/.test(msg)) {
        // Đang có mã VietQR chờ → hỏi bệnh nhân trước, tránh thu tiền mặt khi tiền chuyển khoản đang về
        const noTransfer = await confirmDialog({
          title: 'Bệnh nhân đã chuyển khoản chưa?',
          message: msg,
          note: 'Nếu bệnh nhân nói ĐÃ chuyển: bấm "Kiểm tra lại" để hỏi PayOS, không thu tiền mặt. Chỉ thu tiền mặt khi bệnh nhân xác nhận CHƯA chuyển — mã VietQR cũ sẽ bị hủy.',
          confirmText: 'Chưa chuyển — thu tiền mặt',
          cancelText: 'Kiểm tra lại',
          type: 'info',
        });
        if (noTransfer) await handlePayInvoice(invoiceId, true);
        else await reconcileVietQR(invoiceId);
      } else if (/đang được ngân hàng xử lý|đã nhận một phần tiền|Không kiểm tra được trạng thái mã VietQR/.test(msg)) {
        notify('Chưa thể thu tiền', msg, 'info');
      } else if (/Đơn thuốc vừa được cộng vào hóa đơn/.test(msg)) {
        await fetchInvoices();
        notify('Hóa đơn vừa cập nhật tiền thuốc', msg, 'info');
      } else if (/không đủ tồn kho|thiếu tồn kho|không tồn tại trong danh mục/.test(msg)) {
        notify('Thiếu thuốc trong kho', msg + ' Liên hệ dược sĩ trước khi thu tiền.', 'error');
      } else if (/vừa tự áp BHYT/.test(msg)) {
        await fetchInvoices();
        if (/không phải trả tiền/.test(msg)) await confirmBhytFullPayment(invoiceId);
        else notify('Đã tự áp BHYT', msg, 'info');
      } else if (/trước khi áp BHYT/.test(msg)) {
        await fetchInvoices();
        notify('Bệnh nhân đã trả đủ trước khi áp BHYT', msg, 'error');
      } else if (/đã được thanh toán qua VietQR/.test(msg)) {
        await fetchInvoices();
        notify('Đã nhận tiền VietQR', msg, 'success');
      } else {
        notify('Lỗi', msg || 'Xác nhận thanh toán thất bại');
      }
    }
  };

  const getLeastBusyDoctorId = () => {
    if (!doctors || doctors.length === 0) return null;
    let minSize = Infinity;
    let minDocId = null;
    doctors.forEach(d => {
      const qSize = d.queueSize || 0;
      if (qSize < minSize) {
        minSize = qSize;
        minDocId = d._id;
      }
    });
    return minDocId;
  };
  const leastBusyDoctorId = getLeastBusyDoctorId();

  // ── UC-REC-08: VietQR PayOS hiển thị ngay tại quầy, tự cập nhật khi tiền về ──
  const [qrPayment, setQrPayment] = useState(null); // { invoiceId, image, amount, checkoutUrl }
  useEffect(() => {
    if (!qrPayment) return undefined;
    const timer = setInterval(async () => {
      try {
        // Hỏi máy chủ → máy chủ hỏi thẳng PayOS (không phụ thuộc webhook, chạy local vẫn cập nhật được)
        const check = await post(`/api/v1/invoices/${qrPayment.invoiceId}/payos-check`);
        if (check?.paid) {
          clearInterval(timer);
          const res = await get('/api/v1/invoices');
          const inv = (res.invoices || []).find((i) => i._id === qrPayment.invoiceId) || check.invoice;
          setInvoices(res.invoices || []);
          setQrPayment(null);
          if (inv?.status === 'đang xử lý') {
            notify('Đã nhận tiền — chưa xuất được thuốc', `Đã nhận chuyển khoản ${formatVnd(owedOf(inv))} qua VietQR nhưng kho thuốc không đủ để xuất. Hóa đơn chuyển "đang xử lý", hệ thống đã báo dược sĩ. Không thu thêm tiền.`, 'info');
          } else {
            notify('Thành công', `Đã nhận chuyển khoản ${formatVnd(owedOf(inv))} qua VietQR. Hóa đơn đã tự động chuyển sang "Đã thanh toán".`);
          }
        } else if (['EXPIRED', 'CANCELLED'].includes(check?.payosStatus)) {
          // Mã đã hết hạn / bị hủy trên PayOS → đóng mã, lễ tân bấm VietQR để tạo mã mới
          clearInterval(timer);
          setQrPayment(null);
          notify('Mã VietQR không còn hiệu lực', check.payosStatus === 'EXPIRED'
            ? 'Mã QR đã hết hạn mà chưa nhận được tiền. Bấm "VietQR PayOS" để tạo mã mới.'
            : 'Mã QR đã bị hủy. Bấm "VietQR PayOS" để tạo mã mới nếu bệnh nhân vẫn muốn chuyển khoản.', 'info');
        }
      } catch { /* bỏ qua lỗi mạng tạm thời, thử lại ở lượt sau */ }
    }, 3000);
    return () => clearInterval(timer);
  }, [qrPayment]);

  const handlePayOSPayment = async (invoiceId) => {
    setLoading(true);
    try {
      const res = await post(`/api/v1/invoices/${invoiceId}/payos`);
      if (res?.qrCode) {
        const image = await QRCodeLib.toDataURL(res.qrCode, { width: 320, margin: 1 });
        setQrPayment({ invoiceId, image, amount: res.amount, checkoutUrl: res.checkoutUrl, expiresAt: res.expiresAt ? new Date(res.expiresAt).getTime() : Date.now() + 15 * 60000, reused: !!res.reused });
      } else if (res?.checkoutUrl) {
        // Không có chuỗi QR → mở trang PayOS ở tab mới và vẫn theo dõi trạng thái hóa đơn
        if (typeof window !== 'undefined') window.open(res.checkoutUrl, '_blank');
        else Linking.openURL(res.checkoutUrl);
        setQrPayment({ invoiceId, image: null, amount: res.amount, checkoutUrl: res.checkoutUrl, expiresAt: res.expiresAt ? new Date(res.expiresAt).getTime() : Date.now() + 15 * 60000, reused: !!res.reused });
      } else {
        notify('Lỗi', 'Không nhận được dữ liệu thanh toán từ cổng PayOS.');
      }
    } catch (err) {
      if (/không phải trả tiền \(BHYT chi trả 100%\)/.test(err.message || '')) {
        await fetchInvoices();
        await confirmBhytFullPayment(invoiceId);
        return;
      }
      if (/trước khi áp BHYT/.test(err.message || '')) {
        await fetchInvoices();
        notify('Bệnh nhân đã trả đủ trước khi áp BHYT', err.message, 'error');
        return;
      }
      if (/đã được thanh toán/.test(err.message || '')) {
        // Đơn VietQR trước đó thực ra đã được trả → máy chủ vừa cập nhật, tải lại danh sách
        await fetchInvoices();
        notify('Đã nhận tiền VietQR', err.message, 'success');
        return;
      }
      if (/đang được ngân hàng xử lý|đã nhận một phần tiền|Không kiểm tra được trạng thái mã VietQR/.test(err.message || '')) {
        notify('Chưa tạo mã mới', err.message, 'info');
        return;
      }
      notify('Không tạo được mã VietQR', err.message || 'Không thể khởi tạo giao dịch PayOS.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── UC-REC-05: cập nhật dịch vụ phát sinh (tiền giường...) khi mở hóa đơn đang chờ ──
  const syncedRef = React.useRef(new Set());
  const syncInvoice = async (inv) => {
    if (!inv || inv.status !== 'chờ thanh toán' || syncedRef.current.has(inv._id)) return;
    syncedRef.current.add(inv._id);
    try {
      const res = await post(`/api/v1/invoices/${inv._id}/sync`);
      if (res?.invoice) setInvoices((prev) => prev.map((i) => (i._id === inv._id ? { ...i, ...res.invoice, patientId: i.patientId } : i)));
      if (res?.bhytAuto?.applied && res.bhytAuto.patientCopayAmount === 0) {
        await confirmBhytFullPayment(inv._id, res.bhytAuto.bhytAmount);
      }
    } catch { /* hóa đơn vẫn dùng được nếu đồng bộ thất bại */ }
  };

  // ── UC-REC-09: hoàn trả viện phí ───────────────────────────────────────────
  // ── Ghi nhận chuyển khoản đối chiếu sao kê (tiền vào mã VietQR đã hủy / hết hạn, chuyển khoản trực tiếp) ──
  const [bankTarget, setBankTarget] = useState(null);
  const [bankRef, setBankRef] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [bankNote, setBankNote] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const openBankTransfer = (inv) => {
    setBankRef('');
    setBankAmount(inv.status === 'chờ thanh toán' ? String(owedOf(inv)) : '');
    setBankNote('');
    setBankTarget(inv);
  };
  const handleRecordBank = async () => {
    if (!bankTarget || !bankRef.trim() || !(Number(bankAmount) > 0)) return;
    setSavingBank(true);
    try {
      const res = await post(`/api/v1/invoices/${bankTarget._id}/bank-transfer`, { reference: bankRef.trim(), amount: Number(bankAmount), note: bankNote.trim() });
      setBankTarget(null);
      await fetchInvoices();
      notify(res?.duplicate ? 'Phát hiện thu trùng' : 'Đã ghi nhận chuyển khoản', res?.message || 'Đã ghi nhận.', res?.duplicate ? 'error' : 'success');
    } catch (err) {
      notify('Chưa ghi nhận được', err.message || 'Không ghi nhận được chuyển khoản.', 'error');
    } finally {
      setSavingBank(false);
    }
  };

  const [refundTarget, setRefundTarget] = useState(null);
  const [refundReason, setRefundReason] = useState(REFUND_REASONS[0]);
  const [refundNote, setRefundNote] = useState('');
  const [refunding, setRefunding] = useState(false);
  const handleRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      const res = await put(`/api/v1/invoices/${refundTarget._id}/refund`, {
        refundReason: [refundReason, refundNote.trim()].filter(Boolean).join(' — '),
      });
      setRefundTarget(null);
      setRefundNote('');
      await fetchInvoices();
      notify('Thành công', res?.message || 'Đã hoàn trả viện phí và chuyển hóa đơn sang "Hoàn trả".');
    } catch (err) {
      // Hóa đơn ≥ 10 triệu cần phê duyệt cấp 2 → backend trả 403 kèm hướng dẫn
      setRefundTarget(null);
      notify('Cần phê duyệt thêm', err.message || 'Không thể hoàn trả viện phí.', 'info');
    } finally {
      setRefunding(false);
    }
  };

  // ── UC-REC-10: đóng lượt khám khi đã đủ thuốc, kết quả & công nợ ─────────────
  const handleCloseVisit = async (v) => {
    const ok = await confirmDialog({
      title: 'Đóng lượt khám',
      message: `Xác nhận đóng hồ sơ ca khám của ${personName(v.patientId)}?`,
      note: 'Chỉ đóng khi bệnh nhân đã nhận đủ thuốc, kết quả và thanh toán xong viện phí. Hệ thống sẽ chặn nếu còn hóa đơn chưa thanh toán.',
      confirmText: 'Đóng lượt khám',
      type: 'info',
    });
    if (!ok) return;
    try {
      await put(`/api/v1/visits/${v._id}/status`, { status: 'đã đóng' });
      await fetchVisits();
      notify('Thành công', `Đã đóng lượt khám của ${personName(v.patientId)}.`);
    } catch (err) {
      notify('Chưa thể đóng lượt khám', err.message || 'Đóng lượt khám thất bại.', 'error');
    }
  };

  const searchQ = searchPatient.toLowerCase();
  const filteredPatients = patients.filter(p =>
    serverMatchIds.includes(p._id) ||
    p.email?.toLowerCase().includes(searchQ) ||
    p.profile?.name?.toLowerCase().includes(searchQ) ||
    p.profile?.fullName?.toLowerCase().includes(searchQ) ||
    p.profile?.medicalId?.toLowerCase().includes(searchQ)
  );

  // Chưa tải xong thông tin người dùng thì vẫn hiện nút (backend luôn kiểm tra quyền lại)
  const canApplyBhyt = !user?.role || ['receptionist', 'admin', 'hospital_admin'].includes(user.role);
  const canDeclareBhyt = canApplyBhyt; // UC-REC-02: khai báo / xác minh thẻ cũng chỉ lễ tân
  const headerTitle = user?.role === 'receptionist' ? 'Bàn Lễ tân & Thu ngân BHYT' :
                      user?.role === 'nurse' ? 'Bàn Tiếp nhận & Đo Sinh hiệu Điều dưỡng' : 'Tiếp nhận & Thu ngân';

  const isPaidStatus = (st) => st === 'đã thanh toán';
  const owedOf = (inv) => inv.patientPayAmount ?? ((inv.totalAmount || 0) - (inv.bhytInfo?.bhytAmount || 0));
  const pendingInvoices = invoices.filter(i => i.status === 'chờ thanh toán');
  const pendingInvoicesCount = pendingInvoices.length;
  const pendingTotal = pendingInvoices.reduce((s, i) => s + owedOf(i), 0);
  const currentActiveRoute = activeTab === 'billing'
    ? 'ReceptionistDashboard_billing'
    : activeTab === 'myQueue'
    ? 'ReceptionistDashboard_myQueue'
    : 'ReceptionistDashboard_createVisit';

  // ── Tiếp nhận: tiến độ các bước ────────────────────────────────────────────
  const selectedPatient = patients.find(p => p._id === selectedPatientId);
  const selectedDoctor = doctors.find(d => d._id === selectedDoctorId);
  const selectedNurse = nurses.find(n => n._id === selectedNurseId);
  const stepsDone = [!!selectedPatient, !!selectedDoctor, !!selectedNurse, !!reason.trim()];
  const doneCount = stepsDone.filter(Boolean).length;
  // Phải hoàn thành đủ 4 bước (kể cả lý do khám) mới được tạo lượt khám
  // UC-REC-04: bệnh nhân phải có email để nhận thông báo (ca cấp cứu được bổ sung sau)
  const patientEmailOk = !selectedPatient || hasRealEmail(selectedPatient.email) || visitPriority === 'khẩn cấp';
  const canSubmit = stepsDone.every(Boolean) && patientEmailOk;
  const missingSteps = [...['bệnh nhân', 'bác sĩ', 'điều dưỡng', 'lý do khám'].filter((_, i) => !stepsDone[i]), ...(patientEmailOk ? [] : ['email bệnh nhân'])];
  const REASON_CHIPS = ['Đau đầu kéo dài', 'Tái khám u não', 'Chụp MRI theo hẹn', 'Co giật', 'Mờ mắt, chóng mặt', 'Khám tổng quát'];

  // ── Lượt khám: gom theo cột trạng thái ─────────────────────────────────────
  const [queueSearch, setQueueSearch] = useState('');
  const BOARD = [
    { key: 'wait', title: 'Chờ khám', color: '#D97706', bg: '#FFFBEB', icon: Hourglass, statuses: ['đang chờ', 'tái khám định kỳ'] },
    { key: 'exam', title: 'Đang khám', color: '#1A5FD0', bg: '#EFF5FF', icon: Stethoscope, statuses: ['đang khám'] },
    { key: 'para', title: 'Cận lâm sàng & MRI', color: '#7C3AED', bg: '#F5F0FF', icon: ScanLine, statuses: ['chờ chụp', 'đang chụp', 'chờ chụp lại', 'chờ kết quả AI', 'lỗi AI', 'chờ bác sĩ đọc', 'chờ hội chẩn', 'chờ chụp sau phẫu thuật'] },
    { key: 'done', title: 'Hoàn tất & Nhập viện', color: '#0F9D6B', bg: '#EEFBF5', icon: BadgeCheck, statuses: ['hoàn tất', 'đã đóng', 'chờ nhập viện', 'no_show', 'đã hủy'] },
  ];
  // Lọc theo tên / mã y tế tại chỗ; SĐT (lưu +84…) và CCCD tra trên máy chủ như ô tìm bệnh nhân ở bước 1
  const [queueMatchIds, setQueueMatchIds] = useState([]);
  useEffect(() => {
    const digits = queueSearch.replace(/[\s.+-]/g, '');
    if (!/^\d{2,12}$/.test(digits)) { setQueueMatchIds([]); return undefined; }
    const timer = setTimeout(async () => {
      try {
        const res = await get(`/api/patients?all=true&search=${encodeURIComponent(queueSearch.trim())}`);
        setQueueMatchIds((res?.data || []).map((p) => p._id));
      } catch {
        setQueueMatchIds([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [queueSearch]);
  const queueQ = queueSearch.trim().toLowerCase();
  const queueFiltered = visits.filter(v => !queueQ
    || personName(v.patientId).toLowerCase().includes(queueQ)
    || (v.patientId?.profile?.medicalId || '').toLowerCase().includes(queueQ)
    || queueMatchIds.includes(v.patientId?._id || v.patientId));
  const columnOf = (status) => (BOARD.find(c => c.statuses.includes(status)) || BOARD[0]).key;
  // Thứ tự trong mọi cột: tiếp nhận trước ở trên, lượt mới hơn ở dưới (cột Chờ khám: cấp cứu luôn lên đầu)
  const sortForColumn = (key) => (a, b) => {
    if (key === 'wait') {
      const urgent = (b.priority === 'khẩn cấp') - (a.priority === 'khẩn cấp');
      if (urgent) return urgent;
    }
    return new Date(a.createdAt) - new Date(b.createdAt);
  };

  // ── Thu ngân: lọc & hóa đơn đang chọn ──────────────────────────────────────
  const [invoiceFilter, setInvoiceFilter] = useState('pending');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const shownInvoices = invoices.filter(i =>
    invoiceFilter === 'all' ? true : invoiceFilter === 'paid' ? (isPaidStatus(i.status) || i.status === 'đang xử lý') : i.status === 'chờ thanh toán');
  const selectedInvoice = shownInvoices.find(i => i._id === selectedInvoiceId) || shownInvoices[0] || null;
  // UC-REC-05: mở hóa đơn đang chờ → cập nhật dịch vụ phát sinh (tiền giường...)
  useEffect(() => { if (selectedInvoice) syncInvoice(selectedInvoice); }, [selectedInvoice?._id]);

  const { width } = useWindowDimensions();
  const isWide = width > 1180;
  const bhytWide = width >= 900; // modal BHYT 2 cột khi đủ rộng

  const TABS = [
    { key: 'createVisit', label: 'Tiếp nhận', icon: UserPlus },
    { key: 'callQueue', label: 'Gọi số', icon: Ticket, count: queueWaiting, warn: true },
    { key: 'myQueue', label: 'Lượt khám hôm nay', icon: ClipboardList, count: visits.length },
    { key: 'billing', label: 'Thu ngân & BHYT', icon: Wallet, count: pendingInvoicesCount, warn: true },
  ];

  const banner = activeTab === 'createVisit' ? (
    <ReceptionBanner
      image={RECEPTION_IMAGES.tablet}
      tone="teal"
      eyebrow="Quầy tiếp đón"
      title="Tiếp nhận bệnh nhân"
      subtitle="Bốn bước: chọn bệnh nhân, phân công bác sĩ, điều dưỡng và ghi lý do khám."
      right={(
        <View style={st.bannerStat}>
          <Text style={st.bannerStatValue}>{doneCount}/4</Text>
          <Text style={st.bannerStatLabel}>bước đã hoàn thành</Text>
          <View style={st.bannerProgress}><View style={[st.bannerProgressFill, { width: `${doneCount * 25}%` }]} /></View>
        </View>
      )}
    />
  ) : activeTab === 'callQueue' ? (
    <ReceptionBanner
      image={RECEPTION_IMAGES.lobby}
      tone="teal"
      eyebrow="Số thứ tự online"
      title="Gọi số bệnh nhân"
      subtitle="Gọi lần lượt bệnh nhân đã lấy số trên app; tiếp nhận số để chuyển sang tạo lượt khám."
      right={(
        <View style={st.bannerStat}>
          <Text style={st.bannerStatValue}>{queueWaiting}</Text>
          <Text style={st.bannerStatLabel}>số đang chờ gọi</Text>
        </View>
      )}
    />
  ) : activeTab === 'myQueue' ? (
    <ReceptionBanner
      image={RECEPTION_IMAGES.corridor}
      tone="indigo"
      eyebrow="Theo dõi trong ngày"
      title="Lượt khám hôm nay"
      subtitle="Bảng trạng thái theo thời gian thực — bấm vào thẻ để mở phiếu khám của bệnh nhân."
      right={(
        <View style={st.bannerChips}>
          {BOARD.map(c => (
            <View key={c.key} style={st.bannerChip}>
              <Text style={st.bannerChipValue}>{visits.filter(v => columnOf(v.status) === c.key).length}</Text>
              <Text style={st.bannerChipLabel}>{c.title}</Text>
            </View>
          ))}
        </View>
      )}
    />
  ) : (
    <ReceptionBanner
      image={RECEPTION_IMAGES.payment}
      tone="amber"
      eyebrow="Quầy thu ngân"
      title="Thu ngân & BHYT"
      subtitle="Áp dụng BHYT, thu tiền mặt hoặc tạo mã VietQR PayOS cho từng hóa đơn."
      right={(
        <View style={st.bannerStat}>
          <Text style={st.bannerStatLabel}>Tổng cần thu</Text>
          <Text style={st.bannerStatValue}>{formatVnd(pendingTotal)}</Text>
          <Text style={st.bannerStatLabel}>{pendingInvoicesCount} hóa đơn đang chờ</Text>
        </View>
      )}
    />
  );

  // ── Thẻ BHYT xem trước: nhóm số theo định dạng thẻ (2-1-2-10) ─────────────
  const cardDigits = (bhytCardNumber || '').replace(/\s+/g, '').toUpperCase();
  const cardPretty = cardDigits
    ? [cardDigits.slice(0, 2), cardDigits.slice(2, 3), cardDigits.slice(3, 5), cardDigits.slice(5, 15)].filter(Boolean).join(' ')
    : '•• • •• ••••••••••';

  return (
    <ResponsiveLayout navigation={navigation} title={headerTitle} user={user} activeRoute={currentActiveRoute}>
      <ScrollView style={st.page} contentContainerStyle={st.pageContent} keyboardShouldPersistTaps="handled">
        {banner}

        {/* Thanh tab dạng viên thuốc, nổi lên trên banner */}
        <View style={st.tabBar}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[st.tab, active && st.tabActive]}
                onPress={() => setActiveTab(t.key)}
                dataSet={active ? undefined : { hover: 'tint' }}
              >
                <Icon size={16} color={active ? '#FFFFFF' : '#475569'} />
                <Text style={[st.tabText, active && st.tabTextActive]}>{t.label}</Text>
                {t.count > 0 && (
                  <View style={[st.tabCount, active ? st.tabCountActive : t.warn && st.tabCountWarn]}>
                    <Text style={[st.tabCountText, (active || t.warn) && { color: '#FFFFFF' }]}>{t.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1A5FD0" style={{ marginTop: 50 }} />
        ) : (
          <>
            {/* ═════════════ GỌI SỐ ONLINE (UC-PAT-03) ═════════════ */}
            {activeTab === 'callQueue' && <QueueDesk desk={queueDesk} onServe={serveFromQueue} />}

            {/* ═════════════ TAB 1: TIẾP NHẬN (WIZARD) ═════════════ */}
            {activeTab === 'createVisit' && (
              <View style={[st.wizard, isWide && { flexDirection: 'row' }]}>
                <View style={[{ gap: 18 }, isWide && { flex: 1.65 }]}>
                  {/* Bước 1 */}
                  <Reveal style={st.stepCard}>
                    <StepHead n={1} done={stepsDone[0]} title="Tìm kiếm & chọn bệnh nhân" hint="Tên, số điện thoại, CCCD hoặc mã y tế — chưa có hồ sơ thì tạo mới">
                      <TouchableOpacity style={st.newPatientBtn} dataSet={{ hover: 'glow' }} onPress={openNewPatient}>
                        <UserPlus size={15} color="#FFFFFF" />
                        <Text style={st.bhytBtnText}>Tạo hồ sơ mới</Text>
                      </TouchableOpacity>
                      {canDeclareBhyt && (
                      <TouchableOpacity
                        style={[st.bhytBtn, !selectedPatientId && { opacity: 0.55 }]}
                        dataSet={{ hover: 'glow' }}
                        onPress={() => {
                          if (!selectedPatientId) {
                            notify('Thông báo', 'Vui lòng bấm chọn 1 bệnh nhân trong danh sách trước khi khai báo thẻ BHYT.');
                            return;
                          }
                          openBhytModal();
                        }}
                      >
                        <ShieldCheck size={15} color="#FFFFFF" />
                        <Text style={st.bhytBtnText}>{activeCards[selectedPatientId]?.manuallyVerified === false ? 'Xác minh thẻ BHYT' : 'Khai báo thẻ BHYT'}</Text>
                      </TouchableOpacity>
                      )}
                    </StepHead>
                    <View style={st.searchBox}>
                      <Search size={16} color="#94A3B8" />
                      <TextInput
                        style={st.searchInput}
                        placeholder="Nhập tên, SĐT (0912…), CCCD 12 số hoặc mã y tế (BN…)"
                        placeholderTextColor="#94A3B8"
                        value={searchPatient}
                        onChangeText={setSearchPatient}
                      />
                    </View>
                    <View style={[st.patientGrid, { columnGap: isWide ? '2.3%' : '3%' }]}>
                      {filteredPatients.slice(0, 12).map(p => {
                        const active = selectedPatientId === p._id;
                        return (
                          <TouchableOpacity
                            key={p._id}
                            style={[st.patientCard, active && st.patientCardActive, { width: isWide ? '31.8%' : '48.5%' }]}
                            onPress={() => setSelectedPatientId(p._id)}
                            dataSet={active ? undefined : { hover: 'lift' }}
                          >
                            <Avatar name={personName(p)} size={40} />
                            <View style={{ flex: 1 }}>
                              <Text style={st.patientName} numberOfLines={1}>{personName(p)}</Text>
                              <Text style={st.patientId} numberOfLines={1}>
                                Mã: {p.profile?.medicalId || 'Chưa có'}
                                {p.profile?.phoneLast4 ? ` · SĐT …${p.profile.phoneLast4}` : ''}
                                {p.profile?.cccdLast4 ? ` · CCCD …${p.profile.cccdLast4}` : ''}
                              </Text>
                              {activeCards[p._id] && (() => {
                                const c = activeCards[p._id];
                                // Chỉ coi là chưa xác minh khi máy chủ báo rõ false (máy chủ bản cũ không trả trường này)
                                const unverified = c.manuallyVerified === false;
                                return (
                                  <>
                                    <View style={[st.bhytTag, unverified && st.bhytTagUnverified, c.expired && st.bhytTagExpired]}>
                                      <Text style={[st.bhytTagText, unverified && { color: '#B45309' }, c.expired && { color: '#DC2626' }]} numberOfLines={1}>
                                        {c.expired ? 'BHYT hết hạn' : unverified ? 'BHYT chưa xác minh' : `BHYT ${c.coverageRate}%`}
                                      </Text>
                                    </View>
                                    <Text style={st.bhytExpiry}>HSD {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('vi-VN') : '—'}</Text>
                                  </>
                                );
                              })()}
                              {/* Chưa có thẻ → lễ tân bấm để khai báo luôn cho bệnh nhân này */}
                              {!activeCards[p._id] && canDeclareBhyt && (
                                <TouchableOpacity style={st.declareTag} onPress={() => openBhytModal(p._id)} dataSet={{ hover: 'glow' }}>
                                  <Text style={st.declareTagText}>+ Khai báo thẻ BHYT</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                            {active && <View style={st.checkDot}><Check size={13} color="#FFFFFF" strokeWidth={3} /></View>}
                          </TouchableOpacity>
                        );
                      })}
                      {selectedPatient && !hasRealEmail(selectedPatient.email) && (
                        <View style={st.emailBox}>
                          <Text style={st.emailBoxTitle}>Bệnh nhân chưa có email nhận thông báo{visitPriority === 'khẩn cấp' ? ' (ca cấp cứu: có thể bổ sung sau)' : ''}</Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TextInput style={[st.modalInput, { flex: 1, marginBottom: 0 }]} value={emailDraft} onChangeText={(v) => setEmailDraft(v.trim())} placeholder="VD: nguyenvanan@gmail.com" placeholderTextColor="#94A3B8" autoCapitalize="none" keyboardType="email-address" />
                            <TouchableOpacity style={[st.newPatientBtn, (savingEmail || !hasRealEmail(emailDraft)) && { opacity: 0.5 }]} onPress={handleSavePatientEmail} disabled={savingEmail || !hasRealEmail(emailDraft)}>
                              <Text style={st.bhytBtnText}>{savingEmail ? 'Đang lưu...' : 'Lưu email'}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                      {filteredPatients.length === 0 && (
                        <View style={st.noMatch}>
                          <Text style={st.muted}>Không tìm thấy bệnh nhân phù hợp — bệnh nhân đến khám lần đầu?</Text>
                          <TouchableOpacity style={st.newPatientBtn} onPress={openNewPatient}>
                            <UserPlus size={14} color="#FFFFFF" />
                            <Text style={st.bhytBtnText}>Tạo hồ sơ mới</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </Reveal>

                  {/* Bước 2 */}
                  <Reveal delay={80} style={st.stepCard}>
                    <StepHead n={2} done={stepsDone[1]} title="Phân công bác sĩ" hint="Thanh tải thể hiện số bệnh nhân đang chờ của từng bác sĩ" />
                    <View style={st.doctorGrid}>
                      {doctors.map(d => {
                        const q = d.queueSize || 0;
                        const active = selectedDoctorId === d._id;
                        const isLeastBusy = d._id === leastBusyDoctorId;
                        const loadColor = q === 0 ? '#0F9D6B' : q >= 5 ? '#DC2626' : '#D97706';
                        return (
                          <TouchableOpacity
                            key={d._id}
                            style={[st.doctorCard, active && st.doctorCardActive, { width: isWide ? '48.8%' : '100%' }]}
                            onPress={() => setSelectedDoctorId(d._id)}
                            dataSet={active ? undefined : { hover: 'lift' }}
                          >
                            <Avatar name={personName(d)} size={44} />
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={[st.doctorName, active && { color: '#FFFFFF' }]} numberOfLines={1}>{personName(d)}</Text>
                              </View>
                              <View style={st.loadTrack}>
                                <View style={[st.loadFill, { width: `${Math.min(q / 6, 1) * 100}%`, backgroundColor: active ? '#FFFFFF' : loadColor }]} />
                              </View>
                              <Text style={[st.loadText, active && { color: '#DBEAFE' }]}>{q} bệnh nhân đang chờ</Text>
                            </View>
                            {isLeastBusy && (
                              <View style={[st.suggest, active && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                <Sparkles size={12} color={active ? '#FFFFFF' : '#0F9D6B'} />
                                <Text style={[st.suggestText, active && { color: '#FFFFFF' }]}>Gợi ý</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </Reveal>

                  {/* Bước 3 */}
                  <Reveal delay={140} style={st.stepCard}>
                    <StepHead n={3} done={stepsDone[2]} title="Phân công điều dưỡng" hint="Điều dưỡng sẽ đo sinh hiệu trước khi bác sĩ khám" />
                    <View style={st.chipWrap}>
                      {nurses.map(n => {
                        const active = selectedNurseId === n._id;
                        return (
                          <TouchableOpacity
                            key={n._id}
                            style={[st.nurseChip, active && st.nurseChipActive]}
                            onPress={() => setSelectedNurseId(n._id)}
                            dataSet={active ? undefined : { hover: 'lift' }}
                          >
                            <Avatar name={personName(n)} size={30} />
                            <Text style={[st.nurseText, active && { color: '#FFFFFF' }]} numberOfLines={1}>{personName(n)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </Reveal>

                  {/* Bước 4 */}
                  <Reveal delay={200} style={st.stepCard}>
                    <StepHead n={4} done={stepsDone[3]} title="Phân luồng, mức ưu tiên & lý do khám" hint="Chọn phòng khám chuyên khoa Thần kinh, gắn cờ cấp cứu nếu cần" />
                    <View style={st.optionRow}>
                      <View>
                        <Text style={st.fieldLabel}>Mức ưu tiên</Text>
                        <View style={st.segment}>
                          {[{ k: 'trung bình', label: 'Thường' }, { k: 'khẩn cấp', label: 'Cấp cứu' }].map(o => (
                            <TouchableOpacity
                              key={o.k}
                              style={[st.segmentItem, visitPriority === o.k && (o.k === 'khẩn cấp' ? st.segmentItemDanger : st.segmentItemActive)]}
                              onPress={() => setVisitPriority(o.k)}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {o.k === 'khẩn cấp' && <Siren size={13} color={visitPriority === o.k ? '#FFFFFF' : '#DC2626'} />}
                                <Text style={[st.segmentText, visitPriority === o.k && (o.k === 'khẩn cấp' ? { color: '#FFFFFF', fontWeight: '800' } : st.segmentTextActive)]}>{o.label}</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <View>
                        <Text style={st.fieldLabel}>Hình thức</Text>
                        <View style={st.segment}>
                          {['Ngoại trú', 'Nội trú'].map(t => (
                            <TouchableOpacity key={t} style={[st.segmentItem, visitType === t && st.segmentItemActive]} onPress={() => setVisitType(t)}>
                              <Text style={[st.segmentText, visitType === t && st.segmentTextActive]}>{t}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                    <Text style={st.fieldLabel}>Phòng khám</Text>
                    <View style={[st.chipWrap, { marginBottom: 12 }]}>
                      {CLINIC_ROOMS.map(r => (
                        <TouchableOpacity key={r} style={[st.reasonChip, clinicRoom === r && st.roomChipActive]} onPress={() => setClinicRoom(r)}>
                          <Text style={[st.reasonChipText, clinicRoom === r && { color: '#1A5FD0' }]}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={st.fieldLabel}>Lý do khám</Text>
                    <View style={st.chipWrap}>
                      {REASON_CHIPS.map(r => (
                        <TouchableOpacity
                          key={r}
                          style={[st.reasonChip, reason === r && st.reasonChipActive]}
                          onPress={() => setReason(r)}
                          dataSet={{ hover: 'tint' }}
                        >
                          <Text style={[st.reasonChipText, reason === r && { color: '#0B7A53' }]}>{r}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={st.textarea}
                      placeholder="Triệu chứng, yêu cầu khám..."
                      placeholderTextColor="#94A3B8"
                      value={reason}
                      onChangeText={setReason}
                      multiline
                    />
                  </Reveal>
                </View>

                {/* Phiếu tiếp nhận xem trước */}
                <Reveal delay={120} style={[st.ticket, isWide && st.ticketSticky]}>
                  <View style={st.ticketHead}>
                    <Text style={st.ticketEyebrow}>PHIẾU TIẾP NHẬN</Text>
                    <Text style={st.ticketDate}>{new Date().toLocaleDateString('vi-VN')}</Text>
                  </View>
                  <View style={st.ticketPatient}>
                    {selectedPatient ? <Avatar name={personName(selectedPatient)} size={52} ring /> : <View style={st.ticketAvatarEmpty}><UserPlus size={22} color="#94A3B8" /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={st.ticketName} numberOfLines={2}>{selectedPatient ? personName(selectedPatient) : 'Chưa chọn bệnh nhân'}</Text>
                      <Text style={st.ticketSub}>{selectedPatient?.profile?.medicalId ? `Mã y tế ${selectedPatient.profile.medicalId}` : 'Bước 1'}</Text>
                    </View>
                  </View>
                  <View style={st.ticketCut}>
                    <View style={st.ticketNotchL} /><View style={st.ticketDash} /><View style={st.ticketNotchR} />
                  </View>
                  {[
                    { label: 'Bác sĩ', value: selectedDoctor ? personName(selectedDoctor) : '—', icon: Stethoscope },
                    { label: 'Điều dưỡng', value: selectedNurse ? personName(selectedNurse) : '—', icon: HeartPulse },
                    { label: 'Phòng khám', value: clinicRoom, icon: Stethoscope },
                    { label: 'Ưu tiên', value: visitPriority === 'khẩn cấp' ? 'CẤP CỨU' : 'Thường', icon: Siren },
                    { label: 'Hình thức', value: visitType, icon: ClipboardList },
                    { label: 'Lý do', value: reason.trim() || '—', icon: Search },
                  ].map(row => {
                    const Icon = row.icon;
                    return (
                      <View key={row.label} style={st.ticketRow}>
                        <Icon size={14} color="#64748B" />
                        <Text style={st.ticketRowLabel}>{row.label}</Text>
                        <Text style={st.ticketRowValue} numberOfLines={2}>{row.value}</Text>
                      </View>
                    );
                  })}
                  <View style={st.ticketProgress}>
                    {stepsDone.map((d, i) => <View key={i} style={[st.ticketPip, d && st.ticketPipDone]} />)}
                  </View>
                  <TouchableOpacity
                    style={[st.submit, !canSubmit && st.submitDisabled]}
                    onPress={() => handleCreateVisit()}
                    disabled={!canSubmit || loading}
                    dataSet={canSubmit ? { hover: 'glow' } : undefined}
                  >
                    <Text style={st.submitText}>Xác nhận tạo lượt khám</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  {!canSubmit && <Text style={st.ticketHint}>Còn thiếu: {missingSteps.join(', ')}.</Text>}
                </Reveal>
              </View>
            )}

            {/* ═════════════ TAB 2: LƯỢT KHÁM (KANBAN) ═════════════ */}
            {activeTab === 'myQueue' && (
              <View style={{ gap: 16 }}>
                <View style={st.toolbar}>
                  <View style={[st.searchBox, { flex: 1, marginBottom: 0 }]}>
                    <Search size={16} color="#94A3B8" />
                    <TextInput
                      style={st.searchInput}
                      placeholder="Lọc theo tên, mã BN, SĐT hoặc CCCD..."
                      placeholderTextColor="#94A3B8"
                      value={queueSearch}
                      onChangeText={setQueueSearch}
                    />
                  </View>
                  <TouchableOpacity style={st.toolBtn} onPress={fetchVisits} dataSet={{ hover: 'tint' }}>
                    <RefreshCw size={15} color="#4F46E5" />
                    <Text style={st.toolBtnText}>Làm mới</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.toolBtn, st.toolBtnPrimary]} onPress={() => setActiveTab('createVisit')} dataSet={{ hover: 'glow' }}>
                    <UserPlus size={15} color="#FFFFFF" />
                    <Text style={[st.toolBtnText, { color: '#FFFFFF' }]}>Tiếp nhận mới</Text>
                  </TouchableOpacity>
                </View>

                {visits.length === 0 ? (
                  <View style={st.panel}>
                    <EmptyState
                      icon={Inbox}
                      tint="#4F46E5"
                      title="Hôm nay chưa có lượt khám nào"
                      text="Khi bạn tiếp nhận bệnh nhân, thẻ của họ sẽ xuất hiện ở cột 'Chờ khám' và tự di chuyển theo tiến trình khám."
                      actionLabel="Tiếp nhận bệnh nhân"
                      onAction={() => setActiveTab('createVisit')}
                    />
                  </View>
                ) : (
                  <View style={[st.board, isWide && { flexDirection: 'row' }]}>
                    {BOARD.map((col, ci) => {
                      const ColIcon = col.icon;
                      const items = queueFiltered.filter(v => columnOf(v.status) === col.key).sort(sortForColumn(col.key));
                      return (
                        <Reveal key={col.key} delay={ci * 90} style={[st.column, { backgroundColor: col.bg }, isWide && { flex: 1 }]}>
                          <View style={st.columnHead}>
                            <View style={[st.columnIcon, { backgroundColor: col.color }]}><ColIcon size={14} color="#FFFFFF" /></View>
                            <Text style={st.columnTitle}>{col.title}</Text>
                            <View style={[st.columnCount, { borderColor: col.color }]}><Text style={[st.columnCountText, { color: col.color }]}>{items.length}</Text></View>
                          </View>
                          {items.length === 0 ? (
                            <View style={st.columnEmpty}><Text style={st.muted}>Trống</Text></View>
                          ) : items.map(v => (
                            <TouchableOpacity
                              key={v._id}
                              style={[st.visitCard, v.priority === 'khẩn cấp' && st.visitCardUrgent]}
                              dataSet={{ hover: 'lift' }}
                              onPress={() => navigation.navigate('NursePatientDetail', { patient: { ...v.patientId, visitId: v._id, visitType: v.visitType } })}
                            >
                              <View style={st.visitTop}>
                                <Avatar name={personName(v.patientId)} size={34} />
                                <View style={{ flex: 1 }}>
                                  <Text style={st.visitName} numberOfLines={1}>{personName(v.patientId)}</Text>
                                  <Text style={st.visitTime}>
                                    {new Date(v.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {new Date(v.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} · {v.visitType || 'Ngoại trú'}
                                  </Text>
                                </View>
                                {v.queueNumber ? (
                                  <View style={[st.queueNo, v.priority === 'khẩn cấp' && st.queueNoUrgent]}>
                                    <Text style={[st.queueNoText, v.priority === 'khẩn cấp' && { color: '#FFFFFF' }]}>
                                      {v.priority === 'khẩn cấp' ? 'CC-' : '#'}{String(v.queueNumber).padStart(3, '0')}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={st.visitReason} numberOfLines={2}>{v.reason || 'Khám tổng quát'}</Text>
                              {v.clinicRoom ? <Text style={st.visitDoctor} numberOfLines={1}>{v.clinicRoom}</Text> : null}
                              <View style={st.visitFoot}>
                                <Text style={st.visitDoctor} numberOfLines={1}>BS. {personName(v.doctorId)}</Text>
                                <ClinicalStatusBadge status={v.status} size="sm" />
                              </View>
                              {v.status === 'hoàn tất' && (
                                <TouchableOpacity style={st.closeVisitBtn} onPress={() => handleCloseVisit(v)} dataSet={{ hover: 'glow' }}>
                                  <Lock size={13} color="#FFFFFF" />
                                  <Text style={st.closeVisitText}>Đóng lượt khám</Text>
                                </TouchableOpacity>
                              )}
                            </TouchableOpacity>
                          ))}
                        </Reveal>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* ═════════════ TAB 3: THU NGÂN (POS) ═════════════ */}
            {activeTab === 'billing' && (
              <View style={{ gap: 16 }}>
                <View style={st.toolbar}>
                  {[
                    { key: 'pending', label: 'Chờ thu', count: pendingInvoicesCount },
                    { key: 'paid', label: 'Đã thu', count: invoices.filter(i => isPaidStatus(i.status) || i.status === 'đang xử lý').length },
                    { key: 'all', label: 'Tất cả', count: invoices.length },
                  ].map(f => (
                    <TouchableOpacity
                      key={f.key}
                      style={[st.filterChip, invoiceFilter === f.key && st.filterChipActive]}
                      onPress={() => { setInvoiceFilter(f.key); setSelectedInvoiceId(null); }}
                    >
                      <Text style={[st.filterChipText, invoiceFilter === f.key && { color: '#FFFFFF' }]}>{f.label} · {f.count}</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity style={st.toolBtn} onPress={fetchInvoices} dataSet={{ hover: 'tint' }}>
                    <RefreshCw size={15} color="#B45309" />
                    <Text style={[st.toolBtnText, { color: '#B45309' }]}>Làm mới</Text>
                  </TouchableOpacity>
                </View>

                {shownInvoices.length === 0 ? (
                  <View style={st.panel}>
                    <EmptyState icon={BadgeCheck} tint="#0F9D6B" title="Không có hóa đơn nào ở mục này" text="Hóa đơn mới sẽ xuất hiện khi điều dưỡng hoặc bác sĩ gửi phiếu thu sang quầy." />
                  </View>
                ) : (
                  <View style={[st.pos, isWide && { flexDirection: 'row' }]}>
                    {/* Danh sách hóa đơn */}
                    <View style={[{ gap: 10 }, isWide && { flex: 1 }]}>
                      {shownInvoices.map((inv, i) => {
                        const active = selectedInvoice?._id === inv._id;
                        const paid = isPaidStatus(inv.status);
                        return (
                          <Reveal key={inv._id} delay={i * 60}>
                            <TouchableOpacity
                              style={[st.invRow, active && st.invRowActive]}
                              onPress={() => setSelectedInvoiceId(inv._id)}
                              dataSet={active ? undefined : { hover: 'lift' }}
                            >
                              <Avatar name={personName(inv.patientId)} size={40} />
                              <View style={{ flex: 1 }}>
                                <Text style={st.invName} numberOfLines={1}>{personName(inv.patientId)}</Text>
                                <Text style={st.invMeta}>{new Date(inv.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })} · {(inv.items || []).length} dịch vụ</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                <Text style={[st.invAmount, paid && { color: '#0F9D6B' }]}>{formatVnd(owedOf(inv))}</Text>
                                <View style={[st.invPill, paid ? st.invPillPaid : st.invPillPending]}>
                                  <Text style={[st.invPillText, { color: paid ? '#0B7A53' : '#B45309' }]}>{paid ? 'Đã thu' : inv.status === 'chờ thanh toán' ? 'Chờ thu' : inv.status === 'đang xử lý' ? 'Đã thu · kẹt kho' : inv.status}</Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          </Reveal>
                        );
                      })}
                    </View>

                    {/* Biên lai chi tiết */}
                    {selectedInvoice && (() => {
                      const inv = selectedInvoice;
                      const bhytCovered = inv.bhytInfo?.bhytAmount > 0;
                      const mustPay = owedOf(inv);
                      const paid = isPaidStatus(inv.status);
                      return (
                        <Reveal key={inv._id} style={[st.receipt, isWide && { flex: 1.1 }]}>
                          <View style={st.receiptTop}>
                            <View>
                              <Text style={st.receiptEyebrow}>BIÊN LAI VIỆN PHÍ</Text>
                              <Text style={st.receiptName}>{personName(inv.patientId)}</Text>
                              <Text style={st.receiptSub}>Mã lượt khám #{String(inv.visitId?._id || inv.visitId || '').slice(-6).toUpperCase()}</Text>
                            </View>
                            <View style={st.receiptIcon}><ReceiptText size={22} color="#B45309" /></View>
                          </View>

                          <View style={st.receiptItems}>
                            {(inv.items || []).map((item, idx) => (
                              <View key={idx} style={st.lineRow}>
                                <Text style={st.lineDesc} numberOfLines={2}>{item.description}</Text>
                                <View style={st.lineDots} />
                                <Text style={st.lineAmount}>{formatVnd(item.amount)}</Text>
                              </View>
                            ))}
                            <View style={[st.lineRow, { marginTop: 6 }]}>
                              <Text style={[st.lineDesc, { fontWeight: '700' }]}>Tổng chi phí</Text>
                              <View style={st.lineDots} />
                              <Text style={[st.lineAmount, { fontWeight: '800' }]}>{formatVnd(inv.totalAmount)}</Text>
                            </View>
                            {bhytCovered ? (
                              <View style={st.lineRow}>
                                <Text style={[st.lineDesc, { color: '#0B7A53' }]}>BHYT chi trả ({inv.bhytInfo.coverageRate}%){inv.bhytInfo.autoApplied ? ' · tự áp dụng' : ''}</Text>
                                <View style={st.lineDots} />
                                <Text style={[st.lineAmount, { color: '#0B7A53' }]}>-{formatVnd(inv.bhytInfo.bhytAmount)}</Text>
                              </View>
                            ) : (
                              <Text style={st.receiptNote}>Chưa khấu trừ BHYT cho hóa đơn này.</Text>
                            )}
                          </View>

                          <View style={st.dueBox}>
                            <Text style={st.dueLabel}>{paid ? 'Đã thu' : bhytCovered ? 'Bệnh nhân đồng chi trả' : 'Bệnh nhân cần trả'}</Text>
                            <Text style={st.dueValue}>{formatVnd(mustPay)}</Text>
                          </View>

                          {paid ? (
                            <View style={{ gap: 14 }}>
                              <View style={st.stamp}><Text style={st.stampText}>ĐÃ THANH TOÁN</Text></View>
                              {/* Tiền VietQR về sau khi hóa đơn đã thu → bệnh nhân trả 2 lần, cần hoàn khoản dư */}
                              {inv.duplicatePayment?.flagged && (
                                <View style={st.dupBox}>
                                  <Text style={st.dupTitle}>⚠ Phát hiện thu trùng — cần hoàn {formatVnd(inv.duplicatePayment.amount)}</Text>
                                  <Text style={st.dupText}>{inv.duplicatePayment.note}</Text>
                                </View>
                              )}
                              {inv.dispenseWarning ? (
                                <View style={st.dupBox}>
                                  <Text style={st.dupTitle}>⚠ Cần dược sĩ kiểm tra xuất kho thuốc</Text>
                                  <Text style={st.dupText}>{inv.dispenseWarning}</Text>
                                </View>
                              ) : null}
                              {(inv.payosLinks || []).length > 0 && (
                                <TouchableOpacity onPress={() => reconcileVietQR(inv._id)} style={{ alignSelf: 'center' }}>
                                  <Text style={[st.hintText, { color: '#1A5FD0', fontWeight: '700', textDecorationLine: 'underline' }]}>Đối soát VietQR ({inv.payosLinks.length} mã đã tạo)</Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity onPress={() => openBankTransfer(inv)} style={{ alignSelf: 'center' }}>
                                <Text style={[st.hintText, { color: '#64748B', fontWeight: '700', textDecorationLine: 'underline' }]}>Sao kê có thêm khoản chuyển khoản cho hóa đơn này?</Text>
                              </TouchableOpacity>
                              <View style={st.payRow}>
                                <TouchableOpacity style={[st.payBtn, { backgroundColor: '#0B2A5B' }]} onPress={() => printReceipt(inv)} dataSet={{ hover: 'glow' }}>
                                  <Printer size={17} color="#FFFFFF" />
                                  <Text style={st.payBtnText}>In biên lai</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[st.payBtn, st.refundBtn]} onPress={() => { setRefundReason(REFUND_REASONS[0]); setRefundNote(''); setRefundTarget(inv); }} dataSet={{ hover: 'tint' }}>
                                  <Undo2 size={17} color="#DC2626" />
                                  <Text style={[st.payBtnText, { color: '#DC2626' }]}>Hoàn tiền</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : inv.status === 'hoàn trả' ? (
                            <View style={[st.stamp, { borderColor: '#DC2626' }]}><Text style={[st.stampText, { color: '#DC2626' }]}>ĐÃ HOÀN TRẢ</Text></View>
                          ) : inv.status === 'đang xử lý' ? (
                            /* Đã nhận tiền (VietQR / chuyển khoản) nhưng chưa trừ được kho thuốc → dược sĩ nhập kho bù hoặc hoàn tiền */
                            <View style={{ gap: 14 }}>
                              <View style={[st.stamp, { borderColor: '#B45309' }]}><Text style={[st.stampText, { color: '#B45309' }]}>ĐÃ NHẬN TIỀN · CHỜ XUẤT KHO</Text></View>
                              <View style={st.dupBox}>
                                <Text style={st.dupTitle}>⚠ Chưa xuất được kho thuốc — đã báo dược sĩ</Text>
                                <Text style={st.dupText}>{inv.dispenseWarning || inv.paymentNotes || 'Hóa đơn đang chờ dược sĩ nhập kho bù hoặc hoàn tiền.'} Không thu thêm tiền của bệnh nhân.</Text>
                              </View>
                            </View>
                          ) : inv.status === 'chờ thanh toán' ? (
                            <View style={{ gap: 10 }}>
                              {bhytCovered && owedOf(inv) <= 0 ? (
                                /* BHYT chi trả 100% → không thu tiền, chỉ xác nhận */
                                <TouchableOpacity style={[st.payBtn, { backgroundColor: '#7C3AED' }]} onPress={() => confirmBhytFullPayment(inv._id, inv.bhytInfo?.bhytAmount)} dataSet={{ hover: 'glow' }}>
                                  <ShieldCheck size={18} color="#FFFFFF" />
                                  <Text style={st.payBtnText}>Xác nhận BHYT chi trả 100%</Text>
                                </TouchableOpacity>
                              ) : (
                              <View style={st.payRow}>
                                <TouchableOpacity style={[st.payBtn, { backgroundColor: '#0F9D6B' }]} onPress={() => handlePayInvoice(inv._id)} dataSet={{ hover: 'glow' }}>
                                  <Banknote size={18} color="#FFFFFF" />
                                  <Text style={st.payBtnText}>Thu tiền mặt</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[st.payBtn, { backgroundColor: '#1A5FD0' }]} onPress={() => handlePayOSPayment(inv._id)} dataSet={{ hover: 'glow' }}>
                                  <QrCode size={18} color="#FFFFFF" />
                                  <Text style={st.payBtnText}>VietQR PayOS</Text>
                                </TouchableOpacity>
                              </View>
                              )}
                              {canApplyBhyt && (
                                <TouchableOpacity onPress={() => openBankTransfer(inv)} style={{ alignSelf: 'center' }}>
                                  <Text style={[st.hintText, { color: '#1A5FD0', fontWeight: '700', textDecorationLine: 'underline' }]}>Bệnh nhân đã chuyển khoản (mã QR hết hạn / chuyển trực tiếp)? Ghi nhận theo sao kê</Text>
                                </TouchableOpacity>
                              )}
                              {/* Khấu trừ BHYT là nghiệp vụ của tiếp đón/viện phí (backend chỉ cho lễ tân & quản trị) */}
                              {!bhytCovered && !canApplyBhyt && (
                                <View style={[st.bhytApply, { opacity: 0.6 }]}>
                                  <Lock size={15} color="#64748B" />
                                  <Text style={[st.bhytApplyText, { color: '#64748B' }]}>Chỉ lễ tân / thu ngân được áp dụng BHYT</Text>
                                </View>
                              )}
                              {!bhytCovered && canApplyBhyt && (
                                <TouchableOpacity
                                  style={st.bhytApply}
                                  onPress={() => handleApplyBhyt(inv)}
                                  disabled={applyingBhytId === inv._id}
                                  dataSet={{ hover: 'tint' }}
                                >
                                  <ShieldCheck size={16} color="#7C3AED" />
                                  <Text style={st.bhytApplyText}>{applyingBhytId === inv._id ? 'Đang tính quyền lợi...' : 'Áp dụng BHYT trước khi thu'}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ) : null}
                        </Reveal>
                      );
                    })()}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── MODAL KHAI BÁO THẺ BHYT (có thẻ xem trước) ─────────────────────── */}
      <Modal visible={showBhytModal} transparent animationType="fade" onRequestClose={() => setShowBhytModal(false)}>
        <View style={st.modalOverlay}>
          <ScrollView style={{ width: '100%', maxWidth: bhytWide ? 940 : 560 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 12 }}>
          <View style={[st.modalBox, { maxWidth: bhytWide ? 940 : 560 }]}>
            <View style={st.modalHead}>
              <Text style={st.modalTitle}>Khai báo thẻ BHYT</Text>
              <TouchableOpacity style={st.modalClose} onPress={() => setShowBhytModal(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Màn hình rộng: 2 cột (trái: thông tin thẻ · phải: đối soát & xác nhận) để vừa khung, không phải cuộn */}
            <View style={bhytWide && { flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
            <View style={bhytWide && { flex: 1 }}>
            {/* Thẻ đang dùng (đã khai báo trước đó) — khai báo thẻ mới sẽ chuyển thẻ này vào lịch sử */}
            {activeCard ? (
              <View style={[st.currentCard, activeCard.manuallyVerified === false && { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' }, activeCard.expired && { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={16} color={activeCard.expired ? '#DC2626' : '#0F9D6B'} />
                  <Text style={[st.currentCardTitle, activeCard.expired && { color: '#DC2626' }]}>
                    {activeCard.expired ? 'Thẻ đang lưu ĐÃ HẾT HẠN' : activeCard.manuallyVerified === false ? 'Thẻ đang lưu — CHƯA XÁC MINH' : 'Thẻ đang dùng'}
                  </Text>
                </View>
                <Text style={st.currentCardLine}>
                  {activeCard.cardMasked} · mức hưởng {activeCard.benefitLevel} ({activeCard.coverageRate}%) · HSD {activeCard.expiresAt ? new Date(activeCard.expiresAt).toLocaleDateString('vi-VN') : '—'}
                </Text>
                <Text style={st.currentCardMeta}>
                  Xác minh bởi {activeCard.verifiedByName || '—'}{activeCard.verifiedAt ? ` lúc ${new Date(activeCard.verifiedAt).toLocaleString('vi-VN')}` : ''}
                  {activeCard.mismatches?.length ? ` · lệch: ${activeCard.mismatches.join(', ')} (${activeCard.mismatchNote})` : ''}
                </Text>
                {activeCard.manuallyVerified === false ? (
                  <Text style={[st.currentCardMeta, { color: '#B45309', fontWeight: '700' }]}>Thẻ này CHƯA được lễ tân xác minh nên chưa áp dụng được vào hóa đơn. Hãy nhập lại mã thẻ in trên thẻ gốc, đối soát và tick xác nhận để xác minh.</Text>
                ) : (
                  <Text style={st.currentCardMeta}>Nhập thẻ bên dưới nếu bệnh nhân gia hạn hoặc đổi thẻ mới.</Text>
                )}
              </View>
            ) : (
              <Text style={[st.hintText, { marginBottom: 12 }]}>Bệnh nhân chưa có thẻ BHYT trong hệ thống.</Text>
            )}

            {/* UC-PAT-02: thẻ bệnh nhân tự khai trên app (chỉ để điền nhanh — vẫn phải đối chiếu thẻ gốc) */}
            {declared.loading ? (
              <Text style={[st.hintText, { marginBottom: 10 }]}>Đang kiểm tra thẻ bệnh nhân tự khai…</Text>
            ) : declared.data ? (
              <View style={st.declaredBox}>
                <Text style={st.declaredTitle}>
                  {declared.data.bhyt.status === 'verified' ? 'Bệnh nhân tự khai trên app (đã xác nhận)' : 'Bệnh nhân tự khai trên app — cần đối chiếu thẻ gốc'}
                </Text>
                <Text style={st.declaredLine}>
                  {declared.data.bhyt.cardNumber}
                  {declared.data.bhyt.expiresAt ? ` · HSD ${new Date(declared.data.bhyt.expiresAt).toLocaleDateString('vi-VN')}` : ''}
                  {declared.data.bhyt.registrationPlace ? ` · ${declared.data.bhyt.registrationPlace}` : ''}
                </Text>
                <TouchableOpacity style={st.declaredBtn} onPress={fillFromDeclared}>
                  <Text style={st.declaredBtnText}>Điền theo thông tin này</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Thẻ bảo hiểm xem trước */}
            <View style={[st.insCard, !cardCheck.ok && !cardCheck.empty && { backgroundColor: '#B45309' }]} dataSet={{ bg: 'band' }}>
              <View style={st.insCardTop}>
                <Text style={st.insCardBrand}>BẢO HIỂM Y TẾ</Text>
                <View style={st.insRate}><Text style={st.insRateText}>{bhytCoverageRate ? `${bhytCoverageRate}%` : '—'}</Text></View>
              </View>
              <Text style={st.insNumber}>{cardPretty}</Text>
              <View style={st.insCardBottom}>
                <View style={{ flex: 1 }}>
                  <Text style={st.insLabel}>Họ tên</Text>
                  <Text style={st.insValue} numberOfLines={1}>{holderName || '—'}</Text>
                </View>
                <View>
                  <Text style={st.insLabel}>Hạn thẻ</Text>
                  <Text style={st.insValue}>{bhytExpiryDate || '—'}</Text>
                </View>
              </View>
            </View>

            {/* 1. Mã thẻ → hệ thống tự kiểm tra mã đối tượng & tự ghi nhận tỷ lệ chi trả */}
            <Text style={st.fieldLabel}>Mã số thẻ BHYT (15 ký tự)</Text>
            <TextInput
              style={[st.modalInput, !cardCheck.ok && !cardCheck.empty && { borderColor: '#F59E0B' }]}
              placeholder="VD: SV4484420058886"
              placeholderTextColor="#94A3B8"
              value={bhytCardNumber}
              onChangeText={handleBhytCardChange}
              autoCapitalize="characters"
              maxLength={15}
            />
            {cardCheck.ok ? (
              <View style={st.rateBox}>
                <Check size={14} color="#0B7A53" strokeWidth={3} />
                <Text style={st.rateBoxText}>
                  Mã đối tượng <Text style={{ fontWeight: '900' }}>{cardCheck.objectCode}</Text> · mức hưởng <Text style={{ fontWeight: '900' }}>{cardCheck.benefitLevel}</Text> → BHYT chi trả <Text style={{ fontWeight: '900' }}>{cardCheck.coverageRate}%</Text> (khám đúng tuyến)
                </Text>
              </View>
            ) : (
              <Text style={[st.hintText, !cardCheck.empty && { color: '#B45309' }]}>
                {cardCheck.empty ? 'Tỷ lệ chi trả được hệ thống tự ghi nhận theo ký tự thứ 3 của mã thẻ.' : cardCheck.error}
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>Hạn thẻ (YYYY-MM-DD)</Text>
                <TextInput style={[st.modalInput, (expiryExpired || expiryError) && { borderColor: '#DC2626' }]} value={bhytExpiryDate} onChangeText={(t) => setBhytExpiryDate(formatDateDigits(t))} placeholder="Gõ số: 20271231" placeholderTextColor="#94A3B8" keyboardType="number-pad" maxLength={10} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>Nơi đăng ký KCB ban đầu</Text>
                <TextInput style={st.modalInput} placeholder="VD: BV Đa khoa Đà Nẵng" placeholderTextColor="#94A3B8" value={bhytRegistrationPlace} onChangeText={setBhytRegistrationPlace} />
              </View>
            </View>
            {expiryError && <Text style={[st.hintText, { color: '#DC2626', marginTop: -4 }]}>{expiryError}</Text>}
            {expiryExpired && <Text style={[st.hintText, { color: '#DC2626', marginTop: -4 }]}>Thẻ đã hết hạn — không thể lưu. Bệnh nhân cần gia hạn thẻ hoặc tự chi trả.</Text>}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              {[
                { on: bhytIsOutOfNetwork, set: () => setBhytIsOutOfNetwork(!bhytIsOutOfNetwork), label: 'Trái tuyến', color: '#B45309' },
                { on: bhytHasTransferForm, set: () => setBhytHasTransferForm(!bhytHasTransferForm), label: 'Có giấy chuyển tuyến', color: '#0B7A53' },
              ].map(t => (
                <TouchableOpacity key={t.label} style={[st.toggle, t.on && { borderColor: t.color, backgroundColor: `${t.color}12` }]} onPress={t.set}>
                  <View style={[st.toggleBox, t.on && { backgroundColor: t.color, borderColor: t.color }]}>
                    {t.on && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={[st.toggleText, t.on && { color: t.color }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            </View>
            <View style={bhytWide && { flex: 1 }}>
            {/* 2. Đối soát: nhập thông tin IN TRÊN THẺ, hệ thống so ngay với hồ sơ bệnh nhân (bắt trường hợp dùng thẻ người khác) */}
            <Text style={[st.fieldLabel, { marginTop: bhytWide ? 0 : 14 }]}>Thông tin in trên thẻ</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1.5 }}>
                <TextInput style={[st.modalInput, { marginBottom: 2 }, holderRows[0].state === 'mismatch' && { borderColor: '#F87171' }]} value={holderName} onChangeText={setHolderName} placeholder="Họ tên trên thẻ" placeholderTextColor="#94A3B8" />
                <HolderCheck row={holderRows[0]} />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput style={[st.modalInput, { marginBottom: 2 }, (holderRows[1].state === 'mismatch' || birthError) && { borderColor: '#F87171' }]} value={holderBirthDate} onChangeText={(t) => setHolderBirthDate(formatDateDigits(t))} placeholder="Ngày sinh (gõ số: 20050905)" placeholderTextColor="#94A3B8" keyboardType="number-pad" maxLength={10} />
                {birthError
                  ? <Text style={{ fontSize: 11, marginBottom: 6, color: '#DC2626' }}>{birthError}</Text>
                  : <HolderCheck row={holderRows[1]} />}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <View style={[st.segment, holderRows[2].state === 'mismatch' && { borderWidth: 1, borderColor: '#F87171' }]}>
                {['Nam', 'Nữ'].map(g => (
                  <TouchableOpacity key={g} style={[st.segmentItem, holderGender === g && st.segmentItemActive]} onPress={() => setHolderGender(g)}>
                    <Text style={[st.segmentText, holderGender === g && st.segmentTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <HolderCheck row={holderRows[2]} />
            </View>
            {holderMismatches.length > 0 && (
              <>
                <Text style={[st.hintText, { color: '#DC2626', marginTop: 8 }]}>
                  Thông tin lệch: {holderMismatches.join(', ')}. Kiểm tra lại thẻ và CCCD; nếu vẫn đúng người thì ghi lý do.
                </Text>
                <TextInput style={st.modalInput} value={mismatchNote} onChangeText={setMismatchNote} placeholder="VD: Hồ sơ nhập sai năm sinh, CCCD khớp với thẻ" placeholderTextColor="#94A3B8" />
              </>
            )}

            {/* 3. Lễ tân kiểm tra tay thẻ gốc rồi tick xác nhận (bắt buộc) */}
            <TouchableOpacity style={[st.verifyTick, bhytVerified && st.verifyTickOn]} onPress={() => setBhytVerified(!bhytVerified)}>
              <View style={[st.toggleBox, bhytVerified && { backgroundColor: '#0F9D6B', borderColor: '#0F9D6B' }]}>
                {bhytVerified && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={[st.toggleText, { flex: 1 }, bhytVerified && { color: '#0B7A53' }]}>
                Đã đối chiếu thẻ BHYT gốc với CCCD/giấy tờ tùy thân: đúng người, thẻ còn hạn.
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={st.btnGhost} onPress={() => setShowBhytModal(false)}>
                <Text style={st.btnGhostText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.btnSolid, (savingBhyt || !canSaveBhyt) && { opacity: 0.5 }]} onPress={handleSaveBhyt} disabled={savingBhyt || !canSaveBhyt}>
                <Text style={st.btnSolidText}>{savingBhyt ? 'Đang lưu...' : 'Lưu thẻ đã xác minh'}</Text>
              </TouchableOpacity>
            </View>
            </View>
            </View>
          </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── UC-REC-01: MODAL TẠO HỒ SƠ BỆNH NHÂN MỚI ─────────────────────────── */}
      <Modal visible={showNewPatient} transparent animationType="fade" onRequestClose={() => setShowNewPatient(false)}>
        <View style={st.modalOverlay}>
          <ScrollView style={{ width: '100%', maxWidth: 560 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={[st.modalBox, { maxWidth: 560 }]}>
              <View style={st.modalHead}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={st.modalIcon}><IdCard size={18} color="#1A5FD0" /></View>
                  <Text style={st.modalTitle}>Tạo hồ sơ bệnh nhân mới</Text>
                </View>
                <TouchableOpacity style={st.modalClose} onPress={() => setShowNewPatient(false)}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={st.hintText}>Hệ thống tự cấp mã y tế (BN…). SĐT và CCCD được mã hóa khi lưu, chỉ hiển thị 4 số cuối.</Text>

              {/* Mức ưu tiên của lượt khám sắp tạo (không lưu vào hồ sơ) — chuyển sẵn sang bước 4 */}
              <Text style={st.fieldLabel}>Mức độ ưu tiên</Text>
              <View style={st.priorityRow}>
                {[
                  { k: 'trung bình', label: 'Thường', sub: 'Khám theo số thứ tự', color: '#1A5FD0', bg: '#E8F0FD' },
                  { k: 'khẩn cấp', label: 'Cấp cứu', sub: 'Ưu tiên lên đầu hàng chờ', color: '#DC2626', bg: '#FEF2F2' },
                ].map(o => {
                  const on = newPatient.priority === o.k;
                  return (
                    <TouchableOpacity key={o.k} style={[st.priorityOpt, on && { borderColor: o.color, backgroundColor: o.bg }]} onPress={() => setNewPatient({ ...newPatient, priority: o.k })}>
                      <View style={[st.radio, on && { borderColor: o.color }]}>{on && <View style={[st.radioDot, { backgroundColor: o.color }]} />}</View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {o.k === 'khẩn cấp' && <Siren size={14} color={o.color} />}
                          <Text style={[st.priorityLabel, on && { color: o.color }]}>{o.label}</Text>
                        </View>
                        <Text style={st.prioritySub}>{o.sub}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {newPatient.priority === 'khẩn cấp' && (
                <View style={st.emergencyNote}>
                  <Siren size={14} color="#DC2626" />
                  <Text style={st.emergencyNoteText}>Ca cấp cứu được tạo hồ sơ ngay cả khi chưa có SĐT/CCCD (bệnh nhân bất tỉnh, chưa rõ danh tính). Bổ sung giấy tờ sau.</Text>
                </View>
              )}

              <Text style={st.fieldLabel}>Họ và tên {newPatient.priority === 'khẩn cấp' ? '(để trống nếu chưa rõ)' : '*'}</Text>
              <TextInput style={st.modalInput} value={newPatient.name} onChangeText={(v) => setNewPatient({ ...newPatient, name: v })} placeholder="VD: Nguyễn Văn An" placeholderTextColor="#94A3B8" />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>Số điện thoại</Text>
                  <TextInput style={st.modalInput} value={newPatient.phone} onChangeText={(v) => setNewPatient({ ...newPatient, phone: v })} placeholder="0912345678" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>Số CCCD (12 số)</Text>
                  <TextInput style={st.modalInput} value={newPatient.cccd} onChangeText={(v) => setNewPatient({ ...newPatient, cccd: v.replace(/\D/g, '') })} placeholder="079204012345" placeholderTextColor="#94A3B8" maxLength={12} keyboardType="number-pad" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>Năm sinh</Text>
                  <TextInput style={st.modalInput} value={newPatient.birthYear} onChangeText={(v) => setNewPatient({ ...newPatient, birthYear: v.replace(/\D/g, '') })} placeholder="1985" placeholderTextColor="#94A3B8" maxLength={4} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>Giới tính</Text>
                  <View style={st.segment}>
                    {['Nam', 'Nữ'].map(g => (
                      <TouchableOpacity key={g} style={[st.segmentItem, newPatient.gender === g && st.segmentItemActive]} onPress={() => setNewPatient({ ...newPatient, gender: g })}>
                        <Text style={[st.segmentText, newPatient.gender === g && st.segmentTextActive]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <Text style={st.fieldLabel}>Địa chỉ</Text>
              <TextInput style={st.modalInput} value={newPatient.address} onChangeText={(v) => setNewPatient({ ...newPatient, address: v })} placeholder="Số nhà, phường/xã, tỉnh/thành" placeholderTextColor="#94A3B8" />
              <Text style={st.fieldLabel}>Email nhận thông báo {newPatient.priority === 'khẩn cấp' ? '(bổ sung sau nếu chưa có)' : '*'}</Text>
              <TextInput style={st.modalInput} value={newPatient.email} onChangeText={(v) => setNewPatient({ ...newPatient, email: v.trim() })} placeholder="VD: nguyenvanan@gmail.com — nhận lịch khám, dời lịch, hoàn tiền" placeholderTextColor="#94A3B8" autoCapitalize="none" keyboardType="email-address" />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity style={st.btnGhost} onPress={() => setShowNewPatient(false)}>
                  <Text style={st.btnGhostText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.btnSolid, { backgroundColor: '#1A5FD0' }, creatingPatient && { opacity: 0.6 }]} onPress={handleCreatePatient} disabled={creatingPatient}>
                  <Text style={st.btnSolidText}>{creatingPatient ? 'Đang tạo...' : 'Tạo hồ sơ & chọn bệnh nhân'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── UC-REC-03: PHIẾU SỐ THỨ TỰ SAU KHI TẠO LƯỢT KHÁM ────────────────── */}
      <Modal visible={!!queueTicket} transparent animationType="fade" onRequestClose={() => setQueueTicket(null)}>
        <View style={st.modalOverlay}>
          {queueTicket && (
            <View style={[st.modalBox, { maxWidth: 400, alignItems: 'center' }]}>
              <View style={[st.modalIcon, { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E3F7EF' }]}>
                <BadgeCheck size={26} color="#0F9D6B" />
              </View>
              <Text style={[st.modalTitle, { marginTop: 10 }]}>Đã tạo lượt khám</Text>
              <Text style={st.hintText}>Số thứ tự trong ngày</Text>
              <View style={[st.ticketNumber, queueTicket.priority === 'khẩn cấp' && { backgroundColor: '#DC2626' }]}>
                <Text style={st.ticketNumberText}>
                  {queueTicket.priority === 'khẩn cấp' ? 'CC-' : ''}{String(queueTicket.queueNumber || 0).padStart(3, '0')}
                </Text>
              </View>
              <View style={{ alignSelf: 'stretch', gap: 6, marginTop: 8 }}>
                {[
                  ['Bệnh nhân', queueTicket.patientName],
                  ['Mã y tế', queueTicket.medicalId || '—'],
                  ['Phòng khám', queueTicket.clinicRoom],
                  ['Bác sĩ', `BS. ${queueTicket.doctorName}`],
                  ['Ưu tiên', queueTicket.priority === 'khẩn cấp' ? 'CẤP CỨU' : 'Thường'],
                ].map(([k, val]) => (
                  <View key={k} style={st.ticketRow}>
                    <Text style={st.ticketKey}>{k}</Text>
                    <Text style={[st.ticketVal, k === 'Ưu tiên' && queueTicket.priority === 'khẩn cấp' && { color: '#DC2626' }]} numberOfLines={1}>{val}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' }}>
                <TouchableOpacity style={st.btnGhost} onPress={() => { setQueueTicket(null); setActiveTab('myQueue'); }}>
                  <Text style={st.btnGhostText}>Xem hàng chờ</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.btnSolid, { flexDirection: 'row', justifyContent: 'center', gap: 8 }]} onPress={() => printQueueTicket(queueTicket)}>
                  <Printer size={16} color="#FFFFFF" />
                  <Text style={st.btnSolidText}>In phiếu số</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setQueueTicket(null)} style={{ marginTop: 12 }}>
                <Text style={[st.hintText, { color: '#1A5FD0', fontWeight: '700' }]}>Tiếp nhận bệnh nhân tiếp theo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ── UC-REC-08: MÃ VIETQR PAYOS TẠI QUẦY ────────────────────────────── */}
      <Modal visible={!!qrPayment} transparent animationType="fade" onRequestClose={() => setQrPayment(null)}>
        <View style={st.modalOverlay}>
          {qrPayment && (
            <View style={[st.modalBox, { maxWidth: 420, alignItems: 'center' }]}>
              <View style={[st.modalHead, { alignSelf: 'stretch' }]}>
                <Text style={st.modalTitle}>Quét mã VietQR</Text>
                <TouchableOpacity style={st.modalClose} onPress={() => setQrPayment(null)}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
              {qrPayment.image ? (
                <View style={st.qrFrame}>
                  {React.createElement('img', { src: qrPayment.image, alt: 'VietQR', style: { width: 260, height: 260, display: 'block' } })}
                </View>
              ) : (
                <View style={[st.qrFrame, { width: 260, height: 160, alignItems: 'center', justifyContent: 'center' }]}>
                  <QrCode size={40} color="#94A3B8" />
                  <Text style={[st.hintText, { textAlign: 'center', marginTop: 8 }]}>Trang thanh toán PayOS đã mở ở tab mới.</Text>
                </View>
              )}
              <Text style={st.qrAmount}>{formatVnd(qrPayment.amount)}</Text>
              <Text style={st.hintText}>Phần bệnh nhân đồng chi trả (đã trừ BHYT)</Text>
              <View style={st.qrWaiting}>
                <ActivityIndicator size="small" color="#1A5FD0" />
                <Text style={{ color: '#1A5FD0', fontWeight: '700', fontSize: 13 }}>Đang chờ thanh toán — tự cập nhật khi tiền về</Text>
              </View>
              {qrPayment.expiresAt ? (
                <Text style={[st.hintText, { marginTop: -4 }]}>
                  {qrPayment.reused ? 'Đang hiển thị lại mã cũ (chưa hết hạn) · ' : ''}Mã có hiệu lực đến {new Date(qrPayment.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              ) : null}
              {qrPayment.checkoutUrl ? (
                <TouchableOpacity onPress={() => (typeof window !== 'undefined' ? window.open(qrPayment.checkoutUrl, '_blank') : Linking.openURL(qrPayment.checkoutUrl))}>
                  <Text style={[st.hintText, { color: '#1A5FD0', textDecorationLine: 'underline' }]}>Mở trang thanh toán PayOS</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      </Modal>

      {/* ── GHI NHẬN CHUYỂN KHOẢN THEO SAO KÊ NGÂN HÀNG ─────────────────────── */}
      <Modal visible={!!bankTarget} transparent animationType="fade" onRequestClose={() => setBankTarget(null)}>
        <View style={st.modalOverlay}>
          {bankTarget && (
            <View style={st.modalBox}>
              <View style={st.modalHead}>
                <Text style={st.modalTitle}>Ghi nhận chuyển khoản</Text>
                <TouchableOpacity style={st.modalClose} onPress={() => setBankTarget(null)}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={st.hintText}>
                {personName(bankTarget.patientId)} · HĐ #{String(bankTarget._id).slice(-8).toUpperCase()}
                {bankTarget.status === 'chờ thanh toán' ? ` · phải trả ${formatVnd(owedOf(bankTarget))}` : ' · hóa đơn ĐÃ thanh toán (khoản này sẽ được gắn cờ thu trùng)'}
              </Text>
              <Text style={st.hintText}>Chỉ ghi nhận khi đã thấy khoản tiền trên sao kê tài khoản ngân hàng của bệnh viện (nội dung "Thanh toan HD …").</Text>
              <Text style={[st.fieldLabel, { marginTop: 8 }]}>Mã giao dịch / số bút toán trên sao kê *</Text>
              <TextInput style={st.modalInput} value={bankRef} onChangeText={setBankRef} placeholder="VD: FT26292123456" placeholderTextColor="#94A3B8" autoCapitalize="characters" />
              <Text style={st.fieldLabel}>Số tiền nhận được (đ) *</Text>
              <TextInput style={st.modalInput} value={bankAmount} onChangeText={(t) => setBankAmount(t.replace(/\D/g, ''))} placeholder="VD: 330000" placeholderTextColor="#94A3B8" keyboardType="number-pad" />
              <Text style={st.fieldLabel}>Ghi chú</Text>
              <TextInput style={st.modalInput} value={bankNote} onChangeText={setBankNote} placeholder="VD: Bệnh nhân quét mã đã hết hạn lúc 10:05" placeholderTextColor="#94A3B8" />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity style={st.btnGhost} onPress={() => setBankTarget(null)}>
                  <Text style={st.btnGhostText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.btnSolid, { backgroundColor: '#1A5FD0' }, (savingBank || !bankRef.trim() || !(Number(bankAmount) > 0)) && { opacity: 0.5 }]} onPress={handleRecordBank} disabled={savingBank || !bankRef.trim() || !(Number(bankAmount) > 0)}>
                  <Text style={st.btnSolidText}>{savingBank ? 'Đang ghi nhận...' : 'Ghi nhận chuyển khoản'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ── UC-REC-09: MODAL HOÀN TRẢ VIỆN PHÍ ─────────────────────────────── */}
      <Modal visible={!!refundTarget} transparent animationType="fade" onRequestClose={() => setRefundTarget(null)}>
        <View style={st.modalOverlay}>
          {refundTarget && (
            <View style={st.modalBox}>
              <View style={st.modalHead}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[st.modalIcon, { backgroundColor: '#FEE2E2' }]}><Undo2 size={18} color="#DC2626" /></View>
                  <Text style={st.modalTitle}>Hoàn trả viện phí</Text>
                </View>
                <TouchableOpacity style={st.modalClose} onPress={() => setRefundTarget(null)}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={st.hintText}>
                {personName(refundTarget.patientId)} · HĐ #{String(refundTarget._id).slice(-8).toUpperCase()} · hoàn {formatVnd(owedOf(refundTarget))}
              </Text>
              <Text style={[st.fieldLabel, { marginTop: 10 }]}>Lý do hoàn trả</Text>
              <View style={{ gap: 8 }}>
                {REFUND_REASONS.map(r => (
                  <TouchableOpacity key={r} style={[st.verifyTick, refundReason === r && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]} onPress={() => setRefundReason(r)}>
                    <View style={[st.radio, refundReason === r && { borderColor: '#DC2626' }]}>
                      {refundReason === r && <View style={st.radioDot} />}
                    </View>
                    <Text style={[st.toggleText, { flex: 1 }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[st.fieldLabel, { marginTop: 10 }]}>Ghi chú thêm</Text>
              <TextInput style={[st.modalInput, { minHeight: 60 }]} multiline value={refundNote} onChangeText={setRefundNote} placeholder="VD: BS. chỉ định hủy chụp, BN có máy tạo nhịp" placeholderTextColor="#94A3B8" />
              <Text style={st.hintText}>Hóa đơn từ 10 triệu cần thêm một người phê duyệt thứ hai.</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={st.btnGhost} onPress={() => setRefundTarget(null)}>
                  <Text style={st.btnGhostText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.btnSolid, { backgroundColor: '#DC2626' }, refunding && { opacity: 0.6 }]} onPress={handleRefund} disabled={refunding}>
                  <Text style={st.btnSolidText}>{refunding ? 'Đang hoàn trả...' : 'Xác nhận hoàn trả'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {dialog}
    </ResponsiveLayout>
  );
};

// Dòng đối chiếu nhỏ dưới mỗi ô: chỉ báo khớp / lệch, không để lộ dữ liệu hồ sơ
const HolderCheck = ({ row }) => (
  <Text style={{ fontSize: 11, marginBottom: 6, color: row.state === 'mismatch' ? '#DC2626' : row.state === 'ok' ? '#0F9D6B' : '#94A3B8' }} numberOfLines={1}>
    {row.state === 'ok' ? '✓ Khớp hồ sơ' : row.state === 'mismatch' ? '✗ Lệch hồ sơ' : row.file === '—' ? 'Hồ sơ chưa có thông tin này' : ' '}
  </Text>
);

// Tiêu đề mỗi bước trong wizard tiếp nhận
const StepHead = ({ n, done, title, hint, children }) => (
  <View style={st.stepHead}>
    <View style={[st.stepNum, done && st.stepNumDone]}>
      {done ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : <Text style={st.stepNumText}>{n}</Text>}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={st.stepTitle}>{title}</Text>
      {hint ? <Text style={st.stepHint}>{hint}</Text> : null}
    </View>
    {children}
  </View>
);

const isWebPlatform = Platform.OS === 'web';
const cardShadow = isWebPlatform ? { boxShadow: '0 12px 30px -20px rgba(11,42,91,0.35)' } : { elevation: 2 };

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F3F7FC' },
  pageContent: { padding: 28, paddingBottom: 56, maxWidth: 1360, width: '100%', alignSelf: 'center', gap: 20 },
  muted: { color: '#94A3B8', fontSize: 13 },

  // Banner phụ
  bannerStat: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 18, padding: 18, minWidth: 220 },
  bannerStatValue: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginVertical: 2 },
  bannerStatLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  bannerProgress: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 10, overflow: 'hidden' },
  bannerProgressFill: { height: '100%', borderRadius: 3, backgroundColor: '#6FDDB2' },
  bannerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bannerChip: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, minWidth: 96 },
  bannerChipValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  bannerChipLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },

  // Thanh tab
  tabBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-start', backgroundColor: '#FFFFFF', padding: 6, borderRadius: 999, marginTop: -44, marginLeft: 24, zIndex: 3, ...(isWebPlatform ? { boxShadow: '0 14px 30px -14px rgba(11,42,91,0.45)' } : { elevation: 4 }) },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  tabActive: { backgroundColor: '#0B2A5B' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  tabTextActive: { color: '#FFFFFF' },
  tabCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0' },
  tabCountActive: { backgroundColor: '#0F9D6B' },
  tabCountWarn: { backgroundColor: '#D97706' },
  tabCountText: { fontSize: 11, fontWeight: '800', color: '#475569' },

  // Wizard tiếp nhận
  wizard: { gap: 18, alignItems: 'flex-start' },
  stepCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', width: '100%', ...cardShadow },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  stepNum: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#0F9D6B', alignItems: 'center', justifyContent: 'center' },
  stepNumDone: { backgroundColor: '#0F9D6B' },
  stepNumText: { color: '#0F9D6B', fontWeight: '800' },
  stepTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  stepHint: { fontSize: 12, color: '#64748B', marginTop: 1 },
  bhytBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7C3AED', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999 },
  bhytBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, marginBottom: 14 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#0F172A', ...(isWebPlatform ? { outlineStyle: 'none' } : {}) },
  patientGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', rowGap: 10 },
  patientCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  patientCardActive: { borderColor: '#0F9D6B', backgroundColor: '#EEFBF5' },
  patientName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  patientId: { fontSize: 11, color: '#64748B', marginTop: 1 },
  checkDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#0F9D6B', alignItems: 'center', justifyContent: 'center' },
  doctorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  doctorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  doctorCardActive: { backgroundColor: '#1A5FD0', borderColor: '#1A5FD0' },
  doctorName: { fontSize: 13, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  loadTrack: { height: 6, borderRadius: 3, backgroundColor: '#EEF2F7', marginTop: 8, overflow: 'hidden' },
  loadFill: { height: '100%', borderRadius: 3, minWidth: 6 },
  loadText: { fontSize: 11, color: '#64748B', marginTop: 4 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E3F7EF', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  suggestText: { color: '#0F9D6B', fontSize: 11, fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nurseChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, borderRadius: 999, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', maxWidth: 320 },
  nurseChipActive: { backgroundColor: '#DB2777', borderColor: '#DB2777' },
  nurseText: { fontSize: 13, fontWeight: '600', color: '#334155', flexShrink: 1 },
  segment: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 12, alignSelf: 'flex-start' },
  segmentItem: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 9 },
  segmentItemActive: { backgroundColor: '#FFFFFF', ...(isWebPlatform ? { boxShadow: '0 2px 6px rgba(15,23,42,0.12)' } : {}) },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  segmentTextActive: { color: '#0B2A5B', fontWeight: '800' },
  reasonChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  reasonChipActive: { borderColor: '#0F9D6B', backgroundColor: '#E3F7EF' },
  reasonChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  textarea: { marginTop: 12, minHeight: 90, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC', textAlignVertical: 'top' },

  // Phiếu tiếp nhận
  ticket: { backgroundColor: '#0B2A5B', borderRadius: 22, padding: 22, width: '100%', ...(isWebPlatform ? { boxShadow: '0 24px 50px -24px rgba(11,42,91,0.6)' } : { elevation: 6 }) },
  ticketSticky: { flex: 1, ...(isWebPlatform ? { position: 'sticky', top: 16 } : {}) },
  ticketHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  ticketEyebrow: { color: '#6FDDB2', fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  ticketDate: { color: '#93C5FD', fontSize: 12 },
  ticketPatient: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ticketAvatarEmpty: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderStyle: 'dashed', borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  ticketName: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  ticketSub: { color: '#93C5FD', fontSize: 12, marginTop: 2 },
  ticketCut: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, marginHorizontal: -22 },
  ticketNotchL: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F5F8FC', marginLeft: -9 },
  ticketNotchR: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F5F8FC', marginRight: -9 },
  ticketDash: { flex: 1, borderTopWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', marginHorizontal: 6 },
  ticketRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  ticketRowLabel: { color: '#93C5FD', fontSize: 12, width: 76 },
  ticketRowValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', flex: 1 },
  ticketProgress: { flexDirection: 'row', gap: 6, marginTop: 6, marginBottom: 16 },
  ticketPip: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  ticketPipDone: { backgroundColor: '#6FDDB2' },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0F9D6B', paddingVertical: 14, borderRadius: 14 },
  submitDisabled: { backgroundColor: '#334155' },
  submitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  ticketHint: { color: '#93C5FD', fontSize: 11, textAlign: 'center', marginTop: 8 },

  // Kanban
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  toolBtnPrimary: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  toolBtnText: { fontSize: 13, fontWeight: '700', color: '#4F46E5' },
  panel: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', ...cardShadow },
  board: { gap: 14, alignItems: 'flex-start' },
  column: { borderRadius: 18, padding: 12, gap: 10, width: '100%', minHeight: 160 },
  columnHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 4 },
  columnIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  columnTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  columnCount: { minWidth: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: '#FFFFFF' },
  columnCountText: { fontSize: 12, fontWeight: '800' },
  columnEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 14, paddingVertical: 22, alignItems: 'center' },
  visitCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 8, ...cardShadow },
  visitCardUrgent: { borderColor: '#FCA5A5', borderLeftWidth: 4, borderLeftColor: '#DC2626' },
  visitTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  visitName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  visitTime: { fontSize: 11, color: '#64748B', marginTop: 1 },
  visitReason: { fontSize: 12, color: '#334155', lineHeight: 17 },
  visitFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  visitDoctor: { fontSize: 11, color: '#64748B', flex: 1 },

  // POS thu ngân
  filterChip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3E3C3' },
  filterChipActive: { backgroundColor: '#B45309', borderColor: '#B45309' },
  filterChipText: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  pos: { gap: 18, alignItems: 'flex-start' },
  invRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#E2E8F0' },
  invRowActive: { borderColor: '#D97706', backgroundColor: '#FFFBF3' },
  invName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  invMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  invAmount: { fontSize: 15, fontWeight: '800', color: '#B45309' },
  invPill: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  invPillPaid: { backgroundColor: '#E3F7EF' },
  invPillPending: { backgroundColor: '#FEF3C7' },
  invPillText: { fontSize: 11, fontWeight: '800' },
  receipt: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24, borderWidth: 1, borderColor: '#F3E3C3', width: '100%', overflow: 'hidden', position: 'relative', ...(isWebPlatform ? { boxShadow: '0 24px 50px -28px rgba(146,64,14,0.45)' } : { elevation: 4 }) },
  receiptTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  receiptEyebrow: { color: '#B45309', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  receiptName: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  receiptSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  receiptIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  receiptItems: { borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#E7D3AE', paddingVertical: 14, gap: 10 },
  lineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  lineDesc: { fontSize: 13, color: '#334155', flexShrink: 1, maxWidth: '62%' },
  lineDots: { flex: 1, borderBottomWidth: 1.5, borderStyle: 'dotted', borderColor: '#CBD5E1', marginBottom: 4 },
  lineAmount: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  receiptNote: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  dueBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, marginVertical: 18 },
  dueLabel: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  dueValue: { fontSize: 28, fontWeight: '800', color: '#B45309' },
  payRow: { flexDirection: 'row', gap: 10 },
  payBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  payBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  bhytApply: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' },
  bhytApplyText: { color: '#7C3AED', fontWeight: '700', fontSize: 13 },
  stamp: { alignSelf: 'center', borderWidth: 3, borderColor: '#0F9D6B', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 22, transform: [{ rotate: '-6deg' }] },
  stampText: { color: '#0F9D6B', fontWeight: '900', fontSize: 18, letterSpacing: 2 },

  // Modal BHYT
  modalOverlay: { flex: 1, backgroundColor: 'rgba(11,42,91,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, width: '100%', maxWidth: 520 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0B2A5B' },
  modalClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  insCard: { borderRadius: 18, padding: 20, backgroundColor: '#0F9D6B', marginBottom: 18, overflow: 'hidden' },
  insCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  insCardBrand: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  insRate: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  insRateText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  insNumber: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 3, marginVertical: 18, fontVariant: ['tabular-nums'] },
  insCardBottom: { flexDirection: 'row', gap: 16 },
  insLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  insValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 4 },
  modalInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC', marginBottom: 10 },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0' },
  toggleBox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  btnGhost: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  btnGhostText: { color: '#475569', fontWeight: '700' },
  btnSolid: { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: '#0F9D6B', alignItems: 'center' },
  btnSolidText: { color: '#FFFFFF', fontWeight: '800' },

  // UC-REC: tạo hồ sơ, phân luồng, số thứ tự, VietQR, hoàn trả, đóng lượt khám
  hintText: { fontSize: 12, color: '#64748B', marginBottom: 6, lineHeight: 17 },
  newPatientBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1A5FD0', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999 },
  noMatch: { width: '100%', alignItems: 'center', gap: 12, paddingVertical: 22, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CBD5E1' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginBottom: 12 },
  segmentItemDanger: { backgroundColor: '#DC2626' },
  roomChipActive: { borderColor: '#1A5FD0', backgroundColor: '#E8F0FD' },
  queueNo: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#E8F0FD' },
  queueNoUrgent: { backgroundColor: '#DC2626' },
  queueNoText: { fontSize: 12, fontWeight: '900', color: '#1A5FD0', fontVariant: ['tabular-nums'] },
  closeVisitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#0B2A5B' },
  closeVisitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  refundBtn: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#FCA5A5' },
  verifyTick: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', marginTop: 12 },
  verifyTickOn: { borderColor: '#0F9D6B', backgroundColor: '#E3F7EF' },
  modalIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F0FD', alignItems: 'center', justifyContent: 'center' },
  ticketNumber: { marginVertical: 8, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 18, backgroundColor: '#1A5FD0' },
  ticketNumberText: { color: '#FFFFFF', fontSize: 48, fontWeight: '900', letterSpacing: 2, fontVariant: ['tabular-nums'] },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#E2E8F0' },
  ticketKey: { fontSize: 13, color: '#64748B', flexShrink: 0 },
  ticketVal: { fontSize: 13, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  qrFrame: { padding: 12, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  qrAmount: { fontSize: 26, fontWeight: '900', color: '#0B2A5B', marginTop: 14 },
  qrWaiting: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#E8F0FD' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' },
  priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  // UC-REC-02: thẻ BHYT đang dùng, tỷ lệ tự ghi nhận, bảng đối soát, nhãn ở danh sách bệnh nhân
  currentCard: { borderWidth: 1.5, borderColor: '#A7F3D0', backgroundColor: '#ECFDF5', borderRadius: 14, padding: 12, marginBottom: 14, gap: 3 },
  currentCardTitle: { fontSize: 13, fontWeight: '800', color: '#0B7A53' },
  currentCardLine: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  currentCardMeta: { fontSize: 11, color: '#64748B' },
  declaredBox: { borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, gap: 4, marginBottom: 12 },
  declaredTitle: { fontSize: 12, fontWeight: '800', color: '#1D4ED8' },
  declaredLine: { fontSize: 12, color: '#334155', fontVariant: ['tabular-nums'] },
  declaredBtn: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#93C5FD', backgroundColor: '#FFFFFF' },
  declaredBtnText: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  rateBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: '#E3F7EF', marginBottom: 10 },
  rateBoxText: { flex: 1, fontSize: 12, color: '#0B7A53' },
  bhytTag: { alignSelf: 'flex-start', marginTop: 4, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, backgroundColor: '#EDE9FE' },
  bhytTagExpired: { backgroundColor: '#FEE2E2' },
  bhytTagUnverified: { backgroundColor: '#FEF3C7' },
  bhytExpiry: { fontSize: 10, color: '#64748B', marginTop: 2 },
  emailBox: { width: '100%', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  emailBoxTitle: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  declareTag: { alignSelf: 'flex-start', marginTop: 4, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, backgroundColor: '#E3F7EF' },
  dupBox: { padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', gap: 4 },
  dupTitle: { fontSize: 13, fontWeight: '800', color: '#DC2626' },
  dupText: { fontSize: 12, color: '#7F1D1D' },
  declareTagText: { fontSize: 10, fontWeight: '800', color: '#0B7A53' },
  bhytTagText: { fontSize: 10, fontWeight: '800', color: '#6D28D9' },
  priorityOpt: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0' },
  priorityLabel: { fontSize: 14, fontWeight: '800', color: '#334155' },
  prioritySub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  emergencyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, backgroundColor: '#FEF2F2', marginBottom: 10 },
  emergencyNoteText: { flex: 1, fontSize: 12, color: '#991B1B', lineHeight: 17 },
});

export default NurseReceptionScreen;
