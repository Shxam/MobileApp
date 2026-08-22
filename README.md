<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Outfit&size=38&duration=2500&pause=1000&color=F59E0B&center=true&vCenter=true&width=800&height=70&lines=%F0%9F%8F%8F+%F0%9F%8D%B2+IPL+Dhaba+Super+App+%26+Operations+Suite;Food+Delivery+%E2%80%A2+Turf+Bookings+%E2%80%A2+Live+Scores;5+Apps+%E2%80%A2+1+NestJS+API+%E2%80%A2+Real-time+Socket.io" alt="IPL Dhaba Super App Banner" />
</p>

<p align="center">
  <i>A high-performance, cricket-themed super app & multi-app operational suite for Singarayakonda, Andhra Pradesh.</i>
</p>

<p align="center">
  <a href="#-architectural-overview"><img src="https://img.shields.io/badge/TypeScript-5.8-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/React-19.0-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/NestJS-11.0-E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS 11" /></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/Prisma-5.22-2D3748.svg?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma ORM" /></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/PostgreSQL-16.0-4169E1.svg?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/Redis-Upstash-DC382D.svg?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" /></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/Tailwind-CSS_4-06B6D4.svg?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" /></a>
  <a href="#-security--ci"><img src="https://img.shields.io/badge/Security-Strix_AI_Pentest-8B5CF6.svg?style=for-the-badge&logo=githubactions&logoColor=white" alt="Security Scan" /></a>
</p>

<p align="center">
  <a href="#-quick-start">⚡ Quick Start</a> •
  <a href="#-multi-app-ecosystem">📱 Applications</a> •
  <a href="#-architectural-overview">🏗️ Architecture</a> •
  <a href="#-security--ci">🛡️ Security</a> •
  <a href="#-deployment-guide">🚀 Deployment</a>
</p>

---

## 🌟 Key Highlights & Features

- 🏏 **Live IPL Cricket Scores:** Integrated real-time match carousel and dynamic score tracking.
- 🍲 **Food Delivery & Dhaba Dining:** Full menu ordering, pitch-side bench delivery, party celebration quotes, and dynamic vouchers (`IPL10`, `SIXER`, `HATTRICK`).
- 🏟️ **Floodlit Box-Turf Bookings:** Real-time slot locking via Redis `SET NX PX`, gate-pass QR generation, add-on rentals (GoPro, umpires, ball boys).
- 💰 **Paise-Integer Financial Precision:** Every financial column is stored as integer paise (`totalAmountPaise`, `balancePaise`), eliminating floating-point rounding errors.
- 🔐 **OTP-Closed Security Delivery:** Delivery partners must verify customer OTP (bcrypt-hashed server-side) before completing an order.
- ⚡ **Atomic Concurrency Protection:** Conditional updates at the database level prevent race conditions between delivery drivers and booking slots.

---

## 📱 Multi-App Ecosystem

One NestJS API powering five dedicated applications across the business:

| Application | Persona / User | Port | Core Responsibilities | Source Path |
| :--- | :--- | :---: | :--- | :--- |
| 🛒 **Customer Super App** | Diners & Turf Players | `3000` | Food ordering, turf booking, party quotes, wallet top-up, live match scores | `src/` |
| ⚡ **NestJS API Engine** | System Backend | `3001` | JWT Auth, Prisma ORM, Socket.io Gateway, Razorpay payments, Dispatch logic | `apps/backend/` |
| 🍳 **Kitchen KDS** | Chefs & Kitchen Staff | `3002` | Live order queue display, status workflow transitions (`accepted` ➔ `ready`) | `apps/kitchen-kds/` |
| ⚙️ **Admin Control Center** | Business Owner / Manager | `3003` | Real-time analytics, menu management, staff unlocking, booking overrides | `apps/admin/` |
| 🛵 **Driver Tracker** | Delivery Partners | `3004` | Order claim queue, turn-by-turn route tracking, OTP delivery verification | `apps/driver/` |

---

## 🏗️ Architectural Overview

```mermaid
graph TD
    subgraph Frontends ["📱 Multi-App Frontends (Vite 6 + React 19 + Tailwind CSS 4)"]
        CA["Customer Super App\n(Port 3000)"]
        KDS["Kitchen Display (KDS)\n(Port 3002)"]
        ADM["Admin Portal\n(Port 3003)"]
        DRV["Driver Tracker\n(Port 3004)"]
    end

    subgraph Backend ["⚡ Backend Core (NestJS 11 + Node.js)"]
        API["NestJS API Engine\n(Port 3001)"]
        AUTH["JWT / Firebase Auth"]
        WS["Socket.io Gateway\n(@socket.io/redis-adapter)"]
        PRICE["Pricing Engine\n(Integer Paise + GST)"]
    end

    subgraph Data ["💾 Data & Messaging Layer"]
        PG[(PostgreSQL 16\nPrisma ORM)]
        REDIS[(Upstash Redis\nCache & Locks)]
        RP[Razorpay Gateway]
        FB[Firebase Admin SDK]
    end

    CA -->|HTTP / Bearer JWT| API
    KDS -->|WebSocket Events| WS
    ADM -->|HTTP REST| API
    DRV -->|HTTP + WS Location| API

    API --> AUTH
    API --> PRICE
    API --> WS

    API --> PG
    API --> REDIS
    API --> RP
    API --> FB
```

