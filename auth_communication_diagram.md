# Unified Authentication Communication Diagram (Biểu đồ Giao tiếp tổng thể phần Authentication)

Tài liệu này cung cấp **Communication Diagram** (Biểu đồ Giao tiếp/Cộng tác) tổng thể cho phân hệ Authentication của dự án. Biểu đồ này được xây dựng bằng cách kết hợp:
1. **Luồng điều hướng** từ [Activity Diagram](hình_a) (liên kết Đăng ký -> Đăng nhập -> SSO -> Quên mật khẩu -> Điều hướng theo Vai trò).
2. **Cấu trúc lớp** từ [Class Diagram](hình_b) (sử dụng các lớp `AuthMiddleware`, `User`, `Hospital`, `AuditLog`).
3. **Các thông điệp chi tiết** từ [Sequence Diagram](auth_sequence_diagram.md).

---

## 1. Bản vẽ dạng Mermaid (Hiển thị trực quan trong IDE)

```mermaid
graph TD
    %% Định nghĩa các lớp Node
    classDef actorStyle fill:#e6f2ff,stroke:#0066cc,stroke-width:2px,rx:10px;
    classDef boundaryStyle fill:#fff0f5,stroke:#cc0066,stroke-width:2px;
    classDef controlStyle fill:#f0fff0,stroke:#00cc66,stroke-width:2px;
    classDef entityStyle fill:#fffae6,stroke:#e6b800,stroke-width:2px;
    
    %% Định nghĩa các đối tượng (Objects)
    User((Patient / User)):::actorStyle
    FE["FE: Auth Screens<br/>(Register, Login, Forgot Modal)"]:::boundaryStyle
    Firebase["Firebase Auth<br/>(SSO Provider)"]:::boundaryStyle
    Middleware["AuthMiddleware<br/>(protect, checkRole)"]:::controlStyle
    Controller["AuthController<br/>(register, login, sso, reset)"]:::controlStyle
    Email["EmailService<br/>(sendOtpEmail)"]:::controlStyle
    
    %% Các Entity đại diện cho Database/Models
    UserModel["User (Model)<br/>(email, phone, role, isLocked, verifyOTP)"]:::entityStyle
    HospitalModel["Hospital (Model)<br/>(code, taxCode, plan)"]:::entityStyle
    AuditLogModel["AuditLog (Model)<br/>(action, entity, performedBy)"]:::entityStyle

    %% Thiết lập các kết nối giao tiếp (Communication Links)
    User <--> |"1.1: enterRegistrationInfo()<br/>2.1: enterLoginCredentials()<br/>3.1: clickLoginWithGoogle()<br/>4.1: enterEmail()<br/>4.9: enterOtpAndNewPassword()"| FE
    
    FE <----> |"3.2: signInWithGoogleWeb()"| Firebase
    
    FE <--> |"1.2: POST /auth/register<br/>2.2: POST /auth/login<br/>3.3: POST /auth/sso/google {idToken}<br/>4.2: POST /auth/forgot-password {email}<br/>4.10: POST /auth/verify-otp {otp, pass}"| Middleware
    
    Middleware <--> |"1.3: register(req, res)<br/>2.3: login(req, res)<br/>3.4: ssoLogin(req, res)<br/>4.3: forgotPassword(req, res)<br/>4.11: verifyOtpAndReset(req, res)"| Controller
    
    Controller <--> |"1.4: findOne({email})<br/>1.6: new User().save()<br/>2.5a: User.findOne({hospitalId})<br/>2.4b: User.findOne({email/phone})<br/>3.6: User.findOne({email})<br/>3.7: new User().save()<br/>4.5: Otp.create()<br/>4.12: Otp.findOne()<br/>4.14: User.updateOne()"| UserModel
    
    Controller <----> |"2.4a: Hospital.findOne({code})"| HospitalModel
    
    Controller <--> |"1.7: writeAuditLog('REGISTER')<br/>2.8: writeAuditLog('LOGIN')<br/>3.9: writeAuditLog('SSO_LOGIN')<br/>4.15: writeAuditLog('RESET_PASSWORD')"| AuditLogModel
    
    Controller <--> |"4.6: sendOtpEmail(email, code)"| Email
    
    Email -.-> |"4.7: Send email containing OTP"| User

    %% CSS tùy biến
    linkStyle default stroke:#555,stroke-width:1px;
```

---

