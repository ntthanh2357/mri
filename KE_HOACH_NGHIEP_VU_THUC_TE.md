# KẾ HOẠCH CHỈNH SỬA NGHIỆP VỤ THEO THỰC TẾ — NEUROSCAN AI

**Mục tiêu:** đưa luồng nghiệp vụ từ mức “demo được” lên mức “bệnh viện dùng được”, ưu tiên đúng thứ tự phụ thuộc để không phải làm lại. Không bao gồm việc vá bảo mật P0 (đã có trong [BAO_CAO_AUDIT_2026-10.md](BAO_CAO_AUDIT_2026-10.md)) trừ khi là điều kiện bắt buộc của nghiệp vụ.

## Trạng thái triển khai (cập nhật 27/10/2026)

Các lỗi P0–P2 trong báo cáo audit đã được vá, trong đó một số hạng mục của kế hoạch dưới đây đã xong sớm. Phần còn lại giữ nguyên thứ tự ưu tiên.

| Hạng mục kế hoạch | Trạng thái | Ghi chú |
| :--- | :---: | :--- |
| G0.3 — Role enum | Một phần | Đã thêm `system_admin`, `cleaner` (hết quyền chết); chưa thêm `radiologist`, `cashier`, `accountant`, `lab_technician`, `lab_doctor`, `head_nurse`, `department_head`, `clinical_pharmacist`, `quality_manager`, `dpo`, `guardian`; chưa có bảng `permission` + `requirePermission` |
| G2 — Mã hóa thẻ BHYT | Đã xong | `cardNumber` AES-256-GCM + `cardNumberHash` (HMAC) + `cardLast4`, API chỉ trả số che |
| G2 — BHYT theo từng dòng dịch vụ | Chưa | `bhytApply` vẫn áp một tỷ lệ lên tổng; chưa có phân loại danh mục/tuyến/đối tượng/giá trần/tạm ứng |
| G3A — Vòng đời xét nghiệm | Một phần | Đã có `COLLECTED → RESULTED → VERIFIED`, endpoint duyệt kết quả, critical value + thông báo, API key cho máy LIS; chưa có `LabSpecimen` riêng, release sau duyệt, chỉ định theo bộ |
| G3B — Báo cáo CĐHA | Một phần | Đã khóa quyền ký/sửa báo cáo và chặn bệnh nhân tạo kết quả; chưa có role `radiologist` riêng, template, so sánh ca cũ, addendum |
| G1 lịch hẹn · G0 catalog/giá · G4 nội trú–xuất viện · G5 phẫu thuật/chất lượng/DSAR | Chưa | Giữ nguyên theo lộ trình bên dưới |
| Ngoài kế hoạch (đã xong) | Đã xong | Phân quyền tick task theo bước, xóa mềm + ẩn danh người dùng, mã hóa CCCD người ký consent, siết quyền route BHYT/consent/upload ảnh |

> Chi tiết đã vá: xem [BAO_CAO_AUDIT_2026-10.md](BAO_CAO_AUDIT_2026-10.md).

## 0. Hai quỹ đạo thời gian

| Quỹ đạo | Thời lượng | Phạm vi | Phù hợp |
| :--- | :---: | :--- | :--- |
| **A — Bảo vệ đồ án** | **4 tuần** | Giai đoạn 0, 1, 2 (mức tối thiểu), 3 (chỉ LIS duyệt kết quả), 4 (chỉ tóm tắt xuất viện) + kịch bản demo | Cần “đủ thực tế” để trả lời hội đồng, không kịp làm toàn bộ |
| **B — Sản phẩm thực tế** | **10–12 tuần** | Toàn bộ G0 → G5, có migration, phân quyền ABAC, báo cáo chất lượng | Có đội 4–5 người, muốn chạy thử ở phòng khám/bệnh viện nhỏ |

> Khuyến nghị: **đi theo quỹ đạo A trước**, nhưng thiết kế dữ liệu của G0/G1 theo hướng B để không phải migrate lại.

## 1. Nguyên tắc triển khai (bắt buộc tuân thủ)

1. **Feature flag từng giai đoạn**: `ENABLE_APPOINTMENT_V2`, `ENABLE_CATALOG_V2`, `ENABLE_INSURANCE_ITEM_LEVEL`, `ENABLE_LIS_V2`, `ENABLE_DISCHARGE_V2`. Bật/tắt bằng biến môi trường, không sửa code khi rollback.
2. **Không phá API cũ**: endpoint cũ giữ nguyên hành vi đến khi FE chuyển xong; endpoint mới đặt dưới `/api/v2/...` hoặc thêm field (additive).
3. **Máy chủ là nguồn sự thật duy nhất**: mọi giá, tỷ lệ BHYT, trạng thái, quyền ký đều tính ở server; client chỉ gửi ý định (chọn dịch vụ, chọn slot), không gửi số tiền/tên người ký.
4. **Snapshot tài chính**: hóa đơn đã phát hành lưu bản sao giá + version bảng giá + tỷ lệ BHYT; sửa bảng giá sau đó không làm đổi hóa đơn cũ.
5. **Mọi thay đổi trạng thái đi qua state machine** có bảng “ai được chuyển”; không update trực tiếp từ controller.
6. **Migration có dry-run + backup**: script ghi rõ số bản ghi sẽ đổi, chạy trên bản sao trước.
7. **Test trước khi nối FE**: mỗi quy tắc nghiệp vụ mới phải có test unit + 1 test HTTP; quy tắc tài chính/ an toàn phải có test đồng thời.
8. **Không đưa vào phạm vi**: HL7/FHIR server đầy đủ, DICOM viewer chuyên nghiệp, tích hợp HĐĐT thật, cổng BHXH thật — dùng mock/adapter trong đồ án, ghi rõ là adapter.

