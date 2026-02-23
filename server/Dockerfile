# Backend API for Cloud Run.
# Build context: project root — docker build -f server/Dockerfile .
# This lets us include public/avatars alongside the compiled server code.
# Cloud Run sets PORT=8080; the app reads it via config/env (default 3001).

FROM node:20-alpine AS base
WORKDIR /app

# ── Stage 1: Install all dependencies (needed for TypeScript build) ───────────
FROM base AS deps
COPY server/package.json server/package-lock.json* ./
RUN npm ci

# ── Stage 2: Compile TypeScript → dist/ ───────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY server/ .
RUN npm run build

# ── Stage 3: Lean production image ────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

# Production deps only
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev

# Compiled application
COPY --from=builder /app/dist ./dist

# Avatar uploads — served via /avatars route.
# In production the path is process.cwd()/public/avatars = /app/public/avatars.
# Avatars are either baked into the image here or mounted via a Cloud Storage FUSE volume.
COPY public/avatars ./public/avatars

EXPOSE 8080
CMD ["node", "dist/index.js"]
