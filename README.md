# 🏏 🍲 IPL Dhaba — Enterprise Super App & Operations Suite

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?logo=react)](https://react.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-11.1-e0234e.svg?logo=nestjs)](https://nestjs.com/)
[![Firebase Auth](https://img.shields.io/badge/Firebase_Auth-Phone_OTP-ffca28.svg?logo=firebase)](https://firebase.google.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748.svg?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Neon_PostgreSQL-16-336791.svg?logo=postgresql)](https://neon.tech/)
[![Redis](https://img.shields.io/badge/Upstash_Redis-7-dc382d.svg?logo=redis)](https://upstash.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**IPL Dhaba Super App** is an all-in-one platform for dhaba food ordering, IPL box turf cricket slot bookings, event celebrations, and operational merchant tools (Kitchen KDS, Driver Live Tracking, and Admin Portal).

It features a **Vite + React 19** frontend, **NestJS 11** microservices-ready backend, **Firebase Phone Authentication**, **Neon Cloud PostgreSQL**, and **Upstash Redis** caching & BullMQ event streaming.

---



## 🔥 Key Features

### 🍲 1. Dhaba Food Ordering
- Multi-category food menu (Biryani, Tandoori, Curries, Beverages, Match Combos)
- Custom cooking instructions, delivery target selection (Pitch-side Bench, Turf Cage, Table)
- Real-time Server-Sent Events (SSE) status stream (`Placed` → `Preparing` → `Out for Delivery` → `Delivered`)
- Live Driver GPS tracking with map visualization and heading updates

### 🏏 2. IPL Box Turf Booking
- Floodlit evening & prime cricket slot booking system
- Atomic Redis concurrency lock preventing double bookings
- QR Code **GatePass Token** generation (`GATEPASS-TB...`) for instant gate validation
- Add-on services: GoPro match recording, ball boys, umpire assignment

### 🎉 3. Celebrations & Birthday Party Packages
- Pitch-side IPL match screening packages
- Birthday bash setups, custom catering options, and advance reservation manager

### 🔐 4. Firebase Phone Authentication
- **Client-Side**: Firebase Web SDK with invisible reCAPTCHA and SMS OTP delivery
- **Backend Verification**: Firebase Admin SDK cryptographically verifies ID tokens via `POST /api/v1/auth/firebase`
- **Identity Linking**: Automatic linking of `firebaseUid` with existing phone accounts in PostgreSQL
- **Role Security**: Customers default to `customer` role; operational staff log in securely via 4-digit PIN

### 💰 5. Fan Rewards & Digital Wallet
- Instant UPI wallet top-ups (Razorpay integration ready)
- 10% Fan Cashback bonus on top-ups and 5% on orders
- Internal ledger transaction history with reference correlation IDs

---

## 🏛 System Architecture

```text
                                  ┌─────────────────────────────────┐
                                  │      Firebase Auth Server       │
                                  └────────────────┬────────────────┘
                                                   │ Verify SMS OTP
┌───────────────────────────────┐                  │ & Issue ID Token
│   Vite + React 19 Frontend    ├──────────────────┘
│  (Consumer, KDS, Admin, Driver)│
└──────────────┬────────────────┘
               │ HTTP REST / SSE Stream
               ▼
┌───────────────────────────────┐
│     NestJS 11 API Backend     │◄─── Firebase Admin SDK (Verify ID Token)
│   (Passport JWT, Guard Scope) │
└──────┬──────────────┬─────────┘
       │              │
       ▼              ▼
┌──────────────┐ ┌──────────────┐
│  Neon Cloud  │ │Upstash Redis │
│ PostgreSQL16 │ │ Cache & Queue│
│ (Prisma ORM) │ │  (BullMQ)    │
└──────────────┘ └──────────────┘
```

---

## 🛠 Tech Stack

- **Frontend**: Vite 6, React 19, TypeScript 5.8, Tailwind CSS v4, Framer Motion 12, Lucide Icons
- **Backend Framework**: NestJS 11, Express, RxJS, class-validator, class-transformer
- **Database & ORM**: PostgreSQL 16 (Neon Cloud), Prisma ORM 5.22
- **Caching & Realtime**: Upstash Redis Cloud 7, BullMQ 6, Socket.IO 4
- **Authentication**: Firebase Auth (Phone Provider), Firebase Admin SDK 12, Passport JWT (15m Access / 7d Refresh)
- **Containerization & Cloud**: Docker, Docker Compose, Kubernetes manifests, Helm Charts

---

## 🚀 Quickstart — Run Locally

### 1. Prerequisites
- Node.js (v20+ LTS recommended)
- npm (v10+)
- PostgreSQL or Neon Database URL
- Upstash Redis URL (optional, in-memory fallback enabled)

### 2. Clone & Install
```bash
git clone https://github.com/Shxam/MobileApp.git
cd MobileApp
npm install
```

### 3. Setup Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure your `.env` contains your Neon PostgreSQL connection string and Firebase config:
```env
# Node Environment
NODE_ENV=development
PORT=3001

# Neon Database
DATABASE_URL="postgresql://user:pass@ep-solitary-thunder.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Firebase Admin SDK (Backend Private)
GOOGLE_APPLICATION_CREDENTIALS=firebase-service-account.json
FIREBASE_PROJECT_ID=ipldhaba
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@ipldhaba.iam.gserviceaccount.com

# Firebase Web Client SDK (Public Frontend)
VITE_FIREBASE_API_KEY=AIzaSyDemoApiKeyForIPLDhabaApp2026
VITE_FIREBASE_AUTH_DOMAIN=ipldhaba.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ipldhaba
VITE_FIREBASE_STORAGE_BUCKET=ipldhaba.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=115362447382
VITE_FIREBASE_APP_ID=1:115362447382:web:demoappkey123
```

### 4. Database Setup & Sync
```bash
npx prisma db push
```

### 5. Launch Development Services
Run all applications in parallel or individually:

```bash
# Start Customer Mobile App (Port 3000)
npm run dev

# Start NestJS API Backend (Port 3001)
npm run dev:backend

# Start Kitchen KDS App (Port 3002)
npm run dev:kds

# Start Admin Dashboard (Port 3003)
npm run dev:admin

# Start Driver Tracker App (Port 3004)
npm run dev:driver
```

---

## 🧪 Testing & Verification

```bash
# Run TypeScript compilation check
npm run lint

# Run Jest unit & integration tests
npm test
```

### Automated Test Coverage
- **Auth Integration**: Firebase Token authentication, JWT token issuance, token refresh rotation, and Redis blocklist logout verification
- **Core Domain Integration**: Menu caching, atomic turf slot reservation locking, food order lifecycle, and internal wallet ledger deductions

---

## 📡 API Contract & Health Check

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/health` | System health check (DB, Redis, Firebase status) | Public |
| `POST` | `/api/v1/auth/firebase` | Exchange Firebase ID Token for IPL Dhaba JWT pair | Public |
| `POST` | `/api/v1/auth/staff-login` | Staff PIN login (`KITCHEN-001`, `DELIVERY-001`, `ADMIN-001`) | Public |
| `POST` | `/api/v1/auth/refresh` | Rotate JWT Refresh Token | Public |
| `POST` | `/api/v1/auth/logout` | Revoke tokens & blocklist in Redis | Bearer JWT |
| `GET` | `/api/v1/menu` | Fetch food menu with category filter | Public / Bearer |
| `POST` | `/api/v1/orders` | Place new food order with delivery target | Bearer JWT |
| `GET` | `/api/v1/orders/:id/tracking-stream` | Real-time SSE status & driver GPS location stream | Bearer JWT |
| `GET` | `/api/v1/bookings/slots` | Fetch available box turf slots | Public / Bearer |
| `POST` | `/api/v1/bookings` | Book turf slot with atomic lock & generate GatePass QR | Bearer JWT |
| `POST` | `/api/v1/wallet/topup` | Credit fan wallet with UPI top-up | Bearer JWT |

---

## 🐳 Containerization & Kubernetes

### Docker Compose
```bash
docker-compose up --build -d
```

### Helm Deployment (Kubernetes)
```bash
helm upgrade --install ipl-dhaba-backend ./deploy/helm/ipl-dhaba-backend \
  --namespace ipl-dhaba \
  --create-namespace \
  -f ./deploy/helm/ipl-dhaba-backend/values.yaml
```

---

## 📂 Repository Directory Structure

```text
├── apps/
│   ├── admin/                # Merchant & Admin Console (Port 3003)
│   ├── backend/              # NestJS 11 Core API (Port 3001)
│   │   ├── src/
│   │   │   ├── common/       # Prisma, Redis, Firebase Admin modules
│   │   │   ├── health/       # Health checks (/health)
│   │   │   └── modules/      # Auth, Menu, Orders, Bookings, Wallet, Admin
│   ├── driver/               # Delivery Partner GPS Tracker (Port 3004)
│   ├── kitchen-kds/          # Kitchen Display System (Port 3002)
│   └── mobile/               # Mobile Fastlane & Native configs
├── deploy/                   # Kubernetes Manifests & Helm Charts
├── docs/                     # Firebase Auth & System Guides
├── prisma/                   # Schema, Migrations & Seeds
├── src/                      # Customer Super App (Vite + React 19)
│   ├── components/           # UI Components, Modals, Navigation
│   ├── context/              # AppContext state engine
│   ├── services/             # Firebase SDK, API Client, Event Stream
│   └── views/                # Home, Food, Turfs, Celebrations, Wallet Views
└── README.md
```

---

## 📄 License & Credits

- **Built by**: IPL Dhaba Development Team
- **License**: MIT License
