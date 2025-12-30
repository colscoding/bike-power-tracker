#!/bin/bash
#
# Bike Power Tracker - View Logs
# Convenience script for viewing container logs
#
# Usage: ./logs.sh [service] [--follow] [--tail N]
#

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="${SERVICE_DIR:-$(dirname "$SCRIPT_DIR")}"

# Defaults
SERVICE=""
FOLLOW=""
TAIL=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --follow|-f)
            FOLLOW="-f"
            shift
            ;;
        --tail|-n)
            TAIL="--tail=$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [service] [options]"
            echo ""
            echo "Services:"
            echo "  app       Application logs"
            echo "  redis     Redis logs"
            echo "  nginx     Nginx logs"
            echo "  postgres  PostgreSQL logs (if enabled)"
            echo "  tunnel    Cloudflare tunnel logs (if enabled)"
            echo "  (none)    All services"
            echo ""
            echo "Options:"
            echo "  -f, --follow    Follow log output"
            echo "  -n, --tail N    Show last N lines"
            echo "  --help          Show this help message"
            exit 0
            ;;
        *)
            SERVICE="$1"
            shift
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

# Map service names to container names
case $SERVICE in
    app|service)
        SERVICE="app"
        ;;
    tunnel|cloudflare|cloudflared)
        SERVICE="cloudflared"
        ;;
    postgres|db|database)
        SERVICE="postgres"
        ;;
esac

# Show logs
if [ -n "$SERVICE" ]; then
    $COMPOSE_CMD -f docker-compose.home.yml logs $FOLLOW $TAIL $SERVICE
else
    $COMPOSE_CMD -f docker-compose.home.yml logs $FOLLOW $TAIL
fi
