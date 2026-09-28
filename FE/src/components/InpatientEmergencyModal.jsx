import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  ShieldAlert,
  Activity,
  FileText,
  Pill,
  Scan,
  BedDouble,
  Undo2,
  Check,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { post, put, patch } from '../services/api.service';

export default function InpatientEmergencyModal({
  isOpen,
  onClose,
  bed,
  patient,
  existingEvent,
  currentUser,
  onSuccess
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'enrich' | 'verbal_order' | 'mri_gate' | 'icu_bed' | 'timeline' | 'closure'
  const [loading, setLoading] = useState(false);
  const [eventData, setEventData] = useState(existingEvent || null);

  // Form states: Post-Enrich
  const [gcsScore, setGcsScore] = useState('');
  const [news2Score, setNews2Score] = useState('');
  const [acuteSigns, setAcuteSigns] = useState([]);
  const [reasonNotes, setReasonNotes] = useState('');

  // Form states: Verbal Order
  const [orderText, setOrderText] = useState('');
  const [isControlledSubstance, setIsControlledSubstance] = useState(false);

  // Form states: Pre-MRI Safety Gate
  const [hemodynamicStable, setHemodynamicStable] = useState(false);
  const [respiratoryStable, setRespiratoryStable] = useState(false);
  const [implantPassed, setImplantPassed] = useState(false);
  const [mrEquipmentReady, setMrEquipmentReady] = useState(false);
  const [mriNote, setMriNote] = useState('');

  // Form states: ICU Bed
  const [icuNote, setIcuNote] = useState('');

  // Form states: Stand-down cancellation
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Form states: Closure
  const [outcome, setOutcome] = useState('emergency_or_transferred');
  const [summaryNotes, setSummaryNotes] = useState('');

  useEffect(() => {
    if (existingEvent) {
      setEventData(existingEvent);
      if (existingEvent.clinicalSeverity) {
        setGcsScore(existingEvent.clinicalSeverity.gcsScore || '');
        setNews2Score(existingEvent.clinicalSeverity.news2Score || '');
        setAcuteSigns(existingEvent.clinicalSeverity.acuteSigns || []);
        setReasonNotes(existingEvent.clinicalSeverity.reasonNotes || '');
      }
    }
  }, [existingEvent]);

  if (!isOpen) return null;

  const patientName = patient?.profile?.name || patient?.profile?.fullName || bed?.currentPatientId?.profile?.name || 'Bệnh nhân nội trú';
  const patientId = patient?._id || bed?.currentPatientId?._id;
  const roomNumber = bed?.roomNumber || 'P.302';
  const bedNumber = bed?.bedNumber || 'G.01';

  // 1-Chạm kích hoạt cấp cứu
  const handleOneTouchTrigger = async () => {
    setLoading(true);
    try {
      const res = await post('/api/v1/emergency/inpatient-trigger', {
        patientId,
        bedNumber,
        roomNumber,
        level: 'RED',
        reason: 'Báo động 1-chạm: Bệnh nhân diễn biến xấu đột ngột tại giường bệnh.'
      });
      if (res && res.success) {
        setEventData(res.data.event);
        if (onSuccess) onSuccess(res.data.event);
      } else {
        alert(res?.message || 'Không thể phát lệnh cấp cứu.');
      }
    } catch (err) {
      alert('Lỗi phát lệnh cấp cứu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Bổ sung thông số lâm sàng
  const handleSaveEnrichment = async () => {
    if (!eventData?._id) return;
    setLoading(true);
    try {
      const res = await patch(`/api/v1/emergency/post-enrich/${eventData._id}`, {
        gcsScore: gcsScore ? Number(gcsScore) : undefined,
        news2Score: news2Score ? Number(news2Score) : undefined,
        acuteSigns,
        reasonNotes
      });
      if (res && res.success) {
        setEventData(res.data.event);
        alert('Đã cập nhật thông số lâm sàng.');
        setActiveTab('overview');
      }
    } catch (err) {
      alert('Lỗi cập nhật: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Xác nhận nhận ca (Role ACK)
  const handleAcknowledge = async () => {
    if (!eventData?._id) return;
    setLoading(true);
    try {
      const res = await put(`/api/v1/emergency/ack/${eventData._id}`, {});
      if (res && res.success) {
        setEventData(res.data.event);
        alert('Bạn đã xác nhận tiếp nhận ca cấp cứu.');
      }
    } catch (err) {
      alert('Lỗi xác nhận: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Hủy báo động nhầm (Stand-down)
  const handleStandDown = async () => {
    if (!cancelReason.trim()) {
      alert('Bắt buộc phải nhập lý do hủy báo động nhầm.');
      return;
    }
    setLoading(true);
    try {
      const res = await post(`/api/v1/emergency/cancel-stand-down/${eventData._id}`, {
        cancelReason
      });
      if (res && res.success) {
        setEventData(res.data.event);
        alert('Đã giải trừ báo động nhầm (Stand-down).');
        setShowCancelPrompt(false);
        if (onSuccess) onSuccess(res.data.event);
        onClose();
      }
    } catch (err) {
      alert('Lỗi hủy báo động: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Ra y lệnh miệng
  const handleCreateVerbalOrder = async () => {
    if (!orderText.trim()) {
      alert('Vui lòng nhập nội dung y lệnh cấp cứu.');
      return;
    }
    setLoading(true);
    try {
      const res = await post('/api/v1/emergency/verbal-order', {
        emergencyEventId: eventData._id,
        orderText,
        isControlledSubstance,
        countersignHours: 24
      });
      if (res && res.success) {
        setEventData(res.data.event);
        setOrderText('');
        alert('Ghi nhận y lệnh miệng thành công. Chờ bác sĩ ký số bổ sung EMR trong vòng 24 giờ.');
        setActiveTab('overview');
      }
    } catch (err) {
      alert('Lỗi tạo y lệnh miệng: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Đề xuất chèn lịch MRI kèm Pre-MRI Safety Gate
  const handleMriOverrideRequest = async () => {
    if (!hemodynamicStable || !respiratoryStable) {
      alert('Cảnh báo an toàn: Bệnh nhân chưa ổn định huyết động/hô hấp, không được đưa vào buồng chụp MRI 3.0T.');
      return;
    }
    if (!implantPassed) {
      alert('Cảnh báo an toàn: Bệnh nhân chưa vượt qua sàng lọc vật liệu cấy ghép từ tính (Clip phình mạch, van VP shunt, máy tạo nhịp).');
      return;
    }
    setLoading(true);
    try {
      const res = await post('/api/v1/emergency/request-mri-override', {
        emergencyEventId: eventData._id,
        preMriSafetyGate: {
          hemodynamicallyStable: hemodynamicStable,
          respiratoryStable: respiratoryStable,
          implantScreeningPassed: implantPassed,
          mrConditionalEquipmentReady: mrEquipmentReady
        },
        note: mriNote || 'Đề xuất chèn lịch MRI sọ não 3.0T khẩn cấp (Pre-MRI Safety Gate Passed).'
      });
      if (res && res.success) {
        setEventData(res.data.event);
        alert('Đã gửi đề xuất chèn lịch MRI sang Kỹ thuật viên trưởng CĐHA.');
        setActiveTab('overview');
      }
    } catch (err) {
      alert('Lỗi đề xuất MRI: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Đề xuất giữ giường Neuro-ICU
  const handleIcuBedRequest = async () => {
    setLoading(true);
    try {
      const res = await post('/api/v1/emergency/request-icu-bed', {
        emergencyEventId: eventData._id,
        requestedBedType: 'KUTN-ICU',
        note: icuNote || 'Đề xuất giữ 1 giường Hồi sức Cấp cứu U Não (Neuro-ICU) 4 giờ.'
      });
      if (res && res.success) {
        setEventData(res.data.event);
        alert('Đã gửi đề xuất giữ giường Neuro-ICU sang Bác sĩ trực Hồi sức.');
        setActiveTab('overview');
      }
    } catch (err) {
      alert('Lỗi đề xuất giường ICU: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Đóng sự kiện cấp cứu
  const handleCloseEvent = async () => {
    setLoading(true);
    try {
      const res = await post(`/api/v1/emergency/close-event/${eventData._id}`, {
        outcome,
        summaryNotes
      });
      if (res && res.success) {
        setEventData(res.data.event);
        alert('Đã đóng sự kiện cấp cứu thành công.');
        if (onSuccess) onSuccess(res.data.event);
        onClose();
      }
    } catch (err) {
      alert('Lỗi đóng sự kiện: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSign = (sign) => {
    if (acuteSigns.includes(sign)) {
      setAcuteSigns(acuteSigns.filter(s => s !== sign));
    } else {
      setAcuteSigns([...acuteSigns, sign]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-red-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs animate-pulse">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-wide uppercase">Báo Động Cấp Cứu Nội Viện</h2>
                <span className="px-2 py-0.5 bg-white/20 rounded-md text-xs font-bold uppercase tracking-wider">
                  {eventData?.level || 'RED'}
                </span>
                <span className="px-2 py-0.5 bg-rose-950/40 rounded-md text-xs font-semibold">
                  Buồng {roomNumber} - Giường {bedNumber}
                </span>
              </div>
              <p className="text-xs text-rose-100 font-medium mt-0.5">
                Bệnh nhân: <b className="text-white underline">{patientName}</b> | Khoa Ung Thư Não
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 pt-2.5 bg-slate-50 border-b border-slate-200 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-t-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-white text-rose-700 border-t-2 border-rose-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Tổng Quan & Kíp Trực
          </button>

          <button
            onClick={() => setActiveTab('enrich')}
            className={`px-3.5 py-2 rounded-t-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'enrich'
                ? 'bg-white text-rose-700 border-t-2 border-rose-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> GCS & Dấu Hiệu Lâm Sàng
          </button>

          <button
            onClick={() => setActiveTab('verbal_order')}
            className={`px-3.5 py-2 rounded-t-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'verbal_order'
                ? 'bg-white text-rose-700 border-t-2 border-rose-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Pill className="w-3.5 h-3.5" /> Y Lệnh Miệng (24h)
          </button>

          <button
            onClick={() => setActiveTab('mri_gate')}
            className={`px-3.5 py-2 rounded-t-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'mri_gate'
                ? 'bg-white text-rose-700 border-t-2 border-rose-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scan className="w-3.5 h-3.5" /> Pre-MRI Safety Gate
          </button>

          <button
            onClick={() => setActiveTab('icu_bed')}
            className={`px-3.5 py-2 rounded-t-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'icu_bed'
                ? 'bg-white text-rose-700 border-t-2 border-rose-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BedDouble className="w-3.5 h-3.5" /> Giữ Giường Neuro-ICU
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3.5 py-2 rounded-t-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'timeline'
                ? 'bg-white text-rose-700 border-t-2 border-rose-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Mốc Thời Gian (Audit)
          </button>

          <button
            onClick={() => setActiveTab('closure')}
            className={`px-3.5 py-2 rounded-t-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'closure'
                ? 'bg-white text-rose-700 border-t-2 border-rose-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Đóng Sự Kiện
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">

          {/* Chưa kích hoạt -> Nút 1-Chạm Siêu Nhanh */}
          {!eventData && (
            <div className="p-8 text-center bg-rose-50/60 rounded-2xl border-2 border-dashed border-rose-300 space-y-4">
              <div className="inline-flex p-4 bg-rose-100 text-rose-700 rounded-full animate-bounce">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-black text-rose-950 uppercase">Báo Động Khẩn Cấp Một-Chạm</h3>
                <p className="text-xs text-rose-700 mt-1">
                  Bấm nút bên dưới để phát tín hiệu cấp cứu tức thì tới kíp trực Roster (BS Ngoại TK, Neuro-ICU, Điều dưỡng trưởng, KTV CĐHA). Không yêu cầu nhập liệu trước.
                </p>
              </div>
              <button
                disabled={loading}
                onClick={handleOneTouchTrigger}
                className="px-8 py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-sm font-black tracking-wide shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 mx-auto"
              >
                🚨 PHÁT LỆNH BÁO ĐỘNG CẤP CỨU NGAY (1-CHẠM)
              </button>
              <p className="text-[11px] text-slate-500 italic">
                Hotline cấp cứu nội bộ kíp trực: <b>Ext 102 / 115</b> (Dự phòng khi rớt mạng)
              </p>
            </div>
          )}

          {/* Đã kích hoạt -> Các Tab chi tiết */}
          {eventData && (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                      <div>
                        <p className="text-xs font-bold text-rose-950">
                          TRẠNG THÁI: <span className="uppercase text-rose-600 font-black">{eventData.status}</span>
                        </p>
                        <p className="text-xs text-rose-700 mt-0.5">
                          {eventData.clinicalSeverity?.reasonNotes || 'Đang cấp cứu nguy kịch.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAcknowledge}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Tôi Nhận Ca (ACK)
                      </button>
                      <button
                        onClick={() => setShowCancelPrompt(true)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <Undo2 className="w-3.5 h-3.5" /> Hủy Báo Động Nhầm
                      </button>
                    </div>
                  </div>

                  {/* Cancel Prompt */}
                  {showCancelPrompt && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        Xác nhận Hủy Báo Động Nhầm (Stand-Down Protocol)
                      </div>
                      <p className="text-xs text-amber-800">
                        Bắt buộc phải nhập lý do hủy báo động để lưu vết kiểm toán và thông báo giải trừ tới kíp trực:
                      </p>
                      <input
                        type="text"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Ví dụ: Bệnh nhân ngất do hạ đường huyết, đã hồi phục sau uống nước đường..."
                        className="w-full text-xs px-3 py-2 border border-amber-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setShowCancelPrompt(false)}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-semibold"
                        >
                          Quay lại
                        </button>
                        <button
                          onClick={handleStandDown}
                          className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
                        >
                          Xác nhận Stand-Down
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Kíp trực điều phối Roster */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-cyan-700" /> Kíp Trực Điều Phối (Roster On-Duty)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(eventData.assignedRoster || []).map((r, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                            r.isAcknowledged
                              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div>
                            <span className="font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 mr-1.5">
                              {r.role}
                            </span>
                            <span className="font-semibold">{r.staffName || 'Đang gọi trực...'}</span>
                          </div>
                          <div className="flex items-center gap-1 font-bold text-[11px]">
                            {r.isAcknowledged ? (
                              <span className="text-emerald-700 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Đã ACK
                              </span>
                            ) : (
                              <span className="text-amber-600 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 animate-spin" /> Chờ nhận
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lối tắt hành động nhanh */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                    <button
                      onClick={() => setActiveTab('verbal_order')}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left transition-all"
                    >
                      <Pill className="w-4 h-4 text-indigo-600 mb-1" />
                      <p className="text-xs font-bold text-slate-800">Ra Y Lệnh Miệng</p>
                      <p className="text-[10px] text-slate-500">Thuốc chống phù não, cắt cơn</p>
                    </button>

                    <button
                      onClick={() => setActiveTab('mri_gate')}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left transition-all"
                    >
                      <Scan className="w-4 h-4 text-rose-600 mb-1" />
                      <p className="text-xs font-bold text-slate-800">Pre-MRI Safety Gate</p>
                      <p className="text-[10px] text-slate-500">Chèn lịch MRI 3.0T khẩn</p>
                    </button>

                    <button
                      onClick={() => setActiveTab('icu_bed')}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left transition-all"
                    >
                      <BedDouble className="w-4 h-4 text-amber-600 mb-1" />
                      <p className="text-xs font-bold text-slate-800">Giữ Giường ICU</p>
                      <p className="text-[10px] text-slate-500">Đơn nguyên Hồi sức U Não</p>
                    </button>

                    <button
                      onClick={() => setActiveTab('closure')}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-left transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mb-1" />
                      <p className="text-xs font-bold text-slate-800">Đóng Sự Kiện</p>
                      <p className="text-[10px] text-slate-500">Chốt Outcome & Audit</p>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: POST-TRIGGER ENRICH */}
              {activeTab === 'enrich' && (
                <div className="space-y-4">
                  <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-xs text-cyan-900">
                    💡 <b>Bổ sung thông số lâm sàng:</b> Giúp kíp trực nắm rõ mức độ tri giác và dấu hiệu thần kinh khu trú.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Điểm Glasgow (GCS Score - từ 3 đến 15):
                      </label>
                      <input
                        type="number"
                        min="3"
                        max="15"
                        value={gcsScore}
                        onChange={(e) => setGcsScore(e.target.value)}
                        placeholder="VD: 8 (Tụt từ 13 xuống 8)"
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Thang Điểm NEWS2 (≥5 Khẩn, ≥7 Tối khẩn):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={news2Score}
                        onChange={(e) => setNews2Score(e.target.value)}
                        placeholder="VD: 7"
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Dấu hiệu thần kinh khu trú & nguy kịch:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Tụt kẹt não',
                        'Co giật liên tục / Động kinh kháng trị',
                        'Hôn mê đột ngột',
                        'Đồng tử giãn một bên',
                        'Đau đầu dữ dội kèm nôn vọt',
                        'Liệt nửa người tiến triển cấp'
                      ].map((sign) => (
                        <button
                          key={sign}
                          type="button"
                          onClick={() => toggleSign(sign)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            acuteSigns.includes(sign)
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {sign}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú diễn tiến:</label>
                    <textarea
                      rows={3}
                      value={reasonNotes}
                      onChange={(e) => setReasonNotes(e.target.value)}
                      placeholder="Mô tả tóm tắt diễn biến tại buồng bệnh..."
                      className="w-full text-xs p-3 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <button
                    disabled={loading}
                    onClick={handleSaveEnrichment}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                  >
                    Lưu Bổ Sung Thông Số Lâm Sàng
                  </button>
                </div>
              )}

              {/* TAB 3: VERBAL ORDER */}
              {activeTab === 'verbal_order' && (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                    ⚠️ <b>Quy chế Y lệnh miệng cấp cứu (Verbal Order):</b> Bác sĩ ra lệnh tại chỗ, Điều dưỡng đọc lại (Read-Back) xác nhận và thực hiện ngay. Bác sĩ chịu trách nhiệm ký số bổ sung EMR trong vòng 24 giờ.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung y lệnh cấp cứu:</label>
                    <textarea
                      rows={3}
                      value={orderText}
                      onChange={(e) => setOrderText(e.target.value)}
                      placeholder="Ví dụ: Tiêm tĩnh mạch chậm Diazepam 10mg cắt cơn co giật + Truyền tĩnh mạch nhanh Mannitol 20% 250ml trong 30 phút..."
                      className="w-full text-xs p-3 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isControlledSubstance}
                      onChange={(e) => setIsControlledSubstance(e.target.checked)}
                      className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Thuốc hướng thần / Gây nghiện (Tuân thủ Thông tư 20/2017/TT-BYT - Đối soát tủ trực)
                    </span>
                  </label>

                  <button
                    disabled={loading}
                    onClick={handleCreateVerbalOrder}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                  >
                    Ban Hành Y Lệnh Miệng Khẩn Cấp (Read-Back Confirmed)
                  </button>
                </div>
              )}

              {/* TAB 4: PRE-MRI SAFETY GATE */}
              {activeTab === 'mri_gate' && (
                <div className="space-y-4">
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed">
                    🛑 <b>Checklist An toàn trước chụp MRI 3.0T (Pre-MRI Safety Gate):</b> Bệnh nhân u não nguy kịch chỉ được vào buồng MRI khi sinh hiệu đã được kiểm soát và vượt qua sàng lọc vật liệu cấy ghép từ tính.
                  </div>

                  <div className="space-y-2.5">
                    <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hemodynamicStable}
                        onChange={(e) => setHemodynamicStable(e.target.checked)}
                        className="w-4 h-4 text-rose-600 rounded"
                      />
                      <span className="text-xs font-bold text-slate-800">1. Huyết động đã được kiểm soát ổn định (Huyết áp, Mạch trong giới hạn an toàn)</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={respiratoryStable}
                        onChange={(e) => setRespiratoryStable(e.target.checked)}
                        className="w-4 h-4 text-rose-600 rounded"
                      />
                      <span className="text-xs font-bold text-slate-800">2. Hô hấp đã được kiểm soát ổn định (SpO2 &gt; 92%, đường thở thông thoáng)</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={implantPassed}
                        onChange={(e) => setImplantPassed(e.target.checked)}
                        className="w-4 h-4 text-rose-600 rounded"
                      />
                      <span className="text-xs font-bold text-slate-800">3. Sàng lọc vật liệu cấy ghép: Không có Clip phình mạch kim loại, van VP Shunt an toàn, không máy tạo nhịp</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mrEquipmentReady}
                        onChange={(e) => setMrEquipmentReady(e.target.checked)}
                        className="w-4 h-4 text-rose-600 rounded"
                      />
                      <span className="text-xs font-bold text-slate-800">4. Có monitor và thiết bị hồi sức tương thích phòng từ trường (MR-conditional)</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú đề xuất chèn lịch:</label>
                    <input
                      type="text"
                      value={mriNote}
                      onChange={(e) => setMriNote(e.target.value)}
                      placeholder="Lý do lâm sàng chèn lịch chụp MRI 3.0T..."
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <button
                    disabled={loading}
                    onClick={handleMriOverrideRequest}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                  >
                    Gửi Đề Xuất Chèn Lịch Chụp MRI 3.0T Khẩn Cấp
                  </button>
                </div>
              )}

              {/* TAB 5: ICU BED PROPOSAL */}
              {activeTab === 'icu_bed' && (
                <div className="space-y-4">
                  <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-xs text-cyan-900 leading-relaxed">
                    🏥 <b>Đề xuất giữ giường Hồi sức U Não (Neuro-ICU):</b> Hệ thống gửi yêu cầu sang Bác sĩ trực Đơn nguyên Hồi sức Cấp cứu U Não để phê duyệt giữ giường tạm thời trong 4 giờ.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú chỉ định chuyển Neuro-ICU:</label>
                    <textarea
                      rows={3}
                      value={icuNote}
                      onChange={(e) => setIcuNote(e.target.value)}
                      placeholder="Cần monitor ICP liên tục, hạ áp lực nội sọ tích cực, chuẩn bị hậu phẫu mở sọ..."
                      className="w-full text-xs p-3 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <button
                    disabled={loading}
                    onClick={handleIcuBedRequest}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                  >
                    Gửi Đề Xuất Giữ Giường Neuro-ICU 4 Giờ
                  </button>
                </div>
              )}

              {/* TAB 6: TIMELINE */}
              {activeTab === 'timeline' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Chuỗi Mốc Thời Gian (Audit Trail Milestones)
                  </h4>
                  <div className="space-y-2 border-l-2 border-slate-200 pl-4 ml-2">
                    {(eventData.timelineMilestones || []).map((m, idx) => (
                      <div key={idx} className="relative pb-3">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-rose-600 ring-4 ring-white" />
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{m.action}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {new Date(m.timestamp).toLocaleTimeString('vi-VN')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Thực hiện: <b>{m.performedByName || 'Hệ thống'}</b>
                          {m.notes && <span className="text-slate-500 italic"> — {m.notes}</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 7: CLOSURE */}
              {activeTab === 'closure' && (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                    ✅ <b>Đóng sự kiện cấp cứu:</b> Ghi nhận kết cục lâm sàng chính thức và hoàn tất hồ sơ sự cố.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Kết cục lâm sàng (Outcome):</label>
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="emergency_or_transferred">Chuyển phòng mổ cấp cứu (Mở sọ giải áp / EVD)</option>
                      <option value="neuro_icu_admitted">Nhập viện Đơn nguyên Hồi sức U Não (Neuro-ICU)</option>
                      <option value="stabilized_in_ward">Điều trị nội khoa tích cực, ổn định tại buồng/HDU</option>
                      <option value="transfer_higher_hospital">Chuyển viện tuyến trên</option>
                      <option value="fatal">Tử vong</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tóm tắt kết thúc ca cấp cứu:</label>
                    <textarea
                      rows={3}
                      value={summaryNotes}
                      onChange={(e) => setSummaryNotes(e.target.value)}
                      placeholder="Mô tả tóm tắt xử trí, tình trạng bệnh nhân khi bàn giao mổ/ICU..."
                      className="w-full text-xs p-3 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <button
                    disabled={loading}
                    onClick={handleCloseEvent}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                  >
                    Xác Nhận Đóng Sự Kiện Cấp Cứu
                  </button>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Quy trình cấp cứu thần kinh NeuroScan AI — Tuân thủ Quy chế Bệnh viện</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-all"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
