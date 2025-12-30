#!/bin/bash
#
# Bike Power Tracker - Backup Script
# Creates backups of Redis data and optionally PostgreSQL/SQLite databases
#
# Usage: ./backup.sh [--redis] [--postgres] [--sqlite] [--all]
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="${SERVICE_DIR:-$(dirname "$SCRIPT_DIR")}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/bike-tracker-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

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
BACKUP_REDIS=false
BACKUP_POSTGRES=false
BACKUP_SQLITE=false

for arg in "$@"; do
    case $arg in
        --redis)
            BACKUP_REDIS=true
            ;;
        --postgres)
            BACKUP_POSTGRES=true
            ;;
        --sqlite)
            BACKUP_SQLITE=true
            ;;
        --all)
            BACKUP_REDIS=true
            BACKUP_POSTGRES=true
            BACKUP_SQLITE=true
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --redis     Backup Redis data"
            echo "  --postgres  Backup PostgreSQL database"
            echo "  --sqlite    Backup SQLite database"
            echo "  --all       Backup everything"
            echo "  --help      Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  BACKUP_DIR       Backup destination (default: ~/bike-tracker-backups)"
            echo "  RETENTION_DAYS   Days to keep backups (default: 7)"
            exit 0
            ;;
    esac
done

# Default to Redis if nothing specified
if [ "$BACKUP_REDIS" = false ] && [ "$BACKUP_POSTGRES" = false ] && [ "$BACKUP_SQLITE" = false ]; then
    BACKUP_REDIS=true
fi

# Detect container runtime
if command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
elif command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
else
    echo -e "${RED}Error: Neither Docker nor Podman is installed${NC}"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Bike Power Tracker - Backup"
echo "==========================="
echo ""
echo "Backup directory: $BACKUP_DIR"
echo "Timestamp: $TIMESTAMP"
echo "Retention: $RETENTION_DAYS days"
echo ""

# Redis backup
if [ "$BACKUP_REDIS" = true ]; then
    echo "Backing up Redis..."
    
    # Check if container is running
    if $CONTAINER_CMD ps --format '{{.Names}}' | grep -q "bike_tracker_redis"; then
        # Trigger Redis save
        if [ -n "$REDIS_PASSWORD" ]; then
            $CONTAINER_CMD exec bike_tracker_redis redis-cli -a "$REDIS_PASSWORD" BGSAVE 2>/dev/null || true
        else
            $CONTAINER_CMD exec bike_tracker_redis redis-cli BGSAVE 2>/dev/null || true
        fi
        
        # Wait for save to complete
        sleep 2
        
        # Copy dump file
        $CONTAINER_CMD cp bike_tracker_redis:/data/dump.rdb "$BACKUP_DIR/redis-$TIMESTAMP.rdb" 2>/dev/null || {
            echo -e "${YELLOW}Warning: Could not copy Redis dump file${NC}"
        }
        
        if [ -f "$BACKUP_DIR/redis-$TIMESTAMP.rdb" ]; then
            # Compress
            gzip "$BACKUP_DIR/redis-$TIMESTAMP.rdb"
            SIZE=$(du -h "$BACKUP_DIR/redis-$TIMESTAMP.rdb.gz" | cut -f1)
            echo -e "${GREEN}✓ Redis backup complete: redis-$TIMESTAMP.rdb.gz ($SIZE)${NC}"
        fi
    else
        echo -e "${YELLOW}Warning: Redis container not running${NC}"
    fi
fi

