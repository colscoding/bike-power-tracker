#!/bin/bash

# Deploy Service to VPS
# Usage: ./deploy-remote.sh <user@host>

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
    echo "Usage: ./copy-remote.sh <user@host>"
    echo "Example: ./copy-remote.sh ubuntu@203.0.113.1"
    exit 1
fi

TARGET="$1"
REMOTE_DIR="~/bike-power-tracker-service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}Copying service to $TARGET...${NC}"

# Navigate to service directory to ensure relative paths work for rsync
cd "$SCRIPT_DIR"

# 1. Sync Files
# We exclude node_modules (too big, wrong arch), .git, dist (build artifacts), and .env (secrets)
echo -e "${GREEN}[1/2] Syncing files to $TARGET:$REMOTE_DIR...${NC}"
rsync -avz \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude 'node_modules' \
    --exclude 'tests' \
    ./ "$TARGET:$REMOTE_DIR"

echo -e "${GREEN}File sync to $TARGET:$REMOTE_DIR completed successfully!${NC}"