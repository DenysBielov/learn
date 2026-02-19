# Flashcards

A self-hosted spaced repetition app with AI-powered study sessions. Built with Next.js, SQLite, and the SM-2 algorithm.

## Features

- **Spaced repetition** — SM-2 algorithm schedules reviews at optimal intervals
- **Flashcards & quizzes** — Multiple question types: multiple choice, true/false, free text, matching, ordering
- **Courses & decks** — Organize cards into decks, group decks into hierarchical courses
- **AI chat** — Ask questions about cards during study sessions (Google Gemini)
- **Session tracking** — Review history with AI-generated summaries and personal notes
- **Push notifications** — Daily reminders when cards are due for review
- **MCP server** — Manage cards programmatically from AI assistants (Claude, etc.)
- **Self-hosted** — SQLite database, no external services required, runs on a Raspberry Pi
- **Dark mode** — System-aware theme switching
- **Mobile-friendly** — Responsive design, installable as PWA

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS, shadcn/ui |
| Backend | Next.js API routes, Server Actions |
| Database | SQLite (better-sqlite3), Drizzle ORM |
| AI | Google Gemini via Vercel AI SDK |
| Auth | JWT in httpOnly cookies |
| MCP | Model Context Protocol server for AI tool use |

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm

### Setup

```bash
git clone https://github.com/DenysBielov/flashcards.git
cd flashcards
pnpm install

# Configure environment
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET

# Initialize database and create a user
pnpm migrate
pnpm add-user

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the account you created.

## Project Structure

```
packages/
├── web/           Next.js frontend + API routes
├── database/      Drizzle ORM schema + migrations
├── mcp-server/    MCP server for AI integrations
└── shared/        Shared utilities
```

Monorepo managed with pnpm workspaces.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm migrate` | Run database migrations |
| `pnpm generate` | Generate migration from schema changes |
| `pnpm add-user` | Create a user account (interactive) |

## Docker

The app ships as two Docker images optimized for ARM64 (Raspberry Pi):

- `ghcr.io/denysbielov/flashcards:latest` — Web app
- `ghcr.io/denysbielov/flashcards-mcp:latest` — MCP server

### Docker Compose

```yaml
services:
  flashcards:
    image: ghcr.io/denysbielov/flashcards:latest
    ports:
      - "3000:3000"
    volumes:
      - flashcards-data:/app/data
    env_file: .env
    restart: unless-stopped

volumes:
  flashcards-data:
```

```bash
docker compose up -d
```

The database is stored in a Docker volume. Migrations run automatically on container startup.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret for signing auth tokens |
| `GEMINI_API_KEY` | No | Google Gemini API key for AI chat |
| `DATABASE_PATH` | No | SQLite path (default: `./data/flashcards.db`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | No | VAPID private key for push notifications |
| `VAPID_SUBJECT` | No | VAPID subject (mailto: URL) |
| `CRON_SECRET` | No | Secret for the daily notification endpoint |
| `MCP_AUTH_TOKEN` | No | Bearer token for MCP server auth |

## MCP Server

The MCP server exposes flashcard management as tools for AI assistants. It runs as a separate service and authenticates via bearer token.

To use with Claude Desktop or other MCP clients, point them at your MCP server URL with the configured auth token.

## Database

SQLite via better-sqlite3 with Drizzle ORM. Schema is defined in `packages/database/src/schema.ts`.

To modify the schema:

```bash
# Edit packages/database/src/schema.ts
pnpm generate   # Creates a new migration file
pnpm migrate    # Applies pending migrations
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run `pnpm build` to verify
5. Open a pull request

## License

[MIT](LICENSE)
