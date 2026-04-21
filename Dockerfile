# syntax=docker/dockerfile:1.7

# ---- litestream: source for the Litestream binary ----
FROM litestream/litestream:latest AS litestream

# ---- builder: compile TypeScript ----
FROM node:22 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci
COPY . .
RUN npm run build

# ---- prod-deps: isolate production-only node_modules ----
FROM node:22 AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci --omit=dev

# ---- runtime: minimal final image ----
FROM node:22-slim AS runtime
WORKDIR /app
ARG GIT_SHA=unknown
ENV NODE_ENV=production
ENV PORT=3001
ENV KOSH_DATA_DIR=/data
ENV KOSH_DB_PATH=/app/data/kosh.db
ENV GIT_SHA=$GIT_SHA

# Static artifacts + prod deps
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/client/dist packages/client/dist
COPY --from=prod-deps /app/node_modules node_modules
COPY package.json ./
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Litestream: replicate the SQLite DB on local disk to Azure Blob Storage.
COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream
COPY litestream.yml /etc/litestream.yml
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# /data is the Azure File share for non-SQLite state (manifest.json, MSAL cache).
VOLUME ["/data"]

EXPOSE 3001
ENTRYPOINT ["/docker-entrypoint.sh"]
