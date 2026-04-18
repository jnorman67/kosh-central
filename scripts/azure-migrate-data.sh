#!/usr/bin/env bash
# Copies current production data onto the new Azure File share so the
# Container App starts with full parity (users, relations, series, MSAL cache,
# and the manifest).
#
# Runs after scripts/azure-provision.sh. Safe to re-run; it overwrites the
# file-share entries.

set -euo pipefail

RG=kosh-central-rg
APP_SERVICE_NAME=kosh-central
STORAGE_NAME=koshcentralstor
FILE_SHARE=kosh-data
LOCAL_MANIFEST=packages/server/data/manifest.json

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

echo "==> Fetching publish profile credentials for Kudu"
CRED_JSON=$(az webapp deployment list-publishing-credentials --resource-group "$RG" --name "$APP_SERVICE_NAME" -o json)
USER=$(echo "$CRED_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['publishingUserName'])")
PASS=$(echo "$CRED_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['publishingPassword'])")
SCM_URL="https://$APP_SERVICE_NAME.scm.azurewebsites.net"

# Kudu's vfs API treats /home as the root: href = /api/vfs/<path relative to /home>.
echo "==> Pulling SQLite DB files from /home (main + WAL + SHM)"
DB_PRESENT=0
for f in kosh.db kosh.db-wal kosh.db-shm; do
    if curl -fsSL -u "$USER:$PASS" "$SCM_URL/api/vfs/$f" -o "$WORKDIR/$f" 2>/dev/null; then
        echo "   $f  ($(du -h "$WORKDIR/$f" | cut -f1))"
        [[ "$f" == "kosh.db" ]] && DB_PRESENT=1
    fi
done

if (( DB_PRESENT )); then
    echo "==> Merging WAL into a consistent snapshot via VACUUM INTO"
    rm -f "$WORKDIR/kosh-merged.db"
    sqlite3 "$WORKDIR/kosh.db" "VACUUM INTO '$WORKDIR/kosh-merged.db'"
    echo "   merged: $(du -h "$WORKDIR/kosh-merged.db" | cut -f1)"
    mv "$WORKDIR/kosh-merged.db" "$WORKDIR/kosh.db"
    rm -f "$WORKDIR/kosh.db-wal" "$WORKDIR/kosh.db-shm"
else
    echo "   no DB on App Service — Container App will start fresh from the manifest"
fi

echo "==> Pulling MSAL cache from /home/.msal-cache.json"
if curl -fsSL -u "$USER:$PASS" "$SCM_URL/api/vfs/.msal-cache.json" -o "$WORKDIR/.msal-cache.json" 2>/dev/null; then
    echo "   $(du -h "$WORKDIR/.msal-cache.json" | cut -f1)"
else
    echo "   not found — you'll re-auth via device code on first Container App start"
    rm -f "$WORKDIR/.msal-cache.json"
fi

echo "==> Verifying local manifest is present"
if [[ ! -f "$LOCAL_MANIFEST" ]]; then
    echo "ERROR: $LOCAL_MANIFEST not found." >&2
    echo "       Run the scanner first, or place your manifest there before migrating." >&2
    exit 1
fi
echo "   $(du -h "$LOCAL_MANIFEST" | cut -f1)"

echo "==> Uploading to Azure File share ($STORAGE_NAME/$FILE_SHARE)"
STORAGE_KEY=$(az storage account keys list --resource-group "$RG" --account-name "$STORAGE_NAME" --query "[0].value" -o tsv)

if [[ -f "$WORKDIR/kosh.db" ]]; then
    az storage file upload --account-name "$STORAGE_NAME" --account-key "$STORAGE_KEY" \
        --share-name "$FILE_SHARE" --source "$WORKDIR/kosh.db" --path kosh.db
fi

if [[ -f "$WORKDIR/.msal-cache.json" ]]; then
    az storage file upload --account-name "$STORAGE_NAME" --account-key "$STORAGE_KEY" \
        --share-name "$FILE_SHARE" --source "$WORKDIR/.msal-cache.json" --path .msal-cache.json
fi

az storage file upload --account-name "$STORAGE_NAME" --account-key "$STORAGE_KEY" \
    --share-name "$FILE_SHARE" --source "$LOCAL_MANIFEST" --path manifest.json

echo ""
echo "==> Restarting Container App so it picks up the migrated files"
az containerapp revision restart --resource-group "$RG" --name kosh-central 2>/dev/null || \
    echo "   (skipping restart — Container App doesn't exist yet; run after provisioning)"

echo ""
echo "Done. Verify at the Container App URL returned by the provisioning script."
