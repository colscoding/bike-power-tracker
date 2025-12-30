#!/bin/bash
#
# Bike Power Tracker - Update Script
# Updates the service to the latest version
#
# Usage: ./update.sh [--backup-first] [--force]
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="${SERVICE_DIR:-$(dirname "$SCRIPT_DIR")}"
PROJECT_ROOT="${PROJECT_ROOT:-$(dirname $(dirname "$SERVICE_DIR"))}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
BACKUP_FIRST=false
FORCE=false

for arg in "$@"; do
    case $arg in
        --backup-first)
            BACKUP_FIRST=true
            ;;
        --force)
            FORCE=true
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --backup-first  Create backup before updating"
            echo "  --force         Skip confirmation prompts"
            echo "  --help          Show this help message"
            exit 0
            ;;
    esac
done

# Detect container runtime
if command -v docker &> /dev/null; then
    COMPOSE_CMD="docker compose"
    CONTAINER_CMD="docker"
elif command -v podman &> /dev/null; then
    COMPOSE_CMD="podman-compose"
    CONTAINER_CMD="podman"
else
    echo -e "${RED}Error: Neither Docker nor Podman is installed${NC}"
    exit 1
fi

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Bike Power Tracker - Update${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Check if we're in a git repository
if [ -d "$PROJECT_ROOT/.git" ]; then
    echo "Git repository detected at: $PROJECT_ROOT"
    echo ""
    
    cd "$PROJECT_ROOT"
    
    # Check for local changes
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}Warning: You have uncommitted changes:${NC}"
        git status --short
        echo ""
        
        if [ "$FORCE" = false ]; then
            read -p "Continue anyway? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Aborted."
                exit 1
            fi
        fi
    fi
    
    # Show current version
    CURRENT_COMMIT=$(git rev-parse --short HEAD)
    echo "Current version: $CURRENT_COMMIT"
    
    # Fetch updates
    echo ""
    echo "Fetching updates..."
    git fetch origin
    
    # Check if there are updates
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse @{u} 2>/dev/null) || REMOTE=""
    
    if [ -z "$REMOTE" ]; then
        echo -e "${YELLOW}Warning: No upstream branch configured${NC}"
    elif [ "$LOCAL" = "$REMOTE" ]; then
        echo -e "${GREEN}Already up to date!${NC}"
        
        if [ "$FORCE" = false ]; then
            read -p "Rebuild anyway? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 0
            fi
        fi
    else
        # Show what will be updated
        echo ""
        echo "Updates available:"
        git log --oneline HEAD..@{u} | head -10
        AHEAD_COUNT=$(git log --oneline HEAD..@{u} | wc -l)
        if [ "$AHEAD_COUNT" -gt 10 ]; then
            echo "  ... and $((AHEAD_COUNT - 10)) more commits"
        fi
        echo ""
        
        if [ "$FORCE" = false ]; then
            read -p "Pull updates? (Y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Nn]$ ]]; then
                echo "Skipping pull, will only rebuild."
            else
                git pull
            fi
        else
            git pull
        fi
    fi
else
    echo -e "${YELLOW}Not a git repository. Will only rebuild containers.${NC}"
fi

# Create backup if requested
if [ "$BACKUP_FIRST" = true ]; then
    echo ""
    echo "Creating backup..."
    if [ -f "$SCRIPT_DIR/backup.sh" ]; then
        "$SCRIPT_DIR/backup.sh" --all
    else
        echo -e "${YELLOW}Warning: backup.sh not found, skipping backup${NC}"
    fi
fi

# Confirmation
if [ "$FORCE" = false ]; then
    echo ""
    echo "This will:"
    echo "  1. Stop current services"
    echo "  2. Rebuild Docker images"
    echo "  3. Start updated services"
    echo ""
    read -p "Continue? (Y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Update process
cd "$SERVICE_DIR"

echo ""
echo "Stopping services..."
$COMPOSE_CMD -f docker-compose.home.yml down

echo ""
echo "Pulling latest base images..."
$COMPOSE_CMD -f docker-compose.home.yml pull

echo ""
echo "Rebuilding application..."
$COMPOSE_CMD -f docker-compose.home.yml build --no-cache

echo ""
echo "Starting services..."
$COMPOSE_CMD -f docker-compose.home.yml up -d

# Wait for services to start
echo ""
echo "Waiting for services to start..."
sleep 10

# Health check
echo ""
echo "Running health check..."
if [ -f "$SCRIPT_DIR/health-check.sh" ]; then
    "$SCRIPT_DIR/health-check.sh" --verbose || {
        echo -e "${RED}Health check failed! Check logs for details.${NC}"
        echo ""
        echo "View logs with:"
        echo "  $COMPOSE_CMD -f docker-compose.home.yml logs -f"
        exit 1
    }
else
    # Basic health check
    sleep 5
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health | grep -q "200"; then
        echo -e "${GREEN}Service is healthy!${NC}"
    else
        echo -e "${RED}Service health check failed!${NC}"
        exit 1
    fi
fi

# Show new version
if [ -d "$PROJECT_ROOT/.git" ]; then
    NEW_COMMIT=$(cd "$PROJECT_ROOT" && git rev-parse --short HEAD)
    echo ""
    echo -e "${GREEN}Update complete!${NC}"
    echo "Version: $CURRENT_COMMIT → $NEW_COMMIT"
else
    echo ""
    echo -e "${GREEN}Rebuild complete!${NC}"
fi

# Clean up old images
echo ""
echo "Cleaning up old images..."
$CONTAINER_CMD image prune -f

echo ""
echo "Done!"
