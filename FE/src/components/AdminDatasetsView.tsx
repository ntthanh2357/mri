import React, { useState, useEffect } from 'react';
import {
  Database,
  PlusCircle,
  Trash2,
  Edit3,
  FileText,
  DollarSign,
  Calendar,
  Activity,
  CheckCircle2,
  ShieldAlert,
  Eye,
  UploadCloud,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { apiRequest } from '../utils/apiClient';

// Dataset type mapped from API response
interface DatasetItem {
  id: string;         // mapped from _id
  name: string;
  description: string;
  priceVND: number;   // mapped from price
  status: 'pending' | 'published' | 'draft' | 'archived';
  createdAt: string;
  // Fields not in API response — kept for display compatibility with fallback values
  sampleCount: number;
  salesCount: number;
  tags: string[];
  thumbnail: string;
  isPublic: boolean;
  createdBy: string;
}

function mapApiDataset(raw: any): DatasetItem {
  return {
    id: raw._id ?? raw.id ?? '',
    name: raw.name ?? '',
    description: raw.description ?? '',
    priceVND: typeof raw.price === 'number' ? raw.price : 0,
    status: raw.status ?? 'pending',
    createdAt: raw.createdAt
      ? new Date(raw.createdAt).toLocaleDateString('vi-VN')
      : '',
    // Fallback values for fields not in API
    sampleCount: raw.sampleCount ?? 0,
    salesCount: raw.salesCount ?? 0,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    thumbnail:
      raw.thumbnail ??
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=200&auto=format&fit=crop&q=60',
    isPublic: raw.isPublic ?? true,
    createdBy: raw.createdBy ?? 'Admin',
  };
}

export default function AdminDatasetsView() {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState<'create' | 'edit' | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<DatasetItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'published' | 'draft' | 'archived'>('all');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priceVND: 100000,
    isPublic: true,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // ── Price-update state (per dataset id) ──────────────────────────────────────
  const [priceEditId, setPriceEditId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<string>('');
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // ── Task 10.1 — Fetch datasets on mount ─────────────────────────────────────
  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<{ success: boolean; datasets: any[] }>('/admin/datasets');
      const mapped = (response.datasets ?? []).map(mapApiDataset);
      setDatasets(mapped);
    } catch (err: any) {
      setError(err.message ?? 'Không thể tải danh sách dataset.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  // ── Filtering ────────────────────────────────────────────────────────────────
  const filteredDatasets = datasets.filter(d => {
    const matchesSearch =
      !searchQuery ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ── Task 10.2 — Create dataset ───────────────────────────────────────────────
  const handleCreate = async () => {
    setFormError(null);
    try {
      await apiRequest<{ success: boolean; dataset: any }>('/admin/datasets', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: formData.priceVND,
          status: 'pending',
        }),
      });
      // On success: refresh list and close modal
      await fetchDatasets();
      setShowModal(null);
    } catch (err: any) {
      // On failure: show error in modal, keep it open
      setFormError(err.message ?? 'Tạo dataset thất bại.');
    }
  };

  // ── Task 10.3 — Update price ─────────────────────────────────────────────────
  const handlePriceUpdate = async (id: string) => {
    const newPrice = parseFloat(priceInput);
    if (isNaN(newPrice) || newPrice < 0) {
      setPriceError('Giá không hợp lệ.');
      return;
    }
    setPriceLoading(true);
    setPriceError(null);
    try {
      await apiRequest<{ success: boolean; dataset: any }>(`/admin/datasets/${id}/price`, {
        method: 'PUT',
        body: JSON.stringify({ price: newPrice }),
      });
      // On success: update only that dataset's price in local state — no full reload
      setDatasets(prev =>
        prev.map(d => (d.id === id ? { ...d, priceVND: newPrice } : d))
      );
      setPriceEditId(null);
      setPriceInput('');
    } catch (err: any) {
      // On failure: show error, preserve old price
      setPriceError(err.message ?? 'Cập nhật giá thất bại.');
    } finally {
      setPriceLoading(false);
    }
  };

  // ── Modal helpers ────────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setFormData({ name: '', description: '', priceVND: 100000, isPublic: true });
    setFormError(null);
    setSelectedDataset(null);
    setShowModal('create');
  };

  // ── Inline price edit helpers ────────────────────────────────────────────────
  const openPriceEdit = (ds: DatasetItem) => {
    setPriceEditId(ds.id);
    setPriceInput(String(ds.priceVND));
    setPriceError(null);
  };

  const cancelPriceEdit = () => {
    setPriceEditId(null);
    setPriceInput('');
    setPriceError(null);
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalRevenue = datasets.reduce((sum, d) => sum + d.salesCount * d.priceVND, 0);

  // ── Status badge helper ──────────────────────────────────────────────────────
  const statusClass = (status: DatasetItem['status']) => {
    switch (status) {
      case 'published': return 'bg-emerald-100 text-emerald-700';
      case 'pending':   return 'bg-blue-100 text-blue-700';
      case 'draft':     return 'bg-amber-100 text-amber-700';
      case 'archived':  return 'bg-slate-100 text-slate-600';
      default:          return 'bg-slate-100 text-slate-600';
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Database className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Quản lý Dataset</h2>
            <p className="text-slate-500 text-xs font-medium mt-0.5">Tạo, định giá và quản lý dữ liệu huấn luyện</p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center gap-2 hover:translate-y-[-1px] transition-all"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Tạo Dataset mới
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e8edf5] shadow-3xs rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Tổng Dataset</p>
            <p className="text-xl font-extrabold font-mono text-slate-800">{datasets.length}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#e8edf5] shadow-3xs rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Tổng mẫu</p>
            <p className="text-xl font-extrabold font-mono text-slate-800">
              {datasets.reduce((s, d) => s + d.sampleCount, 0).toLocaleString('vi-VN')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#e8edf5] shadow-3xs rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Doanh thu</p>
            <p className="text-xl font-extrabold font-mono text-slate-800">{(totalRevenue / 1000000).toFixed(1)}M</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#e8edf5] shadow-3xs rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Lượt bán</p>
            <p className="text-xl font-extrabold font-mono text-slate-800">
              {datasets.reduce((s, d) => s + d.salesCount, 0)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#e8edf5] shadow-3xs p-4 flex flex-col lg:flex-row justify-between gap-3">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm dataset theo tên, mô tả, tags..."
          className="flex-1 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 font-medium"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="bg-white border border-[#e8edf5] px-3 py-2 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="published">Đã xuất bản</option>
          <option value="draft">Nháp</option>
          <option value="archived">Đã archive</option>
        </select>
      </div>

      {/* Loading indicator — Requirement 13.5 */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-12 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span>Đang tải danh sách dataset...</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4 text-rose-700 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={fetchDatasets}
            className="ml-auto text-rose-600 underline hover:no-underline"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Dataset Grid — shown when not loading */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredDatasets.map(ds => (
            <div key={ds.id} className="bg-white rounded-2xl border border-[#e8edf5] shadow-3xs overflow-hidden flex flex-col">
              {/* Thumbnail */}
              <div className="relative">
                <img src={ds.thumbnail} alt={ds.name} className="h-36 w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-0.5 truncate">{ds.id}</p>
                  <h3 className="text-sm font-extrabold text-white leading-tight truncate">{ds.name}</h3>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col gap-3">
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{ds.description}</p>

                {/* Status + sample count row */}
                <div className="flex items-center justify-between text-xs">
                  {ds.sampleCount > 0 ? (
                    <div className="flex items-center gap-1 text-slate-500">
                      <FileText className="w-3.5 h-3.5" />
                      <span className="font-semibold">{ds.sampleCount.toLocaleString('vi-VN')} mẫu</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="font-medium">{ds.createdAt}</span>
                    </div>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusClass(ds.status)}`}>
                    {ds.status.toUpperCase()}
                  </span>
                </div>

                {/* Tags (only if available) */}
                {ds.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {ds.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* CreatedAt date */}
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Calendar className="w-3 h-3" />
                  <span>Tạo lúc: {ds.createdAt || '—'}</span>
                </div>

                {/* Price + actions */}
                <div className="border-t border-[#e8edf5] pt-3 mt-auto flex flex-col gap-2">

                  {/* Price row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium mb-0.5">Giá bán</p>
                      <p className="text-lg font-extrabold text-slate-800 font-mono">
                        {(ds.priceVND / 1000).toFixed(0)}K VND
                      </p>
                    </div>

                    {/* Price error for this card */}
                    {priceEditId === ds.id && priceError && (
                      <span className="text-[10px] text-rose-600 font-medium max-w-[120px] text-right">{priceError}</span>
                    )}
                  </div>

                  {/* Inline price update — Task 10.3 */}
                  {priceEditId === ds.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        value={priceInput}
                        onChange={(e) => { setPriceInput(e.target.value); setPriceError(null); }}
                        className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                        placeholder="Nhập giá mới (VND)"
                        disabled={priceLoading}
                      />
                      <button
                        onClick={() => handlePriceUpdate(ds.id)}
                        disabled={priceLoading}
                        className="px-3 py-1.5 text-[10px] font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center gap-1 whitespace-nowrap"
                      >
                        {priceLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Lưu
                      </button>
                      <button
                        onClick={cancelPriceEdit}
                        disabled={priceLoading}
                        className="px-3 py-1.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-60 transition-colors whitespace-nowrap"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openPriceEdit(ds)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <DollarSign className="w-3 h-3" />
                      Cập nhật giá
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredDatasets.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl border border-[#e8edf5] shadow-3xs p-10 text-center text-slate-400 text-xs">
              Không tìm thấy dataset nào phù hợp.
            </div>
          )}
        </div>
      )}

      {/* Create Modal — Task 10.2 */}
      {showModal === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-150 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PlusCircle className="w-4.5 h-4.5 text-indigo-600" />
                Tạo Dataset mới
              </h3>
              <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {/* Form error banner */}
            {formError && (
              <div className="mb-4 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-rose-700 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Tên Dataset</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Ví dụ: MRI Brain Tumor Segmentation 2026"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px]"
                  placeholder="Mô tả chi tiết về dataset này..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Giá bán (VND)</label>
                <input
                  type="number"
                  value={formData.priceVND}
                  onChange={(e) => setFormData({ ...formData, priceVND: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  id="public"
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="public" className="text-xs font-medium text-slate-700">Dataset công khai</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowModal(null)}
                  className="flex-1 px-4 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:opacity-90 transition-opacity"
                >
                  Tạo Dataset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