## 2. Kiến trúc nghiệp vụ đích

### 2.1 Sơ đồ luồng chuẩn (sau khi sửa)

```
[Đặt lịch] → [Xác nhận] → [Check-in] → [Sinh hiệu] → [Bác sĩ khám]
      → [Chỉ định CLS] → [Thu tạm ứng/đồng chi trả] → [Thực hiện CLS]
      → [AI hỗ trợ] → [Bác sĩ CĐHA đọc & ký] → [Trả kết quả]
      → [Nhập viện/ mổ] → [Chăm sóc] → [Xuất viện: tóm tắt + đơn + hẹn]
```

Điểm khác biệt so với hiện tại: **lịch hẹn là thực thể trung tâm** (không phải lượt khám), **thanh toán gắn với từng chỉ định**, **ký báo cáo là hành động pháp lý riêng**, **xuất viện có điều kiện**.

### 2.2 Thực thể mới / sửa

| Thực thể | Loại | Trường cốt lõi | Quan hệ |
| :--- | :--- | :--- | :--- |
| `Appointment` | **mới** | `patientId, doctorId, departmentId, roomId, slotId, start, end, type, status, source, reason, visitId, cancelReason, rescheduledFrom` | 1–1 `Visit` khi check-in; 1–n `AppointmentHistory` |
| `ServiceCatalogItem` | **mới** | `code, name, category, unit, bhytCode, bhytGroup, insuranceCovered, basePrice, vatRate, active` | n–1 `PriceList` |
| `PriceList` | **mới** | `hospitalId, version, effectiveFrom, effectiveTo, status, items[]` | 1–n hóa đơn snapshot |
| `InsuranceCard` | **mới** (tách `BhytInfo`) | `patientId, cardNumberEnc, benefitLevel, objectType, routeType, validFrom/To, fiveYear, copayRate, capPerYear, verifiedBy/At` | 1–n `Invoice` |
| `LabSpecimen` | **mới** | `labOrderId, barcode, type, collectedAt/By, receivedAt/By, condition` | 1–n `LabResult` |
| `LabResult` | **mới** (tách khỏi `LabOrder.results`) | `testCode, value, unit, refRange, flag, enteredBy, verifiedBy, verifiedAt, releasedAt` | n–1 `LabOrder` |
| `RadiologyReport` | **mới** (tách khỏi `ImagingResult`) | `studyId, templateId, findings, impression, structured, status, version, signedBy, signedAt, signatureId, amendedFrom` | 1–1 `ImagingStudy` |
| `Admission` | **mới** | `visitId, bedId, admittedAt, admittingDoctorId, diagnosis, status, dischargedAt` | 1–1 `Visit`, 1–n `CarePlan` |
| `CarePlan` / `Handover` | **mới** | mục tiêu – can thiệp – đánh giá; SBAR + task chờ | n–1 `Admission` |
| `DischargeRecord` | **mới** | `admissionId, criteriaMet, summary, medications, followUpDate, signedBy, invoiceCleared` | 1–1 `Admission` |
| `SurgeryCase` | **mới (G5)** | `visitId, schedule, team, preop, anesthesia, whoChecklist, implants, postOpOrders, pathology` | 1–1 `Visit` |
| `IncidentReport` | **mới (G5)** | `type, severity, description, actions, reportedBy, status` | n–1 `Hospital` |
| `Visit` | **sửa** | thêm `appointmentId, scheduledAt, checkedInAt, departmentId, admissionId`; bỏ phụ thuộc `date` mơ hồ | — |
| `Invoice` | **sửa** | thêm `priceListVersion, depositApplied, approval{requestedBy,approvedBy,reason}, eInvoiceNo` | — |
| `ImagingResult` | **giữ** | trở thành “study” + trỏ `reportId`; không lưu `conclusion` trực tiếp lâu dài | — |

> Lưu ý: không xóa `ImagingResult`/`BhytInfo`/`DischargePaper` cũ ngay. Giai đoạn đầu **dual-write** (ghi cả cũ và mới), đọc từ mới; sau khi FE chuyển xong mới bỏ ghi cũ.

### 2.3 Quyền & phạm vi (điều kiện tiên quyết của G0)

- Thêm role: `radiologist`, `cashier`, `accountant`, `lab_technician`, `lab_doctor`, `head_nurse`, `department_head`, `clinical_pharmacist`, `quality_manager`, `dpo`, `guardian`; sửa enum `system_admin`, `cleaner`.
- Thêm `permission` + `role_permissions`; middleware `requirePermission`.
- Thêm `scope` mặc định: `hospitalId` (đã có) + `departmentId` (mới) + `ownerId` cho các bảng lâm sàng.
- Quy tắc ký báo cáo: `role = radiologist` **và** `specialty` CĐHA **và** `hospitalId` khớp **và** `report.status = draft` **và** không phải người chỉ định (nếu bật second-read).

---

## 3. LỘ TRÌNH CHI TIẾT

> Đơn vị là **ngày công** (person-day), không phải ngày lịch. Tổng Track B ≈ **61 ngày công**; với 2 người (1 BE, 1 FE) + 1 người test bán thời gian, thời gian lịch khoảng **10–12 tuần**. Track A chỉ lấy phần “tối thiểu” của G2–G4, khoảng **28 ngày công**.

