# Kosh Central task runner.
#
# Thin wrapper over the npm scripts in the root and the two workspaces
# (packages/server, packages/client), plus the one-off scripts in
# packages/server/scripts. The npm scripts remain the source of truth — targets
# here just save typing and document the common combinations. Node 22 is required.
#
# Run `make help` for the list of targets. Targets that take a path are passed
# it as a variable, e.g. `make scan DIR="/mnt/c/Users/me/OneDrive/Photo Vault"`.

SHELL := /bin/bash

SERVER_WS := @kosh-central/server
CLIENT_WS := @kosh-central/client
SERVER_DIR := packages/server
SCRIPTS_DIR := $(SERVER_DIR)/scripts

# Local dev database (the server's default when KOSH_DB_PATH is unset).
DEV_DB := $(CURDIR)/$(SERVER_DIR)/kosh.db

# Production database. SQLite has no network endpoint to proxy to, so the
# equivalent of a db proxy is a point-in-time copy restored from the Litestream
# replica in Azure Blob Storage (see litestream.yml). The copy is gitignored
# (*.db) and is never replicated back, so it is safe to poke at or to run the
# dev server against.
PROD_DB             := $(CURDIR)/$(SERVER_DIR)/kosh-prod.db
LITESTREAM_IMAGE    ?= litestream/litestream:latest
AZURE_STORAGE_ACCOUNT ?= koshcentralstor
AZURE_RESOURCE_GROUP  ?= kosh-central-rg

.DEFAULT_GOAL := help

# --- terminal titles --------------------------------------------------------
#
# Long-running targets (dev servers, builds, deploys) set the terminal title so
# a screen full of tabs stays readable. `tput tsl`/`tput fsl` is the portable
# way to ask terminfo for the "to status line" / "from status line" sequences;
# many terminfo entries omit them even when the terminal honors OSC 0, so fall
# back to that, and degrade to a no-op when there is no tty.
#
# Usage: prefix a recipe line with `@$(call title,Some Title)`.
#
define title
{ \
  if [ -t 1 ]; then \
    if tsl=$$(tput tsl 2>/dev/null) && fsl=$$(tput fsl 2>/dev/null) && [ -n "$$tsl" ]; then \
      printf '%s%s%s' "$$tsl" "KC: $(1)" "$$fsl"; \
    else \
      case "$$TERM" in \
        xterm*|rxvt*|screen*|tmux*|vte*|alacritty*|konsole*|foot*|wezterm*|ghostty*|kitty*) \
          printf '\033]0;KC: %s\007' "$(1)" ;; \
      esac; \
    fi; \
  fi; \
}
endef

# Fail with a usage message when a required variable is empty.
# Usage: @$(call require,DIR,make scan DIR=/path/to/photos)
define require
test -n "$($(1))" || { echo "$(1) is required. Usage: $(2)"; exit 1; }
endef

.PHONY: help install \
        dev dev-server dev-client dev-prod-db kill start \
        build build-server build-client typecheck lint format \
        db-status db-migrate db-prod-status db-shell db-backup db-pull db-prod-shell \
        scan scan-dry convert-heic import-gedcom import-gedcom-dry thumbnails \
        deploy deploy-image deploy-restart logs logs-live \
        clean

## help: list the available targets
help:
	@echo "Kosh Central make targets:"
	@echo
	@grep -E '^## ' $(MAKEFILE_LIST) | sed -e 's/^## /  /' -e 's/: /\t/' | column -t -s $$'\t'

# --- install ----------------------------------------------------------------

## install: npm ci for the root and both workspaces
install:
	@$(call title,install)
	npm ci

# --- dev servers (each blocks; run in separate terminals) -------------------

## dev: server (:3001) and client (:5273) together, after clearing the ports
dev:
	@$(call title,dev :3001 + :5273)
	npm run dev

## dev-server: Express API on :3001 only (tsx watch, packages/server/.env)
dev-server:
	@$(call title,server :3001)
	npm run dev -w $(SERVER_WS)

## dev-client: Vite dev server on :5273 only, proxying /api to :3001
dev-client:
	@$(call title,client :5273)
	npm run dev -w $(CLIENT_WS)

## dev-prod-db: Express API on :3001 against the prod snapshot (run db-pull first)
dev-prod-db:
	@$(call title,server :3001 [prod db])
	@test -f $(PROD_DB) || { echo "$(PROD_DB) not found. Run 'make db-pull' first."; exit 1; }
	KOSH_DB_PATH=$(PROD_DB) npm run dev -w $(SERVER_WS)

## kill: kill anything listening on :3001 / :5273
kill:
	npm run kill

## start: run the production build locally on :3001 (run build first)
start:
	@$(call title,prod :3001)
	npm run start -w $(SERVER_WS)

# --- build / check ----------------------------------------------------------

## build: build server and client
build:
	@$(call title,build)
	npm run build

## build-server: tsc the server -> packages/server/dist
build-server:
	@$(call title,build server)
	npm run build -w $(SERVER_WS)

## build-client: type-check and build the client -> packages/client/dist
build-client:
	@$(call title,build client)
	npm run build -w $(CLIENT_WS)

## typecheck: type-check server and client without emitting
typecheck:
	@$(call title,typecheck)
	npm exec -w $(SERVER_WS) -- tsc --noEmit
	npm exec -w $(CLIENT_WS) -- tsc -b

## lint: ESLint + Prettier over the client
lint:
	@$(call title,lint)
	npm run lint

## format: Prettier --write over the client
format:
	npm run format -w $(CLIENT_WS)

# --- database ---------------------------------------------------------------

