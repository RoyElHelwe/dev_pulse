# ---- base -------------------------------------------------------------------
FROM node:22-alpine AS base
RUN corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---- deps (cached until package.json / lockfile change) ---------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- dev: hot reload, source is bind-mounted by docker-compose.dev.yml -------
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

# ---- build ------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm build

# ---- prod: Next.js standalone server ----------------------------------------
FROM base AS prod
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