| Giai đoạn | BE | FE | Test | Tổng | Sản phẩm bàn giao |
| :--- | :---: | :---: | :---: | :---: | :--- |
| G0 Nền tảng | 4 | 1 | 1 | **6** | Catalog + giá version + role/permission + state machine |
| G1 Lịch hẹn | 5 | 3 | 1 | **9** | Appointment + slot + check-in + cấp số atomic |
| G2 BHYT/ viện phí | 6 | 3 | 1 | **10** | InsuranceCard + coverage theo item + tạm ứng/ hoàn tiền |
| G3 LIS + RIS | 12 | 4 | 1 | **17** | Mẫu/ kết quả/ duyệt 2 cấp + report ký khóa |
| G4 Nội trú/ xuất viện | 5 | 3 | 1 | **9** | Admission + handover + điều kiện xuất viện |
| G5 Phẫu thuật/ CL/ dữ liệu | 6 | 3 | 1 | **10** | SurgeryCase + incident + DSAR/retention |
| **Tổng** | **38** | **17** | **6** | **61** | — |

## GIAI ĐOẠN 0 — NỀN TẢNG DỮ LIỆU & PHÂN QUYỀN (6 ngày công)

**Vì sao phải làm trước:** lịch hẹn, BHYT theo item, báo cáo CĐHA đều cần `service catalog`, `price version`, `departmentId` và role `radiologist`. Nếu làm sau sẽ phải sửa lại hóa đơn/ báo cáo.

### Việc cần làm

| # | Việc | Chi tiết |
| :-- | :--- | :--- |
| 0.1 | `ServiceCatalogItem` + `PriceList` | CRUD cho `hospital_admin`; mỗi item có `code`, `bhytCode`, `insuranceCovered`, `basePrice`, `vatRate`; publish theo `version` + `effectiveFrom` |
| 0.2 | API `GET /api/v2/catalog?date=` | Trả giá đang hiệu lực; hóa đơn lưu `priceListVersion` + snapshot `unitPrice` |
| 0.3 | Role & permission | Thêm enum role mới; bảng `permissions`, `role_permissions`; `requirePermission()`; seed quyền cho 8 role cũ |
| 0.4 | Scope `departmentId` | Thêm `departmentId` vào JWT payload (đã có trong model); middleware `withDepartmentScope` cho EMR/ lịch/ giường |
| 0.5 | Chuẩn hóa `Visit.status` | Thêm `đã đặt lịch`, `đã check-in`; bảng `TRANSITION_ROLES`; ghi audit mọi lần chuyển |
| 0.6 | Feature flag + migration skeleton | `config/features.config.js` thêm cờ V2; thư mục `scripts/migrations/` có template dry-run |

### Quy tắc nghiệp vụ chốt ở G0

- Giá **không** lấy từ client; mọi dòng hóa đơn phải trỏ `serviceItemCode` (hoặc `drugId`).
- Hóa đơn đã phát hành là **bất biến**; sửa bằng credit note/ điều chỉnh có duyệt.
- `visit.departmentId` bắt buộc với ca nội trú/ CĐHA; dùng để lọc hàng đợi và chặn truy cập chéo khoa.
- Role `radiologist` chỉ được tạo sau khi có `licenseNumber` + `licenseExpiresAt`.

### Nghiệm thu G0

- [ ] Tạo được bảng giá 2 phiên bản; hóa đơn cũ giữ giá cũ sau khi publish version mới.
- [ ] `nurse` gọi API ký báo cáo → 403; `radiologist` → 200.
- [ ] Tất cả test cũ vẫn pass; thêm test snapshot giá + scope khoa.
- [ ] Migration dry-run chạy trên DB copy, báo đúng số bản ghi.

**Effort:** BE 4 ngày · FE 1 ngày (màn hình bảng giá) · test 1 ngày.

---

## GIAI ĐOẠN 1 — LỊCH HẸN & TIẾP ĐÓN THỰC TẾ (9 ngày công)

**Mục tiêu:** thay “tạo lượt khám là vào hàng đợi ngay” bằng luồng **đặt lịch → xác nhận → check-in → cấp số**. Đây là thay đổi lớn nhất về nghiệp vụ và là nền cho B2C.

### Mô hình & API

```
Appointment {
  hospitalId, patientId, doctorId, departmentId, roomId, slotId,
  startAt, endAt, type: consultation|followup|imaging|procedure,
  status: booked|confirmed|checked_in|completed|cancelled|no_show,
  source: reception|portal|transfer,
  reason, note, visitId, cancelReason, rescheduledFromId
}
```

| API | Role | Mô tả |
| :--- | :--- | :--- |
| `GET /api/v2/appointments/slots?doctorId&date` | receptionist, patient | Trả slot trống theo lịch trực + thời lượng dịch vụ |
| `POST /api/v2/appointments` | receptionist, patient | Đặt lịch; khóa slot bằng `findOneAndUpdate` |
| `PUT /api/v2/appointments/:id/confirm` | receptionist | Xác nhận qua SMS/ email (mock adapter) |
| `PUT /api/v2/appointments/:id/reschedule` | receptionist, patient | Dời lịch, giữ lịch sử |
| `PUT /api/v2/appointments/:id/cancel` | receptionist, patient | Hủy trong hạn, lý do bắt buộc |
| `POST /api/v2/appointments/:id/check-in` | receptionist | Tạo/ gắn `Visit`, cấp số atomic, set `checkedInAt` |
| `PUT /api/v2/appointments/:id/no-show` | receptionist | Sau X phút, nhả slot, ghi lý do |

### Quy tắc nghiệp vụ

