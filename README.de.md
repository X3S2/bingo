# StreamBingo

**v1.2.0** — Produktionsreife Twitch-Bingo-Plattform für Streamer, Moderatoren und Zuschauer.

> ðŸ‡¬ðŸ‡§ [English version â†’ README.md](README.md)

[![CI](https://github.com/X3S2/bingo/actions/workflows/ci.yml/badge.svg)](https://github.com/X3S2/bingo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](CHANGELOG.md)

---

## Features

- **Streamer** â€“ Bingo-Spiele erstellen und verwalten, Channel-Point-Redeems konfigurieren, Gewinnerzahl festlegen
- **Zuschauer** â€“ Mit Twitch anmelden, persÃ¶nliche 5Ã—5-Bingo-Karte erhalten, Zahlen markieren, Bingo melden
- **Moderatoren** â€“ Alle Karten live einsehen, Zahlen verwalten, nach Bingo-NÃ¤he sortieren
- **Admin-Portal** â€“ Nutzer/Rollen verwalten, Impressum & Datenschutz live editieren, Wartungsmodus, Audit-Log
- **Echtzeit** â€“ Alle Updates via Socket.IO WebSockets (< 500 ms Latenz)
- **Twitch-Integration** â€“ OAuth, IRC-Befehle (`!zahl+N`, `!zahl-N`, `bingo`), EventSub Channel-Point-Redeems
- **Hell/Dunkel-Modus** â€“ Automatische Systemerkennung, sofortiger Wechsel
- **Mehrsprachig** â€“ Deutsch & Englisch (DE/EN), Cookie-basierter Wechsel
- **Mobile-first** â€“ VollstÃ¤ndig responsiv, touch-optimierte Bingo-Karten

---

## Architektur

```
streambingo-proxy  (Nginx)          :4000  â† Ã–ffentlicher Einstiegspunkt
streambingo-web    (Next.js 16)     :4001  â† Frontend
streambingo-api    (NestJS 11)      :4002  â† Backend API + WebSocket
streambingo-db     (PostgreSQL 17)  :4003  â† Datenbank
streambingo-cache  (Redis 7)        :4004  â† Cache
```

Alle Dienste sind Docker-containerisiert und werden Ã¼ber Docker Compose orchestriert. Entwickelt fÃ¼r die Bereitstellung auf Synology NAS via Docker Desktop, erreichbar Ã¼ber eine ipv64.net-Domain.

---

## Tech-Stack

| Schicht | Technologie |
|---------|------------|
| Frontend | Next.js 16 (App Router, Turbopack), TypeScript, TailwindCSS 4, shadcn/ui |
| Backend | NestJS 11, TypeScript, Socket.IO |
| Datenbank | PostgreSQL 17 + Prisma ORM v7 |
| Cache | Redis 7 |
| Proxy | Nginx |
| Auth | Twitch OAuth2 |
| Echtzeit | Twitch IRC (@twurple/chat), Twitch EventSub |
| CI/CD | GitHub Actions |
| Container | Docker, Docker Compose |

---

## Schnellstart

### Voraussetzungen

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (Windows) oder Docker Engine (Linux)
- Eine [Twitch Developer Application](https://dev.twitch.tv/console) (Client ID + Secret)
- Einen Twitch-Account fÃ¼r den Bot (oder den Streamer-Account verwenden)

### 1. Repository klonen

```bash
git clone https://github.com/X3S2/bingo.git
cd bingo
```

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
# .env mit den eigenen Werten befÃ¼llen
```

### 3. Mit Docker Compose starten (Entwicklung)

```bash
docker compose up --build
```

Die Plattform ist jetzt unter **http://localhost:4000** erreichbar.

Beim ersten Start fÃ¼hrt der **Setup-Assistent** durch:
1. Setup-Token eingeben (aus `ADMIN_SETUP_TOKEN` in `.env`)
2. Twitch App-Zugangsdaten (Client ID + Secret) eintragen
3. Bot-Account konfigurieren (Benutzername, Access Token, Refresh Token)

### 4. Produktions-Deployment (Synology NAS)

```bash
docker compose -f docker-compose.prod.yml up -d
```

VollstÃ¤ndige Anleitung: [docs/deployment-synology.md](docs/deployment-synology.md)

---

## Twitch-App einrichten

1. Auf [dev.twitch.tv/console](https://dev.twitch.tv/console) â†’ **Anwendung registrieren**
2. **OAuth-Redirect-URL** exakt eintragen: `https://deinedomain.de/api/auth/callback/twitch`  
   âš ï¸ Kein abschlieÃŸender SchrÃ¤gstrich. FÃ¼r lokale Entwicklung: `http://localhost:4000/api/auth/callback/twitch`
3. **Client ID** und **Client Secret** kopieren â€” werden im Setup-Assistenten eingegeben (nicht in `.env`)  
   â„¹ï¸ Diese App-Zugangsdaten laufen **nicht ab** und mÃ¼ssen nicht erneuert werden.
4. Bot-Zugangsdaten: Access Token + Refresh Token Ã¼ber [twitchtokengenerator.com](https://twitchtokengenerator.com) generieren  
   âš ï¸ Diese **User Access Tokens** laufen ab. StreamBingo verwendet `RefreshingAuthProvider` (@twurple/auth) â€” abgelaufene Tokens werden automatisch erneuert und in der Datenbank gespeichert. Daher muss **unbedingt ein Refresh Token** mit generiert und eingetragen werden.

---

## Umgebungsvariablen

| Variable | Beschreibung | Pflicht |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL-Verbindungsstring | âœ… |
| `REDIS_URL` | Redis-Verbindungsstring | âœ… |
| `TWITCH_CLIENT_ID` | Twitch App Client ID (Fallback; Setup-Wert hat Vorrang) | âœ… |
| `TWITCH_CLIENT_SECRET` | Twitch App Client Secret (Fallback) | âœ… |
| `TWITCH_REDIRECT_URI` | OAuth-Callback-URL | âœ… |
| `TWITCH_EVENTSUB_SECRET` | HMAC-Secret fÃ¼r EventSub | âœ… |
| `JWT_SECRET` | JWT-Secret (min. 32 Zeichen) | âœ… |
| `JWT_EXPIRES_IN` | JWT-Ablaufzeit (z. B. `7d`) | âœ… |
| `NEXT_PUBLIC_API_URL` | Backend-API-URL (Ã¶ffentlich) | âœ… |
| `NEXT_PUBLIC_WS_URL` | WebSocket-URL (Ã¶ffentlich) | âœ… |
| `ADMIN_SETUP_TOKEN` | Einmaliges Setup-Token | âœ… |
| `NODE_ENV` | `development` oder `production` | âœ… |

---

## Rollen

| Rolle | Berechtigungen |
|-------|---------------|
| `VIEWER` | Eigene Karte ansehen, Zahlen markieren, Bingo melden |
| `MODERATOR` | Alle Viewer-Rechte + alle Karten einsehen, Zahlen verwalten |
| `STREAMER` | Alle Moderator-Rechte + Spiele erstellen/verwalten, Redeems konfigurieren |
| `ADMIN` | VollstÃ¤ndige Plattformkontrolle, alle Nutzer und Spiele verwalten |

Der **erste Nutzer**, der sich Ã¼ber Twitch anmeldet, wird automatisch zum Admin.

---

## API-Ãœbersicht

| Endpunkt | Methode | Auth | Beschreibung |
|----------|---------|------|-------------|
| `/api/auth/twitch` | GET | â€” | Twitch OAuth starten |
| `/api/auth/callback/twitch` | GET | â€” | OAuth-Callback |
| `/api/auth/logout` | POST | Nutzer | Abmelden |
| `/api/games` | POST | Streamer | Neues Bingo-Spiel erstellen |
| `/api/games/:id` | PATCH | Streamer | Spiel aktualisieren (starten/beenden) |
| `/api/games/:id/numbers` | POST | Mod/Streamer | Zahl ziehen |
| `/api/games/:id/cards` | GET | Mod/Streamer | Alle Karten abrufen |
| `/api/admin/users` | GET | Admin | Alle Nutzer auflisten |
| `/api/admin/settings` | GET/PATCH | Admin | Plattformeinstellungen |
| `/api/setup` | POST | â€” | Ersteinrichtung (Assistent) |

---

## Projektstruktur

```
bingo/
â”œâ”€â”€ frontend/          # Next.js 16 App Router
â”œâ”€â”€ backend/           # NestJS 11 API
â”‚   â””â”€â”€ prisma/        # Prisma-Schema & Migrationen
â”œâ”€â”€ docker/            # Docker & Nginx-Konfigurationen
â”œâ”€â”€ docs/              # Dokumentation
â”œâ”€â”€ .github/           # GitHub Actions Workflows
â”œâ”€â”€ docker-compose.yml
â”œâ”€â”€ docker-compose.prod.yml
â””â”€â”€ .env.example
```

---

## Versionierung

Dieses Projekt verwendet [Semantic Versioning](https://semver.org/): `X.Y.Z`

- `X` (Major): Breaking Changes
- `Y` (Minor): Neue Features / PhasenabschlÃ¼sse
- `Z` (Patch): Bugfixes und kleine Verbesserungen

VollstÃ¤ndige Historie: [CHANGELOG.md](CHANGELOG.md)

---

## Lizenz

[MIT](LICENSE) Â© 2026 X3S2

