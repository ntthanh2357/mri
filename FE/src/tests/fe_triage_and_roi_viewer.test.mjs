// Kiem thu luong KTV loc anh thu muc/ZIP + xem va chinh sua ROI tung lat cat phia BS
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ✔ ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  ✖ ${name}\n    ${e.message}`);
  }
};

test('KTV bulk study triage panel + DoctorWorkQueue integration', () => {
  const api = read('api/endpoints/imaging.api.js');
  for (const fn of ['initTriage', 'uploadTriageBatch', 'uploadTriageZip', 'runTriage', 'finalizeTriage', 'cancelTriage']) {
    assert.ok(api.includes(fn), `Thieu API helper ${fn}`);
  }

  const panel = read('components/ktv/KtvStudyTriagePanel.jsx');
  assert.ok(panel.includes('webkitdirectory'), 'Thieu ho tro chon thu muc MRI');
  assert.ok(panel.includes('webkitGetAsEntry'), 'Thieu ho tro keo tha thu muc de quy');
  assert.ok(panel.includes('MAX_SELECTED_SLICES = 15') && panel.includes('600 * 1024 * 1024'), 'Thieu gioi han MAX_SELECTED_SLICES/ZIP 600MB');
  assert.ok(panel.includes('aspectRatio: 1'), 'Khung preview KtvStudyTriagePanel can aspectRatio: 1 de khop YOLO bbox');

  const workQueue = read('screens/DoctorWorkQueueScreen.js');
  assert.ok(workQueue.includes('KtvStudyTriagePanel'), 'DoctorWorkQueueScreen chua tich hop KtvStudyTriagePanel');
  assert.ok(workQueue.includes('sliceSeriesMeta') && workQueue.includes('primarySliceIndex'), 'Chua gui sliceSeriesMeta/primarySliceIndex khi tao ket qua CĐHA');
  assert.ok(workQueue.includes('15 - uploadedImages.length') && !workQueue.includes('3 - uploadedImages.length'), 'Van con gioi han cu 3 lat cat tren mobile trong DoctorWorkQueueScreen');

  const createImg = read('screens/CreateImagingResultScreen.js');
  assert.ok(createImg.includes('KtvStudyTriagePanel'), 'CreateImagingResultScreen chua tich hop KtvStudyTriagePanel');
  assert.ok(createImg.includes('sliceSeriesMeta') && createImg.includes('primarySliceIndex'), 'CreateImagingResultScreen chua luu metadata lat cat da chon');
});

test('InteractiveRoiDrawer ho tro normalizedInitialBox, aiNormalizedBox va nut Ve AI/Xoa', () => {
  const drawer = read('components/InteractiveRoiDrawer.jsx');
  assert.ok(drawer.includes('normalizedInitialBox'), 'Thieu prop normalizedInitialBox');
  assert.ok(drawer.includes('aiNormalizedBox'), 'Thieu prop aiNormalizedBox');
  assert.ok(drawer.includes('handleResetToAi'), 'Thieu ham khoi phuc khung AI goc');
  assert.ok(drawer.includes('handleClearBox'), 'Thieu ham xoa khung ROI');
  assert.ok(drawer.includes('normalizedBox'), 'onBoxChange phai emit normalizedBox [0..1]');
});

test('DicomWebViewer hien thi AI overlay & Doctor ROI override can khop anh contain theo tung lat cat', () => {
  const viewer = read('components/DicomWebViewer.js');
  assert.ok(viewer.includes('manifest?.aiOverlay?.sliceOverlays'), 'Chua doc sliceOverlays theo tung lat cat');
  assert.ok(viewer.includes('stripUrlQuery'), 'Can bo qua query signature khi doi chieu URL lat cat');
  assert.ok(viewer.includes('doctorBoundingBox') && viewer.includes('aiGhostBoundingBox'), 'Thieu phan biet khung BS hieu chinh va khung AI goc');
  assert.ok(viewer.includes('overlayRenderRect') && viewer.includes('externalSliceIndex'), 'Thieu tinh toan khung anh contain hoac dong bo externalSliceIndex');
  assert.ok(viewer.includes('onActiveSliceChange') && viewer.includes('onEditSliceRoi'), 'Thieu callback dong bo lat cat dang xem voi man hinh bac si');
});

test('ImagingResultScreen & AIAnalysisScreen chinh sua ROI tung lat cat, khong hardcode images[0] hay "120"', () => {
  const ir = read('screens/ImagingResultScreen.js');
  assert.ok(!ir.includes("'120'") && !ir.includes('"120"'), 'Van con hardcode toa do 120 trong ImagingResultScreen');
  assert.ok(!ir.includes("'disagreed'") && !ir.includes('"disagreed"'), 'Van con enum khong hop le "disagreed"');
  assert.ok(ir.includes('sliceIndex: activeSliceIndex') && ir.includes('normalizedBox:'), 'Feedback AI phai gui kem sliceIndex va normalizedBox');
  assert.ok(ir.includes('result.isSigned') && ir.includes('normalizedInitialBox'), 'Phai khoa hieu chinh khi da ky so va truyen normalizedInitialBox');
  assert.ok(ir.includes('externalSliceIndex={activeSliceIndex}'), 'ImagingResultScreen chua dong bo activeSliceIndex xuong DicomWebViewer');

  const ai = read('screens/AIAnalysisScreen.js');
  assert.ok(!/const targetResultId[\s\S]*const targetResultId/.test(ai), 'Phat hien khai bao trung lap targetResultId');
  assert.ok(ai.includes('sliceImages') && ai.includes('normalizedBox:'), 'AIAnalysisScreen phai ho tro chuyen lat cat va gui normalizedBox');
  assert.ok(ai.includes("navigate('CreateImagingResult'") && ai.includes('setFeedbackError'), 'AIAnalysisScreen can quay lai CreateImagingResult khi chua co resultId va bao loi neu feedback that bai');
});

test('ResponsiveLayout menu technician chi co muc may chup, khong chua ScanRecordQr/TaskBoard/EmergencyHistory', () => {
  const layout = read('components/ResponsiveLayout.js');
  const start = layout.indexOf("case 'technician':");
  const end = layout.indexOf("case 'nurse':", start);
  assert.ok(start >= 0 && end > start, 'Khong tim thay nhanh case technician trong ResponsiveLayout');
  const techMenu = layout.slice(start, end);

  for (const allowed of ["route: 'Home'", "route: 'DoctorWorkQueue'", "tab: 'mriQueue'", "route: 'CreateImagingResult'", "route: 'MriRooms'", "route: 'StaffScheduling'", "route: 'Support'"]) {
    assert.ok(techMenu.includes(allowed), `Menu KTV thieu muc may chup: ${allowed}`);
  }
  for (const forbidden of ['ScanRecordQr', 'TaskBoard', 'EmergencyHistory']) {
    assert.ok(!techMenu.includes(forbidden), `Menu KTV van chua muc lam sang/ho so bi cam: ${forbidden}`);
  }

  // Dam bao cac role khac van giu nguyen nhanh menu
  assert.ok(layout.includes("case 'doctor':") && layout.includes("case 'patient':") && layout.includes("case 'radiologist':"));
});

test('DoctorWorkQueueScreen khoa mode mriQueue cho isTechnician, an PillTabs va doi nhan nut Xem anh chup & AI', () => {
  const wq = read('screens/DoctorWorkQueueScreen.js');
  assert.ok(wq.includes("const effectiveMode = isTechnician ? 'mriQueue' : currentMode;"), 'Thieu effectiveMode khoa mriQueue cho KTV');
  assert.ok(wq.includes("activeRoute: `DoctorWorkQueue_${effectiveMode}`"), 'openReadResult chua dung effectiveMode');
  assert.ok(wq.includes("effectiveMode === 'mriQueue' ? 'Y lệnh chụp'"), 'Tieu de cot colInfo chua dung effectiveMode');
  assert.ok(/\{!isTechnician\s*&&\s*\(\s*<PillTabs/.test(wq), 'Chua an PillTabs khi isTechnician');
  assert.ok(wq.includes("isTechnician ? 'Xem ảnh chụp & AI' : 'Đọc kết quả phim'"), 'Thieu nhan nut Xem anh chup & AI cho KTV');
  assert.ok(wq.includes("label: 'Chờ / Đang chụp'") && wq.includes("label: 'Đã chụp / AI'"), 'BannerStats KTV thieu chi so phong may');
  assert.ok(/\{!isTechnician && Boolean\(v\.vitals\?\.bloodPressure\) && \(/.test(wq), 'Chua an sinh hieu trong renderVisitCard cho KTV');
  assert.ok(/\{!isTechnician && \(\s*<Text[^>]*>Điều dưỡng:/.test(wq), 'Chua an dong Dieu duong trong renderVisitRow cho KTV');
  assert.ok(/\{!isTechnician && \(\s*<View[^>]*>[\s\S]*?Điều dưỡng:/.test(wq), 'Chua an dong Dieu duong trong renderVisitCard cho KTV');
  assert.ok(wq.includes("isTechnician ? (\n            <Text style={styles.cellMuted}>Chưa có y lệnh chụp</Text>") || /:\s*isTechnician\s*\?\s*\(\s*<Text[^>]*>Chưa có y lệnh chụp<\/Text>\s*\)\s*:\s*v\.vitals\?\.bloodPressure/.test(wq), 'Chua an sinh hieu trong renderVisitRow cho KTV');
});

test('CreateImagingResultScreen an muc III va bo bat buoc mo ta/ket luan bac si doi voi isTechnician', () => {
  const cir = read('screens/CreateImagingResultScreen.js');
  assert.ok(cir.includes("useCurrentRole") && cir.includes("const isTechnician = role === 'technician'"), 'CreateImagingResultScreen chua kiem tra isTechnician');
  assert.ok(/\{!isTechnician\s*&&\s*\(\s*<SectionCard\s+no="III"/.test(cir), 'Chua an SectionCard III voi isTechnician');
  assert.ok(/if\s*\(!isTechnician\)\s*\{[\s\S]*newErrors\.findings[\s\S]*newErrors\.conclusion[\s\S]*newErrors\.radiologist/.test(cir), 'handleSaveResult chua bo bat buoc nhap mo ta/ket luan cho KTV');
  assert.ok(cir.includes('if (isTechnician && images.length === 0)'), 'KTV can kiem tra it nhat 1 anh truoc khi luu');
  assert.ok(cir.includes("const checks = isTechnician ? [") && cir.includes("{ key: 'images', label: 'Ảnh phim chụp', ok: images.length > 0 }"), 'Danh sach checks cua KTV chua dung 4 muc may chup');
  assert.ok(cir.includes("isTechnician ? 'Kết quả AI chi tiết toàn thư mục' : 'Kết quả AI đã được bác sĩ xác nhận'"), 'Nhan khoi AI tra ve chua phan biet KTV va Bac si');
});

test('ImagingResultScreen tach isTechnician khoi canReviewAI va an phieu bao cao lam sang/findingsSection/signatureSection', () => {
  const ir = read('screens/ImagingResultScreen.js');
  assert.ok(ir.includes("const isTechnician = localUser?.role === 'technician';"), 'Thieu bien isTechnician trong ImagingResultScreen');
  const reviewMatch = ir.match(/const canReviewAI = \[([^\]]+)\]\.includes\(localUser\?\.role\)/);
  assert.ok(reviewMatch, 'Khong tim thay dinh nghia canReviewAI');
  assert.ok(!reviewMatch[1].includes('technician'), 'Khong duoc dua technician vao canReviewAI');
  for (const docRole of ['doctor', 'radiologist', 'department_head']) {
    assert.ok(reviewMatch[1].includes(docRole), `canReviewAI bi mat vai tro ${docRole}`);
  }
  assert.ok(ir.includes('const canViewStaffAi = canReviewAI || isTechnician;'), 'Thieu canViewStaffAi de KTV xem ket qua AI tra ve');
  assert.ok(ir.includes('.finally(() => setUserLoading(false))'), 'userLoading phai co finally de khong ket loading khi /auth/me loi');
  assert.ok(ir.includes('activeAiReport && canViewStaffAi'), 'The ket qua AI lat cat chua dung canViewStaffAi');
  assert.ok(/\{canReviewAI\s*&&\s*\([\s\S]*InteractiveRoiDrawer/.test(ir), 'Khoi duyet/hieu chinh AI va InteractiveRoiDrawer phai chi hien cho canReviewAI');
  assert.ok(/\{!isTechnician\s*&&\s*\(\s*<>\s*<View style=\{styles\.sectionDivider\}\s*\/>\s*<View style=\{styles\.findingsSection\}>[\s\S]*<View style=\{styles\.signatureSection\}>/.test(ir), 'Chua an sectionDivider, findingsSection va signatureSection khi isTechnician');
  assert.ok(ir.includes("localUser?.role === 'patient'") && ir.includes('<AiResultPatientCard'), 'Khong duoc lam mat giao dien benh nhan trong ImagingResultScreen');
});

test('AIAnalysisScreen khong dua technician vao canReview va hien che do xem cho KTV', () => {
  const ai = read('screens/AIAnalysisScreen.js');
  assert.ok(ai.includes("const isTechnician = role === 'technician';"), 'Thieu bien isTechnician trong AIAnalysisScreen');
  const canReviewMatch = ai.match(/const canReview = \[([^\]]+)\]\.includes\(role\)/);
  assert.ok(canReviewMatch, 'Khong tim thay dinh nghia canReview trong AIAnalysisScreen');
  assert.ok(!canReviewMatch[1].includes('technician'), 'Khong duoc dua technician vao canReview trong AIAnalysisScreen');
  for (const docRole of ['doctor', 'radiologist', 'department_head']) {
    assert.ok(canReviewMatch[1].includes(docRole), `canReview trong AIAnalysisScreen bi mat vai tro ${docRole}`);
  }
  assert.ok(ai.includes("isTechnician ? 'Ảnh chụp & Kết quả AI trả về' : 'Chẩn đoán hình ảnh AI'"), 'Header AIAnalysisScreen chua doi tieu de cho KTV');
  assert.ok(/\{canReview\s*&&\s*\([\s\S]*Bác sĩ xác nhận kết quả:/.test(ai), 'Khoi Bac si xac nhan ket qua phai boc trong canReview');
  assert.ok(/\{isTechnician\s*&&\s*!canReview\s*&&\s*\([\s\S]*Hoàn tất xem & Quay lại ca chụp/.test(ai), 'Thieu the chi xem va nut quay lai cho KTV');
});

test('ImagingResultScreen hien thi thong bao va nut tai phim cho KTV khi ban ghi chua co anh', () => {
  const ir = read('screens/ImagingResultScreen.js');
  assert.ok(ir.includes('displayGalleryImages'), 'Phai gop result.images va extraImages thanh displayGalleryImages');
  assert.ok(ir.includes('Chưa có ảnh phim chụp được đính kèm'), 'Thieu trang thai rong khi ca chup chua co anh');
  assert.ok(ir.includes('Tải phim MRI / Chọn lọc ảnh (AI)'), 'Thieu nut dieu huong KTV toi man hinh tai phim khi chua co anh');
});

test('KTV upload/triage UI duoc phong to, full-width va co modal phong to lat cat', () => {
  const panel = read('components/ktv/KtvStudyTriagePanel.jsx');
  assert.ok(panel.includes('useWindowDimensions') && panel.includes('zoomCandidate'), 'KtvStudyTriagePanel can ho tro chieu rong responsive va modal phong to lat cat');
  assert.ok(panel.includes('Phóng to xem lát cắt'), 'Thieu nut phong to lat cat tren luoi anh KTV');
  assert.ok(!panel.includes('pointerEvents="none"'), 'Can dua pointerEvents vao style de tranh canh bao RN Web');

  const createImg = read('screens/CreateImagingResultScreen.js');
  assert.ok(createImg.includes('maxWidth: 1440'), 'CreateImagingResultScreen can mo rong khung chieu ngang toi 1440');
  assert.ok(createImg.includes('Khối ảnh phim & bộ lọc thư mục MRI toàn chiều ngang'), 'Section IV KTV can nam toan chieu ngang de luoi anh to ro');

  const workQueue = read('screens/DoctorWorkQueueScreen.js');
  assert.ok(workQueue.includes('maxWidth: 1280'), 'Upload Modal trong DoctorWorkQueueScreen can mo rong maxWidth: 1280');
});

test('dicomParser giai ma chuan DICOM Part 10 va DicomViewerScreen duoc gan cho ky thuat vien', async () => {
  const { parseDicomBuffer, groupLocalFilesIntoSeries } = await import('../utils/dicomParser.js');

  const parts = [];
  const pushU16 = (val) => {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(val, 0);
    parts.push(b);
  };
  const pushAscii = (str) => parts.push(Buffer.from(str, 'ascii'));
  const addTagStr = (g, e, vr, val) => {
    pushU16(g);
    pushU16(e);
    pushAscii(vr);
    const padded = val.length % 2 === 1 ? `${val} ` : val;
    pushU16(padded.length);
    pushAscii(padded);
  };
  const addTagU16 = (g, e, vr, val) => {
    pushU16(g);
    pushU16(e);
    pushAscii(vr);
    pushU16(2);
    pushU16(val);
  };

  parts.push(Buffer.alloc(128, 0));
  pushAscii('DICM');
  addTagStr(0x0002, 0x0010, 'UI', '1.2.840.10008.1.2.1');
  addTagStr(0x0008, 0x0060, 'CS', 'MR');
  addTagStr(0x0008, 0x103e, 'LO', 'Ax_T2_FLAIR_3');
  addTagStr(0x0010, 0x0010, 'PN', 'NGUYEN^VAN A');
  addTagStr(0x0010, 0x0020, 'LO', 'BN009');
  addTagStr(0x0020, 0x0011, 'IS', '3');
  addTagStr(0x0020, 0x0013, 'IS', '12');
  addTagU16(0x0028, 0x0010, 'US', 4);
  addTagU16(0x0028, 0x0011, 'US', 4);
  addTagU16(0x0028, 0x0100, 'US', 16);
  addTagStr(0x0028, 0x1050, 'DS', '500');
  addTagStr(0x0028, 0x1051, 'DS', '1000');

  // PixelData (7FE0,0010) OW long explicit VR
  pushU16(0x7fe0);
  pushU16(0x0010);
  pushAscii('OW');
  pushU16(0);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(32, 0);
  parts.push(lenBuf);
  parts.push(Buffer.alloc(32, 1));

  const buf = Buffer.concat(parts);
  const parsed = parseDicomBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), 'IM0012.dcm');
  assert.equal(parsed.isDicom, true);
  assert.equal(parsed.metadata.patientName, 'NGUYEN VAN A');
  assert.equal(parsed.metadata.patientId, 'BN009');
  assert.equal(parsed.metadata.modality, 'MR');
  assert.equal(parsed.metadata.seriesType, 'T2_FLAIR');
  assert.equal(parsed.metadata.instanceNumber, 12);
  assert.equal(parsed.metadata.rows, 4);
  assert.equal(parsed.metadata.columns, 4);
  assert.equal(parsed.pixelDataLength, 32);

  const grouped = groupLocalFilesIntoSeries([parsed]);
  assert.equal(grouped.series.length, 1);
  assert.equal(grouped.series[0].seriesType, 'T2_FLAIR');
  assert.equal(grouped.series[0].sliceCount, 1);

  const screen = read('screens/DicomViewerScreen.js');
  assert.ok(screen.includes('DicomWebViewer') && screen.includes('parseLocalDicomOrImageFile'), 'DicomViewerScreen thieu DicomWebViewer hoac parseLocalDicomOrImageFile');
  assert.ok(screen.includes('/api/v1/dicom/studies') && screen.includes('/validate'), 'DicomViewerScreen thieu tai danh sach PACS va kiem chuan DICOM');

  const viewer = read('components/DicomWebViewer.js');
  assert.ok(viewer.includes('externalManifest') && viewer.includes("raw.startsWith('blob:')"), 'DicomWebViewer can ho tro externalManifest va blob URL cho DICOM local');

  const layout = read('components/ResponsiveLayout.js');
  const start = layout.indexOf("case 'technician':");
  const end = layout.indexOf("case 'nurse':", start);
  const techMenu = layout.slice(start, end);
  assert.ok(techMenu.includes("route: 'DicomViewer'"), 'Menu technician thieu muc Xem anh DICOM (PACS)');

  const appNav = read('navigation/AppNavigator.js');
  const staffPortal = read('navigation/StaffPortal.js');
  const linking = read('navigation/linking.js');
  assert.ok(appNav.includes('name="DicomViewer"') && staffPortal.includes('name="DicomViewer"') && linking.includes('DicomViewer:'), 'Thieu khai bao route DicomViewer trong navigator/linking');
});

test('FinalizedSliceGallery cho phep bam xem tung anh kem phan loai khoi u va khung khoanh u AI', () => {
  const gallery = read('components/ktv/FinalizedSliceGallery.jsx');
  assert.ok(gallery.includes('setInspectIdx') && gallery.includes('boundingBox'), 'FinalizedSliceGallery can ho tro bam xem tung anh va ve boundingBox AI');
  assert.ok(gallery.includes('TUMOR_LABEL_VI') && gallery.includes('Phân loại AI:'), 'FinalizedSliceGallery thieu nhan phan loai khoi u AI');
  assert.ok(gallery.includes('KẾT QUẢ CHẨN ĐOÁN AI CHÍNH') && gallery.includes('Nghi ngờ loại khác (Chẩn đoán phân biệt'), 'FinalizedSliceGallery can lam noi bat ket qua chinh va hien nghi ngo loai khoi u khac');
  assert.ok(!gallery.includes('pointerEvents="none"'), 'Can dat pointerEvents trong style de tranh warning RN Web');

  const panel = read('components/ktv/KtvStudyTriagePanel.jsx');
  assert.ok(panel.includes('triageAiPreview'), 'KtvStudyTriagePanel can truyen triageAiPreview sau khi chot');

  const createImg = read('screens/CreateImagingResultScreen.js');
  assert.ok(createImg.includes('<FinalizedSliceGallery') && createImg.includes('setAiResult(triageAiPreview)'), 'CreateImagingResultScreen chua dung FinalizedSliceGallery va triageAiPreview');

  const workQueue = read('screens/DoctorWorkQueueScreen.js');
  assert.ok(workQueue.includes('<FinalizedSliceGallery'), 'DoctorWorkQueueScreen Upload Modal chua dung FinalizedSliceGallery');
});

test('KtvStudyTriagePanel chay AI 3 tang that sau khi chot va mo DicomViewer cho lat cat nhap', () => {
  const panel = read('components/ktv/KtvStudyTriagePanel.jsx');
  assert.ok(panel.includes("setStage('deep_ai')") && panel.includes('imagingApi.analyzeAI'), 'KtvStudyTriagePanel phai chay analyzeAI (3 tang) cho cac lat da chot');
  assert.ok(panel.includes('deepAiCompleted') && panel.includes('3-Tier Consensus AI'), 'KtvStudyTriagePanel phai danh dau ket qua AI 3 tang');

  const gallery = read('components/ktv/FinalizedSliceGallery.jsx');
  assert.ok(gallery.includes('onOpenDicomViewer') && gallery.includes('heatmapUri'), 'FinalizedSliceGallery can ho tro nut mo DicomViewer va xem Heatmap Grad-CAM');
  assert.ok(gallery.includes('consensusMessage'), 'FinalizedSliceGallery can hien thi thong diep dong thuan 3 tang AI');

  const dicomScreen = read('screens/DicomViewerScreen.js');
  assert.ok(dicomScreen.includes('draftImages') && dicomScreen.includes('externalManifest={selectedPacsItem.externalManifest'), 'DicomViewerScreen can nhan draftImages va truyen externalManifest vao DicomWebViewer');

  const createImg = read('screens/CreateImagingResultScreen.js');
  assert.ok(createImg.includes('handleOpenDicomViewer') && createImg.includes('onOpenDicomViewer={handleOpenDicomViewer}'), 'CreateImagingResultScreen can gan handleOpenDicomViewer cho KTV');
});

test('KtvStudyTriagePanel chay AI chi tiet toan thu muc va hien thi thong ke da so (studyDiagnosisSummary)', () => {
  const panel = read('components/ktv/KtvStudyTriagePanel.jsx');
  assert.ok(!panel.includes('Lọc nhanh'), 'Khong con nhan Loc nhanh cu trong KtvStudyTriagePanel');
  assert.ok(panel.includes('candidateLimit: 120') && panel.includes('geminiConflictLimit: 5'), 'KtvStudyTriagePanel phai gui candidateLimit=120 va gioi han geminiConflictLimit=5');
  assert.ok(panel.includes('studyDiagnosisSummary') && panel.includes('Kết quả AI chi tiết toàn thư mục'), 'KtvStudyTriagePanel can hien thi banner thong ke da so toan thu muc');
  assert.ok(panel.includes('Biểu đồ phân bố loại khối u toàn thư mục') && panel.includes('Biểu đồ xác suất phân loại AI cho lát cắt này') && panel.includes('miniProbBox'), 'KtvStudyTriagePanel can hien thi bieu do phan bo toan thu muc va xac suat tung anh');

  const createImg = read('screens/CreateImagingResultScreen.js');
  assert.ok(!createImg.includes("'Sàng lọc nhanh'"), 'CreateImagingResultScreen khong con nhan Sang loc nhanh');
  assert.ok(createImg.includes('Đa số toàn thư mục:'), 'CreateImagingResultScreen can hien thi thong ke da so toan thu muc');
});

test('MriRoomsScreen cho phep KTV va admin chinh sua phong/trang thai MRI ngay tren the phong', () => {
  const mriRooms = read('screens/MriRoomsScreen.js');
  assert.ok(mriRooms.includes("'hospital_admin'") && mriRooms.includes("'system_admin'") && mriRooms.includes("'technician'"), 'MriRoomsScreen can phan quyen cho ca system_admin, hospital_admin va technician');
  assert.ok(mriRooms.includes('canCreateDelete') && mriRooms.includes('canEditRoom'), 'MriRoomsScreen can tach quyen tao/xoa va quyen chinh sua');
  assert.ok(mriRooms.includes('editing === room._id') && mriRooms.includes('label="Chỉnh sửa"'), 'MriRoomsScreen can mo form chinh sua ngay tren the phong MRI');
  assert.ok(mriRooms.includes('operatingHours') && mriRooms.includes('rescheduledCount') && mriRooms.includes('room.notes'), 'MriRoomsScreen can ho tro gio hoat dong, ghi chu va thong bao doi lich');

  const workQueue = read('screens/DoctorWorkQueueScreen.js');
  assert.ok(workQueue.includes('res.roomBlocked') && workQueue.includes('/api/v1/mri-rooms/schedule/auto'), 'DoctorWorkQueueScreen can canh bao khi phong bao tri va ho tro xep phong tu dong');
  assert.ok(workQueue.includes('v.mriSlot?.roomId?.name'), 'DoctorWorkQueueScreen can hien ten phong MRI da xep tren moi ca');

  const layout = read('components/ResponsiveLayout.js');
  const docStart = layout.indexOf("case 'doctor':");
  const docEnd = layout.indexOf("case 'radiologist':", docStart);
  const docBlock = layout.slice(docStart, docEnd);
  assert.ok(docBlock.includes("section: 'Khám & Chẩn đoán'") && docBlock.includes("section: 'Bệnh nhân & Hồ sơ'") && docBlock.includes("section: 'Cá nhân & Ca trực'"), 'Menu bac si can phan nhom ro rang');
  assert.ok(!docBlock.includes("route: 'MriRooms'") && !docBlock.includes("tab: 'examQueue'") && !docBlock.includes("tab: 'mriQueue'") && !docBlock.includes("tab: 'transfers'"), 'Menu bac si khong chua MriRooms hoac tab trung lap');
});

test('DoctorWorkQueueScreen va submitImagingResult giu tron ven anh MRI va ket qua AI 3 tang cho bac si', () => {
  const workQueue = read('screens/DoctorWorkQueueScreen.js');
  assert.ok(workQueue.includes('triageAiPreview: uploadAiPreview || null'), 'handleSubmitResult phai gui kem triageAiPreview tu KtvStudyTriagePanel');
  assert.ok(workQueue.includes('setUploadAiPreview(null);'), 'openUploadModal phai reset uploadAiPreview');
  assert.ok(workQueue.includes('Nộp kết quả phim chụp'), 'Modal KTV can nhac bam Nop ket qua phim chup de gui anh sang bac si');

  const imagingCtrl = fs.readFileSync(path.resolve(SRC, '..', '..', 'BE', 'src', 'modules', 'imaging', 'imaging.controller.js'), 'utf8');
  assert.ok(imagingCtrl.includes('const buildTriageAiReport ='), 'imaging.controller can co ham dung chung buildTriageAiReport');
  assert.ok(imagingCtrl.includes('shouldQueueBgAi'), 'submitImagingResult can dung lai triageAiPreview thay vi bo qua');

  const imgResult = read('screens/ImagingResultScreen.js');
  const explainIdx = imgResult.indexOf('styles.explainCard');
  assert.ok(explainIdx > 0 && imgResult.slice(Math.max(0, explainIdx - 120), explainIdx).includes("localUser?.role === 'patient'"), 'Khung giai thich de hieu AI chi hien cho benh nhan, an voi bac si');

  const emr = read('screens/EMRDashboardScreen.jsx');
  assert.ok(!emr.includes('Đã chọn hồ sơ của'), 'EMRDashboardScreen khong chi hien Alert "Da chon ho so" ma phai mo chi tiet');
  assert.ok(emr.includes('setDetailRecord(record)') && emr.includes('Chẩn đoán lâm sàng') && emr.includes('Kế hoạch điều trị'), 'EMRDashboardScreen phai mo modal chi tiet ho so benh an');

  const layout = read('components/ResponsiveLayout.js');
  assert.ok(layout.includes('styles.userProfileTrigger') && layout.includes('onPress={openProfileModal}'), 'ResponsiveLayout can cho phep bam vao avatar/ten tai khoan de mo ho so ca nhan');
  assert.ok(layout.includes('renderProfileModal()') && layout.includes("get('/auth/me')") && layout.includes("put('/auth/profile'"), 'ResponsiveLayout can ho tro xem/cap nhat ho so qua /auth/me va /auth/profile');
  assert.ok(layout.includes('styles.bellBtn') && layout.includes('onPress={() => setShowNotifModal(true)}'), 'Nut chuong thong bao van giu su kien mo hop thong bao doc lap');
});

console.log(`\nKết quả FE triage/ROI viewer: ${passed} đạt, ${failed} lỗi.`);
if (failed > 0) process.exit(1);
