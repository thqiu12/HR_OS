# syntax=docker/dockerfile:1.7
#
# Multi-stage build for HR OS (Next.js 14 + better-sqlite3 + pdfjs-dist).
# Produces a ~250 MB image (vs ~1.2 GB without standalone output).
#
# Stages:
#   1. deps    — install npm deps with native build toolchain
#   2. builder — compile Next.js + native modules
#   3. runner  — minimal runtime, non-root user, only standalone output
#
# Build:    docker build -t hr-os .
# Test:     docker run --rm -p 3010:3010 -e AUTH_SECRET=xxx -e HR_DB_PATH=/tmp/hr.db hr-os
# Deploy:   fly deploy   (uses fly.toml)

ARG NODE_VERSION=20.18.0

# ============================================================================
# Stage 1: dependencies
# ============================================================================
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app

# build toolchain for better-sqlite3 (compiles native C++ binding)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

# ============================================================================
# Stage 2: builder
# ============================================================================
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js with standalone output (configured in next.config.js).
# Skip seed during build — production starts with empty volume.
ENV HR_SKIP_SEED=1
RUN npm run build

# ============================================================================
# Stage 3: runner (production image)
# ============================================================================
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3010
ENV HOSTNAME=0.0.0.0

# tini = proper PID 1 (forwards signals to Node so fly deploys roll cleanly)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# non-root user for runtime
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid 1001 --create-home nextjs

# Next.js standalone output bundles only the files needed to run.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# Migrations are needed at runtime (db.ts applies them on boot).
COPY --from=builder --chown=nextjs:nodejs /app/migrations      ./migrations

# Bootstrap script for creating the first admin user on a fresh DB.
# Run via:  fly ssh console -C "node /app/bootstrap-prod.js --admin-login ..."
COPY --from=builder --chown=nextjs:nodejs /app/scripts/bootstrap-prod.js ./bootstrap-prod.js

# Persistent data dir — mounted as a Fly volume in production.
# HR_DB_PATH and UPLOADS_DIR (set in fly.toml) point inside /data.
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs
EXPOSE 3010

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