1. **Slot**: sinh từ `WorkSchedule` (ca sáng/chiều/tối) + thời lượng khám (mặc định 15 phút) + buffer 5 phút; không cho đặt ngoài ca trực.
2. **Chống trùng**: unique index `{doctorId, startAt, status: {$ne:'cancelled'}}`; đặt đồng thời → 409.
3. **Một bệnh nhân – một lịch mở** cho cùng chuyên khoa/ ngày; đặt mới phải hủy/ dời lịch cũ.
4. **Check-in** mới tạo `Visit`; **không** tạo `Visit` khi đặt lịch → hàng đợi không bị bẩn.
5. **Số thứ tự** cấp lúc check-in bằng `QueueCounter.findOneAndUpdate({hospitalId,date}, {$inc:{seq:1}}, {upsert:true,new:true})`; số cấp theo thứ tự đến, ưu tiên cấp cứu có dải riêng (`CC-`).
6. **No-show** sau 20 phút (cấu hình) → `no_show`, nhả slot, gửi thông báo.
7. **Hủy/ dời** trước 2 giờ; sau mốc đó cần lễ tân xác nhận, ghi lý do; slot được nhả và mở lại.
8. **B2C**: bệnh nhân chỉ thấy slot của bác sĩ/ chuyên khoa đang nhận lịch; không thấy thông tin bệnh nhân khác.

### UI cần làm

- Lễ tân: **Lịch hẹn theo ngày/ tuần** (cột bác sĩ, màu trạng thái), panel đặt lịch, check-in, no-show.
- Bác sĩ: “Lịch của tôi hôm nay” + hàng đợi đã check-in.
- Bệnh nhân: chọn chuyên khoa → bác sĩ → slot → xác nhận; xem/ dời/ hủy.
- Thay màn “Lấy số khám” hiện tại bằng “Đặt lịch” + “Check-in muộn/ lấy số tại quầy”.

### Nghiệm thu G1

- [ ] Đặt 2 lịch cùng slot đồng thời → chỉ 1 thành công, lịch kia 409.
- [ ] Đặt lịch ngày mai không xuất hiện trong hàng đợi hôm nay.
- [ ] Check-in tạo đúng 1 Visit + 1 số thứ tự, không trùng khi 50 người check-in đồng thời.
- [ ] Hủy/ dời cập nhật lịch sử + nhả slot + thông báo.
- [ ] No-show sau ngưỡng → slot mở lại.
- [ ] Bệnh nhân không đặt được ngoài ca trực/ quá số slot.
- [ ] Job nhắc lịch 24h/ 2h chạy đúng trên `Appointment.startAt`, có test.

**Effort:** BE 5 ngày · FE 3 ngày · test 1 ngày.

> **Cắt giảm nếu thiếu thời gian (Track A):** chỉ làm đặt lịch + check-in + chống trùng + nhắc lịch; bỏ reschedule UI (dùng API), bỏ no-show tự động (làm job sau).

---

## GIAI ĐOẠN 2 — BHYT & VIỆN PHÍ THEO THỰC TẾ (10 ngày công)

**Mục tiêu:** bỏ cách “một tỷ lệ × tổng hóa đơn”; mỗi dòng dịch vụ có mức chi trả riêng; có tạm ứng/ công nợ; hoàn tiền có người duyệt.

### Mô hình

```
InsuranceCard {
  patientId, hospitalId,
  cardNumberEnc, holderName, birthDate, objectType, benefitLevel,
  validFrom, validTo, fiveYearContinuous,
  routeType: correct|referral|wrong,
  registeredHospitalId, referralHospitalId, referralValidTo,
  copayRate, capPerYear, usedThisYear,
  verifiedBy, verifiedAt, status: active|expired|replaced
}

InvoiceItem {
  serviceItemCode, description, quantity, unitPrice, vatRate,
  insurance: { covered, rate, maxPrice, bhytAmount, patientCopay, reason }
}
```

### Quy tắc nghiệp vụ (cần đối chiếu văn bản hiện hành trước khi chốt)

| Quy tắc | Cách làm trong hệ thống |
| :--- | :--- |
| Chỉ chi trả dịch vụ/ thuốc thuộc danh mục | `ServiceCatalogItem.insuranceCovered` + `bhytCode`; item ngoài danh mục → `covered:false`, bệnh nhân trả 100% |
| Tỷ lệ theo đối tượng/ mức hưởng | `benefitLevel` (1–5) + bảng `benefit_rates` cấu hình; không hard-code 80/95/100 |
| Đúng tuyến/ trái tuyến/ có giấy chuyển | `routeType` + `referralValidTo`; nếu trái tuyến không giấy → tỷ lệ theo cấu hình (có thể 0%), ghi rõ lý do trên hóa đơn |
| Giá trần BHYT | `maxPrice` theo item; `bhytAmount = min(rate × unitPrice, maxPrice)` |
| Trần năm | `usedThisYear` cập nhật atomic: `findOneAndUpdate({usedThisYear: {$lte: cap - amount}}, {$inc:{usedThisYear: amount}})`; nếu vượt → phần vượt bệnh nhân trả |
| Tạm ứng nội trú | `Deposit`/`patientCredit`; mỗi lần thu là một bút toán, không sửa số dư trực tiếp |
| Hoàn tiền/ giảm giá | `Approval {requestedBy, approvedBy, reason, amount}`; ngưỡng cấu hình; người duyệt ≠ người thu |
| Hóa đơn điện tử | Adapter `EInvoiceProvider` (mock trong đồ án), lưu `eInvoiceNo`, `issuedAt`, `pdfUrl` |

### API

| API | Role |
| :--- | :--- |
| `POST /api/v2/insurance-cards` (mã hóa) | receptionist |
| `GET /api/v2/insurance-cards/:patientId` (mask) | receptionist, cashier, accountant |
| `POST /api/v2/invoices/:id/apply-insurance` | cashier |
| `POST /api/v2/invoices/:id/deposit` | cashier |
| `POST /api/v2/invoices/:id/refund-request` / `:id/approve` | cashier / accountant |
| `GET /api/v2/invoices/:id/breakdown` | cashier, accountant, patient (của mình) |
| `POST /api/v2/claims/export` (XML adapter) | accountant |

### UI

