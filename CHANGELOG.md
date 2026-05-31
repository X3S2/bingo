# Changelog

All notable changes to StreamBingo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.3] - 2026-05-31

### Added
- **i18n – complete audit**: all remaining hardcoded German strings replaced with `useTranslations` hooks across all pages (`streamer`, `admin`, `game/[id]`, `game`, `moderator`, `moderator/[id]`)
- **i18n – new namespaces**: `bot` namespace (full DE + EN) for bot status labels; extended `bingo`, `streamer`, `moderator`, `admin`, `legal` namespaces with missing keys in both `de.json` and `en.json`
- **Impressum / Datenschutz – bilingual toggle**: both legal pages converted to client components; show DE by default, toggle button switches to EN content; admin can now enter separate EN texts (`impressum_en`, `datenschutz_en`) in the Settings tab
- **Admin Settings tab**: added two new textarea fields — *Impressum (EN)* and *Datenschutzerklärung (EN)* — stored as `impressum_en` / `datenschutz_en` in `AdminSetting`
- **Bot tab i18n**: all labels in admin bot tab (`IRC:`, `Token:`, `Verbunden`, `Gültig`, channel list, refresh button) now driven by `bot` namespace translations
- **Game status badges translated**: `CREATED` → "Bereit" / "Ready", `RUNNING` → "Spiel läuft" / "Game running", `STOPPED` → "Spiel beendet" / "Game stopped" across streamer dashboard and admin games tab

### Changed
- **Auto-Stop defaults**: new game form now defaults `autoStopEnabled` and `autoStopEod` to **`true`** (was `false`)
- **Moderator dashboard header**: bot-joined badge labels now use `t('botJoined')` / `t('botNotJoined')` from moderator namespace

### Fixed
- **Emoji mojibake** in `game/[id]/page.tsx`: trophy icon `ðŸ†` corrected to `🏆` in winner toast
- **503 Service Temporarily Unavailable**: transient error caused by Turbopack hot-reload during source file changes; resolved by container restart
### Added
- **PageToolbar** component (DE/EN language toggle + dark/light mode) on all public pages (home, login, help, setup)
- **Setup wizard**: explicit Redirect URI hint — users must register `http://<host>/api/auth/callback/twitch` exactly in the Twitch dev console
- **Help page**: all guide content now fully translated (DE + EN), no more mixed-language display on locale switch
- **Back button** (← Dashboard) on admin portal, streamer management

### Fixed
- **Security**: admin portal, streamer page — content is now only rendered after auth check; no more 1-second content flash for unauthenticated visitors
- **Navbar**: `document.cookie` accessed during SSR caused a `document is not defined` runtime error — moved to `useEffect`
- **Navbar**: `useTranslations()` called inside an async callback (React Hook rules violation) — extracted to component scope
- **Navbar**: Twitch login link changed from Next.js `<Link>` to `<a>` to prevent RSC payload fetch to the backend OAuth redirect
- **Navbar**: StreamBingo logo now links to `/dashboard` when logged in instead of `/`
- **Auth**: `getTwitchUser()` now reads Client ID from the DB (via setup wizard) instead of the `.env` placeholder — this fixed "Anmeldung fehlgeschlagen" after Twitch OAuth callback
- **Streamer page**: mojibake encoding corruption fixed (`ðŸŽ¬` → `🎬`, `Ã¶ffnen` → `öffnen`)
- **Admin page**: mojibake encoding corruption fixed (`âš™ï¸` → `⚙️`, `â€"` → `—`, `â†'` → `→`)
- **Redirect URI mismatch**: setup wizard step 2 now shows exact required URI with explicit label

### Notes
- `next-themes` v0.4.6 + React 19 produces a cosmetic console warning ("Encountered a script tag while rendering React component"). This is a known upstream issue — no fix available in current next-themes; warning does not affect functionality

---

## [1.0.1] - 2026-05-29

### Added
- Setup wizard: DE/EN language toggle (default: German, persisted in cookie)
- Setup wizard: detailed step-by-step instructions per step with clickable links to dev.twitch.tv/console and twitchtokengenerator.com
- Setup wizard: Refresh Token field for automatic bot token renewal
- Setup wizard: `oauth:` prefix normalization (accepted with or without prefix)
- Twitch IRC bot: replaced `StaticAuthProvider` with `RefreshingAuthProvider` — tokens are renewed automatically and saved to DB

### Fixed
- nginx: WebSocket proxy for `/_next/webpack-hmr` — React now hydrates correctly through port 4000
- Setup page: UTF-8 encoding corruption (German umlauts restored)
- Setup wizard: step 1 was incorrectly showing bot token fields instead of setup token field

### Removed
- Tanstack Query Devtools panel (no longer shown in any mode)
- Next.js development indicator (devIndicators disabled)

---

## [1.0.0] - 2026-05-28

### Added
- Production-ready release: StreamBingo v1.0.0
- Environment validation on startup (validates DATABASE_URL, JWT_SECRET, Twitch credentials, APP_URL)
- JWT_SECRET length check (≥32 chars) with descriptive error on misconfiguration
- Comprehensive DSGVO-compliant legal templates: Impressum (TMG §5) and Datenschutzerklärung (Art. 6 DSGVO) with `[PLACEHOLDER]` fields in seed
- Deployment guide for Synology NAS Container Manager (`docs/deployment-synology.md`)
- Twitch developer application setup guide (`docs/twitch-setup.md`)

### Changed
- Legal pages (impressum, datenschutz) use `react-markdown` instead of `dangerouslySetInnerHTML`
- @tailwindcss/typography plugin added for prose rendering of legal Markdown content
- Frontend `_count` fields corrected from `bingoCards` to `cards` to match Prisma BingoGame relation

### Fixed
- Prisma relation name `bingoCards` → `cards` in admin.service.ts and bingo.service.ts
- Duplicate export default function in game/[id], moderator/[id], admin, and streamer pages

---

## [0.9.0] - 2026-05-28

### Added
- **Phase 9 – Viewer UX polish**: Socket.IO connection indicator (Wifi/WifiOff), last drawn number badge, toast on `number:drawn`, join game button for RUNNING games, game-stopped Alert
- **Phase 10 – Moderator card grid**: Mini 5×5 bingo card rendering, proximity score algorithm (min unmarked cells from any bingo line), sort by proximity/name, winner highlighting with Trophy icon and gold border, user search
- **Phase 11 – Streamer dashboard**: `GET /api/games/my-games` integration, copy game link button, external link, card/draw count stats, auto-fill channelName from user.displayName, redirect to moderator view after game creation
- **Phase 12 – Admin portal enhancements**: 5-tab layout (Stats, Users, Games, Settings, Audit), role change via Select dropdown, ban/unban buttons, user search, force-stop game, audit log with ScrollArea, maintenance toggle, impressum/datenschutz text editors
- **Phase 13 – DSGVO legal**: Seed with full German legal templates for Impressum and Datenschutzerklärung
- **Phase 14 – Production hardening**: Environment variable validation at startup, react-markdown for legal pages, deployment docs
- Backend: `GET /api/games/active?channel=X` route to fetch running game by channel name
- Backend: `GET /api/games/my-games` route for streamer's games with `_count`
- Root moderator page (`/moderator`) redirects streamer/admin to their active game

### Changed
- Admin `listGames()` includes `_count: { cards, winners, drawnNumbers }`
- Bingo `getGamesByStreamer()` includes `_count: { cards, winners, drawnNumbers }`
- BingoController `createGame` passes autoStop options from DTO

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
