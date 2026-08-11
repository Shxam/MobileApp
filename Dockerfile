# ===================================================
# IPL Dhaba Production NestJS Backend Multi-Stage Dockerfile
#
# deps → builder → prod-deps → runner
#
# What this replaces, and why each change matters:
#   • `RUN npx tsc --project tsconfig.json || true` — the `|| true` swallowed
#     every compile error, and the frontend config it pointed at sets
#     `noEmit: true`, so the stage emitted nothing even when it "succeeded".
#     The image then ran TypeScript source through `tsx` at runtime.
#   • `prisma generate` was never run, so `@prisma/client` had no generated
#     client and the container crashed on its first query — every time.
#   • The runtime stage copied the full `node_modules` from the dependency
#     stage, shipping vite, jest, ts-jest, esbuild and the rest to production.
# ===================================================

# ── Stage 1: Full dependencies (needed to compile) ───
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# The root manifest declares `workspaces`, so `npm ci` reads every workspace's
# own manifest to build the tree. Without these two copies it aborts with
# "npm ci can only install with an existing package-lock.json" before any of the
# source is even present.
COPY packages/types/package.json ./packages/types/
COPY packages/api-client/package.json ./packages/api-client/
# `--ignore-scripts` keeps a postinstall from running before the schema is
# copied in; the builder runs `prisma generate` explicitly below.
RUN npm ci --ignore-scripts

# ── Stage 2: Build ───────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No `|| true`: a type error must fail the image build, not ship silently.
# `build:backend` runs `prisma generate` first, then emits CommonJS to ./dist
# via tsconfig.backend.json.
RUN npm run build:backend

# ── Stage 3: Production dependencies only ────────────
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/api-client/package.json ./packages/api-client/
COPY prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts && npx prisma generate

# ── Stage 4: Slim Production Runtime ────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --chown=node:node package*.json ./
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
# The schema and migrations ship with the image so `prisma migrate deploy` can
# run as a release step against the target database.
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/dist ./dist

USER node

EXPOSE 3001

# Readiness really probes Postgres and Redis (see health.controller.ts), so an
# unhealthy replica is pulled rather than silently serving errors.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/apps/backend/src/main.js"]
