# IPL Dhaba — $0/Month Deployment: Oracle Cloud Always Free + Cloudflare

This guide walks through deploying the IPL Dhaba Super App for **$0/month** using:

- **Frontend**: Cloudflare Pages (unlimited global edge CDN, free)
- **Backend**: Oracle Cloud **Always Free** VM (4 vCPU / 24 GB RAM / 200 GB SSD)
- **Database + Cache**: PostgreSQL 16 + Redis 7 in Docker on the same VM
- **Tunnel**: Cloudflare Zero Trust Tunnel (`cloudflared`) for secure HTTPS routing

---

## 🧱 Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Customer / Staff)                             │
│  https://ipl-dhaba.pages.dev  (Cloudflare Pages)        │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│  Cloudflare Zero Trust Tunnel (cloudflared)             │
│  api.ipl-dhaba.com → http://127.0.0.1:3001             │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Oracle Cloud Always Free VM (4 OCPU / 24GB / 200GB)    │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Docker Compose                                   │   │
│  │  ├─ backend  (NestJS, port 3001, 127.0.0.1 only) │   │
│  │  ├─ postgres (PostgreSQL 16, internal only)       │   │
│  │  └─ redis    (Redis 7, internal only)             │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 🏁 Prerequisites

| # | What | Where | Cost |
|---|------|-------|------|
| 1 | [Oracle Cloud Free Tier](https://signup.cloud.oracle.com) account | Oracle | $0 |
| 2 | [Cloudflare](https://dash.cloudflare.com/sign-up) account | Cloudflare | $0 |
| 3 | A domain (e.g. `ipldhaba.com`) | Namecheap/Cloudflare Registrar | ~$10/yr |
| 4 | [Google Cloud Console](https://console.cloud.google.com) | Google | $0 |

---

## 📦 Part A — Oracle Cloud VM Setup

### A1. Sign up for Oracle Cloud Free Tier
1. Go to [signup.cloud.oracle.com](https://signup.cloud.oracle.com)
2. Select **"Start for free"** — no credit card needed in most regions.
3. Verify your email and phone.

### A2. Create an Always Free Compute Instance
1. In the Oracle Cloud Console → **Compute** → **Instances** → **Create instance**.
2. **Name**: `ipl-dhaba-vm`
3. **Image**: Ubuntu 22.04 LTS (or Later) — `Canonical Ubuntu 22.04`
4. **Shape**: Choose `VM.Standard.E2.1.Micro` (1 OCPU, 1 GB RAM) — Always Free.
   > **Optional**: If you need more power, `VM.Standard.A1.Flex` offers up to 4 OCPU / 24 GB on the free tier (Arm-based). Select 4 OCPU / 24 GB RAM with the Always Free tag.
5. **Networking**: Create a VCN. Open ingress rules for:
   - TCP `22` (SSH) — restrict to your IP
   - TCP `80` (optional redirect) — if not using tunnel-only
   - TCP `443` (optional) — if not using tunnel-only
6. **SSH**: Upload a public key or generate one.
7. Click **Create**.

### A3. SSH into the VM
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@<ORACLE_PUBLIC_IP>
```

### A4. Install Docker + Docker Compose
```bash
# Update the system
sudo apt-get update && sudo apt-get upgrade -y

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine + Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add current user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

### A5. Create the project directory
```bash
sudo mkdir -p /opt/ipl-dhaba
sudo chown $USER:$USER /opt/ipl-dhaba
cd /opt/ipl-dhaba
```

---

## ⚙️ Part B — Backend Deployment (Docker Compose)

### B1. Clone the repository
```bash
cd /opt/ipl-dhaba
git clone https://github.com/Shxam/MobileApp.git .
```

### B2. Create the production environment file
Create `/opt/ipl-dhaba/deploy/.env.production`:

```bash
cd /opt/ipl-dhaba/deploy
cat > .env.production << 'EOF'
# ─── Core ────────────────────────────────────────
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
APP_URL=https://ipl-dhaba.pages.dev
CORS_ORIGINS=https://ipl-dhaba.pages.dev

# ─── Database (internal to compose network) ──────
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD

# ─── JWT Secrets (generate with `openssl rand -base64 48`) ──
JWT_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL
JWT_REFRESH_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
STAFF_TOKEN_TTL=12h

# ─── Gate Pass ───────────────────────────────────
GATE_PASS_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL

# ─── Razorpay (productions keys) ─────────────────
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=CHANGE_ME
RAZORPAY_WEBHOOK_SECRET=CHANGE_ME

# ─── Google OAuth (from Google Cloud Console) ────
GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com

# ─── Firebase (optional if migrating) ─────────────
# FIREBASE_PROJECT_ID=
# FIREBASE_CLIENT_EMAIL=
# FIREBASE_PRIVATE_KEY=

# ─── Cricket API (optional) ───────────────────────
# CRICKET_API_KEY=

# ─── Redis / dhaba scope ──────────────────────────
DEFAULT_DHABA_ID=dhaba_singarayakonda
REDIS_HOST=redis
REDIS_PORT=6379
EOF
```

### B3. Generate secure secrets
```bash
# Run these on your local machine (or the VM) to generate secure values
openssl rand -base64 48   # → paste into JWT_SECRET
openssl rand -base64 48   # → paste into JWT_REFRESH_SECRET
openssl rand -base64 48   # → paste into GATE_PASS_SECRET
openssl rand -base64 24   # → paste into POSTGRES_PASSWORD
```

### B4. Build and start the stack
```bash
cd /opt/ipl-dhaba/deploy
docker compose -f docker-compose.prod.yml up -d --build

# Check status
docker compose -f docker-compose.prod.yml ps

# Stream logs
docker compose -f docker-compose.prod.yml logs -f backend
```

### B5. Run database migrations
```bash
cd /opt/ipl-dhaba/deploy
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Seed the database (first time only)
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

### B6. Verify the health endpoint locally
```bash
curl -s http://127.0.0.1:3001/health | jq
# Expect: { "status": "ok", ... }
```

---

## 🌐 Part C — Cloudflare Tunnel Setup

### C1. Install `cloudflared` on the Oracle VM
```bash
# Add Cloudflare's official repo
sudo curl -L --output /usr/share/keyrings/cloudflare-main.gpg https://pkg.cloudflare.com/cloudflare-main.gpg

echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt-get update
sudo apt-get install -y cloudflared

# Verify
cloudflared --version
```

### C2. Create a Tunnel
1. Log into Cloudflare Dashboard → **Zero Trust** → **Networks** → **Tunnels**.
2. Click **Create a tunnel** → select **Cloudflared** → **Next**.
3. Name it `ipl-dhaba-api`.

### C3. Configure the Tunnel
In the Cloudflare dashboard, add a **Public Hostname**:

| Field | Value |
|-------|-------|
| Subdomain | `api` |
| Domain | `ipldhaba.com` (or your domain) |
| Service type | `HTTP` |
| URL | `127.0.0.1:3001` |

### C4. Install the connector on the Oracle VM
Cloudflare will provide a token. Run:
```bash
# Install the tunnel as a systemd service
sudo cloudflared service install <TOKEN_FROM_DASHBOARD>

# Verify the tunnel is running
sudo systemctl status cloudflared
```

> **Result**: `https://api.ipldhaba.com` now securely proxies to `http://127.0.0.1:3001` on your Oracle VM — with automatic SSL, DDoS protection, and zero public ports needed.

---

## 🚀 Part D — Cloudflare Pages (Frontend)

### D1. Build the frontend locally
```bash
cd /path/to/ipl-dhaba-super-app

# Set the API URL to your tunnel domain
export VITE_API_URL=https://api.ipldhaba.com
export VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com

# Build the Vite app
npm run build
# Output goes to dist/
```

### D2. Deploy to Cloudflare Pages
**Option A — Dashboard** (quick start):
1. Go to Cloudflare → **Workers & Pages** → **Create** → **Pages**.
2. Connect your GitHub repo (`Shxam/MobileApp`).
3. Build configuration:
   - **Framework preset**: `React`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Environment variables**:
   - `VITE_API_URL`: `https://api.ipldhaba.com`
   - `VITE_GOOGLE_CLIENT_ID`: your Google client ID
5. Click **Deploy**.

**Option B — Wrangler CLI** (CI/CD):
```bash
npm install -g wrangler

wrangler pages deploy dist \
  --project-name ipl-dhaba \
  --branch main

# Set environment variables
wrangler pages secret put VITE_API_URL --project-name ipl-dhaba
wrangler pages secret put VITE_GOOGLE_CLIENT_ID --project-name ipl-dhaba
```

> **Result**: Your app is live at `https://ipl-dhaba.pages.dev` — globally distributed from Cloudflare's edge network.

---

## 🔐 Part E — Google OAuth Configuration

### E1. Create OAuth credentials in Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. **Application type**: Web application.
4. **Authorized JavaScript origins**:
   - `https://ipl-dhaba.pages.dev`
   - `http://localhost:3000` (for local dev)
5. **Authorized redirect URIs**:
   - `https://ipl-dhaba.pages.dev`
   - `http://localhost:3000` (for local dev)
6. Copy the **Client ID** → set `VITE_GOOGLE_CLIENT_ID` in the frontend build and `GOOGLE_CLIENT_ID` in the backend `.env.production`.

### E2. Enable People API (for profile scope)
1. **APIs & Services** → **Library**.
2. Search for → **People API** → **Enable**.

---

## 🔧 Part F — Upgrade Path (When You Outgrow Free Tier)

| Component | Free Option | Paid Upgrade |
|-----------|-------------|--------------|
| Frontend CDN | Cloudflare Pages ($0) | Cloudflare Pro ($20/mo) |
| Backend VM | Oracle Always Free (4 OCPU/24GB) | Oracle PAYG (~$20/mo) |
| PostgreSQL | On-VM Docker ($0) | Neon/Supabase free tier ($0) |
| Redis | On-VM Docker ($0) | Upstash free tier ($0) |
| Domain | ~$10/yr | ~$10/yr |

---

## 🛠️ Maintenance & Operations

### Backup database (nightly cron)
```bash
# Add to crontab -e
0 2 * * * docker exec ipldhaba_postgres pg_dump -U ipldhaba ipldhaba | gzip > /opt/ipl-dhaba/backups/db_$(date +\%Y\%m\%d).sql.gz
```

### Update the backend
```bash
cd /opt/ipl-dhaba/deploy
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### View real-time logs
```bash
docker compose -f docker-compose.prod.yml logs -f backend --tail 100
```

### Monitor tunnel status
```bash
sudo systemctl status cloudflared
```

---

## 🧪 Verification Checklist

- [ ] `https://api.ipldhaba.com/health` returns `{"status":"ok"}`
- [ ] `https://ipl-dhaba.pages.dev` loads the full app
- [ ] Click **"Sign in with Google"** → Google popup appears → completes
- [ ] New Google users see the **"Complete Your Profile"** step
- [ ] Existing users (with phone) go straight into the app
- [ ] Staff apps (`:3002` KDS, `:3003` admin, `:3004` driver) still work via Employee ID + PIN
- [ ] Wallet, orders, turf bookings all function end-to-end