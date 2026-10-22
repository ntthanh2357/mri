import PDFDocument from "pdfkit";
import { FONTS, COLOR, fmtDate } from "./reportPdf.service.js";
import { addSignaturePlaceholder, signPdf, signatureNote } from "./pdfSignature.service.js";

/**
 * PDF bản sao bệnh án: in nội dung đã chốt lúc bệnh viện duyệt (`request.snapshot`), ký số nếu có chứng thư.
 * Chỉ đọc dữ liệu trong snapshot (đã lọc như bệnh án chia sẻ QR), không truy vấn thêm.
 */

export const SECTION_TITLES = {
  visits: "Lịch sử khám",
  imaging: "Kết quả chẩn đoán hình ảnh (MRI/CT)",
  prescriptions: "Đơn thuốc",
  labs: "Kết quả xét nghiệm",
  vitals: "Sinh hiệu",
  inpatient: "Bệnh án nội trú",
  papers: "Giấy ra viện, giấy chuyển viện",
};
/** Chuỗi do bệnh nhân tự nhập → 1 dòng, cắt độ dài: không chèn được dòng/đoạn giả vào văn bản mang chữ ký số của bệnh viện. */
export const oneLine = (s, max = 200) => String(s ?? "").replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

const GENDER = { male: "Nam", female: "Nữ", other: "Khác", Nam: "Nam", "Nữ": "Nữ" };
const ROLE = { receptionist: "Lễ tân", hospital_admin: "Quản lý bệnh viện" };
const join = (parts, sep = ", ") => parts.filter((p) => p !== undefined && p !== null && String(p).trim() !== "").join(sep);

/** Mỗi nhóm → danh sách mục { title, lines[] } để in. */
const entriesOf = (section, s) => {
  switch (section) {
    case "visits":
      return (s.visits || []).map((v) => ({
        title: join([fmtDate(v.date), v.reason || "Lượt khám"], ": "),
        lines: [join([v.doctor ? `Bác sĩ: ${v.doctor}` : "", v.status ? `Trạng thái: ${v.status}` : "", v.mriRegion ? `Chỉ định chụp MRI: ${v.mriRegion}` : ""], ". ")],
      }));
    case "imaging":
      return (s.imaging || []).map((m) => ({
        title: join([fmtDate(m.reportDate || m.orderDate), m.procedure || m.imagingType || "Chẩn đoán hình ảnh"], ": "),
        lines: [m.findings ? `Mô tả: ${m.findings}` : "", m.conclusion ? `Kết luận: ${m.conclusion}` : "", m.radiologist ? `Bác sĩ đọc phim: ${m.radiologist}` : ""],
      }));
    case "prescriptions":
      return (s.prescriptions || []).map((p) => ({
        title: join([fmtDate(p.recorded_at), p.diagnosis || "Đơn thuốc"], ": "),
        lines: [
          p.doctor_name ? `Bác sĩ kê đơn: ${p.doctor_name}` : "",
          ...(p.drugs || []).map((d) => `• ${join([d.name, d.quantity ? `${d.quantity} ${d.unit || ""}`.trim() : ""])}${d.usage ? `: ${d.usage}` : ""}`),
          p.note ? `Ghi chú: ${p.note}` : "",
        ],
      }));
    case "labs":
      return (s.labs || []).map((l) => ({
        title: join([fmtDate(l.resulted_at || l.ordered_at), l.category || "Xét nghiệm"], ": "),
        lines: (l.results || []).length ? l.results.map((r) => `• ${r.biomarker_name}: ${r.value_result} ${r.unit && r.unit !== "N/A" ? r.unit : ""}`.trim()
          + (r.reference_range_display ? ` (tham chiếu ${r.reference_range_display})` : "")
          + (r.is_abnormal ? (r.abnormal_direction === "LOW" ? ", thấp hơn tham chiếu" : ", cao hơn tham chiếu") : "")) : ["Chưa có kết quả."],
      }));
    case "vitals":
      return (s.vitals || []).map((v) => ({
        title: fmtDate(v.recorded_at, true) || "Lần đo",
        lines: [join([v.blood_pressure ? `Huyết áp ${v.blood_pressure} mmHg` : "", v.pulse ? `mạch ${v.pulse} lần/phút` : "", v.spo2 ? `SpO2 ${v.spo2}%` : "",
          v.temperature ? `thân nhiệt ${v.temperature} °C` : "", v.weight ? `cân nặng ${v.weight} kg` : ""])],
      }));
    case "inpatient":
      return (s.inpatientRecords || []).map((r) => ({
        title: join([fmtDate(r.createdAt), r.department ? `Khoa ${r.department}` : "Bệnh án nội trú"], ": "),
        lines: [r.diagnosis ? `Chẩn đoán: ${r.diagnosis}` : "", r.treatmentPlan ? `Hướng điều trị: ${r.treatmentPlan}` : "",
          r.doctorInCharge ? `Bác sĩ điều trị: ${r.doctorInCharge}` : "", r.dischargeDate ? `Ngày ra viện: ${fmtDate(r.dischargeDate)}` : ""],
      }));
    case "papers":
      return [
        ...(s.dischargePapers || []).map((d) => ({
          title: join([fmtDate(d.dateOut || d.recorded_at), "Giấy ra viện"], ": "),
          lines: [d.diagnosis ? `Chẩn đoán: ${d.diagnosis}` : "", d.treatment ? `Điều trị: ${d.treatment}` : "", d.doctor_name ? `Bác sĩ: ${d.doctor_name}` : ""],
        })),
        ...(s.transferForms || []).map((t) => ({
          title: join([fmtDate(t.recorded_at), t.transferTo ? `Giấy chuyển viện tới ${t.transferTo}` : "Giấy chuyển viện"], ": "),
          lines: [t.diagnosis ? `Chẩn đoán: ${t.diagnosis}` : "", t.reason ? `Lý do chuyển: ${t.reason}` : "", t.clinicalSummary ? `Tóm tắt: ${t.clinicalSummary}` : ""],
        })),
      ];
    default:
      return [];
  }
};

