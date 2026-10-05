# ---- base -------------------------------------------------------------------
FROM node:22-alpine AS base
RUN corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app

# ---- deps (cached until package.json / lockfile change) ---------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- dev: hot reload, source is bind-mounted by docker-compose.dev.yml -------
FROM deps AS dev
COPY . .
RUN pnpm prisma generate
EXPOSE 4000
CMD ["sh", "-c", "pnpm prisma db push --accept-data-loss && pnpm dev"]

# ---- build ------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm prisma generate && pnpm build \
 && pnpm prune --prod && pnpm prisma generate

# ---- prod -------------------------------------------------------------------
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4000
CMD ["sh", "-c", "node_modules/.bin/prisma db push --skip-generate && node dist/main.js"]
