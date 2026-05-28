# StreamBingo

A modern, production-ready Twitch Bingo web platform for streamers, moderators, and viewers.

[![CI](https://github.com/X3S2/bingo/actions/workflows/ci.yml/badge.svg)](https://github.com/X3S2/bingo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- **Streamers** – Create and manage Bingo games, configure Channel Point Redeems, manage moderators, set winner counts
- **Viewers** – Sign in with Twitch, get a personal 5×5 Bingo card, mark numbers, claim Bingo
- **Moderators** – View all cards with live updates, manage drawn numbers, sort by Bingo proximity
- **Admin Portal** – Manage streamers/users, live-edit Imprint & Privacy Policy, configure global auto-stop, monitor platform health
- **Real-time** – All updates via Socket.IO WebSockets (< 500ms latency)
- **Twitch Integration** – OAuth, IRC commands (`!zahl+N`, `!zahl-N`, `BINGO`), EventSub Channel Point Redeems
- **Dark/Light Mode** – Automatic system detection, instant toggle
- **Multilingual** – German & English (DE/EN)
- **Mobile-first** – Fully responsive, touch-optimized Bingo cards

---

## Architecture

```
streambingo-proxy  (Nginx)       :4000  ← Public entry point
streambingo-web    (Next.js 15)  :4001  ← Frontend
streambingo-api    (NestJS 11)   :4002  ← Backend API + WebSocket
streambingo-db     (PostgreSQL 17):4003 ← Database
streambingo-cache  (Redis 7)     :4004  ← Cache (optional adapter)
```

All services are containerized with Docker and orchestrated via Docker Compose. Designed for deployment on Synology NAS via Docker Desktop, accessible through an ipv64.net domain.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, TailwindCSS 4, shadcn/ui |
| Backend | NestJS 11, TypeScript, Socket.IO |
| Database | PostgreSQL 17 + Prisma ORM |
| Cache | Redis 7 |
| Proxy | Nginx |
| Auth | Twitch OAuth2 (PKCE) |
| Realtime | Twitch IRC (@twurple/chat), Twitch EventSub |
| CI/CD | GitHub Actions |
| Container | Docker, Docker Compose |

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (Windows)
- [Node.js 22+](https://nodejs.org/)
- A [Twitch Developer Application](https://dev.twitch.tv/console) (Client ID + Secret)
- A Twitch account for the bot (or use the streamer account)

### 1. Clone the repository

```bash
git clone https://github.com/X3S2/bingo.git
cd bingo
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Start with Docker Compose (development)

```bash
docker compose up --build
```

The platform is now available at **http://localhost:4000**

On first start, the **Setup Wizard** will guide you through:
- Twitch App credentials (Client ID + Secret)
- Admin account creation
- Bot account configuration

### 4. Production deployment (Synology NAS)

```bash
docker compose -f docker-compose.prod.yml up -d
```

See [docs/deployment.md](docs/deployment.md) for full NAS setup guide.

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `TWITCH_CLIENT_ID` | Twitch App Client ID | ✅ |
| `TWITCH_CLIENT_SECRET` | Twitch App Client Secret | ✅ |
| `TWITCH_REDIRECT_URI` | OAuth callback URL | ✅ |
| `TWITCH_EVENTSUB_SECRET` | HMAC secret for EventSub | ✅ |
| `JWT_SECRET` | Secret for JWT tokens (min 32 chars) | ✅ |
| `JWT_EXPIRES_IN` | JWT expiry (e.g. `7d`) | ✅ |
| `NEXTAUTH_URL` | Frontend base URL | ✅ |
| `NEXT_PUBLIC_API_URL` | Backend API URL (public) | ✅ |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (public) | ✅ |
| `ADMIN_SETUP_TOKEN` | One-time setup token (cleared after use) | ✅ |
| `REDIS_ADAPTER_ENABLED` | Enable Redis Socket.IO adapter (`true`/`false`) | Optional |
| `NODE_ENV` | `development` or `production` | ✅ |

---

## Twitch Setup

1. Go to [dev.twitch.tv/console](https://dev.twitch.tv/console) → **Register Your Application**
2. Set **OAuth Redirect URLs** to `https://yourdomain.com/api/auth/callback/twitch`
3. Copy **Client ID** and **Client Secret** to `.env`
4. During first setup, configure EventSub webhooks via the Setup Wizard

For Channel Point Redeems:
- The streamer must partner or affiliate with Twitch
- Configure Redeems in the Streamer Dashboard after setup

---

## Roles

| Role | Permissions |
|------|-------------|
| `VIEWER` | View own card, mark numbers, claim Bingo |
| `MODERATOR` | All viewer permissions + view all cards, manage numbers |
| `STREAMER` | All moderator permissions + create/manage games, configure Redeems |
| `ADMIN` | Full platform control, manage all users and games |

Moderators are **auto-detected** from the Twitch channel's moderator list via the Helix API.

---

## API Overview

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/twitch` | GET | — | Initiate Twitch OAuth |
| `/api/auth/callback/twitch` | GET | — | OAuth callback |
| `/api/auth/logout` | POST | User | Logout |
| `/api/games` | POST | Streamer | Create a new Bingo game |
| `/api/games/:id` | PATCH | Streamer | Update game (start/stop) |
| `/api/games/:id/numbers` | POST | Mod/Streamer | Draw a number |
| `/api/games/:id/cards` | GET | Mod/Streamer | Get all cards |
| `/api/cards/:id` | GET | User | Get own card |
| `/api/admin/users` | GET | Admin | List all users |
| `/api/admin/games` | GET | Admin | List all games |
| `/api/admin/settings` | GET/PATCH | Admin | Platform settings |
| `/api/setup` | POST | — | Initial setup (wizard) |

WebSocket events documented in [docs/websocket.md](docs/websocket.md).

---

## Project Structure

```
bingo/
├── frontend/          # Next.js 15 App Router
├── backend/           # NestJS 11 API
│   └── prisma/        # Prisma schema & migrations
├── docker/            # Docker & Nginx configs
├── docs/              # Documentation
├── .github/           # GitHub Actions workflows
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env.example
```

---

## Versioning

This project uses [Semantic Versioning](https://semver.org/): `X.Y.Z`

- `X` (Major): Breaking changes — only on explicit release
- `Y` (Minor): New features / phase completions
- `Z` (Patch): Bug fixes and small improvements

See [CHANGELOG.md](CHANGELOG.md) for full history.

---

## License

[MIT](LICENSE) © 2026 X3S2
