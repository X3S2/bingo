# Changelog

All notable changes to StreamBingo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.1.4] - 2026-05-31

### Added
- **Viewer: Dashboard-Bypass** — Viewer werden direkt zum laufenden Spiel weitergeleitet, ohne das Dashboard zu sehen. Bei mehreren gleichzeitigen Spielen erscheint eine Spiel-Auswahl
- **Mod-Ansicht: Spiel-Switcher** — Moderatoren und Streamer können direkt zwischen mehreren laufenden Spielen wechseln — Dropdown im Moderator-Header, Spiel-Picker bei `/moderator` wenn mehrere Spiele aktiv
- **Backend: `GET /games/all-running`** — Gibt alle laufenden Spiele zurück (für Viewer-Redirect und Mod-Switcher)
- **Backend: `GET /games/mod-games`** — Gibt alle laufenden Spiele für Moderatoren zurück
- **Cookie-Banner: Datenschutz-Link** — Der Cookie-Hinweis enthält jetzt einen direkten Link zur Datenschutzseite

### Changed
- **Navbar: Viewer-Modus** — Für Viewer ist das StreamBingo-Logo nicht mehr klickbar (kein Dashboard-Link). Im Profil-Dropdown ist nur noch "Abmelden" sichtbar (kein Dashboard-Link)
- **Viewer: Kein "← Dashboard"-Button** — Der Zurück-zum-Dashboard-Link wurde auf der Spiel-Seite für Viewer ausgeblendet
- **Hilfe-Panel (Streamer)** — Das Fragezeichen öffnet jetzt ein persistentes Sidebar-Panel anstatt eines modalen Sheets: beginnt unterhalb des Headers (kein Header-Overlap), bleibt beim Klick daneben offen (nur X schließt es), Toggle-Verhalten
- **Hilfe-Button: Cookie-Banner-Abstand** — Solange der Cookie-Banner sichtbar ist, wird der Hilfe-Button nach oben verschoben, damit er nicht dahinter verschwindet

---

## [1.1.3] - 2026-05-31

### Fixed
- **Login-Weiterleitung** — Nach dem Login über einen Spiellink wird der User nun direkt zum Spiel weitergeleitet statt ins Dashboard. Der Login-Flow unterstützt jetzt `?returnTo=/game/<id>` (nur relative Pfade, CSRF-sicher)

### Added
- **Game-Page: Channel Points Kaufanleitung** — Viewer ohne Karte sehen jetzt eine klare Anleitung: Link zum Twitch-Chat des Streamers, Name des Self-Rewards, optionaler Hinweis auf den Gift-Reward wenn aktiviert. Der alte "Jetzt mitspielen"-Button wurde entfernt
- **Backend: `GET /games/:id/join-info`** — Neuer Endpunkt gibt Channel-Infos und Reward-Namen für die Kaufanleitung zurück
- **Streamer Manuell: Gift-Reward immer sichtbar** — Im Manuell-Modus ist der Gift-Reward-Toggle jetzt immer sichtbar (als optional markiert), auch wenn er noch nicht aktiviert ist. Anleitung enthält auch einen Abschnitt für das Gift-Reward
- **Git Tags** — Releases werden jetzt als annotierte Git Tags gepusht (v1.1.2, v1.1.3)

### Changed
- **Game-Page Redirect** — Unauthentifizierte User werden mit `?returnTo` zur Login-Seite geleitet und nach erfolgreichem Login direkt zum Spiel weitergeleitet

---

## [1.1.2] - 2025-06-01

### Fixed
- **Wartungsmodus-Schalter** — Der Toggle im Admin-Panel hat den Status nun korrekt angezeigt; `invalidateQueries` nach dem Speichern ergänzt + optimistischer lokaler State damit der Schalter sich sofort bewegt

### Changed
- **Admin: Wartungsmodus** — Statustext jetzt zweisprachig (DE/EN); zeigt "Wartungsmodus aktiv / inaktiv" mit kurzer Erklärung
- **Streamer: Link-Button** — Der Einladungslink-Button ist nun grün (`bg-green-600`); auf PC-Ansicht wird der Text "Link kopieren / Copy link" ausgeschrieben; auf Mobilgeräten nur Icon

