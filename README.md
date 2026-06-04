# MRI Project

Dự án gồm 2 phần: **FE** (Expo React Native) và **BE** (Node.js Express), tổ chức theo mô hình MVC.

---

## Cấu trúc dự án

```
mri/
├── FE/          ← Frontend (Expo React Native)
└── BE/          ← Backend (Node.js Express)
```

---

## BE — Node.js Express

### Cấu trúc thư mục

```
BE/
├── src/
│   ├── config/
│   │   └── db.js                     ← Cấu hình kết nối DB
│   ├── controllers/
│   │   └── example.controller.js     ← Xử lý request/response
│   ├── models/
│   │   └── example.model.js          ← Schema / tương tác dữ liệu
│   ├── routes/
│   │   ├── index.js                  ← Mount routes /api/v1
│   │   └── example.routes.js         ← Định nghĩa endpoints
│   ├── middlewares/
│   │   ├── auth.middleware.js         ← Xác thực token
│   │   └── error.middleware.js        ← Global error handler
│   ├── services/
│   │   └── example.service.js        ← Business logic
│   ├── utils/
│   │   └── response.util.js          ← Format JSON response chuẩn
│   └── index.js                      ← Entry point
├── .env
└── package.json
```

### Luồng xử lý

```
Request → routes/ → middlewares/ → controllers/ → services/ → models/ → DB
                                        ↓
Response ←──────────────────── controllers/
```

### Cài đặt & Chạy

```bash
cd BE
npm install
```

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Chạy development (nodemon, tự reload) |
| `npm start` | Chạy production |

Server mặc định chạy tại: `http://localhost:3000`

### Endpoints

| Method | URL | Mô tả |
|--------|-----|-------|
| GET | `/api/v1/` | Health check |
| GET | `/api/v1/examples` | Lấy tất cả |
| GET | `/api/v1/examples/:id` | Lấy theo ID |
| POST | `/api/v1/examples` | Tạo mới |
| PUT | `/api/v1/examples/:id` | Cập nhật |
| DELETE | `/api/v1/examples/:id` | Xoá |

### Biến môi trường (`.env`)

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mri_db
DB_USER=root
DB_PASSWORD=
```

---

## FE — Expo React Native

### Cấu trúc thư mục

```
FE/
├── src/
│   ├── screens/
│   │   └── HomeScreen.js             ← (View) Màn hình chính
│   ├── components/
│   │   └── Button.js                 ← (View) UI tái sử dụng
│   ├── controllers/
│   │   └── useHome.js                ← (Controller) Custom hook
│   ├── models/
│   │   └── User.js                   ← (Model) Cấu trúc data
│   ├── services/
│   │   └── api.service.js            ← (Model) Gọi API tới BE
│   ├── navigation/
│   │   └── AppNavigator.js           ← Cấu hình React Navigation
│   ├── constants/
│   │   ├── colors.js                 ← Bảng màu
│   │   └── config.js                 ← API_URL và hằng số app
│   └── utils/
│       └── format.js                 ← Helper functions
├── App.js                            ← Entry point
└── package.json
```

### Luồng xử lý

```
Screen (View) ←→ useXxx Hook (Controller) ←→ api.service.js (Model) ←→ BE API
```

### Cài đặt & Chạy

```bash
cd FE
npm install
```

| Lệnh | Nền tảng |
|------|----------|
| `npm start` | Mở Expo DevTools, chọn nền tảng |
| `npm run android` | Android (cần Android Studio hoặc thiết bị thật) |
| `npm run ios` | iOS (chỉ trên macOS) |
| `npm run web` | Trình duyệt web |

### Packages chính

| Package | Mô tả |
|---------|-------|
| `expo` ~56.0.8 | Framework chính |
| `react-native` 0.85.3 | UI framework |
| `@react-navigation/native` | Navigation |
| `@react-navigation/native-stack` | Stack navigator |
| `react-native-web` | Hỗ trợ chạy trên web |
