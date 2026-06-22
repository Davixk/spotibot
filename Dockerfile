# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build
# Install dependencies against the lockfile first for better layer caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile
# Build everything: shared types, the web SPA, then the server bundle.
COPY . .
RUN pnpm run build:shared \
  && pnpm --filter @spotibot/web run build \
  && pnpm --filter @spotibot/server run build
# Produce a self-contained server folder with only production dependencies.
# --legacy bundles the workspace @spotibot/shared package into node_modules.
RUN pnpm --filter @spotibot/server deploy --prod --legacy /app/out

FROM base AS runtime
ENV NODE_ENV=production
ENV STATIC_DIR=/app/web
WORKDIR /app
COPY --from=build /app/out/dist ./dist
COPY --from=build /app/out/node_modules ./node_modules
COPY --from=build /app/out/package.json ./package.json
COPY --from=build /app/server/drizzle ./drizzle
COPY --from=build /app/web/dist ./web
EXPOSE 8080
CMD ["node", "dist/index.js"]
