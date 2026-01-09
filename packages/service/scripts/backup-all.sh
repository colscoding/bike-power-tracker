#!/bin/bash

# Complete Backup Script for Bike Power Tracker
# Runs all backup scripts in sequence
# Usage: ./backup-all.sh

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log_info "Starting complete backup process..."
log_info "=========================================="

# Run PostgreSQL backup
log_info "Step 1/3: PostgreSQL database backup"
if bash "${SCRIPT_DIR}/backup-postgres.sh"; then
    log_info "✓ PostgreSQL backup completed"
else
    log_error "✗ PostgreSQL backup failed"
    exit 1
fi

echo ""

# Run Redis backup
log_info "Step 2/3: Redis database backup"
if bash "${SCRIPT_DIR}/backup-redis.sh"; then
    log_info "✓ Redis backup completed"
else
    log_error "✗ Redis backup failed"
    exit 1
fi

echo ""

# Run volume backup
log_info "Step 3/3: Docker volumes backup"
if bash "${SCRIPT_DIR}/backup-volumes.sh"; then
    log_info "✓ Volume backup completed"
else
    log_error "✗ Volume backup failed"
    exit 1
fi

echo ""
log_info "=========================================="
log_info "All backups completed successfully!"

# Show total backup size
BACKUP_DIR="${BACKUP_DIR:-./backups}"
if [ -d "${BACKUP_DIR}" ]; then
    TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
    BACKUP_COUNT=$(find "${BACKUP_DIR}" -type f | wc -l)
    log_info "Total backup size: ${TOTAL_SIZE} (${BACKUP_COUNT} files)"
fi
