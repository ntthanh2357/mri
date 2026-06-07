# NeuroScan AI

Dự án NeuroScan AI được tổ chức dưới dạng monorepo sử dụng Turborepo và pnpm, và toàn bộ mã nguồn được viết bằng TypeScript.

## Cấu trúc thư mục

```
neuroscan-ai/
├── apps/                    # Các ứng dụng frontend
│   ├── patient/            # Ứng dụng dành cho bệnh nhân (Expo React Native)
│   ├── doctor/             # Ứng dụng dành cho bác sĩ (Expo React Native)
│   ├── admin/              # Ứng dụng quản trị (Expo React Native)
│   └── partner/            # Ứng dụng dành cho đối tác (Expo React Native)
├── packages/                # Các package chia sẻ
│   ├── ui/                 # Component UI dùng chung
│   ├── api/                # API client dùng chung
│   ├── auth/               # Logic xác thực dùng chung
│   ├── utils/              # Helper functions dùng chung
│   └── constants/          # Hằng số dùng chung (màu sắc, API URL,...)
├── backend/                 # Backend API (Node.js Express + TypeScript)
├── docs/                    # Tài liệu dự án
├── turbo.json               # Cấu hình Turborepo
├── pnpm-workspace.yaml     # Cấu hình pnpm workspace
└── package.json             # Package.json gốc
```

## Cài đặt

1. Cài đặt pnpm (nếu chưa):
   ```bash
   npm install -g pnpm
   ```

2. Cài đặt các dependencies ở thư mục gốc:
   ```bash
   pnpm install
   ```

## Chạy dự án

### Chạy backend
```bash
cd backend
pnpm dev
```

### Chạy một ứng dụng frontend (ví dụ: patient)
```bash
cd apps/patient
pnpm start
# Hoặc chạy trên nền tảng cụ thể:
pnpm android
pnpm ios
pnpm web
```

### Chạy tất cả các ứng dụng cùng lúc bằng Turbo
```bash
pnpm dev
```

## Lệnh hữu ích
- `pnpm build`: Build toàn bộ dự án
- `pnpm clean`: Xóa các file build
- `pnpm lint`: Kiểm tra lint toàn bộ dự án
