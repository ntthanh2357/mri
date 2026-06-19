import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Brain,
  RotateCw,
  Save,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Terminal,
  TrendingUp,
  Activity,
  BarChart2,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../utils/apiClient';

// ─── Accuracy Ring Chart (SVG) ──────────────────────────────────────────────
function AccuracyRing({ accuracy = 0, size = 120 }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (accuracy / 100) * circumference;
  const color = accuracy >= 80 ? '#10b981' : accuracy >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={10} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-slate-900 leading-none">{accuracy}%</span>
        <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Độ chính xác</span>
      </div>
    </div>
  );
}

// ─── Class Breakdown Bar ─────────────────────────────────────────────────────
function ClassBar({ label, correct, corrected }) {
  const total = correct + corrected;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const colorMap = {
    glioma: '#6366f1',
    meningioma: '#10b981',
    pituitary: '#f59e0b',
    notumor: '#64748b',
    unknown: '#94a3b8',
  };
  const color = colorMap[label] || '#6366f1';
  const labelMap = {
    glioma: 'U thần kinh đệm (Glioma)',
    meningioma: 'U màng não (Meningioma)',
    pituitary: 'U tuyến yên (Pituitary)',
    notumor: 'Không có u (No Tumor)',
    unknown: 'Không xác định',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
          {labelMap[label] || label}
        </span>
        <span className="text-slate-400 font-mono">{correct}/{total} ca · {pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function AdminAIConfigView() {
  // ─── Training Stats ────────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState(null);

  // ─── Doctor Feedback Logs ──────────────────────────────────────────────────
  const [feedback, setFeedback] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);

  // ─── Retrain ───────────────────────────────────────────────────────────────
  const [retraining, setRetraining] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState('');

  // ─── Chatbot Config ────────────────────────────────────────────────────────
  const [config, setConfig] = useState({ blacklist: [], system_prompt: '' });
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [blacklistInput, setBlacklistInput] = useState('');

  // ─── Fetch Training Stats ─────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const data = await apiRequest('/admin/ai-training-stats');
      setStats(data.stats ?? null);
    } catch (err) {
      setStatsError(err.message || 'Không thể tải thống kê huấn luyện');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // ─── Fetch Feedback Logs ──────────────────────────────────────────────────
  const fetchFeedback = useCallback(async () => {
    setLoadingFeedback(true);
    setFeedbackError(null);
    try {
      const data = await apiRequest('/admin/ai-feedback');
      setFeedback(data.feedback ?? []);
    } catch (err) {
      setFeedbackError(err.message || 'Lỗi khi tải phản hồi từ bác sĩ');
    } finally {
      setLoadingFeedback(false);
    }
  }, []);

  // ─── Fetch Chatbot Config ─────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setLoadingConfig(true);
    setConfigError(null);
    try {
      const data = await apiRequest('/admin/chatbot-config');
      if (data.config) {
        setConfig(data.config);
        setBlacklistInput(data.config.blacklist.join(', '));
      }
    } catch (err) {
      setConfigError(err.message || 'Lỗi khi tải cấu hình chatbot');
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchFeedback();
    fetchConfig();
  }, [fetchStats, fetchFeedback, fetchConfig]);

  // ─── Retrain Handler ───────────────────────────────────────────────────────
  const handleRetrain = async () => {
    setRetraining(true);
    setRetrainMsg('');
    try {
      const data = await apiRequest('/admin/ai-retrain', { method: 'POST' });
      if (data.success) {
        setRetrainMsg(data.message || 'Kích hoạt tiến trình huấn luyện lại thành công!');
        await fetchStats();
        await fetchFeedback();
      }
    } catch (err) {
      setRetrainMsg(`Lỗi: ${err.message}`);
    } finally {
      setRetraining(false);
    }
  };

  // ─── Save Config Handler ───────────────────────────────────────────────────
  const handleSaveConfig = async () => {
    setSaveSuccess('');
    setConfigError(null);
    const cleanBlacklist = blacklistInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
    try {
      const response = await apiRequest('/admin/chatbot-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blacklist: cleanBlacklist, system_prompt: config.system_prompt }),
      });
      if (response.success) {
        setSaveSuccess(response.message || 'Cấu hình Chatbot đã được cập nhật thành công!');
        setConfig(response.config);
      }
    } catch (err) {
      setConfigError(err.message || 'Lỗi khi lưu cấu hình chatbot');
    }
  };

  // ─── Compute class breakdown ───────────────────────────────────────────────
  const allClasses = stats
    ? Array.from(new Set([...Object.keys(stats.approved_by_class || {}), ...Object.keys(stats.corrected_by_class || {})]))
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
          <Brain className="w-4.5 h-4.5" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Quản trị Hệ thống AI — Huấn luyện & Chatbot</h2>
          <p className="text-slate-500 text-xs font-medium mt-0.5">
            Theo dõi thống kê ca đúng/sai, kích hoạt Active Learning và quản lý cấu hình trợ lý AI
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1: AI TRAINING STATISTICS
      ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e8edf5] flex items-center justify-between bg-gradient-to-r from-indigo-50/60 to-white">
          <div className="flex items-center gap-2.5">
            <BarChart2 className="w-4.5 h-4.5 text-indigo-600" />
            <span className="font-bold text-slate-900 text-sm">Thống kê Phản hồi Bác sĩ — Độ chính xác AI</span>
          </div>
          <button
            onClick={fetchStats}
            className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
            title="Làm mới thống kê"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="p-6">
          {loadingStats ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-xs">
              <Loader2 className="w-5 h-5 animate-spin" /> Đang tải thống kê...
            </div>
          ) : statsError ? (
            <div className="flex items-center gap-2 py-6 text-rose-500 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{statsError}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Ring Chart */}
              <div className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <AccuracyRing accuracy={stats?.accuracy ?? 0} size={130} />
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Tổng phản hồi</p>
                  <p className="text-2xl font-black text-slate-900">{stats?.total ?? 0}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">ca bác sĩ đã đánh giá</p>
                </div>
              </div>

              {/* Stat cards */}
              <div className="space-y-3 col-span-1">
                {/* Approved */}
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">Duyệt đúng</p>
                    <p className="text-2xl font-black text-emerald-700 font-mono">{stats?.approved ?? 0}</p>
                    <p className="text-[10px] text-emerald-500">AI phân loại chính xác, bác sĩ xác nhận</p>
                  </div>
                </div>

                {/* Corrected */}
                <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                    <XCircle className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-rose-500 font-semibold uppercase tracking-wider">Sai — đã sửa lại</p>
                    <p className="text-2xl font-black text-rose-600 font-mono">{stats?.corrected ?? 0}</p>
                    <p className="text-[10px] text-rose-400">Bác sĩ điều chỉnh kết quả AI</p>
                  </div>
                </div>
              </div>

              {/* Per-class breakdown */}
              <div className="space-y-3 col-span-1">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3 h-3" /> Phân loại theo loại u
                </p>
                {allClasses.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Chưa có dữ liệu phân loại</p>
                ) : (
                  allClasses.map(cls => (
                    <ClassBar
                      key={cls}
                      label={cls}
                      correct={stats.approved_by_class[cls] || 0}
                      corrected={stats.corrected_by_class[cls] || 0}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2: ACTIVE LEARNING — RETRAIN
      ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e8edf5] flex items-center gap-2.5 bg-gradient-to-r from-blue-50/60 to-white">
          <Zap className="w-4.5 h-4.5 text-blue-600" />
          <span className="font-bold text-slate-900 text-sm">Vòng lặp học tăng cường — Kích hoạt Huấn luyện lại</span>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
              <p className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Ca cần học lại</p>
              <p className="text-3xl font-black text-slate-900 font-mono mt-1">{feedback.length}</p>
              <p className="text-slate-400 text-[10px] mt-0.5">phản hồi bác sĩ sửa lại</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
              <p className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Phiên bản mô hình</p>
              <p className="text-xl font-black text-slate-900 font-mono mt-1">v4.2-ensemble</p>
              <p className="text-slate-400 text-[10px] mt-0.5">YOLOv8 + ResNet-50</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
              <p className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Trạng thái</p>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sẵn sàng
              </span>
            </div>
          </div>

          <button
            onClick={handleRetrain}
            disabled={retraining || feedback.length === 0}
            className="w-full px-4 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {retraining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            {retraining ? 'Đang chạy huấn luyện...' : `🤖 Chạy huấn luyện lại với ${feedback.length} ca phản hồi`}
          </button>

          {retrainMsg && (
            <div className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
              retrainMsg.startsWith('Lỗi')
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-indigo-50 border-indigo-200 text-indigo-800'
            }`}>
              {retrainMsg.startsWith('Lỗi') ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />}
              <span>{retrainMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3: DOCTOR FEEDBACK LOGS TABLE
      ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e8edf5] flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-500" />
            Ca sai bác sĩ đã sửa lại (Active Learning Logs)
          </h3>
          <button
            onClick={fetchFeedback}
            className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            title="Làm mới"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          {loadingFeedback ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-xs">
              <Loader2 className="w-5 h-5 animate-spin" /> Đang tải...
            </div>
          ) : feedbackError ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-rose-500">
              <AlertTriangle className="w-6 h-6" />
              <p className="text-xs font-semibold">{feedbackError}</p>
            </div>
          ) : (
            <table className="min-w-full text-xs">
              <thead className="bg-[#f8fafc] sticky top-0">
                <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-semibold">#</th>
                  <th className="text-left px-5 py-3 font-semibold">Tên phim</th>
                  <th className="text-left px-4 py-3 font-semibold">Chẩn đoán đúng (bác sĩ sửa)</th>
                  <th className="text-left px-4 py-3 font-semibold">Bounding Box (x, y, w, h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8edf5]">
                {feedback.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-5 py-3 font-medium text-slate-700 font-mono">{item.filename}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold uppercase">
                        {item.correctClass}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400 text-[11px]">
                      x:{item.x}, y:{item.y}, w:{item.w}, h:{item.h}
                    </td>
                  </tr>
                ))}
                {feedback.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-xs">
                      Chưa có ca sai nào bác sĩ cần sửa lại.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4: CHATBOT CONFIGURATOR
      ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e8edf5] flex items-center gap-2.5 bg-gradient-to-r from-purple-50/60 to-white">
          <Brain className="w-4.5 h-4.5 text-purple-600" />
          <span className="font-bold text-slate-900 text-sm">Cấu hình Trợ lý lâm sàng Chatbot</span>
        </div>

        <div className="p-6 space-y-5">
          {configError && (
            <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{configError}</span>
            </div>
          )}
          {saveSuccess && (
            <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Blacklist */}
            <div className="space-y-1.5">
              <label className="text-slate-700 font-bold block text-xs">Từ khóa cấm (Keyword Blacklist)</label>
              <input
                type="text"
                value={blacklistInput}
                onChange={(e) => setBlacklistInput(e.target.value)}
                placeholder="Cách nhau bằng dấu phẩy, ví dụ: tự tử, kê đơn, sống được bao lâu..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder:text-slate-400 font-medium"
              />
              <p className="text-[10px] text-slate-400">Chatbot sẽ từ chối và ghi nhật ký cảnh báo khi gặp từ khóa này.</p>
            </div>

            {/* System Prompt */}
            <div className="space-y-1.5">
              <label className="text-slate-700 font-bold block text-xs">Chỉ dẫn hệ thống (System Prompt)</label>
              <textarea
                value={config.system_prompt}
                onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
                placeholder="Nhập vai trò hệ thống, phạm vi tư vấn..."
                rows={6}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder:text-slate-400 font-medium leading-relaxed font-sans"
              />
            </div>
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={loadingConfig}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-500/25 hover:translate-y-[-1px]"
          >
            {loadingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Lưu cấu hình Chatbot
          </button>
        </div>
      </div>
    </div>
  );
}
