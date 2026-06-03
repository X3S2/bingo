# StreamBingo

**v1.6.0** — Produktionsreife Twitch-Bingo-Plattform für Streamer, Moderatoren und Zuschauer.

> 🇬🇧 [English version → README.md](README.md)

[![CI](https://github.com/X3S2/bingo/actions/workflows/ci.yml/badge.svg)](https://github.com/X3S2/bingo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.6.0-blue.svg)](CHANGELOG.md)

---

## Features

- **Streamer** — Bingo-Spiele erstellen und verwalten, Channel-Point-Redeems konfigurieren, Gewinnerzahl festlegen
- **Zuschauer** — Mit Twitch anmelden, persönliche 5×5-Bingo-Karte erhalten, Zahlen manuell markieren, Bingo melden
- **Moderatoren** — Alle Karten live einsehen, Zahlen ziehen/entfernen, Zufallszug mit Ballanimation, nach Bingo-Nähe sortieren
- **Admin-Portal** — Nutzer/Rollen verwalten, Impressum & Datenschutz live editieren, Wartungsmodus, Audit-Log
- **Echtzeit** — Alle Updates via Socket.IO WebSockets (< 500 ms Latenz)
- **Twitch-Integration** — OAuth, IRC-Befehle (`!zahl+N`, `!zahl-N`, `!zahlziehen`, `bingo`, `!buycard`), EventSub Channel-Point-Redeems
- **Channel Points XOR !buycard** — Wenn Channel-Point-Rewards konfiguriert und aktiv sind, wird `!buycard` stillschweigend ignoriert — entweder einer der Modi, nicht beide
- **In-App Bot-Autorisierung** — Bot-Account direkt im Admin-Panel mit der eigenen App-Client-ID autorisieren (kein externes Tool nötig)
- **Broadcaster-Modus** — Chat-Nachrichten optional über den eigenen Streamer-Account senden statt über einen separaten Bot-Account
- **Automatisches Token-Refresh** — Abgelaufene Twitch-Tokens werden über `RefreshingAuthProvider` automatisch erneuert und in der Datenbank gespeichert
- **Ballanimation** — 14-Ball-Animation bei Zufallszügen, synchron für alle Zuschauer (1,2 s Flug + 3 s Final, kein Gap)
- **Buycard-Bedingungen** — Unabhängige Follower/Abonnent-Checkboxen mit Hierarchie (Abonnenten erfüllen Follower-Bedingung); Staff immer freigestellt
- **Hell/Dunkel-Modus** — Automatische Systemerkennung, sofortiger Wechsel
- **Mehrsprachig** — Deutsch & Englisch (DE/EN), Cookie-basierter Wechsel
- **Mobile-first** — Vollständig responsiv, touch-optimierte Bingo-Karten

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
| Datenbank | PostgreSQL 17 + Prisma ORM |
| Cache | Redis 7 |
| Proxy | Nginx |
| Auth | Twitch OAuth2 |
| Twitch | @twurple/auth, @twurple/chat, @twurple/api |
| CI/CD | GitHub Actions |
| Container | Docker, Docker Compose |

---

## Schnellstart

### Voraussetzungen

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (Windows) oder Docker Engine (Linux)
- Eine [Twitch Developer Application](https://dev.twitch.tv/console) (Client ID + Secret)

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

### 3. Mit Docker Compose starten

```bash
docker compose up --build
```

Die Plattform ist jetzt unter **http://localhost:4000** erreichbar.

Beim ersten Start führt der **Setup-Assistent** durch:
1. Setup-Token eingeben (aus `ADMIN_SETUP_TOKEN` in `.env`)
2. Twitch App-Zugangsdaten (Client ID + Secret) eintragen
3. Bot-Account konfigurieren (siehe [Twitch-App einrichten](#twitch-app-einrichten))

### 4. Synology NAS (Container Manager, ohne Konsole)

Der Synology Container Manager liest **keine `.env`-Datei** automatisch — alle Variablen müssen direkt im YAML eingetragen sein. Verwende dafür die mitgelieferte `docker-compose.nas.yml`:

1. **File Station** → Projektordner → `docker-compose.nas.yml` öffnen
2. Alle `ANPASSEN_*`-Platzhalter durch echte Werte ersetzen und speichern
3. **Container Manager** → Projekt → **Erstellen** → Inhalt der `docker-compose.nas.yml` einfügen

> ⚠️ Die reguläre `docker-compose.yml` mit `${VARIABLE}`-Syntax **nicht** im Container Manager verwenden — die Platzhalter werden dort nicht aufgelöst.

---

## Twitch-App einrichten

### Schritt 1: Twitch Developer Application

1. Auf [dev.twitch.tv/console](https://dev.twitch.tv/console) → **Anwendung registrieren**
2. **OAuth-Redirect-URL** exakt eintragen (kein abschließender Schrägstrich):
   ```
   https://deinedomain.de/api/auth/callback/twitch
   ```
   Für lokale Entwicklung: `http://localhost:4000/api/auth/callback/twitch`
3. **Client ID** und **Client Secret** kopieren — werden im Setup-Assistenten eingegeben
   > ℹ️ Diese App-Zugangsdaten laufen **nicht ab** und müssen nie erneuert werden.

### Schritt 2: Bot-Account autorisieren (empfohlen)

StreamBingo enthält einen **In-App OAuth-Flow** für den Bot-Account:

1. Im Admin-Portal → Tab **Bot** → **Bot-Account autorisieren** klicken
2. Twitch-Login öffnet sich — als **Bot-Account** einloggen (nicht als Streamer)
3. Token und Benutzername werden automatisch gespeichert
4. Bot verbindet sich automatisch neu

> ✅ **Empfohlen:** Diese Methode verwendet die eigene App-Client-ID — Token-Refresh funktioniert zuverlässig.  
> ⚠️ **Nicht empfohlen:** Tokens von externen Tools wie `twitchtokengenerator.com` sind an deren Client-ID gebunden und können mit dieser App **nicht** erneuert werden (Fehler 400 bei Refresh).

---

## Bot-Konfiguration

### IRC-Befehle

| Befehl | Berechtigung | Funktion |
|--------|-------------|----------|
| `!zahl+N` | Mod / Broadcaster | Zahl N ziehen |
| `!zahl-N` | Mod / Broadcaster | Zahl N entfernen |
| `bingo` | Alle | Bingo melden |
| `!buycard` | Alle | Bingo-Karte erhalten |
| `!zahlen` | Alle | Gezogene Zahlen anzeigen |
| `!bingogewinner` | Alle | Gewinner anzeigen |
| `!bingolink` | Alle | Spiel-Link im Chat posten |

Alle Befehlsnamen und Berechtigungen können im Admin-Portal → Bot → Chat-Befehle angepasst werden.

### Broadcaster-Modus

Wenn aktiviert (**Admin → Bot → Broadcaster-Modus**), werden ausgehende Chat-Nachrichten über den eigenen Twitch-Account des Streamers gesendet statt über den Bot-Account.

**Vorteile:**
- Eigener Account kann nicht durch Anti-Spam-Filter (StreamElements, Nightbot etc.) blockiert werden
- Slow-Mode gilt nicht für den Broadcaster selbst
- Kein separater Bot-Account nötig

Der Bot-Account wird weiterhin zum **Empfangen** von Befehlen verwendet (falls konfiguriert).

### Automatisches Token-Refresh

StreamBingo verwendet `RefreshingAuthProvider` von `@twurple/auth`:
- Abgelaufene Tokens werden **automatisch** im Hintergrund erneuert
- Aktualisierte Tokens werden direkt in der Datenbank gespeichert
- Kein manuelles Eingreifen nötig (solange ein gültiger Refresh Token vorhanden ist)

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

Der **erste Nutzer**, der sich über Twitch anmeldet und den Setup-Assistenten abschließt, wird automatisch zum Admin. Weitere Admins können im Admin-Portal ernannt werden.

Moderatoren werden **automatisch pro Kanal** über die Twitch Helix API (`/helix/moderation/channels`) erkannt. Die Prüfung erfolgt beim Login und in konfigurierbaren Intervallen (Standard: 10 Minuten). Verliert ein Nutzer alle Mod-Rechte, wird seine Rolle auf `VIEWER` zurückgestuft.

---

## API-Übersicht

| Endpunkt | Methode | Auth | Beschreibung |
|----------|---------|------|-------------|
| `/api/auth/twitch` | GET | — | Twitch OAuth starten |
| `/api/auth/bot-twitch` | GET | Admin | Bot-Account OAuth starten |
| `/api/auth/callback/twitch` | GET | — | OAuth-Callback |
| `/api/auth/logout` | POST | Nutzer | Abmelden |
| `/api/games` | POST | Streamer | Neues Bingo-Spiel erstellen |
| `/api/games/:id` | PATCH | Streamer | Spiel aktualisieren (starten/beenden) |
| `/api/games/:id/numbers` | POST | Mod/Streamer | Zahl ziehen |
| `/api/games/:id/cards` | GET | Mod/Streamer | Alle Karten abrufen |
| `/api/admin/users` | GET | Admin | Alle Nutzer auflisten |
| `/api/admin/settings` | GET/PATCH | Admin | Plattformeinstellungen |
| `/api/admin/bot-status` | GET | Admin | IRC-Bot-Status abrufen |
| `/api/admin/bot-reconnect` | POST | Admin | Bot neu verbinden |
| `/api/admin/bot-broadcaster-mode` | POST | Admin | Broadcaster-Modus umschalten |
| `/api/setup` | POST | — | Ersteinrichtung (Assistent) |

---

## Projektstruktur

```
bingo/
├── frontend/               # Next.js 16 App Router
├── backend/                # NestJS 11 API
│   └── prisma/             # Prisma-Schema & Migrationen
├── docker/                 # Docker & Nginx-Konfigurationen
├── .github/                # GitHub Actions Workflows
├── docker-compose.yml      # Lokale Entwicklung
├── docker-compose.nas.yml  # Synology NAS / Container Manager
└── .env.example
```

---

## CI/CD

GitHub Actions führt bei jedem Push auf `master` automatisch aus:
- **Backend:** `npm ci` → Prisma Client generieren → ESLint → `nest build`
- **Frontend:** `npm ci` → ESLint → `next build`

Docker-Images werden bei Git-Tags (`v*`) automatisch gebaut und in die GitHub Container Registry (`ghcr.io`) gepusht.

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
