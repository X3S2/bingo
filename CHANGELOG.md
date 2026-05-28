# Changelog

All notable changes to StreamBingo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
