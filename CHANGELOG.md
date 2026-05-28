# Changelog

All notable changes to StreamBingo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.8.0] - 2026-05-28

### Added
- Next.js 15 App Router frontend with 14 fully functional routes
- i18n support (DE/EN) via next-intl with cookie-based locale switching
- Dark/Light/System theme support via next-themes
- React Query + Zustand state management
- Socket.IO client provider for real-time updates
- Auth provider (JWT cookie-based, /api/auth/me)
- Pages: Home (landing), Login, Dashboard (role-based), Game viewer (/game/:id)
- Pages: Moderator dashboard (/moderator/:id), Streamer management (/streamer)
- Pages: Admin portal (/admin), Setup wizard (/setup), Help page
- Pages: Legal pages (/impressum, /datenschutz) with server-rendered CMS content
- Components: BingoCard (5x5 interactive), NumberBoard, WinnerBoard
- Components: Navbar (with theme/language toggle, role-based links)
- Components: MaintenanceBanner, CookieBanner
- All shadcn/ui components: avatar, badge, card, input, label, dialog, sheet, tabs, etc.

---

## [0.7.0] - 2026-05-28

### Added
- Socket.IO WebSocket gateway (NestJS) at path `/socket.io`
- JWT authentication on WebSocket connection via HttpOnly cookie
- Room-based subscriptions: `game:{id}`, `card:{id}`, `mod:{id}`, `admin`
- Real-time events: `number:drawn`, `number:removed`, `card:updated`, `game:status`, `winner:added`, `user:banned`, `maintenance:toggle`

---

## [0.6.0] - 2026-05-28

### Added
- Twitch EventSub webhook controller at `POST /api/eventsub`
- HMAC-SHA256 signature verification with timing-safe comparison
- Channel point redeem handling: SELF (card for redeemer) and GIFT (card for named target user)
- Nginx EventSub bypass (no rate limiting for `/api/eventsub`)

---

## [0.5.0] - 2026-05-28

### Added
- Twitch IRC bot via @twurple/chat, credentials stored in AdminSetting DB
- Chat commands: `!zahl+N` (draw), `!zahl-N` (remove), `bingo` (claim via chat)
- Permission check: only moderators/broadcasters can draw/remove; viewers can only claim
- `registerActiveGame()` / `unregisterActiveGame()` for channel lifecycle

---

## [0.4.0] - 2026-05-28

### Added
- Complete bingo game engine (NestJS service + controller)
- 5x5 card generation with BINGO column ranges (B:1-15, I:16-30, N:31-45, G:46-60, O:61-75)
- Center free square with pre-marked state
- Win condition checker: rows, columns, and 2 diagonals
- Draw/remove number with automatic card update for all participants
- Bingo claim with validation — auto-stop game when maxWinners reached
- CRON auto-stop at configurable time or end-of-day

---

## [0.3.0] - 2026-05-28

### Added
- Prisma ORM schema with 8 models: User, Session, BingoGame, BingoCard, DrawnNumber, Winner, Redeem, AdminSetting, AuditLog
- User roles: VIEWER, MODERATOR, STREAMER, ADMIN with hierarchy guard
- Prisma seed script with default AdminSettings (maintenance, impressum, datenschutz)
- `prisma.config.ts` for Prisma 7.x datasource configuration

---

## [0.2.0] - 2026-05-28

### Added
- Twitch OAuth2 PKCE flow with state-based CSRF protection (10-min expiry)
- JWT authentication with HttpOnly cookies (SameSite=lax, 7d expiry)
- Passport JWT strategy extracting token from cookie
- Auth endpoints: GET /api/auth/twitch, GET /api/auth/callback/twitch, GET /api/auth/me, POST /api/auth/logout
- Setup wizard endpoint: GET /api/setup/status, POST /api/setup (validates ADMIN_SETUP_TOKEN)
- First-user-becomes-admin logic

---

## [0.1.0] - 2026-05-28

### Added
- Initial monorepo structure (`/frontend`, `/backend`, `/docker`, `/docs`)
- Docker Compose configuration with 5 services using `streambingo-*` naming convention
  - `streambingo-proxy` (Nginx, port 4000)
  - `streambingo-web` (Next.js, port 4001)
  - `streambingo-api` (NestJS, port 4002)
  - `streambingo-db` (PostgreSQL 17, port 4003)
  - `streambingo-cache` (Redis 7, port 4004)
- Nginx reverse proxy configuration (routing `/api/*` → backend, `/ws/*` → WebSocket, `/` → frontend)
- NestJS 11 backend scaffold with TypeScript strict mode
- Next.js 15 frontend scaffold with App Router and TypeScript strict mode
- TailwindCSS 4 + shadcn/ui initialization
- `.env.example` with all required environment variables documented
- `README.md` with project overview, setup instructions, and architecture documentation
- MIT License
- GitHub Actions CI workflow (lint + build on PR/push)
- `.gitignore` with `/plan/` excluded (local planning files only)

[0.1.0]: https://github.com/X3S2/bingo/releases/tag/v0.1.0
