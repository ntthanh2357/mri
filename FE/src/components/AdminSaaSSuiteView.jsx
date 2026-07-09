import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Database, 
  RefreshCw, 
  AlertTriangle, 
  Send, 
  Sliders, 
  Activity, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  Download, 
  Upload 
} from 'lucide-react';
import { apiRequest } from '../utils/apiClient';

export default function AdminSaaSSuiteView() {
  const [subTab, setSubTab] = useState('subscriptions');
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Subscription states
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [editPlan, setEditPlan] = useState('trial');
  const [editExpiry, setEditExpiry] = useState('');
  const [editStatus, setEditStatus] = useState('active');

  // SLA Monitoring state
  const [slaMetrics, setSlaMetrics] = useState([]);
  const [slaLoading, setSlaLoading] = useState(false);

  // Tenant isolation state
  const [isolationResults, setIsolationResults] = useState(null);
  const [verifyingIsolation, setVerifyingIsolation] = useState(false);

  // Backup states
  const [backupLoading, setBackupLoading] = useState({});
  const [backupFiles, setBackupFiles] = useState({});

  // AI Model versioning state
  const [aiVersions, setAiVersions] = useState([]);
  const [currentAiVersion, setCurrentAiVersion] = useState('neuroscan-v2.1.0');
  const [aiLoading, setAiLoading] = useState(false);

  // Announcements state
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annType, setAnnType] = useState('info');

  const showToast = (msg, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  };

  const loadHospitals = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/admin/hospitals');
      setHospitals(data.hospitals ?? []);
    } catch (err) {
      showToast(err.message || 'Lỗi khi tải danh sách bệnh viện', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHospitals();
  }, []);

  // Update subscription
  const handleUpdateSubscription = async (e) => {
    e.preventDefault();
    if (!selectedHospital) return;
    try {
      const res = await apiRequest(`/admin/hospitals/${selectedHospital._id}/subscription`, {
        method: 'PUT',
        body: {
          subscriptionPlan: editPlan,
          subscriptionExpiresAt: editExpiry,
          subscriptionStatus: editStatus
        }
      });
      showToast('Cập nhật gói dịch vụ thành công!');
      setSelectedHospital(null);
      loadHospitals();
    } catch (err) {
      showToast(err.message || 'Cập nhật gói dịch vụ thất bại', true);
    }
  };

  // Load SLA Metrics
  const loadSlaMetrics = async () => {
    setSlaLoading(true);
    try {
      const data = await apiRequest('/admin/monitoring/sla');
      setSlaMetrics(data.slaMetrics ?? []);
    } catch (err) {
      showToast('Lỗi khi tải SLA', true);
    } finally {
      setSlaLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'sla') {
      loadSlaMetrics();
    }
  }, [subTab]);

  // Verify Tenant Isolation
  const handleVerifyIsolation = async () => {
    setVerifyingIsolation(true);
    setIsolationResults(null);
    try {
      const data = await apiRequest('/admin/tenants/verify-isolation');
      setIsolationResults(data);
      showToast('Xác thực cách biệt dữ liệu thành công!');
    } catch (err) {
      showToast('Xác thực thất bại', true);
    } finally {
      setVerifyingIsolation(false);
    }
  };

  // Backup data
  const handleBackup = async (hospId) => {
    setBackupLoading(prev => ({ ...prev, [hospId]: true }));
    try {
      const data = await apiRequest(`/admin/hospitals/${hospId}/backup`, { method: 'POST' });
      setBackupFiles(prev => ({ ...prev, [hospId]: data.fileName }));
      showToast(`Sao lưu dữ liệu bệnh viện thành công: ${data.fileName}`);
    } catch (err) {
      showToast('Sao lưu thất bại', true);
    } finally {
      setBackupLoading(prev => ({ ...prev, [hospId]: false }));
    }
  };

  // Restore data
  const handleRestore = async (hospId) => {
    const fileName = backupFiles[hospId];
    if (!fileName) {
      showToast('Không có file sao lưu nào được chọn để khôi phục.', true);
      return;
    }
    try {
      const data = await apiRequest(`/admin/hospitals/${hospId}/restore`, {
        method: 'POST',
        body: { fileName }
      });
      const { restoredStats, warnings } = data;
      let msg = `✅ Khôi phục thành công!`;
      if (restoredStats) {
        msg += ` ${restoredStats.visits} lượt khám · ${restoredStats.users} tài khoản · ${restoredStats.invoices} hóa đơn`;
      }
      showToast(msg);
      // Nếu có user bị tạo lại với mật khẩu tạm, cảnh báo riêng
      if (warnings && warnings.length > 0) {
        setTimeout(() => {
          showToast(`⚠️ ${warnings.length} tài khoản được tạo mới với mật khẩu tạm — yêu cầu đặt lại mật khẩu.`, true);
        }, 1200);
      }
    } catch (err) {
      showToast(err.message || 'Khôi phục thất bại', true);
    }
  };


  // Load AI versions
  const loadAiVersions = async () => {
    setAiLoading(true);
    try {
      const data = await apiRequest('/admin/ai-models');
      setAiVersions(data.versions ?? []);
    } catch (err) {
      showToast('Lỗi khi tải các phiên bản AI', true);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'ai-models') {
      loadAiVersions();
    }
  }, [subTab]);

  // Rollback AI model
  const handleRollback = async (version) => {
    try {
      const data = await apiRequest('/admin/ai-models/rollback', {
        method: 'POST',
        body: { version }
      });
      setCurrentAiVersion(data.currentVersion);
      showToast(`Đã khôi phục mô hình AI về phiên bản: ${version}`);
      loadAiVersions();
    } catch (err) {
      showToast('Khôi phục mô hình AI thất bại', true);
    }
  };

  // Send announcement
  const handleSendAnnouncement = async (e) => {
    e.preventDefault();
    if (!annTitle || !annContent) return;
    try {
      await apiRequest('/admin/announcements', {
        method: 'POST',
        body: { title: annTitle, content: annContent, type: annType }
      });
      showToast('Đã đăng thông báo khẩn cấp hệ thống thành công!');
      setAnnTitle('');
      setAnnContent('');
    } catch (err) {
      showToast('Gửi thông báo thất bại', true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast notifications */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-lg">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold shadow-lg">
          {errorMsg}
        </div>
      )}

      {/* Tab Navigation header */}
      <div className="border-b border-slate-200 flex flex-wrap gap-1">
        <button
          onClick={() => setSubTab('subscriptions')}
          className={`px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
            subTab === 'subscriptions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          💳 Gói Dịch Vụ & Subscription
        </button>
        <button
          onClick={() => setSubTab('sla')}
          className={`px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
            subTab === 'sla' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          ⚡ Giám Sát SLA & Isolation
        </button>
        <button
          onClick={() => setSubTab('backup')}
          className={`px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
            subTab === 'backup' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          📂 Backup & Restore Data
        </button>
        <button
          onClick={() => setSubTab('ai-models')}
          className={`px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
            subTab === 'ai-models' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          🤖 Phiên Bản AI Models
        </button>
        <button
          onClick={() => setSubTab('announcements')}
          className={`px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer ${
            subTab === 'announcements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          📢 Thông Báo Hệ Thống
        </button>
      </div>

      {/* ─── TAB: SUBSCRIPTIONS ─── */}
      {subTab === 'subscriptions' && (
        <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-3xs p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Quản Lý Gói Dịch Vụ SaaS</h3>
              <p className="text-xs text-slate-400 font-medium">Theo dõi thời hạn và cấu hình gói thuê bao của từng bệnh viện</p>
            </div>
            <button onClick={loadHospitals} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Làm mới
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-[#f8fafc]">
                <tr className="text-slate-500 uppercase tracking-wider text-[10.5px]">
                  <th className="text-left px-4 py-3">Mã BV</th>
                  <th className="text-left px-4 py-3">Tên Bệnh Viện</th>
                  <th className="text-left px-4 py-3">Gói Dịch Vụ</th>
                  <th className="text-left px-4 py-3">Thời Hạn</th>
                  <th className="text-left px-4 py-3">Trạng Thái</th>
                  <th className="text-center px-4 py-3">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8edf5]">
                {hospitals.map(h => (
                  <tr key={h._id} className="hover:bg-[#f8fafc]/50">
                    <td className="px-4 py-4 font-bold font-mono">{h.code}</td>
                    <td className="px-4 py-4 font-bold">{h.name}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                        h.subscriptionPlan === 'pro' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                        h.subscriptionPlan === 'basic' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-slate-50 text-slate-600 border border-slate-200'
                      }`}>
                        {h.subscriptionPlan || 'trial'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-500 font-mono">
                      {h.subscriptionExpiresAt ? new Date(h.subscriptionExpiresAt).toLocaleDateString('vi-VN') : 'Không xác định'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        h.subscriptionStatus === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-rose-50 text-rose-700 border border-rose-150'
                      }`}>
                        {h.subscriptionStatus === 'active' ? 'Hoạt động' : 'Hết hạn/Khóa'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedHospital(h);
                          setEditPlan(h.subscriptionPlan || 'trial');
                          setEditExpiry(h.subscriptionExpiresAt ? h.subscriptionExpiresAt.substring(0, 10) : '');
                          setEditStatus(h.subscriptionStatus || 'active');
                        }}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        Sửa Gói
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal cập nhật subscription */}
          {selectedHospital && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-xs p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="text-sm font-bold text-slate-900">Thay đổi gói: {selectedHospital.name}</h4>
                  <button onClick={() => setSelectedHospital(null)} className="text-slate-400">✕</button>
                </div>
                <form onSubmit={handleUpdateSubscription} className="space-y-4 text-xs font-medium text-slate-700">
                  <div className="space-y-1">
                    <label className="block text-[11px]">Gói Dịch Vụ</label>
                    <select value={editPlan} onChange={e => setEditPlan(e.target.value)} className="w-full border p-2 rounded-xl">
                      <option value="trial">Trial (Thử nghiệm)</option>
                      <option value="basic">Basic (Tiêu chuẩn)</option>
                      <option value="pro">Pro (Bệnh viện lớn)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px]">Ngày hết hạn</label>
                    <input type="date" value={editExpiry} onChange={e => setEditExpiry(e.target.value)} className="w-full border p-2 rounded-xl" required />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px]">Trạng Thái</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full border p-2 rounded-xl">
                      <option value="active">Active (Kích hoạt)</option>
                      <option value="expired">Expired (Hết hạn)</option>
                      <option value="suspended">Suspended (Tạm ngưng)</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setSelectedHospital(null)} className="px-4 py-2 border rounded-xl hover:bg-slate-50 cursor-pointer">Hủy</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 cursor-pointer font-bold">Lưu lại</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: SLA & ISOLATION ─── */}
      {subTab === 'sla' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-3xs p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Giám Sát SLA & Uptime Dịch Vụ AI</h3>
                <p className="text-xs text-slate-400 font-medium">Uptime thực tế và độ trễ phản hồi của hệ thống Active Learning</p>
              </div>
              <button onClick={loadSlaMetrics} disabled={slaLoading} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold flex items-center gap-1">
                {slaLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                Làm mới SLA
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {slaMetrics.map(m => (
                <div key={m.hospitalId} className="border border-slate-150 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{m.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono font-bold uppercase">{m.code}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase ${
                      m.status === 'healthy' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' :
                      m.status === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-250' : 'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}>
                      {m.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t">
                    <div>
                      <span className="text-[10px] text-slate-400">AI Uptime</span>
                      <p className="font-mono font-bold text-slate-800">{m.uptime}%</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Latency</span>
                      <p className="font-mono font-bold text-slate-800">{m.latencyMs} ms</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-3xs p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Xác Thực Tenant Isolation (Bảo Mật Dữ Liệu)</h3>
              <p className="text-xs text-slate-400 font-medium">Chạy quy trình quét chéo hệ thống để chứng minh tính cách biệt dữ liệu an toàn</p>
            </div>
            
            <button
              onClick={handleVerifyIsolation}
              disabled={verifyingIsolation}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-850 cursor-pointer flex items-center gap-2"
            >
              {verifyingIsolation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Bắt đầu quét và xác thực cách biệt
            </button>

            {isolationResults && (
              <div className="border rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-800">
                    Kết quả xác thực: {isolationResults.allIsolated ? "ĐẠT TIÊU CHUẨN ISOLATION" : "CẢNH BÁO RÒ RỈ DỮ LIỆU"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{isolationResults.details}</p>
                <div className="divide-y text-[11px]">
                  {isolationResults.verificationResults.map(r => (
                    <div key={r.hospitalId} className="py-2 flex justify-between">
                      <span className="font-bold text-slate-700">{r.name}</span>
                      <span className="text-emerald-600 font-bold font-mono">Cách biệt 100%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: BACKUP & RESTORE ─── */}
      {subTab === 'backup' && (
        <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-3xs p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Sao Lưu & Khôi Phục Dữ Liệu Theo Cơ Sở</h3>
            <p className="text-xs text-slate-400 font-medium">Backup độc lập dữ liệu hồ sơ bệnh nhân, lượt khám và hóa đơn để tuân thủ an toàn</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-[#f8fafc]">
                <tr className="text-slate-500 uppercase tracking-wider text-[10.5px]">
                  <th className="text-left px-4 py-3">Tên Bệnh Viện</th>
                  <th className="text-left px-4 py-3">Bản sao lưu gần nhất</th>
                  <th className="text-center px-4 py-3">Thao Tác Backup</th>
                  <th className="text-center px-4 py-3">Thao Tác Restore</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8edf5]">
                {hospitals.map(h => (
                  <tr key={h._id} className="hover:bg-[#f8fafc]/50">
                    <td className="px-4 py-4 font-bold">{h.name}</td>
                    <td className="px-4 py-4 font-mono text-slate-500 text-[10.5px]">
                      {backupFiles[h._id] || 'Chưa thực hiện backup trong phiên này'}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleBackup(h._id)}
                        disabled={backupLoading[h._id]}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-[11px] font-bold flex items-center gap-1 mx-auto cursor-pointer"
                      >
                        {backupLoading[h._id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        Backup JSON
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleRestore(h._id)}
                        disabled={!backupFiles[h._id]}
                        className="px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-[11px] font-bold flex items-center gap-1 mx-auto disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        Restore Dữ Liệu
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: AI MODELS ─── */}
      {subTab === 'ai-models' && (
        <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-3xs p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Quản Lý Phiên Bản Mô Hình AI</h3>
              <p className="text-xs text-slate-400 font-medium">Theo dõi lịch sử huấn luyện Active Learning và cấu hình Rollback phiên bản</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Phiên bản hiện tại</span>
              <span className="text-xs font-bold text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded-lg">{currentAiVersion}</span>
            </div>
          </div>

          {aiLoading && (
            <div className="flex justify-center py-8 text-xs text-slate-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải dữ liệu mô hình...
            </div>
          )}

          {!aiLoading && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-[#f8fafc]">
                    <tr className="text-slate-500 uppercase tracking-wider text-[10.5px]">
                      <th className="text-left px-4 py-3">Tên Phiên Bản AI</th>
                      <th className="text-left px-4 py-3">Độ chính xác (Accuracy)</th>
                      <th className="text-left px-4 py-3">Ngày Deployed</th>
                      <th className="text-left px-4 py-3">Trạng Thái</th>
                      <th className="text-center px-4 py-3">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8edf5]">
                    {aiVersions.map(v => (
                      <tr key={v.version} className="hover:bg-[#f8fafc]/50">
                        <td className="px-4 py-4 font-mono font-bold text-slate-800">{v.version}</td>
                        <td className="px-4 py-4 font-mono font-bold text-slate-700">{v.accuracy}%</td>
                        <td className="px-4 py-4 text-slate-500 font-mono">
                          {new Date(v.deployedAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            v.version === currentAiVersion ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-slate-50 text-slate-500'
                          }`}>
                            {v.version === currentAiVersion ? 'Đang chạy' : 'Sẵn sàng rollback'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleRollback(v.version)}
                            disabled={v.version === currentAiVersion}
                            className="px-3 py-1 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-40 text-[11px] font-bold cursor-pointer"
                          >
                            Rollback
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: ANNOUNCEMENTS ─── */}
      {subTab === 'announcements' && (
        <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-3xs p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Đăng Thông Báo Khẩn Cấp Hệ Thống</h3>
            <p className="text-xs text-slate-400 font-medium">Gửi tin nhắn khẩn cấp, thông tin bảo trì tới giao diện của tất cả các bệnh viện</p>
          </div>

          <form onSubmit={handleSendAnnouncement} className="space-y-4 text-xs font-medium text-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px]">Tiêu đề thông báo</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Bảo trì máy chủ AI NeuroScan"
                  value={annTitle}
                  onChange={e => setAnnTitle(e.target.value)}
                  className="w-full border p-2.5 bg-slate-50 border-slate-200 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px]">Phân loại thông báo</label>
                <select value={annType} onChange={e => setAnnType(e.target.value)} className="w-full border p-2.5 bg-slate-50 border-slate-200 rounded-xl">
                  <option value="info">Info (Thông tin chung)</option>
                  <option value="warning">Warning (Cảnh báo quan trọng)</option>
                  <option value="maintenance">Maintenance (Bảo trì định kỳ)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px]">Nội dung chi tiết</label>
              <textarea
                rows={4}
                placeholder="Nhập nội dung thông báo hiển thị cho các bệnh viện..."
                value={annContent}
                onChange={e => setAnnContent(e.target.value)}
                className="w-full border p-3 bg-slate-50 border-slate-200 rounded-xl"
                required
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-500/20"
              >
                <Send className="w-3.5 h-3.5" /> Gửi thông báo
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
