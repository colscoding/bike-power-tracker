#!/bin/bash

# Deploy Service to VPS
# Usage: ./deploy-remote.sh <user@host>

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
    echo "Usage: ./deploy-remote.sh <user@host>"
    echo "Example: ./deploy-remote.sh ubuntu@203.0.113.1"
    exit 1
fi

TARGET="$1"
REMOTE_DIR="~/bike-power-tracker-service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}Deploying service to $TARGET...${NC}"

# Navigate to service directory to ensure relative paths work for rsync
cd "$SCRIPT_DIR"

# 1. Sync Files
# We exclude node_modules (too big, wrong arch), .git, dist (build artifacts), and .env (secrets)
echo -e "${GREEN}[1/2] Syncing files to $TARGET:$REMOTE_DIR...${NC}"
rsync -avz \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude '.env' \
    --exclude 'coverage' \
    --exclude '.DS_Store' \
    ./ "$TARGET:$REMOTE_DIR"

# 2. Run Remote Deploy
# We use ssh to execute the server-side deploy.sh script
echo -e "${GREEN}[2/2] Running deployment script on server...${NC}"
ssh -t "$TARGET" "cd $REMOTE_DIR && chmod +x deploy.sh && ./deploy.sh"

echo -e "${GREEN}Deployment finished successfully!${NC}"