## 2. Bản vẽ dạng PlantUML (Đầy đủ chú thích chuẩn hóa)

Bạn có thể sao chép đoạn mã PlantUML dưới đây để kết xuất sơ đồ giao tiếp dạng lưới phẳng:

```puml
@startuml
skinparam linetype ortho
skinparam nodesep 80
skinparam ranksep 80
skinparam actorBackgroundcolor #e6f2ff
skinparam rectangleBackgroundcolor #ffffff
skinparam databaseBackgroundcolor #fffae6

actor "Patient / User" as User
rectangle "FE: Auth Screens" as FE
rectangle "Firebase Auth" as Firebase
rectangle "EmailService" as Email
rectangle "AuthMiddleware" as Middleware
database "User (Model)" as UserModel
rectangle "AuthController" as Controller
database "Hospital (Model)" as HospitalModel
database "AuditLog (Model)" as AuditLogModel

' THIẾT LẬP VỊ TRÍ TƯƠNG ĐỐI (GRID LAYOUT VIA HIDDEN LINKS)
User -[hidden]right-> FE
User -[hidden]down-> Email
FE -[hidden]down-> Middleware
Email -[hidden]down-> UserModel
Middleware -[hidden]down-> Controller
Controller -[hidden]down-> AuditLogModel

' LƯU ĐỒ GIAO TIẾP VỚI TÊN HÀM RÚT GỌN (COMMUNICATION LINKS WITH SIMPLIFIED METHOD NAMES)
User -right----> FE : 1.1: registerInfo()\n2.1: loginCreds()\n3.1: googleLogin()\n4.1: enterEmail()\n4.9: enterOtpAndNewPass()\n\n

FE -right----------> Firebase : 3.2: signInWithGoogle()

FE -down---> Middleware : 1.2: POST /register\n2.2: POST /login\n3.3: POST /sso/google\n4.2: POST /forgot-password\n4.10: POST /verify-otp

Middleware -down---> Controller : 1.3: register()\n2.3: login()\n3.4: ssoLogin()\n4.3: forgotPassword()\n4.11: verifyOtpAndReset()

Controller -left------> UserModel : 1.4: findUser()\n1.6: createUser()\n2.5a: findHospitalAdmin()\n2.4b: findUserByCreds()\n3.6: findUserByEmail()\n3.7: createUser()\n4.5: createOtp()\n4.12: findOtp()\n4.14: updatePassword()

Controller -right---------> HospitalModel : 2.4a: findHospital()

Controller -down---> AuditLogModel : 1.7, 2.8, 3.9, 4.15:\nwriteAuditLog()

Controller -up----> Email : 4.6: sendOtpEmail()
Email .up----> User : 4.7: Send OTP Email

@endum
```

---

## 3. Bảng tra cứu thông điệp (Message Legend)

Để sơ đồ PlantUML không bị chồng chéo chữ, các đường liên kết được đánh số thứ tự tương ứng với các lời gọi hàm dưới đây:

