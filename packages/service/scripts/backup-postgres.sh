#!/bin/bash

# PostgreSQL Backup Script for Bike Power Tracker
# Creates compressed backups and manages retention
# Usage: ./backup-postgres.sh

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-biketracker}"
POSTGRES_DB="${POSTGRES_DB:-biketracker}"

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

# Check if PostgreSQL container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
    log_error "PostgreSQL container '${POSTGRES_CONTAINER}' is not running"
    exit 1
fi

log_info "Starting PostgreSQL backup..."

# Create backup using custom format (supports compression and selective restore)
BACKUP_FILE="${BACKUP_DIR}/postgres-${TIMESTAMP}.dump"

if docker exec "${POSTGRES_CONTAINER}" pg_dump \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --format=custom \
    --compress=9 \
    --verbose \
    > "${BACKUP_FILE}" 2>/dev/null; then
    
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log_info "Backup completed: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    log_error "Backup failed!"
    exit 1
fi

# Clean old backups
log_info "Cleaning backups older than ${RETENTION_DAYS} days..."
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "postgres-*.dump" -mtime +${RETENTION_DAYS} -delete -print | wc -l)

if [ "${DELETED_COUNT}" -gt 0 ]; then
    log_info "Deleted ${DELETED_COUNT} old backup(s)"
else
    log_info "No old backups to delete"
fi

# Show remaining backups
REMAINING_COUNT=$(find "${BACKUP_DIR}" -name "postgres-*.dump" | wc -l)
log_info "Total backups retained: ${REMAINING_COUNT}"

log_info "Backup process completed successfully"
