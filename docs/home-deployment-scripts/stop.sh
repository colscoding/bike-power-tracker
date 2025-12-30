#!/bin/bash
#
# Bike Power Tracker - Stop Services
# Stops all containers for home deployment
#
# Usage: ./stop.sh [--remove-volumes]
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="${SERVICE_DIR:-$(dirname "$SCRIPT_DIR")}"
COMPOSE_FILE="${SERVICE_DIR}/docker-compose.home.yml"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Parse arguments
REMOVE_VOLUMES=""

for arg in "$@"; do
    case $arg in
        --remove-volumes)
            REMOVE_VOLUMES="-v"
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --remove-volumes  Also remove data volumes (WARNING: deletes all data)"
            echo "  --help            Show this help message"
            exit 0
            ;;
    esac
done

# Detect container runtime
if command -v docker &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v podman &> /dev/null; then
    COMPOSE_CMD="podman-compose"
else
    echo "Error: Neither Docker nor Podman is installed"
    exit 1
fi

cd "$SERVICE_DIR"

if [ -n "$REMOVE_VOLUMES" ]; then
    echo -e "${RED}WARNING: This will delete all data including Redis and database volumes!${NC}"
    read -p "Are you sure? (type 'yes' to confirm): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 1
    fi
fi

echo "Stopping Bike Power Tracker..."
echo ""

# Stop services
$COMPOSE_CMD -f docker-compose.home.yml down $REMOVE_VOLUMES

echo ""
echo -e "${GREEN}Services stopped.${NC}"

if [ -n "$REMOVE_VOLUMES" ]; then
    echo -e "${YELLOW}All data volumes have been removed.${NC}"
fi
