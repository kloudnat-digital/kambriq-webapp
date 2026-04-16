# ----- KAMBRIQ API - Production Dockerfile ----- #

FROM node:24.13.1-bookworm AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile
RUN npx prisma generate --schema prisma/core/schema.prisma && \
    npx prisma generate --schema prisma/kbs/schema.prisma && \
    npx prisma generate --schema prisma/kamnet/schema.prisma && \
    npx prisma generate --schema prisma/lands/schema.prisma

COPY tsconfig.base.json ./
COPY apps/api ./apps/api/
COPY libs ./libs/

RUN pnpm run build

FROM node:24.13.1-bookworm AS production

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -m -s /usr/sbin/nologin appuser

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/prisma ./prisma/

RUN pnpm install --frozen-lockfile --prod && \
    npx prisma generate --schema prisma/core/schema.prisma && \
    npx prisma generate --schema prisma/kbs/schema.prisma && \
    npx prisma generate --schema prisma/kamnet/schema.prisma && \
    npx prisma generate --schema prisma/lands/schema.prisma && \
    pnpm store prune

COPY --from=builder /app/dist/apps/api ./dist/apps/api
COPY --from=builder /app/libs/common/src/i18n ./libs/common/src/i18n

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 CMD [ "wget", "-q", "--spider", "http://localhost:3000/health" ] || exit 1

CMD ["node", "dist/apps/api/main.js"]