## db-status: list applied and pending migrations for the dev database (read-only)
db-status:
	npx tsx $(SCRIPTS_DIR)/migrate.ts status --db $(DEV_DB)

## db-migrate: apply pending migrations to the dev database (the server also does this on startup)
db-migrate:
	npx tsx $(SCRIPTS_DIR)/migrate.ts up --db $(DEV_DB)

## db-prod-status: list applied and pending migrations for the prod snapshot (run db-pull first)
db-prod-status:
	@test -f $(PROD_DB) || { echo "$(PROD_DB) not found. Run 'make db-pull' first."; exit 1; }
	npx tsx $(SCRIPTS_DIR)/migrate.ts status --db $(PROD_DB)

## db-shell: sqlite3 shell on the local dev database
db-shell:
	sqlite3 $(DEV_DB)

## db-backup: snapshot the dev database to packages/server/kosh-<timestamp>.db
db-backup:
	sqlite3 $(DEV_DB) ".backup '$(CURDIR)/$(SERVER_DIR)/kosh-$(shell date +%Y%m%d-%H%M%S).db'"

## db-pull: restore the latest prod database from Litestream -> packages/server/kosh-prod.db
#
# Runs Litestream from its Docker image (same binary the container ships) with
# the repo's litestream.yml, so the replica URL lives in one place. The storage
# key is fetched with `az`; set AZURE_STORAGE_KEY to skip that, or override
# AZURE_STORAGE_ACCOUNT if the replica lives in a different account.
db-pull:
	@$(call title,db pull)
	@key="$${AZURE_STORAGE_KEY:-$$(az storage account keys list \
	    --resource-group $(AZURE_RESOURCE_GROUP) --account-name $(AZURE_STORAGE_ACCOUNT) \
	    --query '[0].value' -o tsv)}" && test -n "$$key" || { echo "Could not get a storage key (az login?)"; exit 1; }; \
	rm -f $(PROD_DB) $(PROD_DB)-wal $(PROD_DB)-shm; \
	docker run --rm --user $$(id -u):$$(id -g) \
	    -e AZURE_STORAGE_ACCOUNT=$(AZURE_STORAGE_ACCOUNT) -e AZURE_STORAGE_KEY="$$key" \
	    -v $(CURDIR)/litestream.yml:/etc/litestream.yml:ro \
	    -v $(dir $(PROD_DB)):/out \
	    $(LITESTREAM_IMAGE) restore -config /etc/litestream.yml -o /out/$(notdir $(PROD_DB)) /app/data/kosh.db
	@echo "Restored prod database to $(PROD_DB)"

## db-prod-shell: read-only sqlite3 shell on the prod snapshot (run db-pull first)
db-prod-shell:
	@test -f $(PROD_DB) || { echo "$(PROD_DB) not found. Run 'make db-pull' first."; exit 1; }
	sqlite3 -readonly $(PROD_DB)

# --- photo / data scripts ---------------------------------------------------

## scan: hash photos under DIR and write kosh-manifest.json files (DIR=...)
scan:
	@$(call require,DIR,make scan DIR=/path/to/photos)
	@$(call title,scan)
	npx tsx $(SCRIPTS_DIR)/scan-local.ts "$(DIR)"

## scan-dry: same as scan but writes nothing (DIR=...)
scan-dry:
	@$(call require,DIR,make scan-dry DIR=/path/to/photos)
	npx tsx $(SCRIPTS_DIR)/scan-local.ts "$(DIR)" --dry-run

## convert-heic: write a .jpg next to every .heic under DIR (DIR=..., ARGS="--quality 90 --delete-originals")
convert-heic:
	@$(call require,DIR,make convert-heic DIR=/path/to/photos)
	@$(call title,convert heic)
	npx tsx $(SCRIPTS_DIR)/convert-heic.ts "$(DIR)" $(ARGS)

## import-gedcom: import a GEDCOM file into the dev database's persons (FILE=data/norman.ged)
import-gedcom:
	@$(call require,FILE,make import-gedcom FILE=data/norman.ged)
	npx tsx $(SCRIPTS_DIR)/import-gedcom.ts "$(abspath $(FILE))"

## import-gedcom-dry: report what import-gedcom would change (FILE=...)
import-gedcom-dry:
	@$(call require,FILE,make import-gedcom-dry FILE=data/norman.ged)
	npx tsx $(SCRIPTS_DIR)/import-gedcom.ts "$(abspath $(FILE))" --dry-run

## thumbnails: backfill thumbnail64 into sidecar JSONs under DIR, recursively (needs Pillow)
thumbnails:
	@$(call require,DIR,make thumbnails DIR=/path/to/album)
	python3 $(SCRIPTS_DIR)/generate_thumbnails.py "$(DIR)" --recursive

# --- deploy / ops -----------------------------------------------------------

## deploy: build + push the image to ACR, then roll a new Container App revision
deploy:
	@$(call title,deploy)
	npm run deploy:container

## deploy-image: build the Docker image and push it to ACR only
deploy-image:
	@$(call title,deploy image)
	npm run deploy:image

## deploy-restart: roll a new Container App revision from the current ACR image
deploy-restart:
	@$(call title,deploy restart)
	npm run deploy:restart

## logs: last 100 container log lines from Log Analytics
logs:
	npm run logs

## logs-live: tail the live container logs
logs-live:
	@$(call title,logs live)
	npm run logs:live

## clean: remove build output and node_modules
clean:
	rm -rf $(SERVER_DIR)/dist packages/client/dist
	rm -rf node_modules $(SERVER_DIR)/node_modules packages/client/node_modules