### Added
- **Streamer: Hilfe-Popup** — Floating `?`-Button (unten rechts, violett) öffnet ein seitliches Sheet-Panel mit einer schrittweisen Anleitung für Streamer (Setup-Assistent → Einstellungen → Channel Points → Spiel starten → Moderieren); vollständig DE + EN übersetzt
- **Moderator: Chat-Befehle EN** — Chat-Befehlsnamen sind nun in beiden Sprachen verfügbar; i18n-Keys `cmd_zahl_add`, `cmd_zahl_remove`, `cmd_bingo`, `cmd_buycard`, `cmd_zahlen`, `cmd_winners` in DE + EN
- **i18n** — Neue Schlüssel in `de.json` und `en.json`: Wartungsmodus-Status, Streamer-Hilfe, Link kopieren, Chat-Befehle

---

## [1.1.1] - 2025-05-25

### Added
- **Channel Points System** — Streamer können auf Twitch Channel Point Rewards für StreamBingo automatisch verwalten. Zwei Reward-Typen: SELF (Karte für sich selbst einlösen) und GIFT (Karte an einen anderen Viewer verschenken)
- **Streamer: Allgemeine Einstellungen** — neues aufklappbares Panel auf der Streamer-Seite zur Konfiguration der Channel Points Rewards (Modus Auto/Manuell, Name, Kosten, Max. Einlösungen pro User)
- **Rewards Auto-Aktivierung** — im Auto-Modus werden Twitch Rewards automatisch aktiviert wenn ein Spiel startet und deaktiviert wenn es endet
- **Einladungslinks** — Admins können Einmal-Einladungslinks generieren, die neuen Usern automatisch die Rolle STREAMER oder MODERATOR geben
- **Admin: Einladungen-Tab** — neuer Tab auf der Admin-Seite zum Erstellen, Anzeigen und Widerrufen von Einladungslinks
- **Invite-Seite** (`/invite/[token]`) — Landingpage für Einladungslinks mit Twitch-Login-Button; Token wird beim OAuth-Callback automatisch konsumiert
- **Moderator-Auto-Erkennung** — beim Twitch-Login wird automatisch geprüft ob der User Moderator eines Channels mit laufendem Spiel ist; falls ja, wird die Rolle automatisch auf MODERATOR gesetzt
- **Twitch OAuth-Tokens gespeichert** — Access- und Refresh-Token werden für API-Calls (Channel Points, Moderator-Erkennung) gespeichert
- **`GET /twitch/rewards/settings`** — Reward-Einstellungen des Streamers laden (STREAMER+)
- **`POST /twitch/rewards/settings`** — Reward-Einstellungen speichern (STREAMER+)
- **`POST /twitch/rewards/setup`** — Rewards auf Twitch erstellen/verifizieren (STREAMER+)
- **`GET /admin/invites`** — alle Invite-Tokens auflisten (ADMIN)
- **`POST /admin/invites`** — neuen Invite-Token erstellen (ADMIN)
- **`DELETE /admin/invites/:id`** — Invite-Token widerrufen (ADMIN)
- **`GET /admin/validate-invite/:token`** — Token-Status prüfen (VIEWER+)

### Changed
- **Moderator: Karten-Layout** — Spieler-Name wird jetzt inline neben dem Avatar angezeigt (spart vertikalen Platz; shadcn CardHeader durch `<div>` ersetzt)
- **Twitch OAuth-Scopes** — `user:read:moderated_channels` hinzugefügt für Moderator-Auto-Erkennung

### Technical
- Prisma Schema: `twitchAccessToken` und `twitchRefreshToken` auf `User`-Modell
- Prisma Schema: `InviteToken`-Modell neu hinzugefügt
- Prisma Schema: `@@unique([gameId, type])` auf `Redeem`-Modell für Upsert-Unterstützung

---

## [1.0.6] - 2026-05-31

