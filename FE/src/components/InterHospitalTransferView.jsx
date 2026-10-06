import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  FileText,
  Search,
  RefreshCw,
  AlertTriangle,
  Mail,
  Brain,
  Box,
  Eye,
  Trash2,
  Info,
  ShieldCheck,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { get, post, del } from '../services/api.service';

const STATUS_CONFIG = {
  draft: { label: 'Chờ Lễ tân gửi email', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  sent: { label: 'Đã gửi email thành công', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  failed: { label: 'Gửi email thất bại', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle },
  cancelled: { label: 'Đã hủy', bg: 'bg-slate-100 text-slate-600 border-slate-200', icon: AlertTriangle },
  // Backward compatibility labels
  pending: { label: 'Chờ xử lý', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  accepted: { label: 'Đã duyệt', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Từ chối', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle },
};

export default function InterHospitalTransferView({ currentUser }) {
  const [activeTab, setActiveTab] = useState('draft'); // 'draft' | 'sent' | 'all'
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Modal gửi email
  const [sendModalItem, setSendModalItem] = useState(null);
  const [recipientEmailInput, setRecipientEmailInput] = useState('');
  const [sendSuccessResult, setSendSuccessResult] = useState(null);

  // Modal xem chi tiết gói hồ sơ
  const [detailModalItem, setDetailModalItem] = useState(null);

  const isReceptionistOrStaff = useMemo(() => {
    return ['receptionist', 'doctor', 'admin', 'hospital_admin'].includes(currentUser?.role);
  }, [currentUser?.role]);

  // Fetch danh sách hồ sơ chuyển viện
  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/v1/transfers');
      if (res && res.success) {
        setTransfers(res.data || []);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách hồ sơ chuyển viện:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  // Phân loại số lượng
  const counts = useMemo(() => {
    const draftCount = transfers.filter((t) => t.status === 'draft' || t.status === 'pending').length;
    const sentCount = transfers.filter((t) => t.status === 'sent' || t.status === 'accepted').length;
    return {
      draft: draftCount,
      sent: sentCount,
      all: transfers.length,
    };
  }, [transfers]);

  // Lọc theo tab & tìm kiếm
  const filteredTransfers = useMemo(() => {
    return transfers.filter((item) => {
      // Filter tab
      if (activeTab === 'draft' && item.status !== 'draft' && item.status !== 'pending') return false;
      if (activeTab === 'sent' && item.status !== 'sent' && item.status !== 'accepted') return false;

      // Filter search
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const ptName = (item.patient_id?.profile?.fullName || item.patient_id?.profile?.name || item.patient_id?.email || '').toLowerCase();
      const code = (item.transferNo || '').toLowerCase();
      const dest = (item.transferTo || '').toLowerCase();
      const diag = (item.diagnosis || '').toLowerCase();
      const email = (item.recipientEmail || '').toLowerCase();
      return ptName.includes(q) || code.includes(q) || dest.includes(q) || diag.includes(q) || email.includes(q);
    });
  }, [transfers, activeTab, searchQuery]);

  // Mở modal gửi email
  const openSendModal = (item) => {
    setSendModalItem(item);
    const defaultEmail = item.recipientEmail || item.patient_id?.email || item.patient_id?.profile?.email || '';
    setRecipientEmailInput(defaultEmail);
    setSendSuccessResult(null);
  };

  // Thực hiện gửi email cho bệnh nhân
  const handleConfirmSendEmail = async () => {
    if (!sendModalItem) return;
    if (!recipientEmailInput.trim() || !recipientEmailInput.includes('@')) {
      alert('Vui lòng nhập địa chỉ email hợp lệ của bệnh nhân!');
      return;
    }

    setActionLoading(true);
    try {
      const res = await post(`/api/v1/transfers/${sendModalItem._id}/send-email`, {
        overrideEmail: recipientEmailInput.trim(),
      });

      if (res && res.success) {
        setSendSuccessResult({
          message: res.message || 'Đã gửi email hồ sơ chuyển viện thành công!',
          delivery: res.data?.delivery || {},
          recipientEmail: recipientEmailInput.trim(),
        });
        fetchTransfers();
      } else {
        alert(res?.message || 'Gửi email thất bại, vui lòng kiểm tra lại cấu hình.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi kết nối khi gửi email hồ sơ.');
    } finally {
      setActionLoading(false);
    }
  };

  // Hủy gói chuyển viện
  const handleCancelTransfer = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn hủy gói chuyển viện này?')) return;
    setActionLoading(true);
    try {
      const res = await del(`/api/v1/transfers/${id}`);
      if (res && res.success) {
        alert('Đã hủy hồ sơ chuyển viện thành công.');
        fetchTransfers();
      } else {
        alert(res?.message || 'Không thể hủy hồ sơ.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi hủy hồ sơ.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-[#F8FAFC] p-4 md:p-6 overflow-y-auto space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-700 border border-blue-100">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">
                  Quản Lý Hồ Sơ Chuyển Viện &amp; Gửi Email Bệnh Nhân
                </h1>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-extrabold rounded-md uppercase tracking-wider">
                  UC-DOC-10
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                Bác sĩ tạo gói chuyển viện u não (tự động đóng gói file DICOM, Báo cáo AI, 3D Model) &rarr; Lễ tân kiểm tra &amp; gửi email điện tử cho bệnh nhân
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTransfers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs md:text-sm font-semibold rounded-xl transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới danh sách
          </button>
        </div>
      </div>

      {/* ── TABS & SEARCH BAR ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs">
          <button
            onClick={() => setActiveTab('draft')}
            className={`px-3.5 py-2 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'draft' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Chờ Lễ tân gửi ({counts.draft})
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-3.5 py-2 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'sent' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Đã gửi thành công ({counts.sent})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả hồ sơ ({counts.all})
          </button>
        </div>

        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên BN, mã CV, email, viện..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs"
          />
        </div>
      </div>

      {/* ── DANH SÁCH HỒ SƠ ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
          Đang tải danh sách hồ sơ chuyển viện...
        </div>
      ) : filteredTransfers.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
          <Mail className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">
            {activeTab === 'draft'
              ? 'Hiện không có hồ sơ chuyển viện nào đang chờ gửi.'
              : activeTab === 'sent'
              ? 'Chưa có hồ sơ chuyển viện nào được gửi đi.'
              : 'Không tìm thấy hồ sơ chuyển viện phù hợp.'}
          </p>
          <p className="text-xs text-slate-400">
            Khi bác sĩ tạo gói chuyển viện tại bệnh án bệnh nhân, hồ sơ sẽ tự động xuất hiện ở tab này.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTransfers.map((item) => {
            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
            const StatusIcon = statusCfg.icon;
            const ptName =
              item.patient_id?.profile?.fullName ||
              item.patient_id?.profile?.name ||
              item.patient_id?.email ||
              'Bệnh nhân';
            const ptPhone = item.patient_id?.profile?.phone || 'Chưa có SĐT';
            const snapshot = item.packageSnapshot || {};
            const hasDicom = Boolean(snapshot?.dicom?.zipUrl);
            const hasAiReport = Boolean(snapshot?.aiReport);
            const has3D = Boolean(snapshot?.model3dUrl);
            const isDraft = item.status === 'draft' || item.status === 'pending';

            return (
              <div
                key={item._id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all space-y-3"
              >
                {/* Header card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
                      {item.transferNo || 'CV-Chưa số'}
                    </span>
                    <h3 className="text-base font-bold text-slate-800">{ptName}</h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${statusCfg.bg}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400">
                    Lập lúc: {new Date(item.createdAt).toLocaleString('vi-VN')} · Bởi: <strong className="text-slate-600">{item.doctor_name || 'Bác sĩ điều trị'}</strong>
                  </div>
                </div>

                {/* Thông tin chuyển viện */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Bệnh viện tiếp nhận:</span>
                    <p className="font-bold text-blue-700 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      {item.transferTo || 'Bệnh viện tuyến trên'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Chẩn đoán u não:</span>
                    <p className="font-semibold text-rose-700">{item.diagnosis || 'Không ghi nhận'}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Email người nhận (Bệnh nhân):</span>
                    <p className="font-mono font-semibold text-slate-800 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {item.recipientEmail || item.patient_id?.email || 'Chưa cung cấp email'}
                    </p>
                  </div>
                </div>

                {/* Package Snapshot Badges */}
                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <Box className="w-3.5 h-3.5 text-indigo-600" />
                    Gói dữ liệu điện tử đã đóng gói:
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded-md font-semibold text-[11px] border flex items-center gap-1 ${
                      hasDicom ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}
                  >
                    📦 DICOM Archive {hasDicom ? `(Có sẵn)` : '(Chưa nén)'}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded-md font-semibold text-[11px] border flex items-center gap-1 ${
                      hasAiReport ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}
                  >
                    <Brain className="w-3 h-3 text-purple-600" />
                    Báo cáo AI {snapshot?.aiReport?.tumorVolumeCm3 ? `(${snapshot.aiReport.tumorVolumeCm3} cm³)` : ''}
                  </span>

                  <span
                    className={`px-2 py-0.5 rounded-md font-semibold text-[11px] border flex items-center gap-1 ${
                      has3D ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}
                  >
                    🧊 Mô hình 3D Mesh {has3D ? '(.GLTF)' : '(Chưa tạo)'}
                  </span>

                  {snapshot?.representativeSliceUrl && (
                    <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
                      🖼️ Ảnh cắt lớp chính
                    </span>
                  )}
                </div>

                {/* Ghi chú gửi email (nếu đã gửi thành công hoặc thất bại) */}
                {item.status === 'sent' && (
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Đã gửi email tới <strong>{item.recipientEmail}</strong> lúc{' '}
                        {item.sentAt ? new Date(item.sentAt).toLocaleString('vi-VN') : 'vừa xong'}.
                      </span>
                    </div>
                    {item.sentBy && (
                      <span className="text-emerald-700 text-[11px]">
                        Thực hiện bởi: {item.sentBy.profile?.name || item.sentBy.email || 'Lễ tân'}
                      </span>
                    )}
                  </div>
                )}

                {item.status === 'failed' && (
                  <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100 text-xs text-rose-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        Gửi email thất bại: <strong>{item.sendError || 'Lỗi kết nối máy chủ'}</strong>. Vui lòng kiểm tra lại địa chỉ email người nhận.
                      </span>
                    </div>
                  </div>
                )}

                {/* Footer action buttons */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={() => setDetailModalItem(item)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    Xem chi tiết gói
                  </button>

                  {isDraft && (
                    <button
                      onClick={() => handleCancelTransfer(item._id)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold rounded-xl border border-slate-200 hover:border-rose-200 transition-all flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hủy gói
                    </button>
                  )}

                  {isReceptionistOrStaff && (
                    <button
                      onClick={() => openSendModal(item)}
                      disabled={actionLoading}
                      className={`px-4 py-1.5 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 ${
                        isDraft
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isDraft ? 'Gửi Email Cho Bệnh Nhân' : 'Gửi Lại Email'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: GỬI EMAIL CHO BỆNH NHÂN (LỄ TÂN) ───────────────────── */}
      {sendModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 text-slate-800">
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Xác Nhận &amp; Gửi Email Hồ Sơ Chuyển Viện</h3>
                <p className="text-xs text-slate-500">Mã chuyển viện: {sendModalItem.transferNo}</p>
              </div>
            </div>

            {sendSuccessResult ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{sendSuccessResult.message}</span>
                </div>
                <p className="text-xs text-emerald-700">
                  Hồ sơ chuyển viện đã được gửi thành công tới <strong>{sendSuccessResult.recipientEmail}</strong>.
                </p>
                {sendSuccessResult.delivery?.attached?.length > 0 && (
                  <div className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-emerald-100">
                    <span className="font-semibold text-slate-700 block mb-1">Các tệp đã đính kèm trong thư:</span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {sendSuccessResult.delivery.attached.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setSendModalItem(null);
                      setSendSuccessResult(null);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    Hoàn tất &amp; Đóng
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <p className="text-slate-600">
                    <strong>Bệnh nhân:</strong>{' '}
                    {sendModalItem.patient_id?.profile?.fullName || sendModalItem.patient_id?.profile?.name || 'N/A'}
                  </p>
                  <p className="text-slate-600">
                    <strong>Bệnh viện tiếp nhận:</strong> {sendModalItem.transferTo}
                  </p>
                  <p className="text-slate-600">
                    <strong>Chẩn đoán:</strong> {sendModalItem.diagnosis}
                  </p>
                  <p className="text-slate-600">
                    <strong>Gói tệp đính kèm:</strong> Báo cáo chẩn đoán AI (HTML), File DICOM nén, Mô hình 3D u não (.gltf), 5 ảnh cắt lớp quan trọng.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    Địa chỉ Email nhận hồ sơ (Bệnh nhân / Người nhà):
                  </label>
                  <input
                    type="email"
                    value={recipientEmailInput}
                    onChange={(e) => setRecipientEmailInput(e.target.value)}
                    placeholder="VD: benhnhan@gmail.com"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    * Lễ tân có thể chỉnh sửa nếu người bệnh cập nhật email mới tại quầy tiếp đón.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setSendModalItem(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={handleConfirmSendEmail}
                    disabled={actionLoading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {actionLoading ? 'Đang đóng gói & gửi...' : 'Gửi Email Ngay'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: XEM CHI TIẾT GÓI HỒ SƠ ──────────────────────────────── */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Chi Tiết Gói Chuyển Viện {detailModalItem.transferNo}
                </h3>
                <p className="text-xs text-slate-500">
                  Bệnh nhân: {detailModalItem.patient_id?.profile?.fullName || detailModalItem.patient_id?.profile?.name || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setDetailModalItem(null)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
              >
                Đóng
              </button>
            </div>

            {/* Chi tiết nội dung gói snapshot */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <p><strong>Nơi chuyển đến:</strong> {detailModalItem.transferTo}</p>
                <p><strong>Chẩn đoán:</strong> {detailModalItem.diagnosis}</p>
                <p><strong>Tóm tắt lâm sàng:</strong> {detailModalItem.clinicalSummary || 'Không ghi nhận'}</p>
                <p><strong>Cận lâm sàng LIS:</strong> {detailModalItem.labSummary || 'Không ghi nhận'}</p>
                <p><strong>Lý do chuyển:</strong> {detailModalItem.reasonDetail}</p>
                <p><strong>Hướng điều trị tiếp theo:</strong> {detailModalItem.treatmentDirection}</p>
                <p><strong>Phương tiện vận chuyển:</strong> {detailModalItem.transportation}</p>
              </div>

              {detailModalItem.packageSnapshot && (
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2">
                  <h4 className="font-bold text-indigo-900 flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-indigo-600" />
                    Báo Cáo AI &amp; Hình Ảnh Khối U
                  </h4>
                  {detailModalItem.packageSnapshot.findings && (
                    <p className="text-slate-700"><strong>Mô tả:</strong> {detailModalItem.packageSnapshot.findings}</p>
                  )}
                  {detailModalItem.packageSnapshot.conclusion && (
                    <p className="text-slate-700"><strong>Kết luận:</strong> {detailModalItem.packageSnapshot.conclusion}</p>
                  )}
                  {detailModalItem.packageSnapshot.aiReport && (
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600">
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        Thể tích u: <strong>{detailModalItem.packageSnapshot.aiReport.tumorVolumeCm3 || 'N/A'} cm³</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        Độ lệch đường giữa: <strong>{detailModalItem.packageSnapshot.aiReport.midlineShiftMm || 'N/A'} mm</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        Mức độ ác tính: <strong>{detailModalItem.packageSnapshot.aiReport.malignancyLevel || 'N/A'}</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-indigo-100">
                        Vị trí u: <strong>{detailModalItem.packageSnapshot.aiReport.anatomicalLocation || 'N/A'}</strong>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap gap-2 text-[11px]">
                    {detailModalItem.packageSnapshot.dicom?.zipUrl && (
                      <span className="px-2 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-md font-semibold">
                        📦 File DICOM: {detailModalItem.packageSnapshot.dicom.filename || 'dicom_study.zip'}
                      </span>
                    )}
                    {detailModalItem.packageSnapshot.model3dUrl && (
                      <span className="px-2 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-md font-semibold">
                        🧊 Mô hình 3D (.gltf)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setDetailModalItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