# PostgreSQL backup
if [ "$BACKUP_POSTGRES" = true ]; then
    echo "Backing up PostgreSQL..."
    
    if $CONTAINER_CMD ps --format '{{.Names}}' | grep -q "bike_tracker_postgres"; then
        $CONTAINER_CMD exec bike_tracker_postgres pg_dump \
            -U "${POSTGRES_USER:-biketracker}" \
            -d "${POSTGRES_DB:-biketracker}" \
            --format=custom \
            --compress=9 \
            > "$BACKUP_DIR/postgres-$TIMESTAMP.dump" 2>/dev/null || {
            echo -e "${YELLOW}Warning: PostgreSQL backup failed${NC}"
        }
        
        if [ -f "$BACKUP_DIR/postgres-$TIMESTAMP.dump" ] && [ -s "$BACKUP_DIR/postgres-$TIMESTAMP.dump" ]; then
            SIZE=$(du -h "$BACKUP_DIR/postgres-$TIMESTAMP.dump" | cut -f1)
            echo -e "${GREEN}✓ PostgreSQL backup complete: postgres-$TIMESTAMP.dump ($SIZE)${NC}"
        else
            rm -f "$BACKUP_DIR/postgres-$TIMESTAMP.dump"
            echo -e "${YELLOW}Warning: PostgreSQL backup file is empty or missing${NC}"
        fi
    else
        echo -e "${YELLOW}Warning: PostgreSQL container not running${NC}"
    fi
fi

# SQLite backup
if [ "$BACKUP_SQLITE" = true ]; then
    echo "Backing up SQLite..."
    
    # Try to copy from container volume
    if $CONTAINER_CMD ps --format '{{.Names}}' | grep -q "bike_tracker_service"; then
        $CONTAINER_CMD exec bike_tracker_service sh -c "sqlite3 /app/data/biketracker.db '.backup /tmp/backup.db'" 2>/dev/null || {
            # Fallback: just copy the file
            $CONTAINER_CMD cp bike_tracker_service:/app/data/biketracker.db "$BACKUP_DIR/sqlite-$TIMESTAMP.db" 2>/dev/null || {
                echo -e "${YELLOW}Warning: Could not backup SQLite database${NC}"
            }
        }
        
        # Copy backup file if it was created
        if $CONTAINER_CMD exec bike_tracker_service test -f /tmp/backup.db 2>/dev/null; then
            $CONTAINER_CMD cp bike_tracker_service:/tmp/backup.db "$BACKUP_DIR/sqlite-$TIMESTAMP.db"
            $CONTAINER_CMD exec bike_tracker_service rm /tmp/backup.db 2>/dev/null || true
        fi
        
        if [ -f "$BACKUP_DIR/sqlite-$TIMESTAMP.db" ]; then
            gzip "$BACKUP_DIR/sqlite-$TIMESTAMP.db"
            SIZE=$(du -h "$BACKUP_DIR/sqlite-$TIMESTAMP.db.gz" | cut -f1)
            echo -e "${GREEN}✓ SQLite backup complete: sqlite-$TIMESTAMP.db.gz ($SIZE)${NC}"
        fi
    else
        # Try local file
        LOCAL_DB="$SERVICE_DIR/data/biketracker.db"
        if [ -f "$LOCAL_DB" ]; then
            sqlite3 "$LOCAL_DB" ".backup '$BACKUP_DIR/sqlite-$TIMESTAMP.db'" 2>/dev/null || {
                cp "$LOCAL_DB" "$BACKUP_DIR/sqlite-$TIMESTAMP.db"
            }
            gzip "$BACKUP_DIR/sqlite-$TIMESTAMP.db"
            SIZE=$(du -h "$BACKUP_DIR/sqlite-$TIMESTAMP.db.gz" | cut -f1)
            echo -e "${GREEN}✓ SQLite backup complete: sqlite-$TIMESTAMP.db.gz ($SIZE)${NC}"
        else
            echo -e "${YELLOW}Warning: SQLite database not found${NC}"
        fi
    fi
fi

# Cleanup old backups
echo ""
echo "Cleaning up old backups (older than $RETENTION_DAYS days)..."

find "$BACKUP_DIR" -name "redis-*.rdb.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "postgres-*.dump" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "sqlite-*.db.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

REMAINING=$(ls -1 "$BACKUP_DIR" 2>/dev/null | wc -l)
echo -e "${GREEN}✓ Cleanup complete. $REMAINING backup files remaining.${NC}"

# Summary
echo ""
echo "==========================="
echo "Backup Summary"
echo "==========================="
ls -lh "$BACKUP_DIR"/*.{rdb.gz,dump,db.gz} 2>/dev/null | tail -5 || echo "No backups found"
echo ""
echo "Total backup size: $(du -sh "$BACKUP_DIR" | cut -f1)"
