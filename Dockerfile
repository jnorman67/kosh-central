# syntax=docker/dockerfile:1.7

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
ENV NODE_ENV=production
ENV PORT=3001
ENV KOSH_DATA_DIR=/data

# Static artifacts + prod deps
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/client/dist packages/client/dist
COPY --from=prod-deps /app/node_modules node_modules
COPY package.json ./
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# /data is the mount point for the Azure File share (manifest, SQLite DB, MSAL cache).
VOLUME ["/data"]

EXPOSE 3001
CMD ["node", "packages/server/dist/index.js"]
