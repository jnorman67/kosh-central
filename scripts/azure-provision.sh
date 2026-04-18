#!/usr/bin/env bash
# One-time provisioning for the Azure Container Apps migration.
#
# Creates: ACR (Basic), Storage Account + File share, Container Apps Environment,
# then builds the first image and creates the Container App with a file-share
# volume mounted at /data.
#
# Prerequisites:
#   - `az login` already done
#   - Subscription set to the one owning kosh-central-rg
#   - AZURE_CLIENT_ID and JWT_SECRET exported in your shell
#
# Idempotent: re-running is safe; existing resources are skipped.

set -euo pipefail

# ---- Configuration ---------------------------------------------------------
RG=kosh-central-rg
LOC=westus2
ACR_NAME=koshcentralacr
STORAGE_NAME=koshcentralstor
FILE_SHARE=kosh-data
ENV_NAME=kosh-env
APP_NAME=kosh-central
IMAGE_NAME=kosh-central
IMAGE_TAG=v1

# ---- Sanity checks ---------------------------------------------------------
: "${AZURE_CLIENT_ID:?Set AZURE_CLIENT_ID in your environment (same value currently in App Service app settings)}"
: "${JWT_SECRET:?Set JWT_SECRET in your environment (same value currently in App Service app settings)}"

require_provider() {
    local p=$1
    local state
    state=$(az provider show --namespace "$p" --query registrationState -o tsv 2>/dev/null || echo "NotRegistered")
    if [[ "$state" != "Registered" ]]; then
        echo "Registering resource provider $p ..."
        az provider register --namespace "$p" --wait
    fi
}

echo "==> Checking resource providers"
require_provider Microsoft.App
require_provider Microsoft.ContainerRegistry
require_provider Microsoft.Storage
require_provider Microsoft.OperationalInsights

# ---- 1. Container Registry -------------------------------------------------
echo "==> 1. Container Registry ($ACR_NAME)"
if ! az acr show --name "$ACR_NAME" -o none 2>/dev/null; then
    az acr create --resource-group "$RG" --name "$ACR_NAME" --sku Basic --admin-enabled true
else
    echo "   exists"
fi
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

# ---- 2. Storage account + file share --------------------------------------
echo "==> 2. Storage account + file share ($STORAGE_NAME / $FILE_SHARE)"
if ! az storage account show --name "$STORAGE_NAME" --resource-group "$RG" -o none 2>/dev/null; then
    az storage account create --resource-group "$RG" --name "$STORAGE_NAME" \
        --location "$LOC" --sku Standard_LRS --kind StorageV2 \
        --allow-blob-public-access false
else
    echo "   storage account exists"
fi
STORAGE_KEY=$(az storage account keys list --resource-group "$RG" --account-name "$STORAGE_NAME" --query "[0].value" -o tsv)
if ! az storage share-rm show --resource-group "$RG" --storage-account "$STORAGE_NAME" --name "$FILE_SHARE" -o none 2>/dev/null; then
    az storage share-rm create --resource-group "$RG" --storage-account "$STORAGE_NAME" --name "$FILE_SHARE" --quota 5
else
    echo "   file share exists"
fi

# ---- 3. Container Apps environment ----------------------------------------
echo "==> 3. Container Apps environment ($ENV_NAME)"
if ! az containerapp env show --resource-group "$RG" --name "$ENV_NAME" -o none 2>/dev/null; then
    az containerapp env create --resource-group "$RG" --name "$ENV_NAME" --location "$LOC"
else
    echo "   exists"
fi
ENV_ID=$(az containerapp env show --resource-group "$RG" --name "$ENV_NAME" --query id -o tsv)

# ---- 4. Register file share with the environment --------------------------
echo "==> 4. Linking file share to environment"
az containerapp env storage set --resource-group "$RG" --name "$ENV_NAME" \
    --storage-name "$FILE_SHARE" \
    --azure-file-account-name "$STORAGE_NAME" \
    --azure-file-account-key "$STORAGE_KEY" \
    --azure-file-share-name "$FILE_SHARE" \
    --access-mode ReadWrite -o none

# ---- 5. Build and push the first image (local docker) --------------------
# ACR Tasks (`az acr build`) are blocked on many newer Azure subscriptions, so
# we build locally and push. Requires local Docker.
echo "==> 5. Building image locally and pushing to ACR"
if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: docker not found on PATH. Install Docker Desktop / Docker Engine and re-run." >&2
    exit 1
fi
az acr login --name "$ACR_NAME"
docker build -t "$ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG" -t "$ACR_LOGIN_SERVER/$IMAGE_NAME:latest" -f Dockerfile .
docker push "$ACR_LOGIN_SERVER/$IMAGE_NAME:$IMAGE_TAG"
docker push "$ACR_LOGIN_SERVER/$IMAGE_NAME:latest"

# ---- 6. Create the Container App from YAML --------------------------------
echo "==> 6. Rendering Container App YAML"
RENDERED=$(mktemp --suffix=.yaml)
sed \
    -e "s|WEST_US_2_PLACEHOLDER|$LOC|g" \
    -e "s|ENV_ID_PLACEHOLDER|$ENV_ID|g" \
    -e "s|ACR_LOGIN_SERVER_PLACEHOLDER|$ACR_LOGIN_SERVER|g" \
    -e "s|ACR_USERNAME_PLACEHOLDER|$ACR_USERNAME|g" \
    -e "s|ACR_PASSWORD_PLACEHOLDER|$ACR_PASSWORD|g" \
    -e "s|AZURE_CLIENT_ID_PLACEHOLDER|$AZURE_CLIENT_ID|g" \
    -e "s|JWT_SECRET_PLACEHOLDER|$JWT_SECRET|g" \
    infra/containerapp.yaml > "$RENDERED"

echo "==> 7. Creating Container App ($APP_NAME)"
if ! az containerapp show --resource-group "$RG" --name "$APP_NAME" -o none 2>/dev/null; then
    az containerapp create --resource-group "$RG" --name "$APP_NAME" --yaml "$RENDERED"
else
    echo "   already exists — updating instead"
    az containerapp update --resource-group "$RG" --name "$APP_NAME" --yaml "$RENDERED"
fi
rm -f "$RENDERED"

URL=$(az containerapp show --resource-group "$RG" --name "$APP_NAME" --query "properties.configuration.ingress.fqdn" -o tsv)
echo ""
echo "Done. Container App URL: https://$URL"
echo ""
echo "Next steps:"
echo "  1. Migrate data:  bash scripts/azure-migrate-data.sh"
echo "  2. Verify the app at https://$URL"
echo "  3. Flip custom domain (if any) to the new URL"
echo "  4. Stop the old App Service: az webapp stop --resource-group $RG --name $APP_NAME"
