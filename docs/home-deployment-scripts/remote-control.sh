#!/bin/bash
#
# Bike Power Tracker - Remote Control
# Manage the bike-power service running on a remote server
#
# Usage: ./remote-control.sh <command> [--host <ip>] [--user <username>]
#
# Commands: start, stop, restart, status, logs, health, backup, update
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/.server-config"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load saved config if exists
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Default values
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_USER="${REMOTE_USER:-}"
REMOTE_DIR="${REMOTE_DIR:-~/bike-power-tracker}"
RUNTIME="${RUNTIME:-auto}"
SSH_KEY_OPT="${SSH_KEY_OPT:-}"
COMMAND=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --host|-h)
            REMOTE_HOST="$2"
            shift 2
            ;;
        --user|-u)
            REMOTE_USER="$2"
            shift 2
            ;;
        --key|-i)
            SSH_KEY_OPT="-i $2"
            shift 2
            ;;
        --dir)
            REMOTE_DIR="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 <command> [options]"
            echo ""
            echo "Commands:"
            echo "  start       Start the service"
            echo "  stop        Stop the service"
            echo "  restart     Restart the service"
            echo "  status      Show container status"
            echo "  logs        Show service logs (follow mode)"
            echo "  health      Check service health"
            echo "  backup      Create backup on server"
            echo "  update      Update and restart service"
            echo "  shell       Open SSH shell on server"
            echo "  exec <cmd>  Execute command on server"
            echo ""
            echo "Options:"
            echo "  --host, -h   Server IP or hostname"
            echo "  --user, -u   SSH username"
            echo "  --key, -i    SSH private key path"
            echo "  --dir        Remote directory (default: ~/bike-power-tracker)"
            echo ""
            echo "Examples:"
            echo "  $0 status --host 192.168.1.100 --user christian"
            echo "  $0 logs"
            echo "  $0 restart"
            echo "  $0 exec 'docker ps'"
            exit 0
            ;;
        start|stop|restart|status|logs|health|backup|update|shell|exec)
            COMMAND="$1"
            shift
            # Capture remaining args for exec command
            EXEC_ARGS="$@"
            break
            ;;
        *)
            # Check if it's a command without options
            if [[ "$1" =~ ^(start|stop|restart|status|logs|health|backup|update|shell)$ ]]; then
                COMMAND="$1"
                shift
            else
                echo -e "${RED}Unknown option or command: $1${NC}"
                echo "Run '$0 --help' for usage"
                exit 1
            fi
            ;;
    esac
done

# Validate
if [ -z "$COMMAND" ]; then
    echo -e "${RED}Error: No command specified${NC}"
    echo "Run '$0 --help' for usage"
    exit 1
fi

if [ -z "$REMOTE_HOST" ] || [ -z "$REMOTE_USER" ]; then
    echo -e "${RED}Error: Server connection not configured${NC}"
    echo ""
    echo "Either:"
    echo "  1. Run deploy-to-server.sh first (saves connection info)"
    echo "  2. Specify --host and --user options"
    echo ""
    echo "Example: $0 $COMMAND --host 192.168.1.100 --user christian"
    exit 1
fi

# Build SSH command
SSH_CMD="ssh $SSH_KEY_OPT ${REMOTE_USER}@${REMOTE_HOST}"

# Detect runtime if auto
if [ "$RUNTIME" = "auto" ]; then
    if $SSH_CMD "command -v docker" &>/dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="podman-compose"
    fi
elif [ "$RUNTIME" = "docker" ]; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="podman-compose"
fi

# Remote compose command
REMOTE_COMPOSE="cd $REMOTE_DIR && $COMPOSE_CMD -f docker-compose.home.yml"

