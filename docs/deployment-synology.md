# StreamBingo — Synology NAS Deployment Guide

This guide explains how to deploy StreamBingo on a Synology NAS using Container Manager (Docker Compose).

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Synology NAS with DSM 7.2+ | |
| Container Manager package | Install via Package Center |
| Domain + DDNS | e.g. `yourdomain.ipv64.net` |
| Port forwarding | 80 → NAS:80, 443 → NAS:443 (or custom ports) |
| GitHub account | To pull images from GHCR |

---

## 1. Twitch Developer Setup

1. Go to [dev.twitch.tv/console](https://dev.twitch.tv/console)
2. Click **Register Your Application**
3. Set:
   - **Name**: StreamBingo (or custom)
   - **OAuth Redirect URLs**: `https://yourdomain.ipv64.net/api/auth/callback/twitch`
   - **Category**: Website Integration
4. Copy **Client ID** and **Client Secret**

---

## 2. Prepare the NAS

### 2a. Create Folder Structure

Via File Station or SSH:

```bash
mkdir -p /volume1/docker/streambingo/{data,backups,nginx-certs}
```

### 2b. Upload Project Files

Upload these files to `/volume1/docker/streambingo/`:
- `docker-compose.prod.yml`
- `.env` (copy from `.env.example` and fill in values)
- `docker/nginx/nginx.conf`

---

## 3. Configure Environment Variables

Create `/volume1/docker/streambingo/.env` based on `.env.example`:

```env
NODE_ENV=production
APP_URL=https://yourdomain.ipv64.net

# JWT — generate with: openssl rand -hex 32
JWT_SECRET=GENERATE_ME_MIN_32_CHARS
JWT_EXPIRES_IN=7d

# Twitch OAuth
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_REDIRECT_URI=https://yourdomain.ipv64.net/api/auth/callback/twitch
TWITCH_EVENTSUB_SECRET=GENERATE_ME_RANDOM_SECRET
TWITCH_EVENTSUB_CALLBACK_URL=https://yourdomain.ipv64.net/api/eventsub

# Database
DATABASE_URL=postgresql://streambingo:SECURE_PASSWORD@streambingo-db:5432/streambingo?schema=public
POSTGRES_DB=streambingo
POSTGRES_USER=streambingo
POSTGRES_PASSWORD=SECURE_PASSWORD_HERE

# Redis
REDIS_URL=redis://streambingo-cache:6379

# Frontend
NEXTAUTH_URL=https://yourdomain.ipv64.net
NEXT_PUBLIC_API_URL=https://yourdomain.ipv64.net/api
NEXT_PUBLIC_WS_URL=https://yourdomain.ipv64.net
INTERNAL_API_URL=http://streambingo-api:3001

# Setup
ADMIN_SETUP_TOKEN=GENERATE_ME_RANDOM_SETUP_TOKEN
```

> **Security**: Never commit `.env` to version control.  
> Generate secrets with: `openssl rand -hex 32`

---

## 4. Deploy with Container Manager

### Option A: Container Manager UI

1. Open **Container Manager** in DSM
2. Go to **Project** → **Create**
3. Set:
   - **Project name**: `streambingo`
   - **Path**: `/volume1/docker/streambingo`
   - **Compose file**: `docker-compose.prod.yml`
4. Click **Next** → **Build**

### Option B: SSH

```bash
ssh admin@NAS_IP
cd /volume1/docker/streambingo
docker compose -f docker-compose.prod.yml up -d
```

---

## 5. First Run Setup

1. Open `https://yourdomain.ipv64.net/setup` in your browser
2. Enter:
   - **Bot Twitch Username**: Your bot account's username
   - **Bot Access Token**: Generate at [twitchapps.com/tmi](https://twitchapps.com/tmi/)
   - **Setup Token**: The value of `ADMIN_SETUP_TOKEN` from your `.env`
3. Log in with your Twitch account via the main page
4. Your account will be automatically promoted to **ADMIN**

---

## 6. Reverse Proxy / SSL

### Using Synology Reverse Proxy (recommended)

1. **Control Panel** → **Login Portal** → **Advanced** → **Reverse Proxy**
2. Add rule:
   - **Source**: `https yourdomain.ipv64.net:443`
   - **Destination**: `http localhost:4000`
3. Enable **WebSocket** support in the rule

### Using Let's Encrypt (automatic TLS)

1. **Control Panel** → **Security** → **Certificate**
2. Add certificate → **Get a certificate from Let's Encrypt**
3. Enter your domain and follow the wizard

### Custom Nginx TLS (advanced)

Mount certificates in `docker-compose.prod.yml`:

```yaml
nginx:
  volumes:
    - /volume1/docker/streambingo/nginx-certs:/etc/nginx/certs:ro
```

Update `nginx.conf` to add HTTPS listener with your cert paths.

---

## 7. Database Backups

### Manual Backup

```bash
docker exec streambingo-db pg_dump -U streambingo streambingo > /volume1/docker/streambingo/backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

### Automated Backup with Synology Task Scheduler

1. **Control Panel** → **Task Scheduler** → **Create** → **Scheduled Task** → **User-defined script**
2. Configure:
   - **Schedule**: Daily at 03:00
   - **Script**:

```bash
#!/bin/bash
BACKUP_DIR="/volume1/docker/streambingo/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec streambingo-db pg_dump -U streambingo streambingo > "$BACKUP_DIR/backup_$DATE.sql"
# Keep only last 7 backups
ls -t "$BACKUP_DIR"/backup_*.sql | tail -n +8 | xargs -r rm --
```

---

## 8. Updating StreamBingo

```bash
cd /volume1/docker/streambingo
# Pull latest images
docker compose -f docker-compose.prod.yml pull
# Restart with new images
docker compose -f docker-compose.prod.yml up -d
# Run migrations if needed
docker exec streambingo-api npx prisma migrate deploy
```

---

## 9. Troubleshooting

### Check Service Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs --tail=50

# Specific service
docker compose -f docker-compose.prod.yml logs streambingo-api --tail=100
```

### Common Issues

| Issue | Solution |
|---|---|
| `502 Bad Gateway` | Backend not ready yet, wait ~30s for startup |
| OAuth redirect mismatch | Ensure `TWITCH_REDIRECT_URI` matches exactly what's in Twitch dev console |
| WebSocket disconnects | Enable WebSocket support in Synology reverse proxy |
| Database connection failed | Check `POSTGRES_PASSWORD` matches in both `DATABASE_URL` and `POSTGRES_PASSWORD` |
| Twitch EventSub not working | Ensure your domain is publicly accessible and port 443 is forwarded |

---

## 10. Monitoring

Check container health:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output:
```
streambingo-proxy    Up X hours (healthy)   0.0.0.0:4000->80/tcp
streambingo-api      Up X hours (healthy)   3001/tcp
streambingo-web      Up X hours (healthy)   3000/tcp
streambingo-db       Up X hours (healthy)   5432/tcp
streambingo-cache    Up X hours (healthy)   6379/tcp
```

---

## Security Checklist

- [ ] `.env` file permissions: `chmod 600 .env`
- [ ] Strong `JWT_SECRET` (min 32 chars, random)
- [ ] Strong `POSTGRES_PASSWORD`
- [ ] Strong `ADMIN_SETUP_TOKEN` (delete from `.env` after setup)
- [ ] HTTPS enabled (Let's Encrypt)
- [ ] Synology Firewall: only 80/443 open to internet
- [ ] Regular database backups configured
- [ ] Twitch EventSub secret configured and random
