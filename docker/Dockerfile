# ----- KAMBRIQ API - Production Dockerfile ----- #

FROM node:24.13.1-bookworm AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci
RUN npx prisma generate

COPY tsconfig.base.json ./
COPY apps/api ./apps/api/
COPY libs ./libs/

RUN npx tsc -p apps/api/tsconfig.app.json

FROM node:24.13.1-bookworm AS production

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma/

RUN npm ci --only=production && \
    npx prisma generate && \
    npm cache clean --force

COPY --from=builder /app/apps/api/dist ./dist

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 CMD [ "wget", "-q", "--spider", "http://localhost:3000/health" ] || exit 1

CMD ["node", "dist/main.js"]
