# ----- KAMBRIQ API - Production Dockerfile ----- #

FROM node:24.13.1-bookworm AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci
RUN npx prisma generate --schema prisma/core/schema.prisma && \
    npx prisma generate --schema prisma/kbs/schema.prisma

COPY tsconfig.base.json ./
COPY apps/api ./apps/api/
COPY libs ./libs/

RUN npm run build

FROM node:24.13.1-bookworm AS production

RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -m -s /usr/sbin/nologin appuser

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma/

RUN npm ci --only=production && \
    npx prisma generate --schema prisma/core/schema.prisma && \
    npx prisma generate --schema prisma/kbs/schema.prisma && \
    npm cache clean --force

COPY --from=builder /app/dist/apps/api ./dist/apps/api
COPY --from=builder /app/libs/common/src/i18n ./libs/common/src/i18n

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 CMD [ "wget", "-q", "--spider", "http://localhost:3000/health" ] || exit 1

CMD ["node", "dist/apps/api/main.js"]