- Màn thu ngân: bảng dòng dịch vụ có cột **Tổng / BHYT trả / BN trả / lý do không chi trả**; panel thẻ BHYT (mức hưởng, tuyến, hạn); nút tạm ứng/ hoàn tiền (có trạng thái chờ duyệt).
- Bệnh nhân: xem breakdown từng dòng, trạng thái hồ sơ BHYT, số dư tạm ứng.

### Nghiệm thu G2

- [ ] Dịch vụ ngoài danh mục (ví dụ phí AI) không bị trừ BHYT.
- [ ] Cùng tổng tiền, thẻ mức 80% và 95% ra số khác nhau đúng bảng cấu hình.
- [ ] Trái tuyến không giấy → tỷ lệ theo cấu hình, có ghi lý do.
- [ ] Vượt trần năm → chỉ trừ đến trần, phần còn lại bệnh nhân trả.
- [ ] Thu tạm ứng 2 lần → số dư cộng đúng, có lịch sử bút toán.
- [ ] Hoàn tiền bởi cùng người thu → 403; có người duyệt → 200 + audit.
- [ ] Hóa đơn đã phát hành không đổi khi publish bảng giá mới.
- [ ] `createAndPayInvoice` và `payInvoice` cho cùng kết quả trên cùng dữ liệu (test đối chiếu).

**Effort:** BE 6 ngày · FE 3 ngày · test 1 ngày.

> **Track A tối thiểu:** item-level coverage + mã hóa số thẻ + sửa 2 luồng thu tiền dùng chung service + test đối chiếu; chưa cần XML giám định/ HĐĐT.

---

## GIAI ĐOẠN 3 — CẬN LÂM SÀNG: LIS & RIS (16–17 ngày công)

### 3A. Xét nghiệm (LIS) — 5 ngày

**Mô hình:** `LabOrder` (order → collected → received → resulted → verified → released) + `LabSpecimen` + `LabResult` + `CriticalValueAlert`.

| Quy tắc | Chi tiết |
| :--- | :--- |
| Vòng đời mẫu | Mỗi mẫu có barcode riêng; không cho nhập kết quả khi chưa `received` |
| Duyệt 2 cấp | KTV nhập (`resulted`) → bác sĩ xét nghiệm `verify` → mới `released` cho bác sĩ điều trị |
| Critical value | Flag `critical` → tạo alert + gọi/ thông báo bác sĩ chỉ định; lưu `acknowledgedBy/At`; chặn `released` nếu chưa ack |
| Máy LIS | API key/ mTLS riêng, không dùng JWT người; body có `barcode`, `analyzerId`, `results[]` |
| Chỉ định | Bác sĩ chọn **bộ xét nghiệm** từ catalog (không gõ tự do); giá tính theo item |

**API:** `POST /api/v2/lab-orders`, `POST /api/v2/lab-orders/:id/collect`, `POST /api/v2/lab-results` (analyzer), `PUT /api/v2/lab-results/:id/verify`, `POST /api/v2/lab-results/:id/release`, `PUT /api/v2/critical-alerts/:id/ack`.

**UI:** hàng đợi mẫu, màn nhập/ duyệt kết quả, badge critical, lịch sử xét nghiệm trong EMR.

**Nghiệm thu:** không release khi chưa verify; critical chưa ack → không release + có thông báo; kết quả hiển thị đúng range theo giới/ tuổi; test máy LIS sai API key → 401.

> **Track A tối thiểu:** thêm `verified` + critical alert + API key; chưa cần quản lý mẫu chi tiết.

### 3B. RIS / Báo cáo CĐHA — 5–7 ngày

**Mô hình:** `ImagingStudy` (accession, modality, bodyPart, seriesCount, storagePath, status) + `RadiologyReport` (findings, impression, template, status draft/prelim/signed/amended, signature, version).

| Quy tắc | Chi tiết |
| :--- | :--- |
| Cổng thanh toán | Chỉ chuyển `đang chụp` khi chỉ định đã thanh toán/ BHYT/ cấp cứu; hiển thị lý do chặn |
| Cổng an toàn | Server tự tính từ checklist; `passed` không nhận từ client; thai/ suy thận + cản quang → cần override có lý do |
| Slot | Chỉ định MRI phải gắn `slotId`; KTV bắt đầu chụp → slot `in_progress`, kết thúc → `completed`; rescan/ cancel nhả slot |
| Ký báo cáo | Chỉ `radiologist` + license hợp lệ; khóa sau ký; sửa bằng addendum có version |
| Critical result | Kết luận nguy hiểm → yêu cầu gọi bác sĩ chỉ định trong X phút, ghi nhận đã đọc |
| So sánh | Bắt buộc chọn ca trước để so sánh khi tái khám; lưu measurement |
| QC ảnh | KTV chấm chất lượng/ lý do rescan; lưu `motion`, `noise`, `coverage` |

**API:** `POST /api/v2/imaging/orders` (gắn slot, catalog), `POST /api/v2/imaging/studies`, `PUT /api/v2/reports/:id/draft`, `POST /api/v2/reports/:id/sign`, `POST /api/v2/reports/:id/addendum`, `POST /api/v2/reports/:id/critical-callback`.

**UI:** hàng đợi đọc phim riêng cho `radiologist`; màn báo cáo có template + so sánh ca cũ; nút ký bị khóa khi thiếu điều kiện; badge critical.

**Nghiệm thu:** không ký được nếu thiếu license/ role; ký xong sửa → 409; chưa thanh toán → không vào buồng; pacemaker + `passed:true` → 400; cancel → nhả slot + điều chỉnh hóa đơn; critical chưa gọi → cảnh báo.

**Effort:** BE 7 ngày · FE 4 ngày · test 1 ngày (LIS 5 + RIS 12 = 17 ngày công).