| Mã số | Lời gọi hàm / Thông điệp | Nguồn $\to$ Đích | Chi tiết Use Case |
| :--- | :--- | :--- | :--- |
| **1.1** | `enterRegistrationInfo()` | User $\to$ FE | **UC-01**: Patient Registration |
| **1.2** | `POST /auth/register` | FE $\to$ Middleware | **UC-01**: Patient Registration |
| **1.3** | `register(req, res)` | Middleware $\to$ Controller | **UC-01**: Patient Registration |
| **1.4** | `findOne({email})` | Controller $\to$ User (Model) | **UC-01**: Patient Registration |
| **1.6** | `new User({...}).save()` | Controller $\to$ User (Model) | **UC-01**: Patient Registration |
| **1.7** | `writeAuditLog('REGISTER')` | Controller $\to$ AuditLog | **UC-01**: Patient Registration |
| **2.1** | `enterLoginCredentials()` | User $\to$ FE | **UC-02**: User Login |
| **2.2** | `POST /auth/login` | FE $\to$ Middleware | **UC-02**: User Login |
| **2.3** | `login(req, res)` | Middleware $\to$ Controller | **UC-02**: User Login |
| **2.4a** | `Hospital.findOne({code})` | Controller $\to$ Hospital | **UC-02**: User Login (Mã bệnh viện) |
| **2.4b** | `User.findOne({$or: [email, phone]})`| Controller $\to$ User (Model) | **UC-02**: User Login (Email/SĐT) |
| **2.5a** | `User.findOne({hospitalId})` | Controller $\to$ User (Model) | **UC-02**: User Login (Mã bệnh viện) |
| **2.8** | `writeAuditLog('LOGIN')` | Controller $\to$ AuditLog | **UC-02**: User Login |
| **3.1** | `clickLoginWithGoogle()` | User $\to$ FE | **UC-03**: SSO Login |
| **3.2** | `signInWithGoogleWeb()` | FE $\to$ Firebase | **UC-03**: SSO Login |
| **3.3** | `POST /auth/sso/google {idToken}` | FE $\to$ Middleware | **UC-03**: SSO Login |
| **3.4** | `ssoLogin(req, res)` | Middleware $\to$ Controller | **UC-03**: SSO Login |
| **3.6** | `User.findOne({email})` | Controller $\to$ User (Model) | **UC-03**: SSO Login |
| **3.7** | `new User({role: 'patient'}).save()` | Controller $\to$ User (Model) | **UC-03**: SSO Login |
| **3.9** | `writeAuditLog('SSO_LOGIN')` | Controller $\to$ AuditLog | **UC-03**: SSO Login |
| **4.1** | `enterEmail()` (Forgot Modal) | User $\to$ FE | **UC-04**: Forgot Password |
| **4.2** | `POST /auth/forgot-password {email}`| FE $\to$ Middleware | **UC-04**: Forgot Password |
| **4.3** | `forgotPassword(req, res)` | Middleware $\to$ Controller | **UC-04**: Forgot Password |
| **4.5** | `Otp.create({email, code, expiresAt})`| Controller $\to$ User (Model) | **UC-04**: Forgot Password |
| **4.6** | `sendOtpEmail(email, code)` | Controller $\to$ EmailService | **UC-04**: Forgot Password |
| **4.7** | Gửi email chứa OTP | EmailService $\to$ User | **UC-04**: Forgot Password |
| **4.9** | `enterOtpAndNewPassword()` | User $\to$ FE | **UC-04**: Forgot Password |
| **4.10** | `POST /auth/verify-otp {otp, pass}` | FE $\to$ Middleware | **UC-04**: Forgot Password |
| **4.11** | `verifyOtpAndReset(req, res)` | Middleware $\to$ Controller | **UC-04**: Forgot Password |
| **4.12** | `Otp.findOne({email, code})` | Controller $\to$ User (Model) | **UC-04**: Forgot Password |
| **4.14** | `User.updateOne({email}, {password})`| Controller $\to$ User (Model) | **UC-04**: Forgot Password |
| **4.15** | `writeAuditLog('RESET_PASSWORD')` | Controller $\to$ AuditLog | **UC-04**: Forgot Password |


---

## 3. Bản chất ánh xạ từ Class Diagram và Activity Diagram

### Ánh xạ từ Class Diagram
1. **`AuthMiddleware`**: Đóng vai trò lớp chắn bảo vệ các Route và trung chuyển dữ liệu từ Frontend (`FE`) đến `AuthController`. Lớp này thực hiện kiểm tra mã token và định dạng dữ liệu đầu vào.
2. **`User` và `Hospital`**: Là các Entity chính. Khi `AuthController` tiếp nhận đăng ký hoặc đăng nhập:
   * Nếu có mã bệnh viện (`hospitalId`), Controller sẽ thực hiện kết nối sang lớp `Hospital` để lấy cấu hình bệnh viện và kiểm tra quyền admin.
   * Sử dụng hàm `login(creds)` và `verifyOTP(otp)` được đặc tả trực tiếp trong thực thể `User`.
3. **`AuditLog`**: Hệ thống gọi lớp tiện ích dùng chung để lưu vết mọi hành động thành công/thất bại của User nhằm phục vụ việc kiểm toán bảo mật.

### Ánh xạ từ Activity Diagram
* **Cơ chế rẽ nhánh (Decision / Alternative Flows)**: Luồng đi từ `User` qua màn `FE` được rẽ làm 4 luồng ứng với 4 lựa chọn của người dùng trong **Activity Diagram** (Chưa có tài khoản -> Đăng ký; Có tài khoản -> Chọn SSO Google hoặc Đăng nhập thường; Quên mật khẩu -> Gửi OTP). Mọi nhánh sau khi xác thực thành công đều quy tụ về bước sinh Token của hệ thống và điều hướng về Home theo vai trò.
