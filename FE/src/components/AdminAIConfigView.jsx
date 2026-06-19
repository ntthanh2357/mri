import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Brain,
  RotateCw,
  Save,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileText,
  ListFilter,
  Eye,
  Terminal
} from 'lucide-react';
import { apiRequest } from '../utils/apiClient';

export default function AdminAIConfigView() {
  const [feedback, setFeedback] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);

  const [retraining, setRetraining] = useState(false);
  const [retrainSuccess, setRetrainSuccess] = useState('');
  
  const [config, setConfig] = useState({ blacklist: [], system_prompt: '' });
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState('');

  const [blacklistInput, setBlacklistInput] = useState('');

  // ─── Fetch Doctor AI Feedback logs ──────────────────────────────────────────
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

  // ─── Fetch Chatbot Configuration ────────────────────────────────────────────
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
    fetchFeedback();
    fetchConfig();
  }, [fetchFeedback, fetchConfig]);

  // ─── Retrain AI Model (Active Learning) ─────────────────────────────────────
  const handleRetrain = async () => {
    setRetraining(true);
    setRetrainSuccess('');
    try {
      const data = await apiRequest('/admin/ai-retrain', {
        method: 'POST',
      });
      if (data.success) {
        setRetrainSuccess(data.message || 'Kích hoạt tiến trình huấn luyện lại thành công!');
        // Reload feedback lists
        await fetchFeedback();
      }
    } catch (err) {
      setRetrainSuccess(`Lỗi: ${err.message}`);
    } finally {
      setRetraining(false);
    }
  };

  // ─── Save Chatbot Configuration ─────────────────────────────────────────────
  const handleSaveConfig = async () => {
    setSaveSuccess('');
    setConfigError(null);
    
    // Parse blacklist tags
    const cleanBlacklist = blacklistInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    try {
      const response = await apiRequest('/admin/chatbot-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blacklist: cleanBlacklist,
          system_prompt: config.system_prompt
        })
      });
      if (response.success) {
        setSaveSuccess(response.message || 'Cấu hình Chatbot đã được cập nhật thành công!');
        setConfig(response.config);
      }
    } catch (err) {
      setConfigError(err.message || 'Lỗi khi lưu cấu hình chatbot');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
          <Brain className="w-4.5 h-4.5" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Quản trị Hệ thống AI (PACS & Chatbot)</h2>
          <p className="text-slate-500 text-xs font-medium mt-0.5">
            Giám sát phản hồi chẩn đoán u của bác sĩ, quản lý Active Learning và cấu hình prompt trợ lý Chatbot
          </p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        
        {/* LEFT COLUMN: ACTIVE LEARNING & DOCTOR FEEDBACK */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Active Learning Status Card */}
          <div className="bg-white rounded-2xl border border-[#e8edf5] p-6 shadow-3xs space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Cpu className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Vòng lặp học tăng cường (Active Learning)</h3>
                  <p className="text-slate-500 text-xs">Huấn luyện lại mô hình chẩn đoán từ dữ liệu phản hồi của Bác sĩ</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-medium">Trạng thái mô hình</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Sẵn sàng
                </span>
              </div>
            </div>

            {/* Progress metrics */}
            <div className="grid grid-cols-2 gap-4 py-2 border-y border-[#f1f5f9]">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Ca khó tích lũy</span>
                <span className="text-lg font-bold text-slate-900 font-mono">{feedback.length} mẫu</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Phiên bản hiện tại</span>
                <span className="text-lg font-bold text-slate-900 font-mono">v4.2-ensemble</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleRetrain}
                disabled={retraining || feedback.length === 0}
                className="flex-1 px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {retraining ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCw className="w-3.5 h-3.5" />
                )}
                {retraining ? 'Đang chạy huấn luyện...' : '🤖 Chạy huấn luyện lại (Active Learning)'}
              </button>
            </div>

            {/* Retrain success feedback */}
            {retrainSuccess && (
              <div className="px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>{retrainSuccess}</span>
              </div>
            )}
          </div>

          {/* Doctor Feedback Logs Table */}
          <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-3xs overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e8edf5] flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-500" />
                Danh sách phản hồi u từ Bác sĩ (Active Learning Logs)
              </h3>
              <button 
                onClick={fetchFeedback}
                className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                title="Làm mới"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
              {loadingFeedback ? (
                <div className="flex items-center justify-center gap-2 py-12 text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang tải danh sách phản hồi...
                </div>
              ) : feedbackError ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-rose-500">
                  <AlertTriangle className="w-6 h-6" />
                  <p className="text-xs font-semibold">{feedbackError}</p>
                </div>
              ) : (
                <table className="min-w-full text-xs">
                  <thead className="bg-[#f8fafc] sticky top-0">
                    <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                      <th className="text-left px-5 py-3 font-semibold">Tên phim</th>
                      <th className="text-left px-4 py-3 font-semibold">Chẩn đoán chuẩn</th>
                      <th className="text-left px-4 py-3 font-semibold">Tọa độ Bounding Box (x, y, w, h)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8edf5]">
                    {feedback.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-700 font-mono">
                          {item.filename}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase">
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
                        <td colSpan={3} className="px-5 py-12 text-center text-slate-400 text-xs">
                          Chưa có phản hồi điều chỉnh u nào từ Bác sĩ.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CHATBOT CONFIGURATOR */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-[#e8edf5] p-6 shadow-3xs space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Cấu hình Trợ lý lâm sàng Chatbot</h3>
                <p className="text-slate-500 text-xs">Tùy biến chỉ dẫn y tế và từ khóa chặn an toàn</p>
              </div>
            </div>

            {configError && (
              <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{configError}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{saveSuccess}</span>
              </div>
            )}

            {/* Config Fields */}
            <div className="space-y-4 text-xs">
              
              {/* Blacklist input */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-bold block">
                  Từ khóa cấm chặn đỏ (Keyword Trap Blacklist)
                </label>
                <input
                  type="text"
                  value={blacklistInput}
                  onChange={(e) => setBlacklistInput(e.target.value)}
                  placeholder="Cách nhau bằng dấu phẩy, ví dụ: tự tử, kê đơn, sống được bao lâu..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder:text-slate-400 font-medium"
                />
                <p className="text-[10px] text-slate-400">
                  Chatbot sẽ tự động chặn đứng (Red Alert) và ghi nhật ký cảnh báo nếu người dùng hỏi các từ này.
                </p>
              </div>

              {/* System prompt input */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-bold block">
                  Chỉ dẫn Bác sĩ AI (System Prompt)
                </label>
                <textarea
                  value={config.system_prompt}
                  onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
                  placeholder="Nhập vai trò hệ thống, phạm vi tư vấn và ràng buộc chuyên môn..."
                  rows={12}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder:text-slate-400 font-medium leading-relaxed font-sans"
                />
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={loadingConfig}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-500/25 hover:translate-y-[-1px]"
              >
                {loadingConfig ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Cập nhật cấu hình Chatbot
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
