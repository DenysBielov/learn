FROM node:22-slim AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install build tools for native addons (better-sqlite3, bcrypt)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web/package.json packages/web/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Migrations must run before build (Next.js pre-renders static pages that query the DB)
RUN pnpm migrate

# NEXT_PUBLIC_ vars are inlined at build time by Next.js
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN pnpm build

# Prepare a self-contained migration directory with npm (flat node_modules, no symlinks)
RUN mkdir -p /migrate && \
    cp scripts/docker-migrate.mjs /migrate/migrate.mjs && \
    cp -r packages/database/src/migrations /migrate/migrations && \
    cd /migrate && \
    echo '{"type":"module"}' > package.json && \
    npm install --no-package-lock better-sqlite3@11 drizzle-orm@0.38

# --- Runner ---
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone server (includes node_modules with pnpm structure)
COPY --from=builder /app/packages/web/.next/standalone ./
# Copy static assets
COPY --from=builder /app/packages/web/.next/static ./packages/web/.next/static
# Copy public assets
COPY --from=builder /app/packages/web/public ./packages/web/public

# Copy self-contained migration directory
COPY --from=builder /migrate ./migrate

# Ensure data directory exists and is owned by nextjs
RUN mkdir -p /app/data /app/data/chat-images /app/data/images && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

CMD ["sh", "-c", "node migrate/migrate.mjs && node packages/web/server.js"]
