#!/bin/bash

# Redis Backup Script for Bike Power Tracker
# Creates RDB snapshot backups
# Usage: ./backup-redis.sh

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REDIS_CONTAINER="${REDIS_CONTAINER:-redis}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Check if Redis container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
    log_error "Redis container '${REDIS_CONTAINER}' is not running"
    exit 1
fi

log_info "Starting Redis backup..."

# Trigger Redis BGSAVE
if [ -n "${REDIS_PASSWORD}" ]; then
    docker exec "${REDIS_CONTAINER}" redis-cli -a "${REDIS_PASSWORD}" --no-auth-warning BGSAVE >/dev/null
else
    docker exec "${REDIS_CONTAINER}" redis-cli BGSAVE >/dev/null
fi

# Wait for BGSAVE to complete
log_info "Waiting for BGSAVE to complete..."
sleep 2

while true; do
    if [ -n "${REDIS_PASSWORD}" ]; then
        LASTSAVE=$(docker exec "${REDIS_CONTAINER}" redis-cli -a "${REDIS_PASSWORD}" --no-auth-warning LASTSAVE)
    else
        LASTSAVE=$(docker exec "${REDIS_CONTAINER}" redis-cli LASTSAVE)
    fi
    
    # Check if save completed in last 10 seconds
    CURRENT_TIME=$(date +%s)
    if [ $((CURRENT_TIME - LASTSAVE)) -lt 10 ]; then
        break
    fi
    
    sleep 1
done

# Copy RDB file from container
BACKUP_FILE="${BACKUP_DIR}/redis-${TIMESTAMP}.rdb"

if docker cp "${REDIS_CONTAINER}:/data/dump.rdb" "${BACKUP_FILE}" >/dev/null 2>&1; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log_info "Backup completed: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    log_error "Failed to copy RDB file from container"
    exit 1
fi

# Clean old backups
log_info "Cleaning backups older than ${RETENTION_DAYS} days..."
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "redis-*.rdb" -mtime +${RETENTION_DAYS} -delete -print | wc -l)

if [ "${DELETED_COUNT}" -gt 0 ]; then
    log_info "Deleted ${DELETED_COUNT} old backup(s)"
else
    log_info "No old backups to delete"
fi

# Show remaining backups
REMAINING_COUNT=$(find "${BACKUP_DIR}" -name "redis-*.rdb" | wc -l)
log_info "Total backups retained: ${REMAINING_COUNT}"

log_info "Backup process completed successfully"
