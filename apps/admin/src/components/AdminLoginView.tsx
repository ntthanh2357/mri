import React, { useState } from 'react';
import { Lock, Mail, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';

interface AdminLoginViewProps {
  onLoginSuccess: (email: string) => void;
}

export default function AdminLoginView({ onLoginSuccess }: AdminLoginViewProps) {
  const [email, setEmail] = useState('admin@neuroscan.vn');
  const [password, setPassword] = useState('Admin@2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (email === 'admin@neuroscan.vn' && password === 'Admin@2026') {
        onLoginSuccess(email);
      } else {
        setError('Email hoặc mật khẩu quản trị viên không chính xác. Vui lòng kiểm tra lại!');
      }
      setLoading(false);
    }, 850);
  };

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative backdrop blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-650/15 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-550/10 rounded-full filter blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10" id="admin-login-card-container">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 bg-gradient-to-tr from-blue-600 to-emerald-550 rounded-2xl items-center justify-center shadow-lg shadow-blue-500/20 mb-4 animate-pulse">
            <ShieldAlert className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight font-sans">
            NEUROSCAN <span className="text-blue-450">ADMIN</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-xs font-semibold uppercase tracking-wider mt-1.5">
            Cổng Kiểm Toán & Quản Trị Hệ Thống
          </p>
        </div>

        {/* Login form card */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8" id="admin-login-card">
          <h2 className="text-base font-bold text-slate-100 mb-6">Đăng nhập tài khoản Admin</h2>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl text-xs flex items-start gap-2.5 mb-5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 block tracking-wide uppercase">Email Quản Trị Viên</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4.5 h-4.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@neuroscan.vn"
                  className="w-full bg-[#121b35] border border-slate-800 rounded-xl py-2.5 pl-11 pr-4 text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500 font-sans font-medium hover:border-slate-750 transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 block tracking-wide uppercase">Mật khẩu bảo mật</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4.5 h-4.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#121b35] border border-slate-800 rounded-xl py-2.5 pl-11 pr-4 text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500 font-mono hover:border-slate-750 transition-colors"
                />
              </div>
            </div>

            {/* Demo Help Banner */}
            <div className="bg-[#0f1d3a] border border-[#1b3469] rounded-xl p-3 text-xs text-blue-300 flex items-start gap-2">
              <Sparkles className="w-4.5 h-4.5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-extrabold text-[#7da8eb] mb-0.5">Môi trường Kiểm thử / Demo:</p>
                <p className="font-medium text-[10.5px] leading-relaxed text-slate-350">
                  Sử dụng tài khoản mặc định được cấu hình sẵn:<br />
                  Email: <strong className="text-white">admin@neuroscan.vn</strong><br />
                  Pass: <strong className="text-white">Admin@2026</strong>
                </p>
              </div>
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              id="login-submit-button"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
              ) : (
                'Đăng Nhập Quản Trị Hệ Thống'
              )}
            </button>
          </form>

          {/* Secure disclaimer */}
          <p className="text-[10px] text-slate-500 text-center font-medium mt-6 leading-relaxed">
            Hệ thống giám sát tối mật đạt chuẩn HIPAA & GDPR. Mọi hoạt động truy cập không hợp lệ đều được ghi chép địa chỉ IP chi tiết và chuyển tiếp đến cơ quan thanh tra an ninh.
          </p>
        </div>
      </div>
    </div>
  );
}
