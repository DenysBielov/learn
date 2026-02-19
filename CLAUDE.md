# Flashcards

A spaced repetition flashcards app built with Next.js and SQLite.

## Project Structure

Monorepo managed with pnpm workspaces:

- `packages/web` — Next.js 16 frontend (App Router, Tailwind, shadcn/ui)
- `packages/database` — SQLite database layer (Drizzle ORM, better-sqlite3)
- `packages/mcp-server` — MCP server for AI integrations

## Key Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm migrate      # Run database migrations
pnpm generate     # Generate new migration from schema changes
pnpm add-user     # Create a user account (interactive email/password prompt)
```

## Database

- SQLite via `better-sqlite3` (native addon, needs compilation per platform)
- ORM: Drizzle with schema at `packages/database/src/schema.ts`
- Migrations at `packages/database/src/migrations/`
- DB file: `data/flashcards.db` (resolved by `DATABASE_PATH` env var, or walking up from cwd looking for `pnpm-workspace.yaml`)

## Auth

- **Web app:** Email/password login, JWT in httpOnly cookie (24h expiry), middleware redirects to `/login`
- **MCP server:** Bearer token via `Authorization` header, validated against `MCP_AUTH_TOKEN` env var
- **User management:** No registration UI — use `pnpm add-user` locally

## CI/CD Pipeline

1. Push to `main` triggers GitHub Actions (`.github/workflows/deploy.yml`)
2. Two parallel jobs build ARM64 Docker images (web + MCP) via QEMU and push to GHCR
3. Watchtower on the host polls GHCR every 60s and auto-pulls new images

## Docker Notes

- `output: "standalone"` in `next.config.ts` produces a self-contained Next.js build
- `scripts/docker-migrate.mjs` is a Docker-specific migration script with hardcoded paths (avoids `import.meta.dirname` issues in standalone output)
- Migration deps (better-sqlite3, drizzle-orm) are installed via npm in a separate `/migrate` directory to avoid pnpm symlink issues
- Migrations run at container startup before the Next.js server starts

## GitHub

- **Repo:** https://github.com/DenysBielov/flashcards
- **Main branch:** `main`
