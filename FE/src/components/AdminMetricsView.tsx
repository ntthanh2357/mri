import React, { useState } from 'react';
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
import { Patient, Doctor } from '../types';

interface AdminMetricsViewProps {
  patients: Patient[];
  doctors: Doctor[];
  datasetsCount: number;
  totalDatasetSales: number;
  onSelectTab?: (tab: 'metrics' | 'users' | 'doctors' | 'datasets' | 'audit-logs') => void;
}

export default function AdminMetricsView({
  patients,
  doctors,
  datasetsCount,
  totalDatasetSales,
  onSelectTab
}: AdminMetricsViewProps) {

  // High-fidelity state for interactive elements
  const [hoveredMonth, setHoveredMonth] = useState<string | null>('T12/25');

  // Chart values and points matching the visual screenshot
  const aiScansData = [
    { label: 'T7/25', value: 6500, x: 5, y: 75 },
    { label: 'T8/25', value: 7200, x: 13, y: 70 },
    { label: 'T9/25', value: 7900, x: 21, y: 64 },
    { label: 'T10/25', value: 8500, x: 29, y: 58 },
    { label: 'T11/25', value: 9800, x: 37, y: 50 },
    { label: 'T12/25', value: 12500, x: 45, y: 30, hasTooltip: true },
    { label: 'T1/26', value: 10200, x: 53, y: 46 },
    { label: 'T2/26', value: 11000, x: 61, y: 41 },
    { label: 'T3/26', value: 12200, x: 69, y: 34 },
    { label: 'T4/26', value: 13100, x: 77, y: 28 },
    { label: 'T5/26', value: 14000, x: 85, y: 22 },
    { label: 'T6/26', value: 11500, x: 93, y: 38 }
  ];

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
            <h3 className="text-2xl font-extrabold text-[#0f172a] font-mono tracking-tight">15.842</h3>
            <span className="text-slate-450 text-[13px] font-medium mt-1 block">Tổng người dùng</span>
          </div>
        </div>

        {/* Card 2: Bác sĩ & Phòng khám */}
        <div className="bg-white border border-[#e8edf5]/85 shadow-sm rounded-xl p-5 hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5 text-[#10b981]" />
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#ef4444] bg-red-50 px-2 py-0.5 rounded-full select-none">
              <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>48 chờ duyệt</span>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold text-[#0f172a] font-mono tracking-tight">2.650</h3>
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
            <h3 className="text-2xl font-extrabold text-[#0f172a] font-mono tracking-tight">128.4K</h3>
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
            <h3 className="text-2xl font-extrabold text-[#0f172a] font-mono tracking-tight">2.84 tỷ</h3>
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
                <span className="w-2.5 h-2.5 rounded-full bg-[#0ea5e9]" />
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
                <div className="border-b border-slate-200 w-full h-px" />
              </div>

              {/* Y Axis Numeric Values */}
              <div className="absolute left-0 top-2 bottom-8 flex flex-col justify-between text-[10px] font-bold font-mono text-slate-400 w-6 text-right pr-1">
                <span>16K</span>
                <span>12K</span>
                <span>8K</span>
                <span>4K</span>
                <span>0K</span>
              </div>

              {/* SVG Area Line Chart Container */}
              <div className="absolute inset-y-0 left-8 right-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 80" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Shaded Area */}
                  <path
                    d="M 5,75 C 9,72 11,71 13,70 C 17,67 19,65 21,64 C 25,61 27,59 29,58 C 33,53 35,51 37,50 C 41,39 43,32 45,30 C 49,39 51,44 53,46 C 57,43 59,42 61,41 C 65,37 67,35 69,34 C 73,31 75,29 77,28 C 81,25 83,23 85,22 C 89,31 91,35 93,38 L 93,75 Z"
                    fill="url(#areaGrad)"
                    stroke="none"
                  />

                  {/* Elegant Curve Stroke Line */}
                  <path
                    d="M 5,75 C 9,72 11,71 13,70 C 17,67 19,65 21,64 C 25,61 27,59 29,58 C 33,53 35,51 37,50 C 41,39 43,32 45,30 C 49,39 51,44 53,46 C 57,43 59,42 61,41 C 65,37 67,35 69,34 C 73,31 75,29 77,28 C 81,25 83,23 85,22 C 89,31 91,35 93,38"
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                  />

                  {/* Draw dashed vertical tracking line on hover item */}
                  <line x1="45" y1="30" x2="45" y2="75" stroke="#0ea5e9" strokeWidth="0.5" strokeDasharray="1,1" />

                  {/* Circular highlighted peak interactive node */}
                  <circle cx="45" cy="30" r="1.5" fill="#ffffff" stroke="#0ea5e9" strokeWidth="1" />
                </svg>

                {/* Absolutely positioned beautiful custom HTML tooltip */}
                <div className="absolute left-[45%] top-[10%] -translate-x-1/2 bg-[#0b0f19] text-white rounded-lg p-2 shadow-xl border border-slate-800 pointer-events-none select-none z-10 text-left min-w-[70px]">
                  <p className="text-[10px] font-bold text-slate-300 font-sans leading-none">T12/25</p>
                  <p className="text-[11px] font-black font-mono mt-1 text-emerald-400">AI Scans: 12.500</p>
                </div>

                {/* Monthly Month Dots trigger points */}
                <div className="absolute inset-x-0 bottom-8 h-[50px] flex justify-between">
                  {aiScansData.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex-1 flex justify-center items-end group cursor-pointer relative"
                      onMouseEnter={() => setHoveredMonth(m.label)}
                    >
                      {/* Anchor hover feedback circle */}
                      <span className={`w-3 h-3 rounded-full bg-[#0ea5e9] scale-0 group-hover:scale-100 transition-all absolute top-1 ${hoveredMonth === m.label ? 'scale-[0.6] opacity-35 animate-ping' : 'opacity-0'}`} />
                    </div>
                  ))}
                </div>

              </div>

              {/* X Axis Labels */}
              <div className="absolute inset-x-8 bottom-0 flex justify-between text-[10px] font-bold text-slate-400 font-sans">
                {aiScansData.map((m, i) => (
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
                  strokeDasharray={`${2.46 * 78.3} ${326.7}`}
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
                  strokeDasharray={`${2.46 * 16.7} ${326.7}`}
                  strokeDashoffset={`-${2.46 * 78.3}`}
                />

                {/* Segment 3: Đối tác */}
                <circle
                  cx="75"
                  cy="75"
                  r="52"
                  fill="transparent"
                  stroke="#34d399"
                  strokeWidth="15"
                  strokeDasharray={`${2.46 * 5.0} ${326.7}`}
                  strokeDashoffset={`-${2.46 * (78.3 + 16.7)}`}
                />

                {/* Inner white cut circle */}
                <circle cx="75" cy="75" r="41" fill="#ffffff" />
              </svg>

              <div className="absolute text-center select-none pointer-events-none">
                <span className="text-xl font-black text-[#0f172a] font-mono">15.8K</span>
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
                <span className="font-bold text-slate-700 font-mono">12.400</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  <span className="text-[#0f172a] font-medium">Bác sĩ</span>
                </div>
                <span className="font-bold text-slate-700 font-mono">2.650</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#34d399]" />
                  <span className="text-[#0f172a] font-medium">Đối tác</span>
                </div>
                <span className="font-bold text-slate-700 font-mono">792</span>
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
                <span className="text-[9px] font-bold text-slate-400 font-mono group-hover:text-[#0ea5e9] transition-colors mb-2">80K</span>
                <div className="w-[42px] bg-[#0ea5e9] rounded-t-lg h-[92px] group-hover:opacity-90 transition-all shadow-3xs" />
                <span className="text-[9.5px] font-medium text-slate-400 mt-2 whitespace-nowrap">90-100%</span>
              </div>

              {/* Bar 2: 80-90% */}
              <div className="flex flex-col items-center flex-1 group">
                <span className="text-[9px] font-bold text-slate-400 font-mono group-hover:text-[#0ea5e9] transition-colors mb-2">35K</span>
                <div className="w-[42px] bg-[#0ea5e9] rounded-t-lg h-[54px] group-hover:opacity-90 transition-all shadow-3xs" />
                <span className="text-[9.5px] font-medium text-slate-400 mt-2 whitespace-nowrap">80-90%</span>
              </div>

              {/* Bar 3: 70-80% */}
              <div className="flex flex-col items-center flex-1 group">
                <span className="text-[9px] font-bold text-slate-400 font-mono group-hover:text-[#0ea5e9] transition-colors mb-2">18K</span>
                <div className="w-[42px] bg-[#0ea5e9] rounded-t-lg h-[32px] group-hover:opacity-90 transition-all shadow-3xs" />
                <span className="text-[9.5px] font-medium text-slate-400 mt-2 whitespace-nowrap">70-80%</span>
              </div>

              {/* Bar 4: 60-70% */}
              <div className="flex flex-col items-center flex-1 group">
                <span className="text-[9px] font-bold text-slate-400 font-mono group-hover:text-[#0ea5e9] transition-colors mb-2">11K</span>
                <div className="w-[42px] bg-[#0ea5e9] rounded-t-lg h-[18px] group-hover:opacity-90 transition-all shadow-3xs" />
                <span className="text-[9.5px] font-medium text-slate-400 mt-2 whitespace-nowrap">60-70%</span>
              </div>

              {/* Bar 5: <60% */}
              <div className="flex flex-col items-center flex-1 group">
                <span className="text-[9px] font-bold text-slate-400 font-mono group-hover:text-[#0ea5e9] transition-colors mb-2">4K</span>
                <div className="w-[42px] bg-[#0ea5e9] rounded-t-lg h-[10px] group-hover:opacity-90 transition-all shadow-3xs" />
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

              {/* Event 1 */}
              <div className="flex items-start gap-3 text-xs leading-normal">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">
                    BS. Nguyễn Văn An được phê duyệt CCHN
                  </p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-350" />
                    5 phút trước
                  </p>
                </div>
              </div>

              {/* Event 2 */}
              <div className="flex items-start gap-3 text-xs leading-normal">
                <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">
                    Nguyễn Thị Ngọc Bích thanh toán Premium 99k
                  </p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-350" />
                    23 phút trước
                  </p>
                </div>
              </div>

              {/* Event 3 */}
              <div className="flex items-start gap-3 text-xs leading-normal">
                <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4.5 h-4.5 text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">
                    BV Tâm Anh chạy 15 lần AI Inference
                  </p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-350" />
                    1 giờ trước
                  </p>
                </div>
              </div>

              {/* Event 4 */}
              <div className="flex items-start gap-3 text-xs leading-normal">
                <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                  <Database className="w-4.5 h-4.5 text-teal-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">
                    Dataset DS001 được bán cho Vinmec Research
                  </p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-350" />
                    2 giờ trước
                  </p>
                </div>
              </div>

              {/* Event 5 */}
              <div className="flex items-start gap-3 text-xs leading-normal">
                <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4.5 h-4.5 text-rose-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">
                    Thanh toán thất bại - Ngô Thị Thanh Vân
                  </p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-350" />
                    3 giờ trước
                  </p>
                </div>
              </div>

              {/* Event 6 */}
              <div className="flex items-start gap-3 text-xs leading-normal">
                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <Users className="w-4.5 h-4.5 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">
                    47 người dùng mới đăng ký hôm nay
                  </p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-350" />
                    4 giờ trước
                  </p>
                </div>
              </div>

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
