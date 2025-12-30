#!/bin/bash
#
# Bike Power Tracker - Start Services
# Starts all containers for home deployment
#
# Usage: ./start.sh [--build] [--cloudflare]
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="${SERVICE_DIR:-$(dirname "$SCRIPT_DIR")}"
COMPOSE_FILE="${SERVICE_DIR}/docker-compose.home.yml"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Parse arguments
BUILD_FLAG=""
CLOUDFLARE_PROFILE=""

for arg in "$@"; do
    case $arg in
        --build)
            BUILD_FLAG="--build"
            ;;
        --cloudflare)
            CLOUDFLARE_PROFILE="--profile cloudflare"
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --build       Rebuild containers before starting"
            echo "  --cloudflare  Also start Cloudflare tunnel container"
            echo "  --help        Show this help message"
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

# Check for compose file
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Error: docker-compose.home.yml not found at $COMPOSE_FILE"
    echo "Run setup.sh first to create it."
    exit 1
fi

# Check for .env file
if [ ! -f "$SERVICE_DIR/.env" ]; then
    echo -e "${YELLOW}Warning: .env file not found. Using defaults.${NC}"
fi

cd "$SERVICE_DIR"

echo "Starting Bike Power Tracker..."
echo ""

# Start services
$COMPOSE_CMD -f docker-compose.home.yml $CLOUDFLARE_PROFILE up -d $BUILD_FLAG

echo ""
echo -e "${GREEN}Services started!${NC}"
echo ""

# Show status
$COMPOSE_CMD -f docker-compose.home.yml ps

echo ""
echo "Access the service at: http://localhost:${APP_PORT:-8080}"
echo ""
echo "View logs with: $COMPOSE_CMD -f docker-compose.home.yml logs -f"