### Added
- **Moderator: Chat-Befehle Übersicht** — neues aufklappbares Panel im Moderator-Dashboard zeigt alle konfigurierten IRC-Befehle (Name, Funktion, Berechtigung, Status); Daten kommen vom neuen `GET /twitch/bot-commands` Endpunkt
- **Moderator: Gewinner entfernen** — jeder Gewinner-Eintrag im Moderator-Dashboard hat jetzt ein ✕-Button zum Entfernen; Platznummern werden automatisch neu vergeben; emitiert `winner:removed` via WebSocket
- **Chat-Ankündigung bei Bingo-Claim** — wenn ein Viewer per Button Bingo meldet, postet der Bot automatisch eine Ankündigung im Twitch-Chat (z. B. „🎉 @Username hat BINGO! (Platz 1)")
- **`GET /twitch/bot-commands`** — neuer Endpunkt (MODERATOR+) gibt aktuelle Bot-Befehlskonfiguration zurück

### Changed
- **StreamBingo-Logo-Schriftgröße**: 28px auf Mobilgeräten, 40px auf Desktop
- **Dashboard Status-Anzeige**: Socket-Verbindungsstatus wird jetzt mit dem tatsächlichen `socket.connected`-Wert initialisiert, um kurzes „Getrennt"-Flackern beim Laden zu vermeiden

---

## [1.0.5] - 2026-05-31

### Added
- **Bot command configuration** in admin bot tab: each chat command now has an editable name/prefix, an enable/disable toggle, and a permission level selector (Alle Zuschauer / Mod & Broadcaster / Nur Broadcaster); settings stored as `bot_cmd_<slug>_name/enabled/perm` in AdminSetting
- **New chat commands**: `!zahlen` (lists all drawn numbers in chat) and `!bingogewinner` (lists all winners); both configurable via admin panel
- **`/imprint` route**: English version of the imprint page, shows EN by default with 🇩🇪 flag to switch to German
- **Flag-button language toggle** on `/impressum`, `/datenschutz`, and `/imprint` pages — replaces the text "Switch to English / Auf Deutsch" button with a single flag emoji button

### Changed
- **Moderator mini-card font size**: bingo cell numbers in the moderator overview increased from `text-[10px]` to `text-xs` for better readability; removed B/I/N/G/O column header row from mini cards
- **Drawn numbers display** (`NumberBoard`): numbers now shown as larger primary-colored tiles without the B/I/N/G/O column prefix
- **Viewer bingo card** (manual marking only): cells are now click-to-toggle locally; server auto-marking no longer overwrites viewer's own selections; `readOnly` prop added for mod/streamer views
- **Bingo card cell font** increased from `text-sm` to `text-lg` for better visibility
- **Streamer create-game form**: channel name field is now disabled (read-only, auto-populated from the logged-in user's Twitch login)
- **Admin legal pages** (Impressum / Datenschutz): "Felder speichern" button added for intermediate field saves; generate buttons no longer require all fields to be filled; previews render unconditionally

### Fixed
- Unused `COLS` array removed from moderator page after removing column header row

---

## [1.0.4] - 2026-05-31

### Added
- **Bot credentials editor** in admin bot tab: two-section UI with step-by-step guide linking to `dev.twitch.tv/console` and `twitchtokengenerator.com`; fields for Client ID, Client Secret, bot login, Access Token, Refresh Token; saves all fields and reconnects in one click
- **Client-side locale switch** (no page reload): new `LocaleProvider` dynamically imports message bundles client-side; `navbar` and `page-toolbar` use `useLocaleToggle()` hook instead of `window.location.reload()`
- **Markdown preview** for Impressum and Datenschutz in admin: previews now render formatted HTML via `ReactMarkdown` instead of raw markdown text
- **Bot auto-join on game start**: bot joins the streamer's channel automatically when a game starts; manual "Bot-Join" button on streamer page for reconnection

### Changed
- **`GET /games/:id`** now includes `drawnNumbers` relation — fixes drawn numbers display on game and moderator pages (numbers were always empty before)
- **`reconnect()`** re-reads all bot credentials from DB before reconnecting — picks up any credential changes immediately
- **`initializeFromSettings()`** reads `twitch_client_id` from DB with env var as fallback (previously env-only)

### Fixed
- **Drawn numbers not appearing** on game and moderator pages after `!zahl+N` command or moderator draw: root cause was missing `include: { drawnNumbers }` in `getGame`
- **"Invalid refresh token" on startup**: `expiresIn: 0 / obtainmentTimestamp: 0` forced an immediate token refresh before IRC connect; changed to `expiresIn: null / obtainmentTimestamp: Date.now()` so the access token is used as-is until Twitch returns a real 401
- **Bingo error messages in English**: all `BadRequestException` messages in `bingo.service.ts` translated to German

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

---

## [1.0.2] - 2026-05-29

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
