#!/bin/bash
#
# Bike Power Tracker - Restore from Backup
# Restores Redis and/or database from backup files
#
# Usage: ./restore.sh <backup-file> [--redis] [--postgres] [--sqlite]
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="${SERVICE_DIR:-$(dirname "$SCRIPT_DIR")}"

# Load environment
if [ -f "$SERVICE_DIR/.env" ]; then
    source "$SERVICE_DIR/.env"
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Parse arguments
BACKUP_FILE=""
RESTORE_TYPE=""

for arg in "$@"; do
    case $arg in
        --redis)
            RESTORE_TYPE="redis"
            ;;
        --postgres)
            RESTORE_TYPE="postgres"
            ;;
        --sqlite)
            RESTORE_TYPE="sqlite"
            ;;
        --help)
            echo "Usage: $0 <backup-file> [options]"
            echo ""
            echo "Options:"
            echo "  --redis     Restore Redis backup (.rdb or .rdb.gz)"
            echo "  --postgres  Restore PostgreSQL backup (.dump)"
            echo "  --sqlite    Restore SQLite backup (.db or .db.gz)"
            echo "  --help      Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 ~/backups/redis-20250101-120000.rdb.gz --redis"
            echo "  $0 ~/backups/postgres-20250101-120000.dump --postgres"
            echo "  $0 ~/backups/sqlite-20250101-120000.db.gz --sqlite"
            exit 0
            ;;
        *)
            if [ -z "$BACKUP_FILE" ]; then
                BACKUP_FILE="$arg"
            fi
            ;;
    esac
done

# Validate arguments
if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file required${NC}"
    echo "Usage: $0 <backup-file> [--redis|--postgres|--sqlite]"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

# Auto-detect backup type from filename
if [ -z "$RESTORE_TYPE" ]; then
    case "$BACKUP_FILE" in
        *redis*.rdb*) RESTORE_TYPE="redis" ;;
        *postgres*.dump) RESTORE_TYPE="postgres" ;;
        *sqlite*.db*) RESTORE_TYPE="sqlite" ;;
        *)
            echo -e "${RED}Error: Could not detect backup type. Use --redis, --postgres, or --sqlite${NC}"
            exit 1
            ;;
    esac
fi

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

echo "Bike Power Tracker - Restore"
echo "============================"
echo ""
echo "Backup file: $BACKUP_FILE"
echo "Restore type: $RESTORE_TYPE"
echo ""
echo -e "${YELLOW}WARNING: This will overwrite existing data!${NC}"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

cd "$SERVICE_DIR"

case "$RESTORE_TYPE" in
    redis)
        echo ""
        echo "Restoring Redis backup..."
        
        # Decompress if needed
        RESTORE_FILE="$BACKUP_FILE"
        if [[ "$BACKUP_FILE" == *.gz ]]; then
            RESTORE_FILE="/tmp/restore-redis-$$.rdb"
            gunzip -c "$BACKUP_FILE" > "$RESTORE_FILE"
        fi
        
        # Stop Redis
        echo "Stopping Redis..."
        $COMPOSE_CMD -f docker-compose.home.yml stop redis
        
        # Copy backup file to volume
        $CONTAINER_CMD cp "$RESTORE_FILE" bike_tracker_redis:/data/dump.rdb
        
        # Clean up temp file
        if [[ "$BACKUP_FILE" == *.gz ]]; then
            rm "$RESTORE_FILE"
        fi
        
        # Start Redis
        echo "Starting Redis..."
        $COMPOSE_CMD -f docker-compose.home.yml start redis
        
        # Wait for Redis to load data
        sleep 5
        
        # Verify
        if $CONTAINER_CMD exec bike_tracker_redis redis-cli -a "${REDIS_PASSWORD}" ping | grep -q "PONG"; then
            echo -e "${GREEN}✓ Redis restored successfully${NC}"
        else
            echo -e "${RED}Warning: Redis may not have loaded correctly${NC}"
        fi
        ;;
        
    postgres)
        echo ""
        echo "Restoring PostgreSQL backup..."
        
        # Check if container is running
        if ! $CONTAINER_CMD ps --format '{{.Names}}' | grep -q "bike_tracker_postgres"; then
            echo "Starting PostgreSQL..."
            $COMPOSE_CMD -f docker-compose.home.yml up -d postgres
            sleep 10
        fi
        
        # Copy backup to container
        $CONTAINER_CMD cp "$BACKUP_FILE" bike_tracker_postgres:/tmp/restore.dump
        
        # Restore
        $CONTAINER_CMD exec bike_tracker_postgres pg_restore \
            -U "${POSTGRES_USER:-biketracker}" \
            -d "${POSTGRES_DB:-biketracker}" \
            --clean \
            --if-exists \
            /tmp/restore.dump || {
            echo -e "${YELLOW}Warning: Some errors during restore (may be normal for clean restore)${NC}"
        }
        
        # Clean up
        $CONTAINER_CMD exec bike_tracker_postgres rm /tmp/restore.dump
        
        echo -e "${GREEN}✓ PostgreSQL restored successfully${NC}"
        ;;
        
    sqlite)
        echo ""
        echo "Restoring SQLite backup..."
        
        # Decompress if needed
        RESTORE_FILE="$BACKUP_FILE"
        if [[ "$BACKUP_FILE" == *.gz ]]; then
            RESTORE_FILE="/tmp/restore-sqlite-$$.db"
            gunzip -c "$BACKUP_FILE" > "$RESTORE_FILE"
        fi
        
        # Stop app to release database lock
        echo "Stopping application..."
        $COMPOSE_CMD -f docker-compose.home.yml stop app
        
        # Copy to container volume
        if $CONTAINER_CMD ps --format '{{.Names}}' | grep -q "bike_tracker_service"; then
            $CONTAINER_CMD cp "$RESTORE_FILE" bike_tracker_service:/app/data/biketracker.db
        else
            # Copy to local data directory
            mkdir -p "$SERVICE_DIR/data"
            cp "$RESTORE_FILE" "$SERVICE_DIR/data/biketracker.db"
        fi
        
        # Clean up temp file
        if [[ "$BACKUP_FILE" == *.gz ]]; then
            rm "$RESTORE_FILE"
        fi
        
        # Start app
        echo "Starting application..."
        $COMPOSE_CMD -f docker-compose.home.yml start app
        
        echo -e "${GREEN}✓ SQLite restored successfully${NC}"
        ;;
esac

echo ""
echo "Restore complete. Verifying services..."

# Run health check
sleep 5
if [ -f "$SCRIPT_DIR/health-check.sh" ]; then
    "$SCRIPT_DIR/health-check.sh" --verbose
else
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health | grep -q "200"; then
        echo -e "${GREEN}✓ Service is healthy${NC}"
    else
        echo -e "${YELLOW}Warning: Service may need attention${NC}"
    fi
fi
