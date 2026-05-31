# StreamBingo

**v1.0.4** — Produktionsreife Twitch-Bingo-Plattform für Streamer, Moderatoren und Zuschauer.

> 🇬🇧 [English version → README.md](README.md)

[![CI](https://github.com/X3S2/bingo/actions/workflows/ci.yml/badge.svg)](https://github.com/X3S2/bingo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.4-blue.svg)](CHANGELOG.md)

---

## Features

- **Streamer** – Bingo-Spiele erstellen und verwalten, Channel-Point-Redeems konfigurieren, Gewinnerzahl festlegen
- **Zuschauer** – Mit Twitch anmelden, persönliche 5×5-Bingo-Karte erhalten, Zahlen markieren, Bingo melden
- **Moderatoren** – Alle Karten live einsehen, Zahlen verwalten, nach Bingo-Nähe sortieren
- **Admin-Portal** – Nutzer/Rollen verwalten, Impressum & Datenschutz live editieren, Wartungsmodus, Audit-Log
- **Echtzeit** – Alle Updates via Socket.IO WebSockets (< 500 ms Latenz)
- **Twitch-Integration** – OAuth, IRC-Befehle (`!zahl+N`, `!zahl-N`, `bingo`), EventSub Channel-Point-Redeems
- **Hell/Dunkel-Modus** – Automatische Systemerkennung, sofortiger Wechsel
- **Mehrsprachig** – Deutsch & Englisch (DE/EN), Cookie-basierter Wechsel
- **Mobile-first** – Vollständig responsiv, touch-optimierte Bingo-Karten

---

## Architektur

```
streambingo-proxy  (Nginx)          :4000  ← Öffentlicher Einstiegspunkt
streambingo-web    (Next.js 16)     :4001  ← Frontend
streambingo-api    (NestJS 11)      :4002  ← Backend API + WebSocket
streambingo-db     (PostgreSQL 17)  :4003  ← Datenbank
streambingo-cache  (Redis 7)        :4004  ← Cache
```

Alle Dienste sind Docker-containerisiert und werden über Docker Compose orchestriert. Entwickelt für die Bereitstellung auf Synology NAS via Docker Desktop, erreichbar über eine ipv64.net-Domain.

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
- Einen Twitch-Account für den Bot (oder den Streamer-Account verwenden)

### 1. Repository klonen

```bash
git clone https://github.com/X3S2/bingo.git
cd bingo
```

### 2. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
# .env mit den eigenen Werten befüllen
```

### 3. Mit Docker Compose starten (Entwicklung)

```bash
docker compose up --build
```

Die Plattform ist jetzt unter **http://localhost:4000** erreichbar.

Beim ersten Start führt der **Setup-Assistent** durch:
1. Setup-Token eingeben (aus `ADMIN_SETUP_TOKEN` in `.env`)
2. Twitch App-Zugangsdaten (Client ID + Secret) eintragen
3. Bot-Account konfigurieren (Benutzername, Access Token, Refresh Token)

### 4. Produktions-Deployment (Synology NAS)

```bash
docker compose -f docker-compose.prod.yml up -d
```

Vollständige Anleitung: [docs/deployment-synology.md](docs/deployment-synology.md)

---

## Twitch-App einrichten

1. Auf [dev.twitch.tv/console](https://dev.twitch.tv/console) → **Anwendung registrieren**
2. **OAuth-Redirect-URL** exakt eintragen: `https://deinedomain.de/api/auth/callback/twitch`  
   ⚠️ Kein abschließender Schrägstrich. Für lokale Entwicklung: `http://localhost:4000/api/auth/callback/twitch`
3. **Client ID** und **Client Secret** kopieren — werden im Setup-Assistenten eingegeben (nicht in `.env`)  
   ℹ️ Diese App-Zugangsdaten laufen **nicht ab** und müssen nicht erneuert werden.
4. Bot-Zugangsdaten: Access Token + Refresh Token über [twitchtokengenerator.com](https://twitchtokengenerator.com) generieren  
   ⚠️ Diese **User Access Tokens** laufen ab. StreamBingo verwendet `RefreshingAuthProvider` (@twurple/auth) — abgelaufene Tokens werden automatisch erneuert und in der Datenbank gespeichert. Daher muss **unbedingt ein Refresh Token** mit generiert und eingetragen werden.

---

## Umgebungsvariablen

| Variable | Beschreibung | Pflicht |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL-Verbindungsstring | ✅ |
| `REDIS_URL` | Redis-Verbindungsstring | ✅ |
| `TWITCH_CLIENT_ID` | Twitch App Client ID (Fallback; Setup-Wert hat Vorrang) | ✅ |
| `TWITCH_CLIENT_SECRET` | Twitch App Client Secret (Fallback) | ✅ |
| `TWITCH_REDIRECT_URI` | OAuth-Callback-URL | ✅ |
| `TWITCH_EVENTSUB_SECRET` | HMAC-Secret für EventSub | ✅ |
| `JWT_SECRET` | JWT-Secret (min. 32 Zeichen) | ✅ |
| `JWT_EXPIRES_IN` | JWT-Ablaufzeit (z. B. `7d`) | ✅ |
| `NEXT_PUBLIC_API_URL` | Backend-API-URL (öffentlich) | ✅ |
| `NEXT_PUBLIC_WS_URL` | WebSocket-URL (öffentlich) | ✅ |
| `ADMIN_SETUP_TOKEN` | Einmaliges Setup-Token | ✅ |
| `NODE_ENV` | `development` oder `production` | ✅ |

---

## Rollen

| Rolle | Berechtigungen |
|-------|---------------|
| `VIEWER` | Eigene Karte ansehen, Zahlen markieren, Bingo melden |
| `MODERATOR` | Alle Viewer-Rechte + alle Karten einsehen, Zahlen verwalten |
| `STREAMER` | Alle Moderator-Rechte + Spiele erstellen/verwalten, Redeems konfigurieren |
| `ADMIN` | Vollständige Plattformkontrolle, alle Nutzer und Spiele verwalten |

Der **erste Nutzer**, der sich über Twitch anmeldet, wird automatisch zum Admin.

---

## API-Übersicht

| Endpunkt | Methode | Auth | Beschreibung |
|----------|---------|------|-------------|
| `/api/auth/twitch` | GET | — | Twitch OAuth starten |
| `/api/auth/callback/twitch` | GET | — | OAuth-Callback |
| `/api/auth/logout` | POST | Nutzer | Abmelden |
| `/api/games` | POST | Streamer | Neues Bingo-Spiel erstellen |
| `/api/games/:id` | PATCH | Streamer | Spiel aktualisieren (starten/beenden) |
| `/api/games/:id/numbers` | POST | Mod/Streamer | Zahl ziehen |
| `/api/games/:id/cards` | GET | Mod/Streamer | Alle Karten abrufen |
| `/api/admin/users` | GET | Admin | Alle Nutzer auflisten |
| `/api/admin/settings` | GET/PATCH | Admin | Plattformeinstellungen |
| `/api/setup` | POST | — | Ersteinrichtung (Assistent) |

---

## Projektstruktur

```
bingo/
├── frontend/          # Next.js 16 App Router
├── backend/           # NestJS 11 API
│   └── prisma/        # Prisma-Schema & Migrationen
├── docker/            # Docker & Nginx-Konfigurationen
├── docs/              # Dokumentation
├── .github/           # GitHub Actions Workflows
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env.example
```

---

## Versionierung

Dieses Projekt verwendet [Semantic Versioning](https://semver.org/): `X.Y.Z`

- `X` (Major): Breaking Changes
- `Y` (Minor): Neue Features / Phasenabschlüsse
- `Z` (Patch): Bugfixes und kleine Verbesserungen

Vollständige Historie: [CHANGELOG.md](CHANGELOG.md)

---

## Lizenz

[MIT](LICENSE) © 2026 X3S2