---

## GIAI ĐOẠN 4 — NỘI TRÚ, CHĂM SÓC & XUẤT VIỆN (9 ngày công)

**Mục tiêu:** biến “gán giường” thành một quá trình nhập viện – chăm sóc – xuất viện có điều kiện, thay vì chỉ đổi trạng thái giường.

### Mô hình

```
Admission { visitId, bedId, admittedAt, admittingDoctorId, departmentId,
            diagnosis, status: active|transferred|discharged, dischargedAt }
CarePlan  { admissionId, goals[], interventions[], evaluations[], updatedBy }
Handover  { admissionId, shift, fromUserId, toUserId, sbar, pendingTasks[], at }
DailyRound{ admissionId, io{in,out}, pain, gcs, fallRisk, pressureUlcerRisk, notes }
DischargeRecord { admissionId, criteriaMet[], summary, medications[],
                  followUpDate, signedBy, invoiceCleared, printedAt }
```

### Quy tắc nghiệp vụ

1. **Nhập viện** phải có chỉ định `chờ nhập viện` (không cho gán giường từ ca `đang khám` nếu chưa có y lệnh), bác sĩ điều trị, chẩn đoán.
2. **Một bệnh nhân – một giường**; chuyển khoa/ giường phải tạo `AdmissionTransfer` có người duyệt.
3. **Điều dưỡng** ghi I/O, đau, Glasgow, đánh giá té ngã/ loét theo ca; **bàn giao ca** bắt buộc trước khi kết thúc ca trực, có SBAR + task chờ.
4. **Xuất viện** chỉ khi: không còn y lệnh chờ, đã đối chiếu thuốc, có tóm tắt ký số, hóa đơn đã quyết toán hoặc có phê duyệt công nợ.
5. **Đơn thuốc ra viện** tạo từ danh mục, có kiểm tra tương tác/ liều; **hẹn tái khám** tự sinh `Appointment`.
6. **Tiền giường** tính theo ngày thực tế (theo giờ nhập – giờ ra), không làm tròn lên cả ngày nếu ra trong ngày.

### API & UI

- `POST /api/v2/admissions`, `PUT /:id/transfer`, `PUT /:id/discharge` (kiểm tra điều kiện), `GET /api/v2/admissions/:id/summary`.
- `POST /api/v2/handovers`, `GET /api/v2/handovers/today`.
- `POST /api/v2/care-plans`, `PUT /:id/evaluate`.
- UI: bảng giường theo khoa, chi tiết nội trú (timeline), form bàn giao ca, màn xuất viện có checklist điều kiện + in tóm tắt.

### Nghiệm thu G4

- [ ] Không gán giường khi chưa có y lệnh nhập viện.
- [ ] Chuyển giường/ khoa giữ lịch sử, không mất tiền giường cũ.
- [ ] Bàn giao ca thiếu SBAR → không kết thúc ca (hoặc cảnh báo theo cấu hình).
- [ ] Xuất viện khi còn hóa đơn chưa thu → 400, trừ khi có duyệt công nợ.
- [ ] Xuất viện tự tạo hẹn tái khám + đơn ra viện.
- [ ] Tóm tắt xuất viện ký số, tải PDF được.

**Effort:** BE 5 ngày · FE 3 ngày · test 1 ngày.

> **Track A tối thiểu:** chỉ làm `Admission` + điều kiện xuất viện + tóm tắt ký số + hẹn tái khám; bỏ bàn giao ca/ I/O chi tiết.

---

## GIAI ĐOẠN 5 — PHẪU THUẬT, CHẤT LƯỢNG & QUẢN TRỊ DỮ LIỆU (10 ngày công)

### 5A. Phẫu thuật / hậu phẫu (5 ngày — nên có cho chuyên khoa u não)

```
SurgeryCase {
  visitId, scheduledAt, roomId, surgeonId, anesthesiologistId,
  preop: { labs, imaging, anesthesiaRisk, consentSigned },
  whoChecklist: { signIn, timeOut, signOut, completedBy },
  implants: [{ name, lot, expiry, manufacturer }],
  postOpOrders, pathology: { specimenId, result, reviewedBy },
  postOpMriDueAt
}
```

- Chỉ định mổ phải có hội chẩn + consent + tiền phẫu đủ; checklist WHO bắt buộc trước rạch da.
- Sau mổ: tạo task **MRI hậu phẫu 72h**, đối chiếu GPB, hẹn tái khám.
- UI: lịch mổ theo phòng/ kíp, màn checklist, theo dõi hậu phẫu.

### 5B. Quản lý chất lượng (2–3 ngày)

- `IncidentReport` (sự cố y khoa/ thuốc/ thiết bị) + quy trình xử lý, báo cáo.
- Chỉ số: thời gian chờ, tỷ lệ ký đúng hạn, tỷ lệ critical có callback, tỷ lệ rescan, nhiễm khuẩn (nếu có dữ liệu).
- Peer review đã có job lấy mẫu 5% — bổ sung dashboard + hành động khắc phục.

### 5C. Dữ liệu & tuân thủ (2 ngày)

- Job retention: đến hạn → ẩn danh hóa/ xóa theo cấu hình, có legal hold.
- DSAR: người bệnh yêu cầu **xuất** (PDF/JSON) và **xóa/ hạn chế**; xác thực danh tính + audit + thời hạn phản hồi.
- Chính sách truy cập: ai xem bệnh án nào, log read, báo cáo cho DPO.

**Effort:** BE 6 ngày · FE 3 ngày · test 1 ngày.

> **Track A:** chỉ làm mục 5C (DSAR + retention) ở mức tối thiểu và 1 màn incident report; phẫu thuật có thể chỉ mô tả trong báo cáo.

