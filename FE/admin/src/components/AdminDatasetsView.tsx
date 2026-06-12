import React, { useState } from 'react';
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
  Sparkles
} from 'lucide-react';
import { initialDatasets } from '@neuroscan/constants';

interface AdminDatasetsViewProps {
  addSystemLog: (action: string, module: string, details: string) => void;
  datasetsCount: number;
  setDatasetsCount: (count: number) => void;
  setTotalDatasetSales: (sales: number) => void;
}

// Dataset type for this view
interface DatasetItem {
  id: string;
  name: string;
  description: string;
  sampleCount: number;
  priceVND: number;
  createdBy: string;
  createdAt: string;
  isPublic: boolean;
  status: 'published' | 'draft' | 'archived';
  tags: string[];
  salesCount: number;
  thumbnail: string;
}

export default function AdminDatasetsView({ addSystemLog, datasetsCount, setDatasetsCount, setTotalDatasetSales }: AdminDatasetsViewProps) {
  const [datasets, setDatasets] = useState<DatasetItem[]>(initialDatasets as any);
  const [showModal, setShowModal] = useState<'create' | 'edit' | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<DatasetItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sampleCount: 1000,
    priceVND: 100000,
    isPublic: true,
    tags: ['MRI', 'Brain']
  });

  const filteredDatasets = datasets.filter(d => {
    const matchesSearch = !searchQuery ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = () => {
    const newId = `DS${String(datasets.length + 1).padStart(3, '0')}`;
    const newDataset: DatasetItem = {
      id: newId,
      name: formData.name,
      description: formData.description,
      sampleCount: formData.sampleCount,
      priceVND: formData.priceVND,
      isPublic: formData.isPublic,
      tags: formData.tags,
      createdBy: 'Admin',
      createdAt: new Date().toLocaleDateString('vi-VN'),
      status: 'published',
      salesCount: 0,
      thumbnail: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=200&auto=format&fit=crop&q=60'
    };

    const updated = [...datasets, newDataset];
    setDatasets(updated);
    setDatasetsCount(updated.length);
    setShowModal(null);

    addSystemLog('Tạo Dataset', 'Datasets', `Tạo mới dataset ${newDataset.name} (${newId})`);
  };

  const handleUpdate = () => {
    if (!selectedDataset) return;
    const updated = datasets.map(d => d.id === selectedDataset.id ? { ...d, ...formData } : d);
    setDatasets(updated);
    setShowModal(null);
    addSystemLog('Cập nhật Dataset', 'Datasets', `Cập nhật thông tin dataset ${selectedDataset.name}`);
  };

  const handleDelete = (id: string) => {
    const target = datasets.find(d => d.id === id);
    if (!target) return;

    const updated = datasets.filter(d => d.id !== id);
    setDatasets(updated);
    setDatasetsCount(updated.length);
    addSystemLog('Xóa Dataset', 'Datasets', `Xóa dataset ${target.name} (${id})`);
  };

  const handleArchive = (id: string) => {
    const updated = datasets.map(d => d.id === id ? { ...d, status: 'archived' as any } : d);
    setDatasets(updated);
    const target = datasets.find(d => d.id === id);
    addSystemLog('Archive Dataset', 'Datasets', `Đã archive dataset ${target?.name} (${id})`);
  };

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      description: '',
      sampleCount: 1000,
      priceVND: 100000,
      isPublic: true,
      tags: ['MRI', 'Brain']
    });
    setSelectedDataset(null);
    setShowModal('create');
  };

  const handleOpenEdit = (dataset: DatasetItem) => {
    setFormData({
      name: dataset.name,
      description: dataset.description,
      sampleCount: dataset.sampleCount,
      priceVND: dataset.priceVND,
      isPublic: dataset.isPublic,
      tags: dataset.tags
    });
    setSelectedDataset(dataset);
    setShowModal('edit');
  };

  const totalRevenue = datasets.reduce((sum, d) => sum + (d.salesCount * d.priceVND), 0);

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
            <p className="text-xl font-extrabold font-mono text-slate-800">{datasets.reduce((s, d) => s + d.sampleCount, 0).toLocaleString('vi-VN')}</p>
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
            <p className="text-xl font-extrabold font-mono text-slate-800">{datasets.reduce((s, d) => s + d.salesCount, 0)}</p>
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
          <option value="published">Đã xuất bản</option>
          <option value="draft">Nháp</option>
          <option value="archived">Đã archive</option>
        </select>
      </div>

      {/* Dataset Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredDatasets.map(ds => (
          <div key={ds.id} className="bg-white rounded-2xl border border-[#e8edf5] shadow-3xs overflow-hidden flex flex-col">
            <div className="relative">
              <img src={ds.thumbnail} alt={ds.name} className="h-36 w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <p className="text-xs font-bold text-white/80 uppercase tracking-wider mb-0.5">{ds.id}</p>
                <h3 className="text-sm font-extrabold text-white leading-tight truncate">{ds.name}</h3>
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col gap-4">
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{ds.description}</p>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-slate-500">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="font-semibold">{ds.sampleCount.toLocaleString('vi-VN')} mẫu</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ds.status === 'published' ? 'bg-emerald-100 text-emerald-700' : ds.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                  {ds.status.toUpperCase()}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {ds.tags.map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="border-t border-[#e8edf5] pt-3 mt-auto flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-medium mb-0.5">Giá bán</p>
                  <p className="text-lg font-extrabold text-slate-800 font-mono">{(ds.priceVND / 1000).toFixed(0)}K VND</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEdit(ds)}
                    className="p-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Chỉnh sửa"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {ds.status !== 'archived' && (
                    <button
                      onClick={() => handleArchive(ds.id)}
                      className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                      title="Archive"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(ds.id)}
                    className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-150 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {showModal === 'create' ? <PlusCircle className="w-4.5 h-4.5 text-indigo-600" /> : <Edit3 className="w-4.5 h-4.5 text-indigo-600" />}
                {showModal === 'create' ? 'Tạo Dataset mới' : 'Chỉnh sửa Dataset'}
              </h3>
              <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Số lượng mẫu</label>
                  <input
                    type="number"
                    value={formData.sampleCount}
                    onChange={(e) => setFormData({ ...formData, sampleCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
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
                  onClick={showModal === 'create' ? handleCreate : handleUpdate}
                  className="flex-1 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:opacity-90 transition-opacity"
                >
                  {showModal === 'create' ? 'Tạo Dataset' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
