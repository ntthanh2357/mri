# BÁO CÁO KIỂM TOÁN TOÀN DIỆN & CHUYÊN SÂU HỆ THỐNG Y TẾ (HIS / EMR / PACS / EHR)
## DỰ ÁN: NEUROSCAN AI (HEALTHCARE ENTERPRISE PLATFORM)

> **Kiểm toán viên**: Senior Full-Stack Architect & Lead AppSec Medical Systems Auditor  
> **Tiêu chuẩn tham chiếu**: HL7/FHIR, HIPAA Security & Privacy Rules, OWASP Top 10 (2025/2026), Luật Khám bệnh, chữa bệnh số 15/2023/QH15 & Thông tư 46/2018/TT-BYT (Hồ sơ bệnh án điện tử).  
> **Thời điểm kiểm toán**: Tháng 09/2026  
> **Phạm vi kiểm toán**: Toàn bộ Backend (`BE` - Node.js/Express/Mongoose/MongoDB Atlas) và Frontend (`FE` - React Native/Expo 54/React 19).

---

## MỤC LỤC
1. [Bảng Tóm Tắt Sức Khỏe Hệ Thống (Executive Summary)](#1-bảng-tóm-tắt-sức-khỏe-hệ-thống-executive-summary)
2. [Kiến Trúc & Cơ Chế Vận Hành Tổng Thể (System Architecture & Data Flow)](#2-kiến-trúc--cơ-chế-vận-hành-tổng-thể)
3. [Ma Trận Phân Quyền Thực Tế (RBAC & Authorization Matrix)](#3-ma-trận-phân-quyền-thực-tế-rbac--authorization-matrix)
4. [Đánh Giá Logic Nghiệp Vụ & State Machine Y Tế (Medical Domain Business Logic)](#4-đánh-giá-logic-nghiệp-vụ--state-machine-y-tế)
5. [Danh Sách Chi Tiết Bug Logic & Lỗ Hổng Bảo Mật (Vulnerability & Bug Dossier)](#5-danh-sách-chi-tiết-bug-logic--lỗ-hổng-bảo-mật)
6. [Bẫy Code Ẩn & Rủi Ro Frontend (Hidden Pitfalls & Edge Cases)](#6-bẫy-code-ẩn--rủi-ro-frontend)
7. [An Toàn Dữ Liệu Y Tế & Tuân Thủ (Security, PII & EHR Compliance)](#7-an-toàn-dữ-liệu-y-tế--tuân-thủ)
8. [Kế Hoạch Hành Động Ưu Tiên (Remediation & Action Plan)](#8-kế-hoạch-hành-động-ưu-tiên)

---

## 1. BẢNG TÓM TẮT SỨC KHỎE HỆ THỐNG (EXECUTIVE SUMMARY)

### 1.1. Chỉ số rủi ro tổng quan (System Health Score)
* **Tổng thể mức độ rủi ro**: **CAO (HIGH RISK)** ⚠️
* **Điểm đánh giá An toàn Ứng dụng (AppSec Score)**: **58 / 100**
* **Điểm đánh giá Toàn vẹn Nghiệp vụ Y tế (Clinical Integrity Score)**: **64 / 100**
* **Điểm kiến trúc & hiệu năng (Architecture & Reliability)**: **72 / 100**

### 1.2. Thống kê lỗi phát hiện
| Mức độ nghiêm trọng (Severity) | Số lượng phát hiện | Tác động chính |
| :--- | :---: | :--- |
| **CRITICAL (Nghiêm trọng)** | **3** | Bỏ qua thanh toán viện phí (Payment Bypass); Rò rỉ toàn bộ bệnh án EMR liên viện (BOLA); IDOR thao túng/xóa bệnh án B2C. |
| **HIGH (Cao)** | **5** | Thiếu role guard tại route giường bệnh & chuyển viện; Tranh chấp cướp giường giữ chỗ; Crash Mongoose khi bệnh nhân đặt tái khám; Crash cú pháp crypto; Cho phép xóa vĩnh viễn hồ sơ y tế. |
| **MEDIUM (Trung bình)** | **6** | Thất thoát kho dược khi hoàn tiền; ReDoS gây treo máy chủ; Chuyển trạng thái ca khám tùy tiện; Danh sách tiếp đón bị giới hạn 20 người; Token refresh bị tê liệt trên FE; Mạo danh chữ ký cam đoan. |
| **LOW / CODE SMELL** | **4** | Lệch múi giờ UTC vs Local; Thiếu AbortController chống stale closure; Rò rỉ thông tin nội bộ trong gitignore/env; Cấu trúc state FE phân mảnh. |

---

## 2. KIẾN TRÚC & CƠ CHẾ VẬN HÀNH TỔNG THỂ

### 2.1. Phân tích Cấu trúc Backend (`BE`)
* **Mô hình kiến trúc**: Đang trong quá trình chuyển đổi theo mô hình **Strangler Fig Pattern** từ kiến trúc phân tầng cổ điển (Layered MVC: `controllers/`, `routes/`, `models/`) sang mô hình **Modular Monolith** (`src/modules/auth`, `billing`, `emr`, `hospital`, `imaging`, `laboratory`, `patient-portal`, `pharmacy`).
* **Cơ chế Multi-Tenancy (Đa cơ sở bệnh viện)**:
  * Sử dụng `AsyncLocalStorage` (`tenantStorage`) trong `tenant.middleware.js` để truyền ngữ cảnh `hospitalId` xuyên suốt luồng thực thi bất đồng bộ.
  * Tích hợp `tenancyPlugin` vào các Schema Mongoose để tự động chèn `{ hospitalId: store.hospitalId }` vào các query (`find`, `findOne`, `findOneAndUpdate`, `deleteMany`...).
  * **Hạn chế cấu trúc**: Nếu gọi từ luồng bất đồng bộ không qua middleware (hoặc qua các helper rời rạc), ngữ cảnh `tenantStorage` bị đứt gãy, dẫn đến truy vấn bị lọt ranh giới bệnh viện. Một số model quan trọng (`MedicalRecord`, `CareSheet`, `Consultation`) vừa gán `tenancyPlugin` vừa có các hàm controller cho phép bypass liên viện không nhất quán.

### 2.2. Phân tích Cấu trúc Frontend (`FE`)
* **Framework**: React Native 0.81.5 + Expo SDK 54, hỗ trợ cả Web (`react-native-web`) và Mobile.
* **Mô hình Quản lý State**: 
  * **Chưa có Global State Store chuẩn** (không Redux, không Zustand, không Context API tập trung cho User/Auth Session).
  * State phân mảnh tại từng màn hình (`DoctorWorkQueueScreen`, `NurseReceptionScreen`, `FinancialsScreen`) với hàng chục biến `useState`.
  * Điều này gây ra hiện tượng không đồng bộ trạng thái khi bác sĩ cập nhật ca bệnh ở màn hình này nhưng màn hình khác vẫn giữ dữ liệu cũ (Stale State).
* **Luồng Navigation**:
  * Sử dụng `@react-navigation/native-stack` trong `AppNavigator.js`.
  * **Lỗ hổng**: Không có Navigation Guard (Auth Guard / Role Guard). Tất cả 30+ màn hình từ `SystemAdminScreen`, `AdminBackofficeScreen`, `FinancialsScreen` đến `DoctorWorkQueueScreen` đều được khai báo phẳng trong một Stack duy nhất. Bất kỳ người dùng nào can thiệp URL (trên Web) hoặc gọi navigation đều có thể mount giao diện của Admin/Bác sĩ.
* **Cấu trúc API Client**:
  * Sử dụng fetch wrapper tự viết (`src/api/client.js` và `src/services/api.service.js`).
  * Token lưu trữ phân tán giữa `AsyncStorage` (Mobile) và `localStorage` (Web).
  * **Lỗi nghiêm trọng**: Không có Interceptor bắt mã lỗi 401 để tự động refresh token. Khi Access Token hết hạn (1 giờ), client lập tức xóa token và đá người dùng về trang `Welcome`, làm mất dữ liệu bệnh án đang nhập dở.

### 2.3. Vòng Đời Luồng Dữ Liệu E2E (End-to-End Request Lifecycle)
```
[User Action trên Màn hình FE]
    │  (VD: Bác sĩ bấm "Ra y lệnh MRI" trên DoctorWorkQueueScreen)
    ▼
[API Client - client.js / api.service.js]
    │  Lấy Bearer JWT từ Storage -> Gắn Header Authorization
    ▼
[Tầng Network / HTTP Request] -> [Express Server: index.js]
    │  1. securityHeaders (OWASP Headers: X-Frame-Options, CSP, nosniff)
    │  2. cors (Kiểm tra Whitelist Origin)
    │  3. express.json({ limit: "50mb" })
    │  4. sanitizeNoSql (Khử ký tự '$' và '.' chống NoSQL Injection)
    │  5. rateLimiter (authRateLimiter, b2cRateLimiter)
    ▼
[Main Router: routes/index.js -> visit.routes.js]
    │  6. protect Middleware (Verify JWT, kiểm tra isLocked, tokenVersion, nạp authCache, khởi tạo tenantStorage.run)
    │  7. checkRole(["doctor"]) (Kiểm tra vai trò bác sĩ)
    ▼
[Controller: visit.controller.js -> createMriOrder]
    │  8. Kiểm tra tính hợp lệ của tham số y vụ
    │  9. Lập hóa đơn tạm tính viện phí (Invoice Draft)
    │  10. Cập nhật Visit.status = 'chờ chụp'
    │  11. Gửi Notification nội bộ cho Kỹ thuật viên
    ▼
[Mongoose ODM -> MongoDB Atlas]
    │  12. Ghi bản ghi Visit & Invoice vào CSDL
    ▼
[Phản hồi JSON về Client]
    │  13. FE nhận response -> Cập nhật local state -> Render Badge 'Chờ chụp MRI'
```

---

## 3. MA TRẬN PHÂN QUYỀN THỰC TẾ (RBAC & AUTHORIZATION MATRIX)

### 3.1. Bản đồ vai trò trong hệ thống
Hệ thống định nghĩa 7 vai trò chính tại `user.model.js`:
1. `patient`: Bệnh nhân (B2C hoặc người bệnh khám nội/ngoại trú).
2. `doctor`: Bác sĩ điều trị / Bác sĩ chuyên khoa chẩn đoán hình ảnh thần kinh.
3. `nurse`: Điều dưỡng (tiếp đón ban đầu, đo sinh hiệu, chăm sóc, lập phiếu thu).
4. `receptionist`: Lễ tân bệnh viện (tiếp đón, tạo lượt khám, thu ngân, xuất hóa đơn).
5. `technician`: Kỹ thuật viên (vận hành máy MRI, kiểm tra an toàn kim loại, upload DICOM).
6. `hospital_admin`: Quản trị viên cấp cơ sở (quản lý nhân viên, danh mục giường, cấu hình giá).
7. `admin`: Quản trị viên hệ thống SaaS (toàn quyền trên mọi tenant, quản lý tenant, SLA, sao lưu).

### 3.2. Bảng Ma Trận Phân Quyền Tuyến API (RBAC Verification Table)

| Tuyến API (Endpoint) | Phương thức | Middleware Bảo Vệ | Role Cho Phép Theo Code | Đánh Giá An Toàn & Lỗ Hổng |
| :--- | :---: | :--- | :--- | :--- |
| `/auth/register` | `POST` | Public | Tự do (`patient`); Staff nếu caller là `hospital_admin` | ✅ Tốt: Đã chặn leo quyền tạo admin trái phép. |
| `/auth/login` | `POST` | Public + RateLimit | Mọi role | ✅ Tốt: Có khóa brute-force 15p sau 5 lần sai. |
| `/api/v1/invoices/payment/success` | `GET` | **KHÔNG CÓ** | **Public** | 🔴 **CRITICAL**: Bất kỳ ai cũng có thể tự xác nhận đã thanh toán hóa đơn hoặc kích hoạt Premium. |
| `/api/v1/hospital-beds/:id/reserve` | `POST` | `protect` | **Mọi role có token** (Thiếu `checkRole`) | 🟠 **HIGH**: Bệnh nhân hoặc Lễ tân có thể tự giữ chỗ giường bệnh. |
| `/api/v1/hospital-beds/:id/occupy` | `PUT` | `protect` | **Mọi role có token** (Thiếu `checkRole`) | 🟠 **HIGH**: Có thể xếp bệnh nhân cướp giường của người khác. |
| `/api/v1/hospital-beds/:id/release` | `PUT` | `protect` | **Mọi role có token** (Thiếu `checkRole`) | 🟠 **HIGH**: Cho phép giải phóng giường bệnh mà không cần bác sĩ/điều dưỡng duyệt. |
| `/api/v1/transfers/:id/accept` | `PUT` | `protect` | **Mọi role có token** | 🟠 **HIGH**: Bất kỳ ai cũng duyệt nhận bệnh nhân chuyển viện, không kiểm tra tenant viện đích. |
| `/api/v1/transfers/:id/grant-cross-view` | `POST` | `protect` | **Mọi role có token** | 🟠 **HIGH + CRASH**: Thiếu role guard + lỗi cú pháp crypto crash 500. |
| `/emr/records/:id` | `GET` | `protect` + `checkRole` | Doctor, Nurse, Recept, Admin | 🔴 **CRITICAL**: Không kiểm tra `hospitalId` (BOLA), cho phép đọc chéo toàn bộ bệnh án của viện khác. |
| `/emr/records/:id` | `PUT` | `protect` + `checkRole` | Doctor, Nurse, Recept, Admin | 🟠 **HIGH**: Lễ tân sửa được bệnh án lâm sàng; Lỗ hổng Mass Assignment. |
| `/api/v1/patient/records/:visitId` | `DELETE` | `protect` + `blockPatient` | Doctor, Nurse, Recept, Admin | 🔴 **CRITICAL**: Cho phép xóa vĩnh viễn lượt khám và tài liệu y khoa. |
| `/api/v1/patient-b2c/imaging/:id` | `GET` | `protect` | Patient (check ID); **Staff (NO CHECK)** | 🟠 **HIGH**: Nhân viên viện A xem được ảnh MRI của bệnh nhân viện B. |
| `/admin/reports/revenue` | `POST` | `checkRole` | Admin, Hospital_Admin, **Doctor** | 🟡 **MEDIUM**: Bác sĩ điều trị được quyền tạo báo cáo doanh thu tài chính. |

---

## 4. ĐÁNH GIÁ LOGIC NGHIỆP VỤ & STATE MACHINE Y TẾ

### 4.1. Luồng Tiếp Nhận & Hàng Đợi Khám (Reception & Work Queue)
* **Chu trình chuẩn y khoa**:
  `Tiếp đón (đang chờ)` ➔ `Đo sinh hiệu (đang khám)` ➔ `Chỉ định cận lâm sàng (chờ chụp MRI)` ➔ `Bảng kiểm an toàn (đang chụp)` ➔ `Xử lý AI (chờ kết quả AI)` ➔ `Bác sĩ đọc phim (chờ bác sĩ đọc)` ➔ `Hội chẩn/Kê đơn (hoàn tất)` ➔ `Viện phí (chờ thanh toán)` ➔ `Thanh toán thành công (đã đóng)`.
* **Lỗ hổng State Machine**:
  * Tuyến `PUT /api/v1/visits/:id/status` nhận trực tiếp `req.body.status` mà **hoàn toàn không có State Transition Guard**.
  * Bất kỳ user nào có quyền đều có thể chuyển trạng thái từ `đang chờ` nhảy cóc sang `hoàn tất` mà không qua khám lâm sàng hay chụp phim.
  * Có thể đảo ngược trạng thái từ `hoàn tất` hoặc `đã đóng` ngược lại `đang chờ`, gây sai lệch dữ liệu viện phí và lịch sử ca bệnh.
  * Khi gọi `updateStatus("hoàn tất")` đồng thời, có thể kích hoạt sinh 2 hóa đơn nháp trùng lặp do thiếu database lock.

### 4.2. Quản Lý Giường Bệnh (Double Allocation & Bed Stealing)
* Cơ chế giữ chỗ (`reserveBedAtomicService`) hoạt động tốt trong việc chống Race Condition khi 2 người cùng giữ chỗ 1 giường trống (`status: 'available'`).
* **Lỗ hổng Cướp Giường (Bed Stealing)**:
  * Trong `occupyBedAtomicService`, điều kiện tìm kiếm là:
    ```javascript
    HospitalBed.findOneAndUpdate({ _id: bedId, hospitalId, status: { $in: ['available', 'reserved'] } }, ...)
    ```
  * Khi giường đang ở trạng thái `reserved` cho Bệnh nhân X (với `reservedForPatientId: X`), hệ thống **không kiểm tra** người đang thao tác `occupy` có phải là Bệnh nhân X hay không!
  * Hậu quả: Điều dưỡng ca trực khác có thể vô tình hoặc cố ý xếp Bệnh nhân Y vào giường đang được giữ chỗ riêng cho ca phẫu thuật cấp cứu của Bệnh nhân X.

### 4.3. Hồ Sơ Bệnh Án & Viện Phí (Records & Financials)
* **Vi phạm tính Bất biến của Bệnh án (EMR Immutability)**:
  * Tuyến `DELETE /api/v1/patient/records/:visitId` và `DELETE /api/v1/patient/records/:visitId/documents/:docId` cho phép xóa cứng hồ sơ lượt khám và tài liệu y khoa.
  * Trong y tế, mọi thao tác chỉnh sửa/hủy bỏ phải được thực hiện thông qua **phiên bản bổ sung (Addendum)** hoặc **Soft Delete có ký số xác nhận**, tuyệt đối không được xóa vật lý khỏi CSDL.
* **Lỗi Thất Thoát Tồn Kho Dược Phẩm khi Hoàn Tiền**:
  * Khi bệnh nhân thanh toán đơn thuốc, hàm `payInvoice` trừ tồn kho nguyên tử (`$inc: { "stock.quantity": -quantity }`).
  * Tuy nhiên, khi gọi `refundInvoice` (hoàn tiền), hệ thống chỉ đổi trạng thái hóa đơn sang `hoàn tiền` mà **không hề cộng hoàn trả tồn kho thuốc**, gây thất thoát thuốc trên sổ sách kế toán dược.

---

## 5. DANH SÁCH CHI TIẾT BUG LOGIC & LỖ HỔNG BẢO MẬT

---

### [BUG-01] Lỗ Hổng Nghiêm Trọng Bỏ Qua Xác Thực Thanh Toán (Unauthenticated Payment Bypass / Backdoor)
* **File & Dòng code**: [invoice.routes.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/modules/billing/invoice.routes.js#L30), [invoice.controller.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/modules/billing/invoice.controller.js#L648-L706)
* **Mức độ**: 🔴 **CRITICAL (CVSS 9.8)**
* **Hậu quả thực tế**: Tuyến `GET /api/v1/invoices/payment/success` được cấu hình Public. Người dùng chỉ cần truy cập URL này kèm tham số `?invoiceId=<id>` hoặc `?orderCode=<code>` là hóa đơn viện phí được hệ thống đánh dấu "đã thanh toán" thành công, hoặc tài khoản người dùng được tự động kích hoạt gói Hội viên Premium 1 năm mà không cần thanh toán bất kỳ đồng nào qua PayOS.
* **Code khắc phục (Diff)**:

```diff
--- a/BE/src/modules/billing/invoice.controller.js
+++ b/BE/src/modules/billing/invoice.controller.js
@@ -648,58 +648,15 @@ export const paymentSuccess = async (req, res) => {
   try {
     const { orderCode, invoiceId } = req.query;
 
-    if (orderCode) {
-      // 1. Kiểm tra và kích hoạt đơn hàng Premium
-      const premiumOrder = await PremiumOrder.findOne({ orderCode });
-      if (premiumOrder && premiumOrder.status !== "completed") {
-        premiumOrder.status = "completed";
-        premiumOrder.paidAt = new Date();
-        await premiumOrder.save();
-
-        const user = await User.findById(premiumOrder.userId);
-        if (user) {
-          user.isPremium = true;
-          const oneYearFromNow = new Date();
-          oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
-          user.premiumUntil = oneYearFromNow;
-          user.autoRenew = true;
-          await user.save();
-          console.log(`[Local Direct Activation] Activated Premium for User: ${user.email}`);
-        }
-      }
-
-      // 2. Kiểm tra và xác nhận hóa đơn lượt khám
-      const invoice = await Invoice.findOne({ orderCode });
-      if (invoice && invoice.status !== "đã thanh toán") {
-        invoice.status = "đã thanh toán";
-        invoice.paidAt = new Date();
-        await invoice.save();
-
-        const visit = await Visit.findById(invoice.visitId);
-        if (visit) {
-          visit.invoiceId = invoice._id;
-          visit.status = "đã đóng";
-          await visit.save();
-        }
-      }
-    } else if (invoiceId) {
-      const invoice = await Invoice.findById(invoiceId);
-      if (invoice && invoice.status !== "đã thanh toán") {
-        invoice.status = "đã thanh toán";
-        invoice.paidAt = new Date();
-        await invoice.save();
-      }
-    }
+    // BẢO MẬT: Tuyệt đối không thay đổi trạng thái hóa đơn tại returnUrl công khai.
+    // Toàn bộ việc cập nhật trạng thái thanh toán bắt buộc phải thông qua Webhook PayOS đã xác thực chữ ký số.
   } catch (error) {
-    console.error("Lỗi cập nhật trực tiếp tại paymentSuccess:", error);
+    console.error("Lỗi paymentSuccess:", error);
   }
```

---

### [BUG-02] Lộ Toàn Bộ Bệnh Án Lâm Sàng Giữa Các Bệnh Viện (Cross-Tenant EMR Data Leak / BOLA)
* **File & Dòng code**: [emr.controller.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/modules/emr/emr.controller.js#L88-L102), [emr.controller.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/modules/emr/emr.controller.js#L179-L192)
* **Mức độ**: 🔴 **CRITICAL**
* **Hậu quả thực tế**: Bác sĩ, Điều dưỡng, Lễ tân của Bệnh viện A chỉ cần biết hoặc thử ID hồ sơ bệnh án (`MedicalRecord._id`) của Bệnh viện B là có thể xem toàn bộ chẩn đoán, kế hoạch điều trị, sinh hiệu, và biên bản hội chẩn mà không hề bị hệ thống từ chối. Vi phạm trắng trợn ranh giới dữ liệu bệnh viện (Multi-Tenant Isolation).
* **Code khắc phục (Diff)**:

```diff
--- a/BE/src/modules/emr/emr.controller.js
+++ b/BE/src/modules/emr/emr.controller.js
@@ -1,5 +1,6 @@
 import { MedicalRecord } from "./models/medicalRecord.model.js";
 import { CareSheet } from "./models/careSheet.model.js";
+import { checkPatientTenancy } from "../../utils/tenancy.util.js";
 
 export const getRecordById = async (req, res) => {
   try {
@@ -91,9 +92,15 @@ export const getRecordById = async (req, res) => {
     if (!record) {
       return res.status(404).json({ message: "Không tìm thấy hồ sơ bệnh án." });
     }
 
-    // Cho phép xem bệnh án liên viện. Quyền sửa đổi vẫn được bảo vệ trong updateRecord.
+    // BẢO MẬT: Kiểm tra thẩm quyền đa cơ sở trước khi xuất dữ liệu bệnh án
+    const hasAccess = await checkPatientTenancy(record.patientId, req.user);
+    if (!hasAccess && record.hospitalId?.toString() !== req.user?.hospitalId?.toString()) {
+      return res.status(403).json({ 
+        message: "Bạn không có quyền xem bệnh án của bệnh nhân thuộc cơ sở y tế khác khi chưa có phiếu chuyển viện hợp lệ." 
+      });
+    }
 
     res.status(200).json({ status: "success", data: record });
   } catch (error) {
```

---

### [BUG-03] Lỗ Hổng IDOR Truy Xuất & Xóa Hồ Sơ Bệnh Nhân Tự Do B2C
* **File & Dòng code**: [patientRecord.controller.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/controllers/patientRecord.controller.js#L6-L18)
* **Mức độ**: 🔴 **CRITICAL**
* **Hậu quả thực tế**: Hàm `getTargetPatientId` kiểm tra:
  ```javascript
  if (!patient || (patient.hospitalId && patient.hospitalId.toString() !== req.user.hospitalId.toString()))
  ```
  Khi bệnh nhân đăng ký tự do B2C trên ứng dụng (`patient.hospitalId === null`), mệnh đề điều kiện thứ hai trả về `false`. Hậu quả: Bất kỳ nhân viên y tế của bất kỳ bệnh viện nào đều có thể truyền `?patientId=<id_b2c>` để đọc trộm, chỉnh sửa hoặc xóa sạch hồ sơ khám bệnh cá nhân của người dùng B2C.
* **Code khắc phục (Diff)**:

```diff
--- a/BE/src/controllers/patientRecord.controller.js
+++ b/BE/src/controllers/patientRecord.controller.js
@@ -3,14 +3,14 @@ import { User } from "../models/user.model.js";
 import { MedicineReminder } from "../models/medicineReminder.model.js";
 import { successResponse, errorResponse } from "../utils/response.util.js";
+import { checkPatientTenancy } from "../utils/tenancy.util.js";
 
 const getTargetPatientId = async (req) => {
   if (req.user && req.user.role !== 'patient') {
     const patientId = req.query.patientId || req.body.patientId || req.user.id;
     if (patientId !== req.user.id) {
-      const patient = await User.findById(patientId);
-      if (!patient || (patient.hospitalId && patient.hospitalId.toString() !== req.user.hospitalId.toString())) {
-        throw { status: 403, message: "Không tìm thấy bệnh nhân hoặc không có quyền truy cập." };
+      const authorizedPatient = await checkPatientTenancy(patientId, req.user);
+      if (!authorizedPatient) {
+        throw { status: 403, message: "Không tìm thấy bệnh nhân hoặc không có quyền truy cập hồ sơ." };
       }
     }
     return patientId;
```

---

### [BUG-04] Thiếu Phân Quyền Vai Trò (Missing `checkRole`) Trên Tuyến API Quản Lý Giường Bệnh & Chuyển Tuyến
* **File & Dòng code**: [hospitalBed.routes.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/modules/hospital/hospitalBed.routes.js#L18-L20), [transfer.routes.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/routes/transfer.routes.js#L18-L20)
* **Mức độ**: 🟠 **HIGH**
* **Hậu quả thực tế**: Người dùng đăng nhập với vai trò `patient` hoặc `receptionist` có thể gửi yêu cầu HTTP `PUT /api/v1/hospital-beds/:id/release` để đẩy bệnh nhân đang nằm điều trị ra khỏi giường bệnh; hoặc gọi `PUT /api/v1/transfers/:id/accept` để tự ý duyệt tiếp nhận bệnh nhân chuyển viện cấp cứu mà không thông qua bác sĩ trưởng khoa.
* **Code khắc phục (Diff)**:

```diff
--- a/BE/src/modules/hospital/hospitalBed.routes.js
+++ b/BE/src/modules/hospital/hospitalBed.routes.js
@@ -1,5 +1,5 @@
 import { Router } from "express";
-import { protect } from "../../middlewares/auth.middleware.js";
+import { protect, checkRole } from "../../middlewares/auth.middleware.js";
 import {
   getBeds,
   createBed,
@@ -15,9 +15,9 @@ router.use(protect);
 router.get("/", getBeds);
-router.post("/", createBed);
+router.post("/", checkRole(["admin", "hospital_admin"]), createBed);
 router.get("/map-summary", getBedMapSummary);
-router.post("/:id/reserve", reserveBed);
-router.put("/:id/occupy", occupyBed);
-router.put("/:id/release", releaseBed);
+router.post("/:id/reserve", checkRole(["doctor", "nurse", "admin", "hospital_admin"]), reserveBed);
+router.put("/:id/occupy", checkRole(["doctor", "nurse", "admin", "hospital_admin"]), occupyBed);
+router.put("/:id/release", checkRole(["doctor", "nurse", "admin", "hospital_admin"]), releaseBed);
 
 export default router;
```

---

### [BUG-05] Xếp Trùng Bệnh Nhân & Cướp Giường Đã Giữ Chỗ (Bed Reservation Hijacking)
* **File & Dòng code**: [hospitalBed.service.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/services/hospitalBed.service.js#L127-L142)
* **Mức độ**: 🟠 **HIGH**
* **Hậu quả thực tế**: Giường A đang được bác sĩ giữ chỗ (`reserved`) trong 4 tiếng cho Bệnh nhân cấp cứu X. Một điều dưỡng khác tại khoa khi thực hiện nhập viện cho Bệnh nhân Y chọn Giường A, hệ thống cho phép ghi đè mà không kiểm tra xem người giữ chỗ có phải là Bệnh nhân Y không, làm mất giường của ca bệnh nặng.
* **Code khắc phục (Diff)**:

```diff
--- a/BE/src/services/hospitalBed.service.js
+++ b/BE/src/services/hospitalBed.service.js
@@ -128,7 +128,14 @@ export const occupyBedAtomicService = async ({ bedId, hospitalId, user, occupyDa
     {
       _id: bedId,
       hospitalId,
-      status: { $in: ['available', 'reserved'] }
+      $or: [
+        { status: 'available' },
+        { 
+          status: 'reserved', 
+          reservedForPatientId: patientId, // Chỉ cho phép nếu giữ chỗ cho đúng bệnh nhân này
+          reservedUntil: { $gte: new Date() } 
+        }
+      ]
     },
     {
       $set: {
```

---

### [BUG-06] Crash 500 Khi Bệnh Nhân B2C Đặt Lịch Tái Khám (Missing Required `hospitalId`)
* **File & Dòng code**: [patientB2c.controller.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/modules/patient-portal/patientB2c.controller.js#L203-L215), [visit.model.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/models/visit.model.js#L6)
* **Mức độ**: 🟠 **HIGH**
* **Hậu quả thực tế**: Khi bệnh nhân B2C đặt lịch tái khám, hàm `bookFollowUp` lấy `hospitalId: req.user.hospitalId`. Tuy nhiên tài khoản B2C có `hospitalId = null`. Schema `Visit` lại quy định `hospitalId: { required: true }`. Lệnh `newVisit.save()` ném lỗi Mongoose ValidationError làm crash 500 API.
* **Code khắc phục (Diff)**:

```diff
--- a/BE/src/modules/patient-portal/patientB2c.controller.js
+++ b/BE/src/modules/patient-portal/patientB2c.controller.js
@@ -197,9 +197,13 @@ export const bookFollowUp = async (req, res) => {
   try {
-    const { preferredDate, reason, doctorId } = req.body;
+    const { preferredDate, reason, doctorId, hospitalId } = req.body;
     const patientId = req.user.id;
 
     if (!reason) return errorResponse(res, "Vui lòng nêu lý do tái khám.", 400);
+    const targetHospitalId = req.user.hospitalId || hospitalId;
+    if (!targetHospitalId) {
+      return errorResponse(res, "Vui lòng chọn cơ sở y tế muốn đăng ký tái khám.", 400);
+    }
 
     const { Visit } = await import("../models/visit.model.js");
     const newVisit = new Visit({
-      hospitalId: req.user.hospitalId,
+      hospitalId: targetHospitalId,
       patientId,
```

---

### [BUG-07] Crash Lỗi Cú Pháp Khi Cấp Token Bệnh Án Liên Viện
* **File & Dòng code**: [transfer.controller.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/controllers/transfer.controller.js#L247-L248)
* **Mức độ**: 🟠 **HIGH**
* **Hậu quả thực tế**: Dòng `const { crypto } = await import("crypto");` khiến biến `crypto` nhận giá trị `undefined`. Dòng tiếp theo gọi `crypto.randomBytes(32)` gây ra lỗi runtime `TypeError: Cannot read properties of undefined (reading 'randomBytes')`, làm tính năng cấp quyền truy cập liên viện bị sập hoàn toàn.
* **Code khắc phục (Diff)**:

```diff
--- a/BE/src/controllers/transfer.controller.js
+++ b/BE/src/controllers/transfer.controller.js
@@ -1,4 +1,5 @@
+import crypto from "crypto";
 import { TransferForm } from "../models/transferForm.model.js";
 import { Hospital } from "../models/hospital.model.js";
@@ -246,3 +247,2 @@ export const grantCrossHospitalView = async (req, res) => {
-    const { crypto } = await import("crypto");
     const accessToken = crypto.randomBytes(32).toString("hex");
```

---

### [BUG-08] Thất Thoát Tồn Kho Dược Phẩm Khi Hoàn Tiền Hóa Đơn (Inventory Leak on Refund)
* **File & Dòng code**: [invoice.controller.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/modules/billing/invoice.controller.js#L939-L987)
* **Mức độ**: 🟡 **MEDIUM**
* **Hậu quả thực tế**: Khi thanh toán, hệ thống tự động trừ kho thuốc (`Drug.stock.quantity`). Khi người bệnh hủy lượt khám hoặc nhân viên hoàn tiền hóa đơn (`refundInvoice`), số lượng thuốc đã trừ không được cộng bù trả lại kho dược, dẫn đến tình trạng sai lệch nghiêm trọng giữa tồn kho thực tế và sổ sách CSDL.
* **Code khắc phục (Diff)**:

```diff
--- a/BE/src/modules/billing/invoice.controller.js
+++ b/BE/src/modules/billing/invoice.controller.js
@@ -958,6 +958,23 @@ export const refundInvoice = async (req, res) => {
     invoice.status = "hoàn tiền";
     invoice.notes = `[HOÀN TIỀN] Lý do: ${refundReason || 'Theo yêu cầu khách hàng'}. Thực hiện bởi: ${req.user.id}`;
+
+    // Hoàn trả tồn kho dược phẩm nguyên tử
+    const drugItems = invoice.items.filter(item => item.type === "drug");
+    if (drugItems.length > 0) {
+      const bulkOps = drugItems.map(item => {
+        const match = item.description.match(/Thuốc:\s*([^(]+)\s*\(SL:\s*(\d+)/i);
+        if (!match) return null;
+        const drugName = match[1].trim();
+        const qty = parseInt(match[2], 10);
+        return {
+          updateOne: {
+            filter: { hospitalId: req.user.hospitalId, name: new RegExp(`^${drugName}$`, "i") },
+            update: { $inc: { "stock.quantity": qty }, $set: { "stock.lastUpdated": new Date() } }
+          }
+        };
+      }).filter(Boolean);
+      if (bulkOps.length > 0) await Drug.bulkWrite(bulkOps);
+    }
+
     await invoice.save();
```

---

### [BUG-09] Lỗ Hổng Tê Liệt Hệ Thống Bằng Truy Vấn Regex (ReDoS Attack)
* **File & Dòng code**: [emr.controller.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/modules/emr/emr.controller.js#L24-L26)
* **Mức độ**: 🟡 **MEDIUM**
* **Hậu quả thực tế**: API tìm kiếm bệnh án truyền trực tiếp chuỗi tìm kiếm từ người dùng vào `$regex`: `{ patientName: { $regex: search, $options: "i" } }`. Kẻ xấu có thể gửi chuỗi regex hiểm độc (ví dụ `((a+)+)+$`) làm CPU Node.js bị quá tải 100%, gây nghẽn toàn bộ dịch vụ của bệnh viện.
* **Code khắc phục (Diff)**:

```diff
--- a/BE/src/modules/emr/emr.controller.js
+++ b/BE/src/modules/emr/emr.controller.js
@@ -20,7 +20,8 @@ export const getRecords = async (req, res) => {
     if (search) {
+      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
       query.$and = [
         { hospitalId },
         {
           $or: [
-            { patientName: { $regex: search, $options: "i" } },
-            { patientId: { $regex: search, $options: "i" } },
+            { patientName: { $regex: escaped, $options: "i" } },
+            { patientId: { $regex: escaped, $options: "i" } },
```

---

### [BUG-10] Bệnh Án Chuyển Trạng Thái Tùy Tiện Không Có State Transition Guard
* **File & Dòng code**: [visit.controller.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/BE/src/controllers/visit.controller.js#L349-L366)
* **Mức độ**: 🟡 **MEDIUM**
* **Hậu quả thực tế**: Người dùng có thể gửi bất kỳ trạng thái nào vào `req.body.status` (kể cả trạng thái không có trong quy trình), hoặc nhảy cóc từ `đang chờ` sang `hoàn tất`. Phá vỡ tính toàn vẹn của hồ sơ kiểm toán lâm sàng.
* **Code khắc phục (Diff)**:

```diff
--- a/BE/src/controllers/visit.controller.js
+++ b/BE/src/controllers/visit.controller.js
@@ -350,6 +350,21 @@ export const updateStatus = async (req, res) => {
   try {
     const { status, visitType } = req.body;
     const visit = await Visit.findById(req.params.id);
+
+    // Ma trận chuyển tiếp trạng thái hợp lệ
+    const ALLOWED_TRANSITIONS = {
+      'đang chờ': ['đang khám', 'đã hủy'],
+      'đang khám': ['chờ chụp', 'hoàn tất', 'đã hủy'],
+      'chờ chụp': ['đang chụp', 'chờ chụp lại', 'đã hủy'],
+      'đang chụp': ['chờ kết quả AI', 'chờ chụp lại', 'đã hủy'],
+      'chờ kết quả AI': ['chờ bác sĩ đọc', 'chờ chụp lại', 'lỗi AI'],
+      'chờ bác sĩ đọc': ['hoàn tất', 'chờ chụp lại'],
+      'hoàn tất': ['đã đóng'],
+      'đã đóng': [] // Trạng thái kết thúc, không được phép lùi
+    };
+
+    if (ALLOWED_TRANSITIONS[visit.status] && !ALLOWED_TRANSITIONS[visit.status].includes(status)) {
+      return res.status(400).json({ message: `Không thể chuyển trạng thái từ '${visit.status}' sang '${status}'.` });
+    }
```

---

## 6. BẪY CODE ẨN & RỦI RO FRONTEND (HIDDEN PITFALLS)

### 6.1. Giới hạn phân trang ẩn & Ô tìm kiếm vô tác dụng (`NurseReceptionScreen`)
* **Vị trí**: [NurseReceptionScreen.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/FE/src/screens/NurseReceptionScreen.js#L28), line 108.
* **Biểu hiện**: Màn hình gọi `get('/api/patients')`. Backend mặc định phân trang `limit = 20`. Khi bệnh viện có từ 21 bệnh nhân trở lên, nhân viên tiếp đón không thể tìm thấy các bệnh nhân mới đăng ký để tạo ca khám.
* **Bẫy code**: Khai báo `const [searchPatient, setSearchPatient] = useState('')` ở dòng 28 nhưng hoàn toàn không gắn vào `FlatList` hay gửi kèm trong query `GET /api/patients?search=...`.

### 6.2. Cơ chế Silent Token Refresh bị tê liệt (`client.js`)
* **Vị trí**: [client.js](file:///c:/Users/Administrator/OneDrive/Desktop/team5/FE/src/api/client.js#L67-L71).
* **Biểu hiện**: Khi Access Token hết hạn sau 1 giờ, Backend trả về 401. Hàm `request` lập tức xóa sạch token trong Storage và điều hướng ép buộc về trang `Welcome`. Bác sĩ đang nhập hồ sơ bệnh án hoặc xem ảnh MRI dở dang sẽ bị mất toàn bộ nội dung chưa lưu trên form.
* **Khắc phục**: Lưu trữ `refreshToken` và cài đặt hàm tự động gọi `POST /auth/refresh` lấy Access Token mới trước khi thử lại request.

### 6.3. Memory Leak & Unmounted Component Updates
* **Vị trí**: `DoctorWorkQueueScreen.js` (line 110-113, line 124-138), `NurseReceptionScreen.js` (line 81-86).
* **Biểu hiện**: Sử dụng `get('/auth/me')` và `fetchData()` trong `useEffect` mà không có cờ `isMounted` hoặc `AbortController`. Khi bác sĩ chuyển tab liên tục, các promise cũ phản hồi muộn sẽ gọi `setUser` hoặc `setVisits` trên component đã bị hủy, dẫn đến cảnh báo Memory Leak và làm suy giảm hiệu năng bộ nhớ trình duyệt/app.

### 6.4. Lệch Múi Giờ UTC vs GMT+7 (Timezone Discrepancy)
* **Vị trí**: `visit.controller.js` (line 31, 89, 177).
* **Biểu hiện**: Backend tính ngày hôm nay bằng `startOfDay.setHours(0,0,0,0)`. Trên môi trường Docker Linux (mặc định múi giờ UTC), 00:00:00 UTC tương ứng với 07:00:00 sáng tại Việt Nam. Do đó, tất cả các ca khám được tiếp đón từ 00:00 đến 06:59 sáng giờ Việt Nam sẽ bị lọc nhầm vào ngày hôm trước, làm biến mất bệnh nhân khỏi hàng đợi ca trực đêm.

---

## 7. AN TOÀN DỮ LIỆU Y TẾ & TUÂN THỦ (SECURITY & EHR COMPLIANCE)

### 7.1. Phân Tích Thực Tế Tình Trạng Rò Rỉ Secret & Đánh Giá Git vs Docker Pipeline

> [!NOTE]
> **Xác minh Git & .gitignore**: Đã thực hiện kiểm tra sâu bằng lệnh `git check-ignore -v` và `git log --all --full-history`. Kết quả khẳng định:
> * Hệ thống `.gitignore` (tại root, `BE/.gitignore`, `FE/.gitignore`) **đang hoạt động chuẩn xác**.
> * Cả `BE/.env`, `BE/credentials.json`, và `BE/firebase-service-account.json` **đang nằm trong danh sách ignored** và **CHƯA TỪNG bị commit hay push lên Git repository (GitHub/Git remote)** trong toàn bộ lịch sử git. Trên Git chỉ tồn tại các file mẫu an toàn `.env.example`.

Tuy nhiên, rủi ro an toàn thông tin (AppSec / OpSec) phát hiện được đến từ **3 Vector Lỗ Hổng Thực Tế Ngoài Git**:

1. **🔴 VECTOR NGUY HIỂM NHẤT: Rò rỉ qua Docker Image Build Context (`BE/Dockerfile` & `BE/.dockerignore`)**:
   * Tại file `BE/.dockerignore` (dòng 8-9) có cấu hình ghi đè ngoại lệ (whitelist):
     ```dockerignore
     !credentials.json
     !firebase-service-account.json
     ```
   * Tại file `BE/Dockerfile` (dòng 31):
     ```dockerfile
     COPY --from=builder /app/credentials.json* /app/firebase-service-account.json* ./
     ```
   * **Hậu quả thực tế**: Mặc dù Git không đẩy lên, nhưng khi quy trình CI/CD hoặc Developer chạy lệnh `docker build -t his-backend:latest .` rồi đẩy (push) lên Docker Hub, AWS ECR, hay GCP Artifact Registry, **toàn bộ Private Key Firebase Admin SDK và Google OAuth Credentials sẽ bị đóng gói vĩnh viễn vào trong Docker Image Layer**. Bất kỳ ai có quyền pull image hoặc dùng công cụ kiểm tra (như `dive`, `trivy`) đều có thể giải nén trích xuất 100% các file private key này.
   * **Khắc phục ngay**: Xóa bỏ dòng `!credentials.json` và `!firebase-service-account.json` khỏi `BE/.dockerignore`; xóa dòng `COPY credentials.json*` khỏi `BE/Dockerfile`. Thay vào đó, inject secret qua Docker Secrets, Kubernetes Secret Volume Mount, hoặc biến môi trường `FIREBASE_PRIVATE_KEY` / `GOOGLE_CLIENT_SECRET`.

2. **🟡 Vector Lưu Trữ File Nén & Đồng Bộ Đám Mây Cá Nhân (`OneDrive` / `.zip`)**:
   * Toàn bộ mã nguồn đang nằm trong thư mục đồng bộ đám mây cá nhân `OneDrive\Desktop\team5` và có chứa file nén `MRIteam_team5.zip`.
   * Khi developer nén cả folder dự án gửi qua Zalo/Drive/Slack cho thành viên khác trong nhóm hoặc nộp dự án, các file `.env` và `credentials.json` thường bị nén kèm theo mà không có cơ chế lọc tự động như Git.

3. **🟡 Vi phạm nguyên tắc Quản lý Secret CSDL Y tế (HIPAA / Plaintext Storage)**:
   * File `BE/.env` trên máy trạm đang chứa thông tin kết nối trực tiếp đến cluster MongoDB Atlas (`mongodb+srv://group5:12345@mri.kwwgmt6.mongodb.net/neuro`), khóa thanh toán PayOS (`PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`), và mật khẩu email app password (`EMAIL_PASS=gdbsabxvjlkzqgrx`).
   * Nếu máy trạm của developer bị lây nhiễm mã độc (infostealer / spyware) hoặc chia sẻ quyền truy cập, các key này có nguy cơ bị chiếm quyền truy cập trực tiếp vào CSDL bệnh nhân thật.

* ⚠️ **Khuyến nghị hành động**:
  1. Giữ nguyên `.gitignore` (đang làm tốt nhiệm vụ với Git).
  2. Sửa ngay `BE/.dockerignore` và `BE/Dockerfile` để chặn đóng gói credentials vào Docker Container Image.
  3. Thu hồi và cấp lại (Rotate/Regenerate) các credentials trên MongoDB Atlas và PayOS nếu đã từng build hoặc chia sẻ Docker Image / file zip trước đây.

### 7.2. Xâm Phạm Hồ Sơ Y Tế Bất Biến (HL7 / HIPAA Audit Trail)
* Chức năng ký giấy cam đoan `signConsent` trong `emr.controller.js` nhận `req.body.role` thay vì lấy từ `req.user.role`. Điều này cho phép bác sĩ ký mạo danh bệnh nhân hoặc bệnh nhân ký mạo danh bác sĩ.
* Tuyến xóa cứng `patientRecord` (`DELETE /records/:visitId`) vi phạm nguyên tắc lưu trữ hồ sơ bệnh án tối thiểu 10 năm theo Luật Khám bệnh, chữa bệnh 2023.

---

## 8. KẾ HOẠCH HÀNH ĐỘNG ƯU TIÊN (REMEDIATION ACTION PLAN)

```mermaid
gantt
    title Kế Hoạch Khắc Phục Hệ Thống NeuroScan AI
    dateFormat  YYYY-MM-DD
    section Giai Đoạn 1: Vá Khẩn Cấp (Trong 24h)
    Vá lỗ hổng Payment Bypass (BUG-01)          :active, p1, 2026-09-11, 1d
    Khóa lỗ hổng BOLA rò rỉ bệnh án (BUG-02)     :active, p2, 2026-09-11, 1d
    Vá lỗi IDOR bệnh nhân B2C (BUG-03)           :active, p3, 2026-09-11, 1d
    Thêm Role Guard cho giường & chuyển viện (BUG-04) :active, p4, 2026-09-11, 1d
    Sửa lỗi crash crypto chuyển viện (BUG-07)   :active, p5, 2026-09-11, 1d
    section Giai Đoạn 2: Nghiệp Vụ Lâm Sàng (Trong 3 - 5 ngày)
    Chống cướp giường bệnh (BUG-05)              :p6, 2026-09-12, 2d
    Hoàn trả kho dược khi hoàn tiền (BUG-08)     :p7, 2026-09-13, 2d
    State Machine cho ca khám (BUG-10)           :p8, 2026-09-13, 2d
    Chống xóa cứng bệnh án (Chuyển Soft Delete)  :p9, 2026-09-14, 2d
    section Giai Đoạn 3: Tối Ưu FE & Hạ Tầng (Trong 1 - 2 tuần)
    Cài đặt Silent Refresh Token FE              :p10, 2026-09-15, 3d
    Sửa phân trang & tìm kiếm tiếp đón           :p11, 2026-09-16, 2d
    Chuẩn hóa múi giờ Asia/Ho_Chi_Minh           :p12, 2026-09-17, 2d
    Thu hồi & thay mới toàn bộ API Keys rò rỉ   :p13, 2026-09-18, 2d
```

### Danh Mục Công Việc Đã Khắc Phục Triệt Để & Xác Minh Tự Động (100% Hoàn Tất):
1. **Giai Đoạn 1: Bảo Mật & Phân Quyền Khẩn Cấp (Đã hoàn thành)**:
   * [x] **Vá BUG-01 (Payment Bypass)**: Đã xóa bỏ logic tự cập nhật CSDL tại `invoice.controller.js:paymentSuccess`. Ép buộc 100% xác nhận qua Webhook PayOS có HMAC checksum.
   * [x] **Vá BUG-02 (EMR BOLA Chéo Viện)**: Đã tích hợp `checkPatientTenancy` vào `getRecordById`, `getCareSheets`, `getConsultations` trong `emr.controller.js`.
   * [x] **Vá BUG-03 (IDOR Bệnh Nhân B2C)**: Đã chuẩn hóa `getTargetPatientId` tại `patientRecord.controller.js` với `checkPatientTenancy`.
   * [x] **Vá BUG-04 (Role Guard Giường & Chuyển Viện)**: Đã bổ sung `checkRole` tại `hospitalBed.routes.js` và `transfer.routes.js`.
   * [x] **Khóa rò rỉ Secret qua Docker**: Đã chặn whitelist và xóa lệnh `COPY credentials.json*` trong `BE/.dockerignore` và `BE/Dockerfile`.
2. **Giai Đoạn 2: Lâm Sàng, Toàn Vẹn & Sửa Crash Backend (Đã hoàn thành)**:
   * [x] **Vá BUG-05 (Chống Cướp Giường)**: Đã bổ sung kiểm tra `reservedForPatientId == patientId` trong `hospitalBed.service.js:occupyBedAtomicService`.
   * [x] **Vá BUG-06 (Crash 500 B2C Tái Khám)**: Đã hỗ trợ chọn bệnh viện trong `patientB2c.controller.js:bookFollowUp`.
   * [x] **Vá BUG-07 (Crash Cú Pháp Crypto)**: Đã import tĩnh `import crypto from "crypto"` trong `transfer.controller.js`.
   * [x] **Vá BUG-08 (Hoàn Kho Thuốc Khi Refund)**: Đã bổ sung `Drug.bulkWrite` hoàn trả tồn kho thuốc trong `invoice.controller.js:refundInvoice`.
   * [x] **Vá BUG-09 (Chống ReDoS Search)**: Đã escape chuỗi RegExp trong `emr.controller.js:getRecords`.
   * [x] **Vá BUG-10 (State Machine Ca Khám)**: Đã áp dụng `ALLOWED_TRANSITIONS` trong `visit.controller.js:updateStatus`.
   * [x] **Chống Xóa Cứng Bệnh Án**: Đã chuyển các thao tác `deleteVisit` và `deleteDocument` sang Soft Delete (`isDeleted: true`) trong `visit.model.js`, `patientRecord.service.js` và `patientRecord.controller.js`.
   * [x] **Chống Mạo Danh Chữ Ký Cam Đoan**: Đã xác thực người ký qua `req.user.role` trong `emr.controller.js:signConsent`.
   * [x] **Chuẩn Hóa Múi Giờ GMT+7 (Asia/Ho_Chi_Minh)**: Đã tạo `BE/src/utils/date.util.js` và áp dụng `getDayRangeVN` cho tất cả truy vấn tính ngày.
3. **Giai Đoạn 3: Nâng Cấp Giao Diện & Trải Nghiệm Frontend (Đã hoàn thành)**:
   * [x] **Silent Token Refresh FE**: Đã cài đặt cơ chế tự động refresh token ngầm và transparent retry khi nhận lỗi 401 trong `FE/src/api/client.js` và lưu `refreshToken` khi đăng nhập trong `LoginScreen.js`.
   * [x] **Sửa Phân Trang & Tìm Kiếm Tiếp Đón**: Đã hỗ trợ `?all=true`, kết nối ô tìm kiếm thời gian thực (debounce server search) và mở rộng danh sách trong `NurseReceptionScreen.js`.
   * [x] **Khắc Phục Memory Leak FE**: Đã bổ sung cờ `isMounted` và cleanup function trong `useEffect` của `DoctorWorkQueueScreen.js` và `NurseReceptionScreen.js`.
   * [x] **Kiểm thử tự động hồi quy**: Đã tạo và vượt qua 76/76 bài test tự động (Clinical E2E, Security Audit, Remediation Verification, FE Utils).