/** @returns {Promise<Buffer>} */
export const buildRecordCopyPdf = (request, { hospitalName = "", signer = null } = {}) =>
  new Promise((resolve, reject) => {
    const s = request.snapshot || {};
    const p = s.patient || {};
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 48, bottom: 56, left: 52, right: 52 },
      info: { Title: `Bản sao bệnh án - ${p.name || ""}`, Author: hospitalName || "NeuroScan AI" },
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => {
      const pdf = Buffer.concat(chunks);
      if (!signer) return resolve(pdf);
      return signPdf(pdf, signer).then(resolve, reject);
    });
    doc.on("error", reject);
    doc.registerFont("R", FONTS.regular);
    doc.registerFont("S", FONTS.semibold);
    doc.registerFont("B", FONTS.bold);
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const room = (h) => { if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage(); doc.x = left; };

    doc.font("B").fontSize(11).fillColor(COLOR.navy).text((hospitalName || "Bệnh viện").toUpperCase(), left, doc.y, { width });
    doc.font("R").fontSize(9).fillColor(COLOR.muted).text(`Mã yêu cầu: ${request._id}`, { width });
    doc.moveDown(1);
    doc.font("B").fontSize(16).fillColor(COLOR.navy).text("BẢN SAO BỆNH ÁN", left, doc.y, { width, align: "center" });
    doc.moveDown(1);

    doc.font("S").fontSize(10.5).fillColor(COLOR.text).text(`Họ và tên: ${oneLine(p.name, 100)}`, { width });
    if (p.medicalId) doc.font("R").fontSize(10.5).text(`Mã bệnh nhân: ${oneLine(p.medicalId, 40)}`, { width });
    const declared = join([GENDER[p.gender] ? `Giới tính: ${GENDER[p.gender]}` : "", p.dateOfBirth ? `Ngày sinh: ${fmtDate(p.dateOfBirth)}` : ""], ". ");
    if (declared) doc.font("R").fontSize(10.5).text(`${declared} (bệnh nhân tự khai).`, { width });
    if (request.reason) doc.text(`Lý do bệnh nhân ghi (bệnh viện không xác minh): "${oneLine(request.reason, 200)}"`, { width });
    doc.text(`Nội dung được sao: ${request.sections.map((k) => SECTION_TITLES[k] || k).join(", ")}.`, { width });

    for (const section of request.sections) {
      room(60);
      doc.moveDown(1);
      doc.font("B").fontSize(11).fillColor(COLOR.green).text((SECTION_TITLES[section] || section).toUpperCase(), left, doc.y, { width });
      doc.moveTo(left, doc.y + 2).lineTo(left + width, doc.y + 2).strokeColor(COLOR.border).stroke();
      doc.moveDown(0.5);
      const entries = entriesOf(section, s);
      if (!entries.length) {
        doc.font("R").fontSize(10).fillColor(COLOR.muted).text("Không có dữ liệu tại bệnh viện này.", left, doc.y, { width });
        continue;
      }
      for (const e of entries) {
        room(40);
        doc.font("S").fontSize(10.5).fillColor(COLOR.text).text(e.title, left, doc.y, { width });
        const lines = e.lines.filter(Boolean);
        if (lines.length) doc.font("R").fontSize(10).fillColor(COLOR.text).text(lines.join("\n"), left + 10, doc.y, { width: width - 10, lineGap: 1.5 });
        doc.moveDown(0.5);
      }
    }

    room(90);
    doc.moveDown(1.5);
    doc.font("R").fontSize(9).fillColor(COLOR.muted).text(
      `Bản sao điện tử do ${hospitalName || "bệnh viện"} cấp ngày ${fmtDate(request.reviewedAt, true)}`
      + `${request.reviewedByName ? `, người duyệt: ${request.reviewedByName}${ROLE[request.reviewedByRole] ? ` (${ROLE[request.reviewedByRole]})` : ""}` : ""}.`
      + " Nội dung được chốt tại thời điểm duyệt; dữ liệu phát sinh sau đó không có trong bản này.",
      left, doc.y, { width, align: "center" },
    );
    doc.text(signatureNote(signer), left, doc.y + 2, { width, align: "center" });
    if (signer) addSignaturePlaceholder(doc, { reason: "Bản sao bệnh án", name: signer.signerName, contactInfo: hospitalName });
    doc.end();
  });