# Execute command
case $COMMAND in
    start)
        echo -e "${BLUE}Starting service on ${REMOTE_HOST}...${NC}"
        $SSH_CMD "$REMOTE_COMPOSE up -d"
        echo -e "${GREEN}✓ Service started${NC}"
        echo ""
        echo "Access at: http://${REMOTE_HOST}:8080"
        ;;
        
    stop)
        echo -e "${BLUE}Stopping service on ${REMOTE_HOST}...${NC}"
        $SSH_CMD "$REMOTE_COMPOSE down"
        echo -e "${GREEN}✓ Service stopped${NC}"
        ;;
        
    restart)
        echo -e "${BLUE}Restarting service on ${REMOTE_HOST}...${NC}"
        $SSH_CMD "$REMOTE_COMPOSE restart"
        echo -e "${GREEN}✓ Service restarted${NC}"
        ;;
        
    status)
        echo -e "${BLUE}Service status on ${REMOTE_HOST}:${NC}"
        echo ""
        $SSH_CMD "$REMOTE_COMPOSE ps"
        ;;
        
    logs)
        echo -e "${BLUE}Showing logs from ${REMOTE_HOST} (Ctrl+C to exit)...${NC}"
        echo ""
        $SSH_CMD "$REMOTE_COMPOSE logs -f --tail=100"
        ;;
        
    health)
        echo -e "${BLUE}Health check for ${REMOTE_HOST}:${NC}"
        echo ""
        
        # Container status
        echo "Container status:"
        $SSH_CMD "$REMOTE_COMPOSE ps --format 'table {{.Name}}\t{{.Status}}'" 2>/dev/null || \
        $SSH_CMD "$REMOTE_COMPOSE ps"
        echo ""
        
        # HTTP health
        echo -n "HTTP health endpoint: "
        HEALTH=$($SSH_CMD "curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/health" 2>/dev/null)
        if [ "$HEALTH" = "200" ]; then
            echo -e "${GREEN}OK (200)${NC}"
            $SSH_CMD "curl -s http://localhost:8080/health" | head -1
        else
            echo -e "${RED}FAILED ($HEALTH)${NC}"
        fi
        echo ""
        
        # Resource usage
        echo "Resource usage:"
        $SSH_CMD "docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'" 2>/dev/null || \
        $SSH_CMD "podman stats --no-stream" 2>/dev/null || \
        echo "  (stats not available)"
        ;;
        
    backup)
        echo -e "${BLUE}Creating backup on ${REMOTE_HOST}...${NC}"
        $SSH_CMD "cd $REMOTE_DIR && ./scripts/backup.sh --all" 2>/dev/null || {
            echo "Running backup commands directly..."
            $SSH_CMD "mkdir -p ~/bike-tracker-backups"
            
            # Redis backup
            REDIS_PASS=$($SSH_CMD "grep REDIS_PASSWORD $REMOTE_DIR/.env | cut -d= -f2")
            $SSH_CMD "docker exec bike_tracker_redis redis-cli -a '$REDIS_PASS' BGSAVE" 2>/dev/null || true
            sleep 2
            TIMESTAMP=$(date +%Y%m%d-%H%M%S)
            $SSH_CMD "docker cp bike_tracker_redis:/data/dump.rdb ~/bike-tracker-backups/redis-$TIMESTAMP.rdb" 2>/dev/null || true
        }
        echo -e "${GREEN}✓ Backup complete${NC}"
        echo ""
        echo "Backups on server:"
        $SSH_CMD "ls -lh ~/bike-tracker-backups/ | tail -5"
        ;;
        
    update)
        echo -e "${BLUE}Updating service on ${REMOTE_HOST}...${NC}"
        echo ""
        
        # Check if git repo
        if $SSH_CMD "test -d $REMOTE_DIR/.git"; then
            echo "Pulling latest changes..."
            $SSH_CMD "cd $REMOTE_DIR && git pull"
        else
            echo -e "${YELLOW}Not a git repository, skipping pull${NC}"
        fi
        
        echo "Rebuilding containers..."
        $SSH_CMD "$REMOTE_COMPOSE build"
        
        echo "Restarting services..."
        $SSH_CMD "$REMOTE_COMPOSE up -d"
        
        echo ""
        echo -e "${GREEN}✓ Update complete${NC}"
        
        # Health check
        sleep 5
        HEALTH=$($SSH_CMD "curl -s http://localhost:8080/health" 2>/dev/null || echo "failed")
        if echo "$HEALTH" | grep -q "ok"; then
            echo -e "${GREEN}✓ Service is healthy${NC}"
        else
            echo -e "${YELLOW}Warning: Health check returned: $HEALTH${NC}"
        fi
        ;;
        
    shell)
        echo -e "${BLUE}Opening shell on ${REMOTE_HOST}...${NC}"
        $SSH_CMD
        ;;
        
    exec)
        if [ -z "$EXEC_ARGS" ]; then
            echo -e "${RED}Error: No command specified for exec${NC}"
            echo "Usage: $0 exec '<command>'"
            exit 1
        fi
        $SSH_CMD "$EXEC_ARGS"
        ;;
        
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        exit 1
        ;;
esac
