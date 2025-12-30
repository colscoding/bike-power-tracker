#!/bin/bash
#
# Bike Power Tracker - Install Cron Jobs
# Sets up automated backups and health checks
#
# Usage: ./install-cron.sh [--backup-daily] [--health-check] [--all]
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Parse arguments
INSTALL_BACKUP=false
INSTALL_HEALTH=false

for arg in "$@"; do
    case $arg in
        --backup-daily)
            INSTALL_BACKUP=true
            ;;
        --health-check)
            INSTALL_HEALTH=true
            ;;
        --all)
            INSTALL_BACKUP=true
            INSTALL_HEALTH=true
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --backup-daily   Install daily backup job (runs at 2 AM)"
            echo "  --health-check   Install health check job (runs every 5 minutes)"
            echo "  --all            Install all cron jobs"
            echo "  --help           Show this help message"
            exit 0
            ;;
    esac
done

if [ "$INSTALL_BACKUP" = false ] && [ "$INSTALL_HEALTH" = false ]; then
    echo "Usage: $0 [--backup-daily] [--health-check] [--all]"
    echo "Run '$0 --help' for more information."
    exit 1
fi

# Check if scripts exist
if [ "$INSTALL_BACKUP" = true ] && [ ! -f "$SCRIPT_DIR/backup.sh" ]; then
    echo -e "${YELLOW}Warning: backup.sh not found in $SCRIPT_DIR${NC}"
    INSTALL_BACKUP=false
fi

if [ "$INSTALL_HEALTH" = true ] && [ ! -f "$SCRIPT_DIR/health-check.sh" ]; then
    echo -e "${YELLOW}Warning: health-check.sh not found in $SCRIPT_DIR${NC}"
    INSTALL_HEALTH=false
fi

# Make scripts executable
chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true

# Get current crontab
CURRENT_CRON=$(crontab -l 2>/dev/null || true)

# Marker for our jobs
MARKER="# bike-power-tracker"

# Remove existing bike-power-tracker jobs
NEW_CRON=$(echo "$CURRENT_CRON" | grep -v "$MARKER" || true)

echo "Installing cron jobs..."
echo ""

# Add backup job
if [ "$INSTALL_BACKUP" = true ]; then
    BACKUP_JOB="0 2 * * * $SCRIPT_DIR/backup.sh --all >> \$HOME/bike-tracker-backup.log 2>&1 $MARKER"
    NEW_CRON="$NEW_CRON
$BACKUP_JOB"
    echo -e "${GREEN}✓ Daily backup at 2:00 AM${NC}"
fi

# Add health check job
if [ "$INSTALL_HEALTH" = true ]; then
    HEALTH_JOB="*/5 * * * * $SCRIPT_DIR/health-check.sh --restart-on-failure >> \$HOME/bike-tracker-health.log 2>&1 $MARKER"
    NEW_CRON="$NEW_CRON
$HEALTH_JOB"
    echo -e "${GREEN}✓ Health check every 5 minutes${NC}"
fi

# Install new crontab
echo "$NEW_CRON" | crontab -

echo ""
echo "Cron jobs installed. Current bike-tracker jobs:"
crontab -l | grep "$MARKER" || echo "(none)"
echo ""
echo "Log files:"
[ "$INSTALL_BACKUP" = true ] && echo "  Backup: ~/bike-tracker-backup.log"
[ "$INSTALL_HEALTH" = true ] && echo "  Health: ~/bike-tracker-health.log"
echo ""
echo "To remove these jobs, run:"
echo "  crontab -e  # and delete lines containing '$MARKER'"
