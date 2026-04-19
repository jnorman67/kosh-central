#!/bin/sh
set -e

mkdir -p /app/data

litestream restore -if-db-not-exists -if-replica-exists -config /etc/litestream.yml /app/data/kosh.db

exec litestream replicate -config /etc/litestream.yml -exec "node packages/server/dist/index.js"
