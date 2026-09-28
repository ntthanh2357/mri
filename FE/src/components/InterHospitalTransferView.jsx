import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Share2,
  ShieldCheck,
  Search,
  RefreshCw,
  Plus,
  AlertTriangle,
  FileText,
  ExternalLink,
  Copy,
  Lock,
} from 'lucide-react';
import { get, post, put } from '../services/api.service';

const STATUS_CONFIG = {
  pending: { label: 'Chờ tiếp nhận', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  accepted: { label: 'Đã chấp nhận', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Từ chối tiếp nhận', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  completed: { label: 'Hoàn tất chuyển viện', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export default function InterHospitalTransferView({ currentUser }) {
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' | 'outgoing'
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [targetHospitals, setTargetHospitals] = useState([]);
  const [selectedTargetHospId, setSelectedTargetHospId] = useState('');
  const [capacityResult, setCapacityResult] = useState(null);
  const [tokenResultModal, setTokenResultModal] = useState(null);

  // Fetch transfers
  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(`/api/v1/transfers?type=${activeTab}`);
      if (res && res.success) {
        setTransfers(res.data || []);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách chuyển viện:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  // Load hospitals for capacity checking
  useEffect(() => {
    get('/admin/hospitals')
      .then((res) => {
        if (res && res.hospitals) setTargetHospitals(res.hospitals);
      })
      .catch(() => {});
  }, []);

  // 1. Phê duyệt tiếp nhận chuyển viện (Viện đích)
  const handleAcceptTransfer = async (transferId) => {
    if (!confirm('Bạn có chắc chắn muốn phê duyệt tiếp nhận bệnh nhân này? Hệ thống sẽ tự động giữ chỗ 1 giường bệnh khả dụng.')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await put(`/api/v1/transfers/${transferId}/accept`, {});
      if (res && res.success) {
        alert(res.message || 'Đã chấp nhận chuyển viện và giữ chỗ giường thành công!');
        fetchTransfers();
      } else {
        alert(res.message || 'Không thể chấp nhận chuyển viện.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi chấp nhận chuyển viện.');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Từ chối tiếp nhận chuyển viện
  const handleRejectTransfer = async () => {
    if (!selectedTransfer) return;
    setActionLoading(true);
    try {
      const res = await put(`/api/v1/transfers/${selectedTransfer._id}/reject`, {
        reason: rejectReason || 'Bệnh viện quá tải công suất cấp cứu',
      });
      if (res && res.success) {
        alert('Đã gửi phản hồi từ chối tiếp nhận ca chuyển viện.');
        setShowRejectModal(false);
        setSelectedTransfer(null);
        setRejectReason('');
        fetchTransfers();
      } else {
        alert(res.message || 'Thất bại.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi từ chối tiếp nhận.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Cấp Token xem bệnh án liên viện 7 ngày (F.5 & HIPAA Token-Based Capability)
  const handleGrantCrossView = async (transferId) => {
    setActionLoading(true);
    try {
      const res = await post(`/api/v1/transfers/${transferId}/grant-cross-view`, {});
      if (res && res.success) {
        setTokenResultModal(res.data);
        fetchTransfers();
      } else {
        alert(res.message || 'Không thể cấp token xem bệnh án.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi cấp quyền xem bệnh án liên viện.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Thu hồi Token xem bệnh án liên viện
  const handleRevokeCrossView = async (transferId) => {
    if (!confirm('Bạn có chắc chắn muốn thu hồi quyền xem bệnh án liên viện này ngay lập tức?')) return;
    setActionLoading(true);
    try {
      const res = await post(`/api/v1/transfers/${transferId}/revoke-cross-view`, {});
      if (res && res.success) {
        alert('Đã thu hồi token xem bệnh án liên viện thành công.');
        fetchTransfers();
      } else {
        alert(res.message || 'Không thể thu hồi.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi thu hồi token.');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Kiểm tra năng lực tiếp nhận mổ/ICU viện đích
  const handleCheckCapacity = async () => {
    if (!selectedTargetHospId) {
      alert('Vui lòng chọn bệnh viện đích.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await post('/api/v1/transfers/check-capacity', {
        targetHospitalId: selectedTargetHospId,
        departmentId: 'KUTN-SURG',
      });
      if (res && res.success) {
        setCapacityResult(res.data);
      } else {
        alert(res.message || 'Không thể kiểm tra.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi kiểm tra năng lực tiếp nhận.');
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
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">
                Quản Lý Chuyển Viện Liên Viện (Inter-Hospital Transfers)
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                Quy trình tiếp nhận cấp cứu, phân bổ giường bệnh và cấp quyền xem chéo EMR 7 ngày (Chuẩn HIPAA / TT 46)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCapacityResult(null);
              setShowCapacityModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs md:text-sm font-semibold rounded-xl transition-all"
          >
            <Building2 className="w-4 h-4" />
            Kiểm tra Sức Chứa Viện Đích
          </button>
          <button
            onClick={fetchTransfers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs md:text-sm font-semibold rounded-xl transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* ── TABS (INCOMING / OUTGOING) ──────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 w-fit">
        <button
          onClick={() => setActiveTab('incoming')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
            activeTab === 'incoming'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Ca Chuyển Đến Cần Tiếp Nhận (Incoming)
        </button>
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
            activeTab === 'outgoing'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Ca Đã Chuyển Tuyến Đi (Outgoing)
        </button>
      </div>

      {/* ── TRANSFERS LIST ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">Đang tải danh sách yêu cầu chuyển viện...</div>
      ) : transfers.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
          <ArrowRightLeft className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-600">
            {activeTab === 'incoming'
              ? 'Không có yêu cầu chuyển viện nào được gửi đến cơ sở của bạn.'
              : 'Chưa có yêu cầu chuyển viện nào được gửi đi.'}
          </p>
          <p className="text-xs text-slate-400">Dữ liệu sẽ tự động hiển thị khi có hồ sơ chuyển tuyến mới.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transfers.map((item) => {
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
            const ptName = item.patient_id?.profile?.name || item.patient_id?.profile?.fullName || item.patient_id?.email || 'N/A';
            const sourceHospName = item.hospitalId?.name || 'Bệnh viện gửi';
            const targetHospName = item.targetHospitalId?.name || item.transferTo || 'Bệnh viện tiếp nhận';

            return (
              <div
                key={item._id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                      {item.transferNo || 'CV-Chưa số'}
                    </span>
                    <h3 className="text-base font-bold text-slate-800">{ptName}</h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${statusConfig.bg}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400">
                    Khởi tạo: {new Date(item.createdAt).toLocaleString('vi-VN')}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Tuyến chuyển viện:</span>
                    <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <span>{sourceHospName}</span>
                      <ArrowRightLeft className="w-3 h-3 text-blue-500" />
                      <span className="text-blue-700">{targetHospName}</span>
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Chẩn đoán lâm sàng:</span>
                    <p className="font-semibold text-slate-800">{item.diagnosis || 'Không ghi nhận'}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Giường bệnh đã giữ chỗ:</span>
                    <p className="font-bold text-emerald-600">
                      {item.targetBedId
                        ? `Giường ${item.targetBedId.bedNumber} (${item.targetBedId.roomNumber || 'ICU'})`
                        : 'Chưa xếp giường'}
                    </p>
                  </div>
                </div>

                {item.clinicalSummary && (
                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100">
                    <span className="font-bold text-slate-700">Tóm tắt bệnh án: </span>
                    {item.clinicalSummary}
                  </div>
                )}

                {item.rejectionReason && (
                  <div className="p-3 bg-rose-50 rounded-xl text-xs text-rose-700 border border-rose-100">
                    <span className="font-bold">Lý do từ chối tiếp nhận: </span>
                    {item.rejectionReason}
                  </div>
                )}

                {/* Cross-hospital capability token status */}
                {item.crossHospitalToken && (
                  <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-indigo-900">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>
                        Token xem chéo bệnh án liên viện đang hoạt động (Hết hạn: {new Date(item.crossHospitalTokenExpiresAt).toLocaleDateString('vi-VN')})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/api/v1/transfers/cross-view/${item.crossHospitalToken}`;
                          navigator.clipboard.writeText(url);
                          alert('Đã sao chép link truy cập bệnh án liên viện an toàn vào bộ nhớ tạm!');
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg font-semibold flex items-center gap-1 shadow-2xs"
                      >
                        <Copy className="w-3 h-3" /> Sao chép link EMR
                      </button>
                      <button
                        onClick={() => handleRevokeCrossView(item._id)}
                        className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg font-semibold"
                      >
                        Thu hồi quyền
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                  {activeTab === 'incoming' && item.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedTransfer(item);
                          setShowRejectModal(true);
                        }}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-all"
                      >
                        Từ chối ca
                      </button>
                      <button
                        onClick={() => handleAcceptTransfer(item._id)}
                        disabled={actionLoading}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Tiếp Nhận & Khóa Giữ Chỗ Giường
                      </button>
                    </>
                  )}

                  {item.status === 'accepted' && !item.crossHospitalToken && (
                    <button
                      onClick={() => handleGrantCrossView(item._id)}
                      disabled={actionLoading}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Cấp Token Xem EMR 7 Ngày
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: TỪ CHỐI TIẾP NHẬN ────────────────────────────────────── */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-800">Từ Chối Tiếp Nhận Ca Chuyển Viện</h3>
            <p className="text-xs text-slate-500">
              Vui lòng cung cấp lý do từ chối rõ ràng để bệnh viện tuyến gửi có thể kịp thời chuyển bệnh nhân sang cơ sở y tế khác.
            </p>
            <textarea
              rows={3}
              placeholder="VD: Hiện tại khoa ICU Ngoại thần kinh đã đạt 100% công suất giường, không còn máy thở..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedTransfer(null);
                }}
                className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600"
              >
                Hủy
              </button>
              <button
                onClick={handleRejectTransfer}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                {actionLoading ? 'Đang gửi...' : 'Xác Nhận Từ Chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: KIỂM TRA SỨC CHỨA VIỆN ĐÍCH ───────────────────────────── */}
      {showCapacityModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-800">Tra Cứu Khả Năng Tiếp Nhận Phẫu Thuật</h3>
            <p className="text-xs text-slate-500">
              Kiểm tra số giường trống thời gian thực tại các bệnh viện tuyến trên trước khi ra chỉ định chuyển viện.
            </p>
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">Chọn bệnh viện tuyến trên:</label>
              <select
                value={selectedTargetHospId}
                onChange={(e) => setSelectedTargetHospId(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="">-- Chọn bệnh viện đích --</option>
                {targetHospitals.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
            </div>

            {capacityResult && (
              <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                capacityResult.canAccept ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <p className="font-bold">{capacityResult.canAccept ? '✅ Đủ điều kiện tiếp nhận' : '⚠️ Cảnh báo quá tải'}</p>
                <p>{capacityResult.message}</p>
                <p className="text-[11px] opacity-80 mt-1">
                  Số giường trống hiện tại: <b>{capacityResult.availableBeds}</b> giường
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCapacityModal(false)}
                className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600"
              >
                Đóng
              </button>
              <button
                onClick={handleCheckCapacity}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                {actionLoading ? 'Đang tra cứu...' : 'Kiểm Tra Ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: HIỂN THỊ TOKEN CHUYỂN VIỆN VỪA CẤP ─────────────────────── */}
      {tokenResultModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-indigo-700">
              <ShieldCheck className="w-6 h-6" />
              <h3 className="text-base font-bold">Cấp Mã Truy Cập Bệnh Án Liên Viện Thành Công</h3>
            </div>
            <p className="text-xs text-slate-500">
              Đường dẫn bảo mật (Token-Based Capability) có hiệu lực trong 7 ngày, cho phép bác sĩ bệnh viện đích tra cứu toàn bộ ảnh chụp MRI và phân tích AI.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs break-all font-mono">
              {window.location.origin}{tokenResultModal.viewUrl}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  const url = `${window.location.origin}${tokenResultModal.viewUrl}`;
                  navigator.clipboard.writeText(url);
                  alert('Đã sao chép link!');
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
              >
                Sao Chép Đường Dẫn
              </button>
              <button
                onClick={() => setTokenResultModal(null)}
                className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600"
              >
                Hoàn Tất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
