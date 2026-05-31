# ── Development stage ──────────────────────────────────────────────
FROM node:22-alpine AS development
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── Build stage ────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
# Include CHANGELOG from project root so it is served as a static file
COPY CHANGELOG.md ./public/CHANGELOG.md
RUN npm run build

# ── Production stage ───────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY frontend/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000
CMD ["npm", "start"]
