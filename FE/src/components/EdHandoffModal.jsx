import React, { useState } from 'react';
import Portal from './ui/Portal';
import { useAppDialog } from './ui/AppDialog';
import {
  FileText,
  AlertTriangle,
  X,
  CheckCircle2,
  Building2,
  ArrowRight,
  ShieldCheck,
  User,
  Scan
} from 'lucide-react';
import { post, put } from '../services/api.service';

export default function EdHandoffModal({
  isOpen,
  onClose,
  onSuccess
}) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'created'

  // ISBAR fields
  const [hisPatientCode, setHisPatientCode] = useState('');
  const [isUnidentifiedPatient, setIsUnidentifiedPatient] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Nam');
  const [edDoctorName, setEdDoctorName] = useState('');

  // S - Situation
  const [situation, setSituation] = useState('');
  // B - Background
  const [background, setBackground] = useState('');
  // A - Assessment
  const [assessment, setAssessment] = useState('');
  // R - Recommendation
  const [recommendation, setRecommendation] = useState('');

  // PACS CT Accession
  const [pacsAccessionNumber, setPacsAccessionNumber] = useState('');

  const [createdEvent, setCreatedEvent] = useState(null);

  // Popup thay cho alert() của trình duyệt
  const { dialog, notify } = useAppDialog();
  const alert = (msg = '') => {
    const m = String(msg);
    const type = /thành công|^đã |đã (cập nhật|giải|xác nhận|hoàn tất)/i.test(m) ? 'success' : /^(vui lòng|bắt buộc)/i.test(m) ? 'info' : 'error';
    return notify(type === 'success' ? 'Thành công' : type === 'info' ? 'Thông báo' : 'Có lỗi xảy ra', m, type);
  };

  if (!isOpen) return null;

  const handleSubmitHandoff = async () => {
    if (!situation.trim() || !assessment.trim()) {
      alert('Vui lòng nhập Diễn biến nguy cấp (S) và Đánh giá sơ bộ (A) theo chuẩn bàn giao ISBAR.');
      return;
    }

    setLoading(true);
    try {
      const res = await post('/api/v1/emergency/ed-handoff', {
        hisPatientCode: isUnidentifiedPatient ? '' : hisPatientCode,
        isUnidentifiedPatient,
        patientName: isUnidentifiedPatient ? '' : patientName,
        age: age ? Number(age) : 40,
        gender,
        edDoctorName,
        situation,
        background,
        assessment,
        recommendation,
        pacsAccessionNumber: pacsAccessionNumber.trim(),
        level: 'RED'
      });

      if (res && res.success) {
        setCreatedEvent(res.data.event);
        setStep('created');
        if (onSuccess) onSuccess(res.data.event);
      } else {
        alert(res?.message || 'Không thể tạo hồ sơ bàn giao từ Khoa Cấp Cứu.');
      }
    } catch (err) {
      alert('Lỗi tạo bàn giao ISBAR: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorAccept = async () => {
    if (!createdEvent?._id) return;
    setLoading(true);
    try {
      const res = await put(`/api/v1/emergency/ed-accept/${createdEvent._id}`, {});
      if (res && res.success) {
        await alert('Bác sĩ Ngoại Thần Kinh đã chấp thuận nhận bệnh. Trách nhiệm lâm sàng đã được chuyển giao chính thức sang Khoa Ung Thư Não!');
        onClose();
      }
    } catch (err) {
      alert('Lỗi chấp thuận: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      {dialog}
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-amber-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-wide uppercase">Tiếp Nhận Ca Từ Khoa Cấp Cứu (ED)</h2>
                <span className="px-2 py-0.5 bg-white/20 rounded-md text-xs font-bold uppercase">Chuẩn ISBAR</span>
              </div>
              <p className="text-xs text-amber-100 font-medium mt-0.5">
                Chuyển giao trách nhiệm lâm sàng & Chỉ định chụp CT/MRI khẩn (Chụp trước, thu sau)
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

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5">
          
          {step === 'form' && (
            <>
              {/* Cảnh báo trách nhiệm pháp lý */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                ⚠️ <b>Ranh giới pháp lý & An toàn người bệnh:</b> Trách nhiệm theo dõi và hồi sinh cấp cứu thuộc <b>100% về Khoa Cấp Cứu</b> cho tới khi Bác sĩ Ngoại Thần Kinh của Khoa Ung Thư Não bấm xác nhận <b>[Chấp thuận nhận bệnh (Accept)]</b>.
              </div>

              {/* Thông tin hành chính & Liên kết HIS */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <User className="w-4 h-4 text-cyan-700" /> I — Identification (Định danh bệnh nhân)
                </h4>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUnidentifiedPatient}
                      onChange={(e) => setIsUnidentifiedPatient(e.target.checked)}
                      className="w-4 h-4 text-orange-600 rounded"
                    />
                    <span className="text-xs font-bold text-rose-700">
                      Bệnh nhân Vô Danh (Hôn mê, không giấy tờ, không người nhà)
                    </span>
                  </label>
                </div>

                {!isUnidentifiedPatient && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Mã Bệnh Nhân HIS / CCCD:</label>
                      <input
                        type="text"
                        value={hisPatientCode}
                        onChange={(e) => setHisPatientCode(e.target.value)}
                        placeholder="VD: HIS-ED-9921 hoặc 0480..."
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Họ và tên bệnh nhân:</label>
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="VD: Vũ Quốc Bảo"
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Tuổi:</label>
                        <input
                          type="number"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          placeholder="VD: 48"
                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl font-medium"
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Giới tính:</label>
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="w-full text-xs px-2 py-2 border border-slate-200 rounded-xl font-medium"
                        >
                          <option value="Nam">Nam</option>
                          <option value="Nữ">Nữ</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Bác sĩ Khoa Cấp Cứu bàn giao:</label>
                  <input
                    type="text"
                    value={edDoctorName}
                    onChange={(e) => setEdDoctorName(e.target.value)}
                    placeholder="VD: BS. Nguyễn Văn A (Trực Cấp Cứu)"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              {/* ISBAR Chi tiết */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    S — Situation (Diễn biến nguy kịch hiện tại): <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={situation}
                    onChange={(e) => setSituation(e.target.value)}
                    placeholder="Hôn mê đột ngột GCS 9, đồng tử P 4mm, T 2mm phản xạ ánh sáng yếu, huyết áp 170/100 mmHg..."
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    B — Background (Tiền sử u não / Điều trị liên quan):
                  </label>
                  <textarea
                    rows={2}
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    placeholder="Nghi ngờ u màng não hoặc u thần kinh đệm đỉnh P, đang điều trị ngoại trú..."
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    A — Assessment (Đánh giá sơ bộ của Bác sĩ Cấp cứu): <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={assessment}
                    onChange={(e) => setAssessment(e.target.value)}
                    placeholder="Tăng áp lực nội sọ cấp dọa tụt kẹt não do u não xuất huyết..."
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    R — Recommendation (Đề xuất can thiệp chuyên khoa):
                  </label>
                  <input
                    type="text"
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    placeholder="Hội chẩn khẩn mổ mở sọ giải áp, giữ giường Neuro-ICU..."
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Kéo ảnh CT từ PACS */}
              <div className="p-4 bg-cyan-50/70 border border-cyan-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <Scan className="w-4 h-4 text-cyan-800" />
                  <h4 className="text-xs font-bold text-cyan-950 uppercase">Liên Kết Ảnh CT Đã Chụp Tại Khoa Cấp Cứu</h4>
                </div>
                <p className="text-[11px] text-cyan-800">
                  Nếu bệnh nhân đã được chụp CT sọ não cấp cứu tại ED, nhập mã Accession để kéo ảnh thẳng từ PACS chung, <b>tránh bắt bệnh nhân chụp lại</b>:
                </p>
                <input
                  type="text"
                  value={pacsAccessionNumber}
                  onChange={(e) => setPacsAccessionNumber(e.target.value)}
                  placeholder="VD: CT_BRAIN_STAT_88219 (Kéo ảnh từ PACS)"
                  className="w-full text-xs px-3 py-2 border border-cyan-300 bg-white rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <button
                disabled={loading}
                onClick={handleSubmitHandoff}
                className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2"
              >
                Gửi Hồ Sơ Bàn Giao ISBAR Sang Khoa Ung Thư Não
              </button>
            </>
          )}

          {step === 'created' && createdEvent && (
            <div className="text-center py-6 space-y-5">
              <div className="inline-flex p-4 bg-emerald-100 text-emerald-700 rounded-full animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-black text-slate-900 uppercase">Hồ Sơ Bàn Giao ISBAR Đã Được Tạo</h3>
                <p className="text-xs text-slate-600">
                  Hệ thống đã thông báo kíp trực Ngoại Thần Kinh. Bác sĩ chuyên khoa có thể bấm chấp thuận nhận bệnh ngay bên dưới:
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-1.5 max-w-lg mx-auto">
                <p><b>Mã ca cấp cứu:</b> {createdEvent._id}</p>
                <p><b>Bệnh nhân:</b> {createdEvent.isbarHandoff?.hisPatientCode || 'Vô danh'}</p>
                <p><b>Tình trạng bàn giao:</b> {createdEvent.isbarHandoff?.situation}</p>
                <p><b>Trách nhiệm hiện tại:</b> <span className="text-amber-700 font-bold uppercase">{createdEvent.isbarHandoff?.clinicalResponsibility}</span></p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  disabled={loading}
                  onClick={handleDoctorAccept}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" /> Bác Sĩ Ngoại TK: Chấp Thuận Nhận Bệnh (Accept)
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
    </Portal>
  );
}