---

## 🔒 Core Engineering Principles

> [!IMPORTANT]
> **Money is stored as integer paise everywhere.**
> Floating-point currency calculations misround GST and Razorpay signatures. All monetary values (`pricePaise`, `totalAmountPaise`) are integer-based. The render layer divides by 100 via `formatPaise()`.

> [!TIP]
> **The Server Owns Every Price.**
> Clients only submit `{ menuItemId, quantity }`. `PricingService` recalculates the total breakdown directly from the database during quote creation. Unknown item IDs return `400 Bad Request`.

> [!NOTE]
> **Ownership Enforced in `where` Clause.**
> Queries fetch scoped rows directly (e.g. `findFirst({ where: { id, userId } })`). Attempting to access another user's order returns `404 Not Found` rather than `403 Forbidden` to prevent object existence enumeration.

> [!WARNING]
> **Database-Level Concurrency Locks.**
> Driver order claiming uses conditional atomic updates (`count === 0` throws `40 ConflictException`). Turf slots use Redis `SET NX PX` locks. Wallet debit transactions enforce non-negative constraints in Postgres.

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js 20+** & **npm 10+**
- **PostgreSQL 16+** (Local or Neon)
- **Redis 7+** (Upstash or local Docker container)

### 2. Installation & Setup
```bash
# Clone the repository
git clone https://github.com/Shxam/MobileApp.git
cd MobileApp

# Install all monorepo dependencies
npm install

# Setup environment variables
cp .env.example .env
```

### 3. Database Migration & Seeding
```bash
# Apply Prisma migrations
npx prisma migrate deploy
npx prisma generate

# Seed 76 menu items, turf slots, celebration packages, and staff PINs
SEED_STAFF_PIN=1234 npx prisma db seed
```

### 4. Running Development Servers

Launch backend and frontend apps in separate terminals:

```bash
# 1. Start NestJS Backend API (Port 3001)
npm run dev:backend

# 2. Start Customer Super App (Port 3000)
npm run dev

# 3. (Optional) Start Kitchen KDS (Port 3002)
npm run dev:kds

# 4. (Optional) Start Admin Portal (Port 3003)
npm run dev:admin

# 5. (Optional) Start Driver App (Port 3004)
npm run dev:driver
```

---

## 🛠️ Tech Stack Matrix

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend Apps** | React 19, Vite 6, TypeScript 5.8, Tailwind CSS 4, Framer Motion, Lucide Icons, Leaflet Maps, Socket.io Client |
| **Backend Core** | NestJS 11, TypeScript, Prisma ORM 5.22, Socket.io, `@nestjs/throttler`, `@nestjs/schedule`, Passport JWT, Bcrypt |
| **Database & Cache** | PostgreSQL 16 (Neon / Local), Redis (Upstash / Local), BullMQ |
| **Integrations** | Razorpay Payments (HMAC Webhooks), Firebase Auth (Phone OTP), Google OAuth, Live Cricket API |
| **Testing & CI/CD** | Jest 30, Supertest, GitHub Actions, Docker, Strix AI Security Scanner |

---

## 🛡️ Security & CI/CD Pipeline

The project integrates automated security scanning and continuous testing:

```bash
# Run backend integration & component unit tests (158 passing specs)
npm test

# Run TypeScript typechecks
npm run lint          # Frontend typecheck
npm run lint:backend  # Backend typecheck
```

- **Strix AI Pentesting:** Continuous pre-merge AI vulnerability scanning via `.github/workflows/security-scan.yml`.
- **JWT Refresh Rotation:** Short-lived access tokens (15m) with automatic refresh token rotation & Redis blocklisting.
- **Strict CORS & Throttling:** Rate-limiting via `@nestjs/throttler` and strict origin verification in production.

---

## 🚀 Free Deployment Guide (No Credit Card)

You can deploy the complete stack for **100% FREE** without providing a credit card:

1. **Frontend (Vercel):** Connect `https://github.com/Shxam/MobileApp.git` to **Vercel** for instant Vite deployment.
2. **Backend API (Render / Koyeb):** Deploy `apps/backend` as a Node.js Web Service on **Render.com** or **Koyeb.com**.
3. **PostgreSQL Database (Supabase / Neon):** Provision a free 500MB Postgres database on **Supabase.com** or **Neon.tech**.
4. **Redis Cache (Upstash):** Create a free serverless Redis cluster on **Upstash.com**.

---

<p align="center">
  Designed & Built with ❤️ for <b>Singarayakonda IPL Dhaba & Box Turf</b>
</p>
