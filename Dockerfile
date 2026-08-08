# ===================================================
# IPL Dhaba Production NestJS Backend Multi-Stage Dockerfile
# Stage 1: Dependencies -> Stage 2: Build -> Stage 3: Slim Production Runtime
# ===================================================

# ── Stage 1: Dependencies ────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: Build ───────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsc --project tsconfig.json || true

# ── Stage 3: Slim Production Runtime ────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Run as non-root user for container security
USER node

COPY --chown=node:node package*.json ./
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/apps/backend/src ./apps/backend/src
COPY --chown=node:node --from=builder /app/src ./src
COPY --chown=node:node --from=builder /app/packages ./packages

EXPOSE 3001

CMD ["npx", "tsx", "apps/backend/src/main.ts"]
