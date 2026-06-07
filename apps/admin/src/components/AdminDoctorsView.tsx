import React, { useState } from 'react';
import { 
  Stethoscope, 
  Check, 
  X, 
  FileText, 
  Search, 
  ShieldCheck, 
  AlertCircle, 
  Award,
  ExternalLink,
  ChevronDown,
  Building
} from 'lucide-react';
import { Doctor } from '@neuroscan/types';

interface BackofficeDoctor {
  id: string;
  name: string;
  avatarUrl: string;
  specialty: string;
  experience: string;
  hospital: string;
  email: string;
  phone: string;
  cchnNumber: string; // Mã số Chứng chỉ hành nghề
  cchnType: string;   // Phạm vi hành nghề
  issuedBy: string;   // Nơi cấp CCHN (e.g., Bộ Y Tế, Sở Y Tế Hà Nội)
  issuedDate: string;
  status: 'Pending' | 'Verified' | 'Rejected';
}

interface AdminDoctorsViewProps {
  doctors: Doctor[];
  addSystemLog: (action: string, moduleName: string, details: string) => void;
  setVerifiedCount: React.Dispatch<React.SetStateAction<number>>;
}

export default function AdminDoctorsView({ 
  doctors, 
  addSystemLog,
  setVerifiedCount
}: AdminDoctorsViewProps) {
  // Convert basic doctors data to high-fidelity backoffice mock
  const [panelDoctors, setPanelDoctors] = useState<BackofficeDoctor[]>(() => {
    return [
      {
        id: 'DOC-01',
        name: 'BS. Lê Mạnh Minh',
        specialty: 'Chẩn Đoán Hình Ảnh (MRI/CT)',
        experience: '12 năm bác sĩ khoa thần kinh',
        avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&auto=format&fit=crop&q=80',
        hospital: 'Bệnh viện Bạch Mai - Khoa Thần Kinh',
        email: 'leminh.neuro@bachmai.org.vn',
        phone: '0912445566',
        cchnNumber: '001425/BYT-CCHN',
        cchnType: 'Chẩn đoán hình ảnh thần kinh học',
        issuedBy: 'Cục Quản Lý Khám Chữa Bệnh - Bộ Y Tế',
        issuedDate: '2016-12-15',
        status: 'Verified'
      },
      {
        id: 'DOC-02',
        name: 'BS. Nguyễn Trọng Nhân',
        specialty: 'Thần Kinh Học Lâm Sàng',
        experience: '8 năm thâm niên ngoại khoa',
        avatarUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=120&auto=format&fit=crop&q=80',
        hospital: 'Bệnh viện Chợ Rẫy - Phòng MRI 3',
        email: 'nhan.nguyen@choray.vn',
        phone: '0988776655',
        cchnNumber: '018942/HCM-CCHN',
        cchnType: 'Nội khoa chuyên ngành Thần kinh',
        issuedBy: 'Sở Y Tế Thành phố Hồ Chí Minh',
        issuedDate: '2020-05-18',
        status: 'Verified'
      },
      {
        id: 'DOC-03',
        name: 'ThS. BS. Trần Thị Mai',
        specialty: 'Phục Hồi Chức Năng Thần Kinh',
        experience: '15 năm nghiên cứu u não hố sau',
        avatarUrl: 'https://images.unsplash.com/photo-1594824813573-246434de83fb?w=120&auto=format&fit=crop&q=80',
        hospital: 'Bệnh viện Đại Học Y Hà Nội',
        email: 'maitran.rehab@hmu.edu.vn',
        phone: '0904005522',
        cchnNumber: '025619/BYT-CCHN',
        cchnType: 'Y học phục hồi & Phẫu thuật thần kinh',
        issuedBy: 'Cục Quản Lý Khám Chữa Bệnh - Bộ Y Tế',
        issuedDate: '2014-08-30',
        status: 'Pending' // Initially pending verification
      },
      {
        id: 'DOC-04',
        name: 'BS. Phan Hoàng Long',
        specialty: 'Bác Sĩ Đọc MRI Não 3D',
        experience: '6 năm kỹ thuật phân tích khối u',
        avatarUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=120&auto=format&fit=crop&q=80',
        hospital: 'Phòng khám Đa khoa Tâm Anh',
        email: 'longph@tamanhhospital.vn',
        phone: '0912998811',
        cchnNumber: '031084/HN-CCHN',
        cchnType: 'Y khoa Chẩn đoán hình ảnh thần kinh sâu',
        issuedBy: 'Sở Y Tế Thành phố Hà Nội',
        issuedDate: '2022-11-10',
        status: 'Pending' // Initially pending verification
      },
      {
        id: 'DOC-05',
        name: 'BS. Phạm Mỹ Liên',
        specialty: 'Ung Bướu Học Thần Kinh',
        experience: '4 năm thâm niên xạ trị',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
        hospital: 'Bệnh viện K Trung Ương',
        email: 'lienpham.oncology@bvk.vn',
        phone: '0904112233',
        cchnNumber: '048592/BYT-CCHN',
        cchnType: 'Ung bướu & Xạ trị thần kinh',
        issuedBy: 'Bộ Y Tế Việt Nam',
        issuedDate: '2023-01-05',
        status: 'Rejected' // Initially rejected for lack of notary sign
      }
    ];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<BackofficeDoctor | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState('');

  // ADM-03 verify function
  const handleVerifyCCHN = (id: string) => {
    setPanelDoctors(prev => 
      prev.map(d => {
        if (d.id === id) {
          addSystemLog(
            'Duyệt chứng chỉ hành nghề', 
            'System', 
            `Đã phê duyệt CCHN mã số ${d.cchnNumber} cho BS. ${d.name} (${d.hospital}). Vị trí hoạt động hợp lệ.`
          );
          setVerifiedCount(c => c + 1);

          const updated = { ...d, status: 'Verified' as const };
          if (selectedDoc?.id === id) {
            setSelectedDoc(updated);
          }
          return updated;
        }
        return d;
      })
    );
  };

  // Reject CCHN
  const handleRejectCCHN = (id: string) => {
    setPanelDoctors(prev => 
      prev.map(d => {
        if (d.id === id) {
          addSystemLog(
            'Từ chối chứng chỉ hành nghề', 
            'System', 
            `Từ chối hồ sơ số hiệu ${d.cchnNumber} của BS. ${d.name}. Lý do: ${verificationFeedback || 'Chứng chỉ mờ hoặc hết hạn hiệu lực'}.`
          );

          const updated = { ...d, status: 'Rejected' as const };
          if (selectedDoc?.id === id) {
            setSelectedDoc(updated);
          }
          return updated;
        }
        return d;
      })
    );
    setVerificationFeedback('');
  };

  const filteredDocs = panelDoctors.filter(d => {
    const query = searchQuery.toLowerCase();
    const matchSearch = d.name.toLowerCase().includes(query) || 
                        d.hospital.toLowerCase().includes(query) || 
                        d.cchnNumber.toLowerCase().includes(query);
    const matchStatus = statusFilter === '' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* View Header */}
      <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-3xs flex justify-between items-center">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">Duyệt Chứng Chỉ Hành Nghề (CCHN) Bác Sĩ</h2>
          <p className="text-slate-405 text-xs">Cơ sở dữ liệu xem xét, xác thực danh tính lâm sàng & cấp mã chuyên môn khám chữa bệnh trước khi cho phép khai thác AI (Mã Task: ADM-03)</p>
        </div>
        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 font-bold px-3 py-1 rounded-lg shrink-0">
          Chờ duyệt CCHN: {panelDoctors.filter(d => d.status === 'Pending').length} trường hợp
        </span>
      </div>

      {/* Roster Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 text-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text"
            placeholder="Tìm theo Mã CCHN, Họ tên y bác sĩ, Bệnh viện liên đới..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-700"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 w-full sm:w-48"
        >
          <option value="">Tất cả Trạng thái duyệt</option>
          <option value="Pending">Chờ duyệt CCHN (Pending)</option>
          <option value="Verified">Đã duyệt (Verified)</option>
          <option value="Rejected">Bị từ chối (Rejected)</option>
        </select>
      </div>

      {/* Layout Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Doctors Grid Left Column */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-3xs">
            <h3 className="text-sm font-bold text-slate-850 mb-4 font-sans">Yêu Cầu Xét Phê Duyệt CCHN</h3>
            
            <div className="space-y-3">
              {filteredDocs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-bold">Không có hồ sơ chứng nhận khoa nào hợp chuẩn.</div>
              ) : (
                filteredDocs.map((doc) => (
                  <div 
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all cursor-pointer hover:shadow-xs ${
                      selectedDoc?.id === doc.id 
                        ? 'border-blue-500 bg-blue-50/10' 
                        : 'border-slate-150 bg-[#fbfcfd]/40'
                    } ${doc.status === 'Verified' ? 'border-emerald-100' : ''}`}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Avatar with absolute status indicator */}
                      <div className="relative shrink-0">
                        <img 
                          src={doc.avatarUrl} 
                          alt={doc.name} 
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200 shadow-3xs"
                        />
                        <span className={`absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${
                          doc.status === 'Verified' ? 'bg-emerald-500' :
                          doc.status === 'Rejected' ? 'bg-rose-500' :
                          'bg-amber-500 animate-pulse'
                        }`}>
                          {doc.status === 'Verified' ? '✓' : doc.status === 'Rejected' ? '✗' : '?'}
                        </span>
                      </div>

                      {/* Info lines */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-extrabold text-slate-800 leading-none">{doc.name}</h4>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono font-bold leading-none">{doc.id}</span>
                        </div>
                        <p className="text-slate-450 text-xs font-semibold flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-slate-350" />
                          {doc.hospital}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          <span className="text-[9.5px] bg-[#eff6ff] text-[#2563eb] border border-blue-100/50 px-2 py-0.5 rounded font-bold uppercase">{doc.specialty}</span>
                          <span className="text-[9.5px] text-slate-450 font-mono font-bold">Số CCHN: {doc.cchnNumber}</span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive validation values */}
                    <div className="mt-3 sm:mt-0 flex sm:flex-col items-end gap-2 shrink-0 border-t sm:border-0 pt-2.5 sm:pt-0 border-slate-100">
                      <div className="text-right hidden sm:block">
                        <span className="text-[9.5px] text-slate-400 font-bold uppercase block">Phạm vi lâm nghiệp</span>
                        <span className="text-xs font-semibold text-slate-700 block truncate max-w-[190px]">{doc.cchnType}</span>
                      </div>
                      
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 w-full justify-end">
                        {doc.status === 'Pending' ? (
                          <>
                            {/* Approve */}
                            <button 
                              onClick={() => handleVerifyCCHN(doc.id)}
                              className="bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-3xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Phê Duyệt</span>
                            </button>
                            {/* Decline popup proxy */}
                            <button 
                              onClick={() => setSelectedDoc(doc)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-150 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-3xs"
                            >
                              Từ chối
                            </button>
                          </>
                        ) : (
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded inline-flex items-center gap-1 ${
                            doc.status === 'Verified' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {doc.status === 'Verified' ? 'Đã duyệt CCHN' : 'Hồ sơ bị từ chối'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Doctor certification visual assessment (Right pane) */}
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-3xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-4">
            <h3 className="text-sm font-bold text-slate-800 font-sans">Bằng Chứng Chỉ Số Gốc</h3>
            <Award className="w-4.5 h-4.5 text-blue-500" />
          </div>

          {selectedDoc ? (
            <div className="space-y-5" id="cchn-document-pane">
              
              {/* Doctor Header */}
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-3">
                <img 
                  src={selectedDoc.avatarUrl} 
                  alt={selectedDoc.name} 
                  className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                />
                <div>
                  <h4 className="text-xs font-extrabold text-slate-850 leading-tight">{selectedDoc.name}</h4>
                  <p className="text-[10px] font-bold text-slate-500 block truncate max-w-[170px] mt-0.5">{selectedDoc.hospital}</p>
                </div>
              </div>

              {/* Verified Documents Frame */}
              <div className="border border-slate-150 rounded-xl p-3 bg-slate-50 font-sans relative overflow-hidden" id="cchn-certification-frame">
                {/* Decorative background watermark */}
                <div className="absolute right-[-15px] bottom-[-15px] text-slate-150 transform rotate-12 select-none pointer-events-none">
                  <Award className="w-24 h-24" />
                </div>

                <div className="border-2 border-amber-200/50 p-2.5 rounded-lg bg-white relative">
                  <div className="text-center pb-2 border-b border-amber-100">
                    <span className="text-[7.5px] uppercase font-bold tracking-widest text-[#134e4a] block">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</span>
                    <span className="text-[6.5px] font-extrabold text-[#115e59] block mt-0.5">Độc lập - Tự do - Hạnh phúc</span>
                  </div>

                  <div className="pt-3 pb-2 text-center">
                    <span className="text-[9.5px] font-black text-amber-900 tracking-wide block">CHỨNG CHỈ HÀNH NGHỀ KHÁM BỆNH, CHỮA BỆNH</span>
                    <span className="text-[9px] text-amber-850 font-bold block mt-1">SỐ HIỆU: {selectedDoc.cchnNumber}</span>
                  </div>

                  <div className="space-y-1.5 text-[10px] text-slate-600 font-medium">
                    <p><strong className="text-slate-800 font-bold">Bác sĩ sở hữu:</strong> {selectedDoc.name}</p>
                    <p><strong className="text-slate-800 font-bold">Chuyên môn:</strong> {selectedDoc.cchnType}</p>
                    <p><strong className="text-slate-800 font-bold">Nơi cấp:</strong> {selectedDoc.issuedBy}</p>
                    <p><strong className="text-slate-800 font-bold">Ngày ban hành:</strong> {selectedDoc.issuedDate}</p>
                  </div>
                </div>
              </div>

              {/* Secondary data verification and checklist */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Yêu cầu xác minh an toàn</span>
                <label className="flex items-start gap-2 text-[11px] font-semibold text-slate-600">
                  <input type="checkbox" defaultChecked className="mt-0.5 accent-blue-600" />
                  <span>Xác minh mã số CCHN khớp với cơ sở Bộ Y Tế</span>
                </label>
                <label className="flex items-start gap-2 text-[11px] font-semibold text-slate-600">
                  <input type="checkbox" defaultChecked className="mt-0.5 accent-blue-600" />
                  <span>Bác sĩ đạt chứng chỉ thực hành y khoa lâm sàng</span>
                </label>
              </div>

              {/* Bottom interactive states */}
              {selectedDoc.status === 'Pending' ? (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <textarea 
                    placeholder="Nhập lý do từ chối nếu có..."
                    value={verificationFeedback}
                    onChange={(e) => setVerificationFeedback(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans font-medium"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleRejectCCHN(selectedDoc.id)}
                      className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                    >
                      Từ Chối Duyệt
                    </button>
                    <button 
                      onClick={() => handleVerifyCCHN(selectedDoc.id)}
                      className="flex-1 bg-emerald-55 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                    >
                      Duyệt CCHN
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                  selectedDoc.status === 'Verified' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50/50 text-rose-800 border border-rose-100'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-extrabold">{selectedDoc.status === 'Verified' ? 'Chứng Chỉ Hợp Lệ' : 'Yêu Cầu Bị Từ Chối'}</h5>
                    <p className="text-[10.5px] mt-0.5 leading-relaxed text-slate-550 font-medium">
                      {selectedDoc.status === 'Verified' 
                        ? `Bác sĩ này đã được cấp quyền kiểm duyệt chẩn đoán hình ảnh thần kinh, bảo lãnh hành pháp bởi ${selectedDoc.issuedBy}.`
                        : `Từ chối cấp phép tham gia. Mã số văn bản liên quan có hiệu lực bị treo.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50 text-center p-4">
              <FileText className="w-10 h-10 text-slate-350 stroke-[1.5] mb-2" />
              <p className="text-xs font-bold text-slate-500">Chưa Chọn Hồ Sơ CCHN</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">Hãy click chọn một y bác sĩ bên bảng danh sách để tra cứu bản scan Chứng chỉ hành nghề và tiến hành xét duyệt pháp lý.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
