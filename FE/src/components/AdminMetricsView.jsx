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

  useEffect(() => {
    apiRequest('/admin/stats')
      .then((data) => {
        setTotalUsers(data.stats.totalUsers);
        setTotalDoctors(data.stats.totalDoctors);
        setPendingDoctors(data.stats.pendingDoctors);
        setTotalAiScans(data.stats.totalAiScans);
        setTotalRevenue(data.stats.totalRevenue);
        setUserDistribution(data.stats.userDistribution);
        setMonthlyScans(data.stats.monthlyScans || []);
        setRecentActivities(data.stats.recentActivities || []);
        
        if (data.stats.monthlyScans && data.stats.monthlyScans.length > 0) {
          setHoveredMonth(data.stats.monthlyScans[data.stats.monthlyScans.length - 1].label);
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

  // Line chart coordinates calculation
  const maxScanValue = Math.max(...monthlyScans.map(m => m.value || 0), 10);
  const chartPoints = monthlyScans.map((m, idx) => {
    const x = 5 + idx * (88 / Math.max(1, monthlyScans.length - 1));
    const pct = maxScanValue > 0 ? (m.value || 0) / maxScanValue : 0;
    const y = 75 - pct * 55;
    return { label: m.label, value: m.value || 0, x, y };
  });

  let linePath = "";
  if (chartPoints.length > 0) {
    linePath = `M ${chartPoints[0].x},${chartPoints[0].y}`;
    for (let i = 1; i < chartPoints.length; i++) {
      linePath += ` L ${chartPoints[i].x},${chartPoints[i].y}`;
    }
  }
  const areaPath = linePath ? `${linePath} L ${chartPoints[chartPoints.length - 1].x},75 L ${chartPoints[0].x},75 Z` : "";

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
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full select-none">
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+8.9% tháng này</span>
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
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full select-none">
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+22.1% tháng này</span>
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
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full select-none">
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+18.4% tháng này</span>
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

                {/* Curvaceous Graph Content */}
                <div className="relative h-[240px] mt-6 select-none">

                  {/* Backgrid grid-lines */}
                  <div className="absolute inset-x-8 top-2 bottom-8 flex flex-col justify-between pointer-events-none">
                    <div className="border-b border-slate-100/70 w-full h-px" />
                    <div className="border-b border-slate-100/70 w-full h-px" />
                    <div className="border-b border-slate-100/70 w-full h-px" />
                    <div className="border-b border-slate-250 w-full h-px" />
                  </div>

                  {/* Y Axis Numeric Values */}
                  <div className="absolute left-0 top-2 bottom-8 flex flex-col justify-between text-[10px] font-bold font-mono text-slate-400 w-6 text-right pr-1">
                    <span>{formatScans(maxScanValue)}</span>
                    <span>{formatScans(Math.round(maxScanValue * 0.75))}</span>
                    <span>{formatScans(Math.round(maxScanValue * 0.5))}</span>
                    <span>{formatScans(Math.round(maxScanValue * 0.25))}</span>
                    <span>0</span>
                  </div>

                  {/* SVG Area Line Chart Container */}
                  <div className="absolute inset-y-0 left-8 right-2">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 80" preserveAspectRatio="none">
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
                          strokeWidth="1.25"
                          strokeLinecap="round"
                        />
                      ) : null}

                      {/* Draw dashed vertical tracking line on hover item */}
                      {hoveredMonth && chartPoints.length > 0 && chartPoints.find(m => m.label === hoveredMonth) && (
                        <>
                          <line 
                            x1={chartPoints.find(m => m.label === hoveredMonth)?.x} 
                            y1={chartPoints.find(m => m.label === hoveredMonth)?.y} 
                            x2={chartPoints.find(m => m.label === hoveredMonth)?.x} 
                            y2="75" 
                            stroke="#14b8a6" 
                            strokeWidth="0.5" 
                            strokeDasharray="1,1" 
                          />
                          <circle 
                            cx={chartPoints.find(m => m.label === hoveredMonth)?.x} 
                            cy={chartPoints.find(m => m.label === hoveredMonth)?.y} 
                            r="2" 
                            fill="#ffffff" 
                            stroke="#14b8a6" 
                            strokeWidth="1.2" 
                          />
                        </>
                      )}
                    </svg>

                    {/* Absolutely positioned beautiful custom HTML tooltip */}
                    {hoveredMonth && chartPoints.length > 0 && chartPoints.find(m => m.label === hoveredMonth) && (
                      <div 
                        className="absolute top-0 bg-white text-[#0f172a] rounded-lg p-3 shadow-xl border border-slate-200 pointer-events-none select-none z-10 text-left min-w-[100px] transform -translate-x-1/2 -translate-y-full mb-2"
                        style={{ left: `${(chartPoints.find(m => m.label === hoveredMonth)?.x || 50)}%` }}
                      >
                        <p className="text-[10px] font-bold text-slate-500 font-sans leading-none">{hoveredMonth}</p>
                        <p className="text-[11px] font-black font-mono mt-1 text-[#14b8a6]">
                          {chartPoints.find(m => m.label === hoveredMonth)?.value.toLocaleString()} scans
                        </p>
                      </div>
                    )}

                    {/* Monthly Month Dots trigger points */}
                    <div className="absolute inset-x-0 bottom-8 h-[50px] flex justify-between">
                      {chartPoints.map((m, idx) => (
                        <div
                          key={idx}
                          className="flex-1 flex justify-center items-end group cursor-pointer relative"
                          onMouseEnter={() => setHoveredMonth(m.label)}
                          onMouseLeave={() => setHoveredMonth(null)}
                        >
                          {/* Anchor hover feedback circle */}
                          <span className={`w-3 h-3 rounded-full bg-[#14b8a6] scale-0 group-hover:scale-100 transition-all absolute top-1 ${hoveredMonth === m.label ? 'scale-[0.6] opacity-35 animate-ping' : 'opacity-0'}`} />
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* X Axis Labels */}
                  <div className="absolute inset-x-8 bottom-0 flex justify-between text-[10px] font-bold text-slate-400 font-sans">
                    {chartPoints.map((m, i) => (
                      <span key={i} className="flex-1 text-center truncate">{m.label}</span>
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
              <span className="text-sm font-extrabold text-[#0ea5e9] font-mono bg-white px-2.5 py-1 rounded-lg border border-[#0ea5e9]/10 shadow-3xs">94.7%</span>
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
                Xem tất cả →
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
                onClick={() => onSelectTab?.('doctors')}
                className="p-4 rounded-xl border border-cyan-100/80 bg-cyan-50/20 hover:bg-cyan-50/45 text-left group transition-all duration-250 ease-out hover:translate-x-[2px] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Stethoscope className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">Duyệt CCHN</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">48 chờ xử lý</p>
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
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">1284 log hôm nay</p>
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