---

## 4. BẢN ĐỒ ẢNH HƯỞNG (file/module cần chạm)

### Backend

| Vùng | File hiện có | Việc cần làm |
| :--- | :--- | :--- |
| Lịch hẹn | — | **Mới**: `modules/appointment/{model,controller,service,routes}` |
| Danh mục/ giá | `servicePricing.util.js`, `hospital.model.js` | **Mới** `modules/catalog`; bỏ dần `priceService()` dò chuỗi |
| BHYT | `modules/billing/bhyt*`, `invoice.controller.js` | Tách `InsuranceCard`; sửa `applyBhytCore` theo item; hợp nhất 2 luồng thu |
| Visit | `models/visit.model.js`, `controllers/visit.controller.js`, `services/visit.service.js` | Thêm `appointmentId/scheduledAt/checkedInAt/admissionId`; `TRANSITION_ROLES`; sửa cổng an toàn + thanh toán |
| CĐHA | `modules/imaging/*` | Tách `ImagingStudy`/`RadiologyReport`; route ký riêng; critical callback |
| LIS | `modules/laboratory/*` | Thêm `LabSpecimen`, `LabResult`, verify 2 cấp, critical |
| Nội trú | `modules/hospital/hospitalBed*`, `emr` | Thêm `Admission`, `CarePlan`, `Handover`, `DischargeRecord` |
| Phẫu thuật | — | **Mới** `modules/surgery` (G5) |
| Chất lượng | `peerReview`, `report` | Thêm `IncidentReport` + chỉ số |
| Phân quyền | `middlewares/auth|role`, `models/user.model.js` | Thêm role/permission/scope; `requirePermission` |
| Dữ liệu | `utils/retention`, `jobs/scheduler` | Job retention + DSAR + legal hold |

### Frontend

| Màn hình | Trạng thái | Ghi chú |
| :--- | :--- | :--- |
| `AppointmentCalendarScreen` | **mới** | Lịch ngày/ tuần theo bác sĩ, kéo-thả dời lịch (optional) |
| `AppointmentBookingScreen` | **mới** | Dùng chung cho lễ tân và bệnh nhân |
| `CheckInScreen` | **mới** | Check-in, cấp số, in phiếu |
| `InsurancePanel` | **mới** (component) | Thẻ, mức hưởng, tuyến, cảnh báo |
| `InvoiceBreakdown` | **mới** (component) | Từng dòng: tổng/ BHYT/ BN trả/ lý do |
| `LabQueueScreen`, `LabResultEditor` | **mới** | Hàng đợi mẫu, nhập/ duyệt, critical |
| `RadiologyReportScreen` | tách từ `ImagingResultScreen` | Template, so sánh, ký/ khóa, addendum |
| `HandoverScreen`, `DischargeScreen`, `SurgeryScheduleScreen` | **mới** | G4/G5 |
| `ResponsiveLayout` | sửa | Menu theo role mới; guard deep-link |
| `DoctorWorkQueueScreen`, `NurseReceptionScreen`, `FinancialsScreen` | sửa | Bỏ luồng “tạo visit là vào hàng đợi”; thêm tab lịch hẹn/ công nợ |

---

## 5. KẾ HOẠCH DI TRÚ & TƯƠNG THÍCH

| Bước | Việc | An toàn |
| :-- | :--- | :--- |
| 1 | Backup DB + uploads; ghi phiên bản | Bắt buộc trước mọi migration |
| 2 | Script `01_catalog_from_pricing.js` | Tạo `ServiceCatalogItem` + `PriceList v1` từ `hospital.pricing`; dry-run in ra số item |
| 3 | `02_backfill_appointments.js` | Tạo `Appointment` cho các `Visit` có `date` hoặc `createdAt` trong 90 ngày; **không** tạo cho ca đã đóng |
| 4 | `03_encrypt_insurance_cards.js` | Mã hóa `bhytInfo.cardNumber`, giữ `last4`; đối chiếu số lượng |
| 5 | `04_backfill_roles.js` | Gán `radiologist` cho user có `specialty` CĐHA; cảnh báo user chưa có license |
| 6 | Dual-write 1–2 tuần | Ghi cả bảng cũ/ mới; job so sánh số dòng + tổng tiền; lệch > 0.5% → dừng |
| 7 | Cutover theo flag | Bật `ENABLE_APPOINTMENT_V2` cho 1 bệnh viện/ 1 khoa trước |
| 8 | Rollback | Tắt flag; dữ liệu mới vẫn giữ; không xóa bảng cũ trong 30 ngày |

> Không đổi tên collection cũ trong giai đoạn đồ án. Dùng collection mới (`appointments`, `service_catalog`, `insurance_cards`, `lab_results`, `radiology_reports`, `admissions`) để có thể bỏ nếu cần.

---

## 6. KỊCH BẢN DEMO / BẢO VỆ (đi theo đúng luồng mới)

1. **Bệnh nhân** đặt lịch trên app: chọn chuyên khoa → bác sĩ → slot; nhận xác nhận + nhắc lịch.
2. **Lễ tân** check-in: tạo lượt + số thứ tự; hệ thống **không** đưa lịch ngày mai vào hàng đợi hôm nay.
3. **Điều dưỡng** đo sinh hiệu + sàng lọc dị ứng; trạng thái vẫn `đang chờ` cho đến khi bác sĩ bắt đầu.
4. **Bác sĩ** khám, chỉ định MRI **có cản quang** + xét nghiệm; hệ thống tính tiền theo catalog, hiển thị BHYT từng dòng.
5. **Thu ngân** thu phần đồng chi trả/ tạm ứng; in breakdown; thử hoàn tiền → cần người duyệt.
6. **KTV** thử bảng kiểm có máy tạo nhịp → bị chặn 400; sửa lại an toàn → vào buồng; chọn slot, chụp, chấm QC.
7. **AI** trả kết quả + heatmap; bác sĩ lâm sàng xem nhưng **không ký được**.
8. **Bác sĩ CĐHA** đọc, so sánh ca cũ, ký số → báo cáo khóa; thử sửa → bị chặn.
9. **Điều dưỡng** bàn giao ca + ghi I/O; bác sĩ chỉ định nhập viện → gán giường.
10. **Xuất viện**: checklist điều kiện, tóm tắt ký số, đơn ra viện, hẹn tái khám; hóa đơn quyết toán.

