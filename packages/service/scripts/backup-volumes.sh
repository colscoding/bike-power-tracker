#!/bin/bash

# Docker Volume Backup Script for Bike Power Tracker
# Creates compressed archives of Docker volumes
# Usage: ./backup-volumes.sh

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

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

# Backup PostgreSQL volume
log_info "Backing up PostgreSQL volume..."
POSTGRES_BACKUP="${BACKUP_DIR}/postgres-volume-${TIMESTAMP}.tar.gz"

if docker run --rm \
    -v postgres_data:/data \
    -v "$(pwd)/${BACKUP_DIR}:/backup" \
    alpine \
    tar czf "/backup/postgres-volume-${TIMESTAMP}.tar.gz" -C /data . 2>/dev/null; then
    
    BACKUP_SIZE=$(du -h "${POSTGRES_BACKUP}" | cut -f1)
    log_info "PostgreSQL volume backup completed: ${BACKUP_SIZE}"
else
    log_error "PostgreSQL volume backup failed!"
    exit 1
fi

# Backup Redis volume
log_info "Backing up Redis volume..."
REDIS_BACKUP="${BACKUP_DIR}/redis-volume-${TIMESTAMP}.tar.gz"

if docker run --rm \
    -v redis_data:/data \
    -v "$(pwd)/${BACKUP_DIR}:/backup" \
    alpine \
    tar czf "/backup/redis-volume-${TIMESTAMP}.tar.gz" -C /data . 2>/dev/null; then
    
    BACKUP_SIZE=$(du -h "${REDIS_BACKUP}" | cut -f1)
    log_info "Redis volume backup completed: ${BACKUP_SIZE}"
else
    log_error "Redis volume backup failed!"
    exit 1
fi

# Clean old volume backups
log_info "Cleaning volume backups older than ${RETENTION_DAYS} days..."
DELETED_COUNT=0
DELETED_COUNT=$((DELETED_COUNT + $(find "${BACKUP_DIR}" -name "postgres-volume-*.tar.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)))
DELETED_COUNT=$((DELETED_COUNT + $(find "${BACKUP_DIR}" -name "redis-volume-*.tar.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)))

if [ "${DELETED_COUNT}" -gt 0 ]; then
    log_info "Deleted ${DELETED_COUNT} old volume backup(s)"
else
    log_info "No old volume backups to delete"
fi

log_info "Volume backup process completed successfully"
