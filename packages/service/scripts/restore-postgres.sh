#!/bin/bash

# PostgreSQL Restore Script for Bike Power Tracker
# Restores database from a backup file
# Usage: ./restore-postgres.sh <backup-file>

set -euo pipefail

# Configuration
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

# Check arguments
if [ $# -eq 0 ]; then
    log_error "Usage: $0 <backup-file>"
    log_info "Example: $0 ./backups/postgres-20250109-020000.dump"
    exit 1
fi

BACKUP_FILE="$1"

# Validate backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    log_error "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Check if PostgreSQL container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
    log_error "PostgreSQL container '${POSTGRES_CONTAINER}' is not running"
    exit 1
fi

# Warning prompt
log_warn "⚠️  WARNING: This will OVERWRITE the current database!"
log_warn "Database: ${POSTGRES_DB}"
log_warn "Backup file: ${BACKUP_FILE}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log_info "Restore cancelled"
    exit 0
fi

log_info "Starting database restore..."

# Restore database
if docker exec -i "${POSTGRES_CONTAINER}" pg_restore \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --clean \
    --if-exists \
    --verbose \
    < "${BACKUP_FILE}" 2>/dev/null; then
    
    log_info "✓ Database restored successfully from ${BACKUP_FILE}"
else
    log_error "✗ Database restore failed!"
    exit 1
fi

log_info "Restore process completed"
