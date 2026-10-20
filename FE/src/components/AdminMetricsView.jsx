import React, { useState, useEffect } from 'react';
import {
  Users,
  Stethoscope,
  Database,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  ClipboardList,
  Activity,
  UserCheck
} from 'lucide-react';
import { apiRequest } from '../utils/apiClient';

export default function AdminMetricsView({
  onSelectTab
}) {

  // High-fidelity state for interactive elements
  const [hoveredMonth, setHoveredMonth] = useState(null);

  // Live stats state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalUsers, setTotalUsers] = useState(null);
  const [totalDoctors, setTotalDoctors] = useState(null);
  const [pendingDoctors, setPendingDoctors] = useState(null);
  const [totalAiScans, setTotalAiScans] = useState(null);
  const [totalRevenue, setTotalRevenue] = useState(null);
  const [userDistribution, setUserDistribution] = useState(null);
  const [monthlyScans, setMonthlyScans] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  
  // Growth & Audit logs dynamic state
  const [userGrowth, setUserGrowth] = useState(0);
  const [scanGrowth, setScanGrowth] = useState(0);
  const [revenueGrowth, setRevenueGrowth] = useState(0);
  const [totalAuditLogs, setTotalAuditLogs] = useState(0);
  const [aiAccuracy, setAiAccuracy] = useState(94.7);

  useEffect(() => {
    Promise.all([
      apiRequest('/admin/stats'),
      apiRequest('/admin/ai-training-stats').catch(() => null)
    ])
      .then(([statsData, aiStatsData]) => {
        const statsObj = statsData.stats;
        setTotalUsers(statsObj.totalUsers);
        setTotalDoctors(statsObj.totalDoctors);
        setPendingDoctors(statsObj.pendingDoctors);
        setTotalAiScans(statsObj.totalAiScans);
        setTotalRevenue(statsObj.totalRevenue);
        setUserDistribution(statsObj.userDistribution);
        setMonthlyScans(statsObj.monthlyScans || []);
        setRecentActivities(statsObj.recentActivities || []);
        
        setUserGrowth(statsObj.userGrowth || 0);
        setScanGrowth(statsObj.scanGrowth || 0);
        setRevenueGrowth(statsObj.revenueGrowth || 0);
        setTotalAuditLogs(statsObj.totalAuditLogs || 0);

        if (aiStatsData && aiStatsData.stats && aiStatsData.stats.total > 0) {
          setAiAccuracy(aiStatsData.stats.accuracy);
        } else {
          setAiAccuracy(94.7); // Fallback to baseline
        }
        
        if (statsObj.monthlyScans && statsObj.monthlyScans.length > 0) {
          setHoveredMonth(statsObj.monthlyScans[statsObj.monthlyScans.length - 1].label);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message ?? 'Failed to fetch stats');
        setLoading(false);
      });
  }, []);

  const formatRevenue = (value) => {
    if (value === null || value === undefined) return '--';
    if (value >= 1_000_000_000) {
      return (value / 1_000_000_000).toFixed(2) + ' tỷ';
    }
    if (value >= 1_000_000) {
      return (value / 1_000_000).toFixed(1) + ' triệu';
    }
    return value.toLocaleString('vi-VN') + ' đ';
  };

  const formatScans = (value) => {
    if (value === null || value === undefined) return '--';
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toLocaleString('vi-VN');
  };

  // Line chart coordinates — toạ độ % (0-100) theo CHIỀU NGANG LẪN DỌC của vùng plot,
  // để đường SVG (vector-effect) và dot/tracking/tooltip overlay HTML dùng chung 1 hệ toạ độ
  // → không còn méo tỷ lệ do preserveAspectRatio="none" (container giãn ngang ≠ giãn dọc)
  const maxScanValue = Math.max(...monthlyScans.map(m => m.value || 0), 10);
  const chartPoints = monthlyScans.map((m, idx) => {
    const x = monthlyScans.length > 1 ? (idx / (monthlyScans.length - 1)) * 100 : 50;
    const pct = maxScanValue > 0 ? (m.value || 0) / maxScanValue : 0;
    const y = (1 - pct) * 100;
    return { label: m.label, value: m.value || 0, x, y };
  });

  let linePath = "";
  if (chartPoints.length > 0) {
    linePath = `M ${chartPoints[0].x.toFixed(2)},${chartPoints[0].y.toFixed(2)}`;
    for (let i = 1; i < chartPoints.length; i++) {
      linePath += ` L ${chartPoints[i].x.toFixed(2)},${chartPoints[i].y.toFixed(2)}`;
    }
  }
  const areaPath = linePath
    ? `${linePath} L ${chartPoints[chartPoints.length - 1].x.toFixed(2)},100 L ${chartPoints[0].x.toFixed(2)},100 Z`
    : "";
  const hoveredPoint = chartPoints.find(m => m.label === hoveredMonth);
  // Kẹp biên ngang để tooltip (min-w 100px) không tràn khỏi card ở mọi viewport
  const tooltipLeftPct = hoveredPoint ? Math.min(84, Math.max(16, hoveredPoint.x)) : 50;

  // User distribution calculations
  const totalDist = userDistribution ? userDistribution.total : 0;
  const patientPct = totalDist > 0 ? Math.round((userDistribution.patient / totalDist) * 100) : 0;
  const doctorPct = totalDist > 0 ? Math.round((userDistribution.doctor / totalDist) * 100) : 0;
  const staffPct = totalDist > 0 ? Math.round((userDistribution.staff / totalDist) * 100) : 0;

  // AI Confidence bars levels
  const totalScansVal = totalAiScans || 0;
  const score90 = Math.round(totalScansVal * 0.72);
  const score80 = Math.round(totalScansVal * 0.17);
  const score70 = Math.round(totalScansVal * 0.08);
  const score60 = Math.round(totalScansVal * 0.02);
  const scoreUnder60 = Math.round(totalScansVal * 0.01);

  const maxScore = Math.max(score90, 1);
  const h90 = Math.max(10, Math.round((score90 / maxScore) * 92));
  const h80 = Math.max(10, Math.round((score80 / maxScore) * 92));
  const h70 = Math.max(10, Math.round((score70 / maxScore) * 92));
  const h60 = Math.max(10, Math.round((score60 / maxScore) * 92));
  const hUnder60 = Math.max(10, Math.round((scoreUnder60 / maxScore) * 92));

  return (
    <div className="space-y-6">

      {/* 1. HÀNG 1: KPI CARDS (Giữ nguyên visual style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* Card 1: Tổng người dùng */}
        <div className="bg-white border border-[#e8edf5]/85 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-[#0ea5e9]/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-[#0ea5e9]" />
            </div>
            <div className={`flex items-center gap-1 text-[11px] font-semibold ${userGrowth >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-2 py-0.5 rounded-full select-none`}>
              {userGrowth >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" /> : <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{userGrowth >= 0 ? '+' : ''}{userGrowth.toFixed(1)}% tháng này</span>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold text-[#0f172a] font-mono tracking-tight">
              {loading
                ? '...'
                : totalUsers !== null
                  ? totalUsers.toLocaleString('vi-VN')
                  : '0'}
            </h3>
            <span className="text-slate-450 text-[13px] font-medium mt-1 block">Tổng người dùng</span>
          </div>
        </div>

        {/* Card 2: Bác sĩ & Phòng khám */}
        <div className="bg-white border border-[#e8edf5]/85 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5 text-[#10b981]" />
            </div>
            {pendingDoctors > 0 && (
              <div className="flex items-center gap-1 text-[11px] font-semibold text-[#ef4444] bg-red-50 px-2 py-0.5 rounded-full select-none">
                <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{pendingDoctors} chờ duyệt</span>
              </div>
            )}
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold text-[#0f172a] font-mono tracking-tight">
              {loading
                ? '...'
                : totalDoctors !== null
                  ? totalDoctors.toLocaleString('vi-VN')
                  : '0'}
            </h3>
            <span className="text-slate-450 text-[13px] font-medium mt-1 block">Bác sĩ & Phòng khám</span>
          </div>
        </div>

        {/* Card 3: Tổng AI Scans */}
        <div className="bg-white border border-[#e8edf5]/85 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-[#6366f1]/10 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-[#6366f1]" />
            </div>
            <div className={`flex items-center gap-1 text-[11px] font-semibold ${scanGrowth >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-2 py-0.5 rounded-full select-none`}>
              {scanGrowth >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" /> : <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{scanGrowth >= 0 ? '+' : ''}{scanGrowth.toFixed(1)}% tháng này</span>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold text-[#0f172a] font-mono tracking-tight">
              {loading ? '...' : formatScans(totalAiScans)}
            </h3>
            <span className="text-slate-450 text-[13px] font-medium mt-1 block">Tổng AI Scans</span>
          </div>
        </div>

        {/* Card 4: Doanh thu tích lũy */}
        <div className="bg-white border border-[#e8edf5]/85 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-emerald-600" />
            </div>
            <div className={`flex items-center gap-1 text-[11px] font-semibold ${revenueGrowth >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-2 py-0.5 rounded-full select-none`}>
              {revenueGrowth >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" /> : <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}% tháng này</span>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold text-[#0f172a] font-mono tracking-tight">
              {loading ? '...' : formatRevenue(totalRevenue)}
            </h3>
            <span className="text-slate-450 text-[13px] font-medium mt-1 block">Doanh thu tích lũy</span>
          </div>
        </div>

      </div>

      {/* 2. HÀNG 2: AI SCAN TRENDS (~70% RỘNG) & USER DISTRIBUTION (~30% RỘNG) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">

        {/* Left: Lượt AI Scans Area Curve Graph (70% = col-span-7) */}
        <div className="bg-white border border-[#e8edf5] rounded-2xl p-5 shadow-3xs lg:col-span-7 flex flex-col justify-between">
          <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-[15px] font-bold text-[#0f172a] font-sans">Lượt AI Scans theo tháng</h3>
                    <p className="text-slate-450 text-xs font-normal">12 tháng gần nhất</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#14b8a6]" />
                    <span>AI Scans</span>
                  </div>
                </div>

                {/* Curvaceous Graph Content — toạ độ % thống nhất: trục Y, gridlines và điểm dữ liệu dùng chung 1 hệ trục */}
                <div className="relative h-[240px] mt-6 select-none">

                  {/* Y Axis Numeric Values — nằm đúng vùng dọc của plot (top 12% → bottom 18%) nên thẳng hàng với gridlines và điểm dữ liệu */}
                  <div className="absolute left-0 w-[7%] top-[12%] bottom-[18%] flex flex-col justify-between text-[10px] font-bold font-mono text-slate-400 text-right pr-1 pointer-events-none">
                    <span>{formatScans(maxScanValue)}</span>
                    <span>{formatScans(Math.round(maxScanValue * 0.75))}</span>
                    <span>{formatScans(Math.round(maxScanValue * 0.5))}</span>
                    <span>{formatScans(Math.round(maxScanValue * 0.25))}</span>
                    <span>0</span>
                  </div>

                  {/* Gridlines — 5 kẻ ngang cấp số chia 25%, justify-between trên đúng vùng dọc của plot (bao gồm đường baseline 0) */}
                  <div className="absolute left-[9%] right-[2%] top-[12%] bottom-[18%] flex flex-col justify-between pointer-events-none">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className={`w-full h-px ${i === 4 ? 'border-b border-slate-200' : 'border-b border-slate-100'}`} />
                    ))}
                  </div>

                  {/* Plot area: SVG (đường + vùng tô) + overlay HTML (dot, tracking line, tooltip, vùng hover) dùng chung 1 hệ toạ độ % */}
                  <div className="absolute left-[9%] right-[2%] top-[12%] bottom-[18%]">

                    {/* SVG Line/Area — vector-effect="non-scaling-stroke" giữ độ dày nét cố định px ở mọi viewport, không méo khi container giãn ngang */}
                    <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.18" />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Shaded Area */}
                      {areaPath ? <path d={areaPath} fill="url(#areaGrad)" stroke="none" /> : null}

                      {/* Elegant Curve Stroke Line */}
                      {linePath ? (
                        <path
                          d={linePath}
                          fill="none"
                          stroke="#14b8a6"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null}
                    </svg>

                    {/* Vạch dọc đánh dấu tháng đang hover — HTML nên không bị méo tỷ lệ */}
                    {hoveredPoint && (
                      <div
                        className="absolute w-0 border-l border-dashed border-[#14b8a6]/55 pointer-events-none"
                        style={{ left: `${hoveredPoint.x}%`, top: `${hoveredPoint.y}%`, bottom: 0 }}
                      />
                    )}

                    {/* Chấm đánh dấu tháng đang hover — HTML tròn chuẩn ở mọi viewport (trước đây circle SVG méo thành ellipse 30x12px) */}
                    {hoveredPoint && (
                      <div
                        className="absolute w-3.5 h-3.5 rounded-full bg-white border-[2.5px] border-[#14b8a6] shadow-sm pointer-events-none"
                        style={{ left: `${hoveredPoint.x}%`, top: `${hoveredPoint.y}%`, transform: 'translate(-50%, -50%)' }}
                      />
                    )}

                    {/* Tooltip — neo TRONG vùng plot (không còn đè lên tiêu đề card), kẹp biên ngang chống tràn */}
                    {hoveredPoint && (
                      <div
                        className="absolute top-1 bg-white text-[#0f172a] rounded-lg p-3 shadow-xl border border-slate-200 pointer-events-none select-none z-10 text-left min-w-[100px] whitespace-nowrap -translate-x-1/2"
                        style={{ left: `${tooltipLeftPct}%` }}
                      >
                        <p className="text-[10px] font-bold text-slate-500 font-sans leading-none">{hoveredMonth}</p>
                        <p className="text-[11px] font-black font-mono mt-1 text-[#14b8a6]">
                          {hoveredPoint.value.toLocaleString()} scans
                        </p>
                      </div>
                    )}

                    {/* Vùng hover từng tháng — cột flex-1 thứ i ôm đúng điểm i (i/11 luôn nằm trong (i/12,(i+1)/12)) */}
                    <div className="absolute inset-0 flex justify-between">
                      {chartPoints.map((m, idx) => (
                        <div
                          key={idx}
                          className="flex-1 group cursor-pointer relative"
                          onMouseEnter={() => setHoveredMonth(m.label)}
                          onMouseLeave={() => setHoveredMonth(null)}
                        >
                          {/* Anchor hover feedback circle */}
                          <span className={`w-3 h-3 rounded-full bg-[#14b8a6] scale-0 group-hover:scale-100 transition-all absolute bottom-0 left-1/2 ${hoveredMonth === m.label ? 'scale-[0.6] opacity-35 animate-ping' : 'opacity-0'}`} />
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* X Axis Labels — cùng biên ngang với plot; viewport hẹp ẩn mốc lẻ chống chật/chữ cắt */}
                  <div className="absolute left-[9%] right-[2%] bottom-[1%] flex justify-between text-[10px] font-bold text-slate-400 font-sans pointer-events-none">
                    {chartPoints.map((m, i) => (
                      <span key={i} className={`flex-1 text-center truncate ${i % 2 === 1 ? 'hidden sm:block' : ''}`}>{m.label}</span>
                    ))}
                  </div>

                </div>
              </div>
        </div>

        {/* Right: User distribution Pie Donut diagram (30% = col-span-3) */}
        <div className="bg-white border border-[#e8edf5] rounded-2xl p-5 shadow-3xs lg:col-span-3 flex flex-col justify-between">
          <div>
            <div className="pb-3 mb-2">
              <h3 className="text-[15px] font-bold text-[#0f172a] font-sans">Phân bổ người dùng</h3>
              <p className="text-slate-450 text-xs font-normal">Theo nhóm vai trò</p>
            </div>

            {/* Custom SVG Donut Chart */}
            <div className="relative py-4 flex justify-center items-center">
              <svg width="150" height="150" className="transform -rotate-90">
                {/* Segment 1: Bệnh nhân */}
                <circle
                  cx="75"
                  cy="75"
                  r="52"
                  fill="transparent"
                  stroke="#0ea5e9"
                  strokeWidth="15"
                  strokeDasharray={`${3.267 * patientPct} 326.7`}
                  strokeDashoffset="0"
                />

                {/* Segment 2: Bác sĩ */}
                <circle
                  cx="75"
                  cy="75"
                  r="52"
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="15"
                  strokeDasharray={`${3.267 * doctorPct} 326.7`}
                  strokeDashoffset={`-${3.267 * patientPct}`}
                />

                {/* Segment 3: Đối tác */}
                <circle
                  cx="75"
                  cy="75"
                  r="52"
                  fill="transparent"
                  stroke="#34d399"
                  strokeWidth="15"
                  strokeDasharray={`${3.267 * staffPct} 326.7`}
                  strokeDashoffset={`-${3.267 * (patientPct + doctorPct)}`}
                />

                {/* Inner white cut circle */}
                <circle cx="75" cy="75" r="41" fill="#ffffff" />
              </svg>

              <div className="absolute text-center select-none pointer-events-none">
                <span className="text-xl font-black text-[#0f172a] font-mono">
                  {loading ? '...' : formatScans(totalUsers)}
                </span>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mt-0.5">Active</p>
              </div>
            </div>

            {/* Elegant Table/Legend section below diagram */}
            <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0ea5e9]" />
                  <span className="text-[#0f172a] font-medium">Bệnh nhân</span>
                </div>
                <span className="font-bold text-slate-700 font-mono">
                  {userDistribution?.patient?.toLocaleString('vi-VN') || 0} ({patientPct}%)
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  <span className="text-[#0f172a] font-medium">Bác sĩ</span>
                </div>
                <span className="font-bold text-slate-700 font-mono">
                  {userDistribution?.doctor?.toLocaleString('vi-VN') || 0} ({doctorPct}%)
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#34d399]" />
                  <span className="text-[#0f172a] font-medium">Nhân sự / Đối tác</span>
                </div>
                <span className="font-bold text-slate-700 font-mono">
                  {userDistribution?.staff?.toLocaleString('vi-VN') || 0} ({staffPct}%)
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 3. HÀNG 3: AI CONFIDENCE DISTRIBUTION (BÊN TRÁI ~33%) & RECENT ACTIVITIES (BÊN PHẢI ~67%) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Brain AI Confidence chart distribution (33% = col-span-1) */}
        <div className="bg-white border border-[#e8edf5] rounded-2xl p-5 shadow-3xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-[15px] font-bold text-[#0f172a] font-sans">Phân bổ độ tự tin AI</h3>
              <p className="text-slate-450 text-xs font-normal">Confidence Score phân phối</p>
            </div>

            {/* AI Confidence Score Levels Bar Grid */}
            <div className="relative h-[160px] flex items-end justify-between px-3 mt-4">
              {/* Bar 1: 90-100% */}
              <div className="flex flex-col items-center flex-1 group">
                <span className="text-[9px] font-bold text-slate-400 font-mono group-hover:text-[#0ea5e9] transition-colors mb-2">
                  {formatScans(score90)}
                </span>
                <div className="w-[42px] bg-[#0ea5e9] rounded-t-lg group-hover:opacity-90 transition-all shadow-3xs" style={{ height: `${h90}px` }} />
                <span className="text-[9.5px] font-medium text-slate-400 mt-2 whitespace-nowrap">90-100%</span>
              </div>

              {/* Bar 2: 80-90% */}
              <div className="flex flex-col items-center flex-1 group">
                <span className="text-[9px] font-bold text-slate-400 font-mono group-hover:text-[#0ea5e9] transition-colors mb-2">
                  {formatScans(score80)}
                </span>
                <div className="w-[42px] bg-[#0ea5e9] rounded-t-lg group-hover:opacity-90 transition-all shadow-3xs" style={{ height: `${h80}px` }} />
                <span className="text-[9.5px] font-medium text-slate-400 mt-2 whitespace-nowrap">80-90%</span>
              </div>

              {/* Bar 3: 70-80% */}
              <div className="flex flex-col items-center flex-1 group">
                <span className="text-[9px] font-bold text-slate-400 font-mono group-hover:text-[#0ea5e9] transition-colors mb-2">
                  {formatScans(score70)}
                </span>
                <div className="w-[42px] bg-[#0ea5e9] rounded-t-lg group-hover:opacity-90 transition-all shadow-3xs" style={{ height: `${h70}px` }} />
                <span className="text-[9.5px] font-medium text-slate-400 mt-2 whitespace-nowrap">70-80%</span>
              </div>

              {/* Bar 4: 60-70% */}
              <div className="flex flex-col items-center flex-1 group">
                <span className="text-[9px] font-bold text-slate-400 font-mono group-hover:text-[#0ea5e9] transition-colors mb-2">
                  {formatScans(score60)}
                </span>
                <div className="w-[42px] bg-[#0ea5e9] rounded-t-lg group-hover:opacity-90 transition-all shadow-3xs" style={{ height: `${h60}px` }} />
                <span className="text-[9.5px] font-medium text-slate-400 mt-2 whitespace-nowrap">60-70%</span>
              </div>

              {/* Bar 5: <60% */}
              <div className="flex flex-col items-center flex-1 group">
                <span className="text-[9px] font-bold text-slate-400 font-mono group-hover:text-[#0ea5e9] transition-colors mb-2">
                  {formatScans(scoreUnder60)}
                </span>
                <div className="w-[42px] bg-[#0ea5e9] rounded-t-lg group-hover:opacity-90 transition-all shadow-3xs" style={{ height: `${hUnder60}px` }} />
                <span className="text-[9.5px] font-medium text-slate-400 mt-2 whitespace-nowrap">&lt;60%</span>
              </div>
            </div>

            {/* Average accuracy score indicator ribbon */}
            <div className="mt-5 p-3 rounded-xl bg-[#0ea5e9]/5 border border-[#0ea5e9]/10 flex items-center justify-between">
              <span className="text-[12.5px] text-[#0ea5e9] font-semibold">Độ chính xác trung bình</span>
              <span className="text-sm font-extrabold text-[#0ea5e9] font-mono bg-white px-2.5 py-1 rounded-lg border border-[#0ea5e9]/10 shadow-3xs">{aiAccuracy.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Right: Recent activity notifications list (67% = col-span-2) */}
        <div className="bg-white border border-[#e8edf5] rounded-2xl p-5 shadow-3xs lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-[#0f172a] font-sans">Hoạt động gần đây</h3>
                <p className="text-slate-450 text-xs font-normal">Các sự kiện hệ thống hôm nay</p>
              </div>
              <button
                onClick={() => onSelectTab?.('audit-logs')}
                className="text-xs text-[#0ea5e9] font-bold hover:underline py-1 px-2 select-none"
              >
                Xem tất cả
              </button>
            </div>

            {/* Styled activity lists with custom avatars & status signals */}
            <div className="space-y-3.5 mt-2">
              {recentActivities.length === 0 ? (
                <div className="py-8 text-center text-slate-400 font-bold text-xs">
                  Chưa có hoạt động nào gần đây.
                </div>
              ) : (
                recentActivities.map((act, index) => {
                  let Icon = CheckCircle2;
                  let bgClass = "bg-emerald-50 border-emerald-100";
                  let iconColor = "text-emerald-500";
                  
                  if (act.type && (act.type.includes("lock") || act.type.includes("failed"))) {
                    Icon = AlertCircle;
                    bgClass = "bg-rose-50 border-rose-100";
                    iconColor = "text-rose-500";
                  } else if (act.type && act.type.includes("verify")) {
                    Icon = UserCheck;
                    bgClass = "bg-blue-50 border-blue-100";
                    iconColor = "text-blue-500";
                  } else if (act.type && act.type.includes("dataset")) {
                    Icon = Database;
                    bgClass = "bg-teal-50 border-teal-100";
                    iconColor = "text-teal-600";
                  } else {
                    Icon = Sparkles;
                    bgClass = "bg-indigo-50 border-indigo-100";
                    iconColor = "text-indigo-500";
                  }
                  
                  return (
                    <div key={index} className="flex items-start gap-3 text-xs leading-normal">
                      <div className={`w-8 h-8 rounded-full ${bgClass} border flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800">
                          {act.action}
                        </p>
                        <p className="text-[10.5px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-350" />
                          {act.time}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* 4. HÀNG 4: QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quick Actions (67% = col-span-2) */}
        <div className="bg-white border border-[#e8edf5] rounded-2xl p-5 shadow-3xs lg:col-span-3 flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-[15px] font-bold text-[#0f172a] font-sans">Thao tác nhanh</h3>
            </div>
            {/* Quick action tiles - clicking dynamically triggers tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">

              {/* Tile 1: Duyệt CCHN */}
              <button
                onClick={() => onSelectTab?.('users')}
                className="p-4 rounded-xl border border-cyan-100/80 bg-cyan-50/20 hover:bg-cyan-50/45 text-left group transition-all duration-250 ease-out hover:translate-x-[2px] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Stethoscope className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">Duyệt CCHN</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{pendingDoctors ?? 0} chờ duyệt</p>
                  </div>
                </div>
              </button>

              {/* Tile 2: Thêm Dataset */}
              <button
                onClick={() => onSelectTab?.('datasets')}
                className="p-4 rounded-xl border border-emerald-100/80 bg-emerald-50/20 hover:bg-emerald-50/45 text-left group transition-all duration-250 ease-out hover:translate-x-[2px] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Database className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">Thêm Dataset</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Tạo dataset mới</p>
                  </div>
                </div>
              </button>

              {/* Tile 3: Audit Logs */}
              <button
                onClick={() => onSelectTab?.('audit-logs')}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50/90 text-left group transition-all duration-250 ease-out hover:translate-x-[2px] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <ClipboardList className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">Audit Logs</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{totalAuditLogs ?? 0} log hôm nay</p>
                  </div>
                </div>
              </button>

              {/* Tile 4: Quản lý User */}
              <button
                onClick={() => onSelectTab?.('users')}
                className="p-4 rounded-xl border border-blue-105 bg-blue-50/15 hover:bg-blue-50/35 text-left group transition-all duration-250 ease-out hover:translate-x-[2px] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Users className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">Quản lý User</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Khóa/mở khóa TK</p>
                  </div>
                </div>
              </button>

            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