Mỗi bước nên có **một màn hình + một đoạn log/ audit** để chứng minh, tránh demo bằng dữ liệu seed không đi qua luồng.

---

## 7. RỦI RO & CÁCH GIẢM

| Rủi ro | Mức | Giảm thiểu |
| :--- | :---: | :--- |
| Scope quá lớn, không kịp | Cao | Đi Track A; mỗi giai đoạn có “tối thiểu” đã ghi |
| Quy tắc BHYT sai/ thay đổi | Cao | Cấu hình theo bảng, không hard-code; review văn bản hiện hành; ghi rõ giả định trong báo cáo |
| Migration làm hỏng dữ liệu | Cao | Backup + dry-run + dual-write + rollback flag |
| FE không theo kịp BE | Trung bình | API contract chốt sớm; mock server; làm màn hình theo phase |
| Slot/ lịch trực không khớp | Trung bình | Sinh slot từ `WorkSchedule`; test ca đêm/ cuối tuần |
| Ký số thật không có CA | Trung bình | Dùng PKCS#12 dev + ghi rõ adapter; không tuyên bố đã tích hợp CA thật |
| DICOM thật quá phức tạp | Trung bình | Giữ ZIP/JPG cho đồ án; DICOMweb để roadmap |
| Hội đồng hỏi “khác gì HIS thật” | Thấp | Dùng bảng đối chiếu 5.1 trong báo cáo audit + demo luồng |

---

## 8. CHECKLIST THEO TUẦN (Track A — 4 tuần)

### Tuần 1 — Nền tảng
- [ ] Chốt enum role + permission catalog + seed
- [ ] `ServiceCatalog` + `PriceList v1` + API đọc giá
- [ ] `TRANSITION_ROLES` + audit chuyển trạng thái
- [ ] Feature flags + migration skeleton + backup script
- [ ] Test: snapshot giá, scope khoa, role ký

### Tuần 2 — Lịch hẹn
- [ ] `Appointment` + slot generation + API đặt/ hủy/ dời
- [ ] Check-in + cấp số atomic
- [ ] Sửa `bookFollowUp` không tạo visit “đang chờ”
- [ ] Job nhắc lịch 24h/ 2h
- [ ] UI lễ tân + bệnh nhân
- [ ] Test đồng thời slot + số thứ tự

### Tuần 3 — BHYT & cận lâm sàng tối thiểu
- [ ] `InsuranceCard` mã hóa + item-level coverage
- [ ] Hợp nhất service tính tiền 3 luồng + test đối chiếu
- [ ] `LabResult` verify 2 cấp + critical alert
- [ ] Cổng thanh toán trước chụp + hủy MRI điều chỉnh hóa đơn
- [ ] `RadiologyReport` khóa sau ký + role radiologist

### Tuần 4 — Nội trú tối thiểu & đóng gói demo
- [ ] `Admission` + điều kiện xuất viện + tóm tắt ký số + hẹn tái khám
- [ ] DSAR/ retention mức tối thiểu (nếu còn thời gian)
- [ ] Kịch bản demo 10 bước + dữ liệu seed đi qua luồng
- [ ] Chạy toàn bộ test cũ + test mới; sửa tài liệu README/ phụ lục
- [ ] Quay video dự phòng (phòng khi mạng/ AI lỗi)

### Track B (10–12 tuần)

| Tuần | Nội dung |
| :---: | :--- |
| 1 | G0 |
| 2–3 | G1 |
| 4–5 | G2 |
| 6–7 | G3 (LIS + RIS) |
| 8–9 | G4 |
| 10 | G5A (phẫu thuật) |
| 11 | G5B/C (chất lượng + dữ liệu) |
| 12 | Hardening, migration thật, tài liệu, demo |

---

## 9. ĐỊNH NGHĨA “BÁM SÁT THỰC TẾ” (Definition of Done)

Một luồng được coi là đạt khi trả lời **có** cho tất cả:

1. Có **trạng thái trung gian** đúng thực tế (đặt lịch, check-in, chờ kết quả, đã ký, chờ xuất viện…), không nhảy tắt.
2. Mỗi hành động có **người chịu trách nhiệm** và **điều kiện hợp lệ** (ai, khi nào, cần gì).
3. **Tiền** tính từ danh mục/ hợp đồng, có snapshot, có người duyệt khi ngoại lệ.
4. **Hồ sơ** sau khi ký/ xuất viện là bất biến, sửa bằng addendum.
5. Có **thông báo/ nhắc** đúng mốc (24h, 2h, 72h hậu phẫu, critical result).
6. Có **audit** cho mọi hành động nhạy cảm và **báo cáo** đo được (thời gian chờ, tỷ lệ đúng hạn).
7. Có **test** cho quy tắc và **kịch bản demo** đi qua luồng thật, không dùng seed tắt.

---

*Tài liệu này là kế hoạch cho phần còn lại; các lỗi P0–P2 đã được vá — xem mục “Trạng thái triển khai” ở đầu tài liệu và [BAO_CAO_AUDIT_2026-10.md](BAO_CAO_AUDIT_2026-10.md).*

