#!/bin/bash
#
# Bike Power Tracker - Deploy to Remote Server
# Copies files and deploys the service to a remote Ubuntu server
#
# Usage: ./deploy-to-server.sh --host <ip> --user <username> [options]
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
SERVICE_DIR="${PROJECT_ROOT}/packages/service"
REMOTE_DIR="~/bike-power-tracker"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
REMOTE_HOST=""
REMOTE_USER=""
SSH_KEY=""
BUILD=true
START=true
RUNTIME="auto"  # auto, docker, podman

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
            SSH_KEY="-i $2"
            shift 2
            ;;
        --remote-dir)
            REMOTE_DIR="$2"
            shift 2
            ;;
        --runtime)
            RUNTIME="$2"
            shift 2
            ;;
        --no-build)
            BUILD=false
            shift
            ;;
        --no-start)
            START=false
            shift
            ;;
        --help)
            echo "Usage: $0 --host <ip> --user <username> [options]"
            echo ""
            echo "Required:"
            echo "  --host, -h       Server IP address or hostname"
            echo "  --user, -u       SSH username"
            echo ""
            echo "Options:"
            echo "  --key, -i        Path to SSH private key"
            echo "  --remote-dir     Remote directory (default: ~/bike-power-tracker)"
            echo "  --runtime        Container runtime: auto, docker, podman (default: auto)"
            echo "  --no-build       Skip building containers"
            echo "  --no-start       Don't start services after deploy"
            echo "  --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --host 192.168.1.100 --user christian"
            echo "  $0 --host bike-server --user christian --runtime podman"
            echo "  $0 -h 192.168.1.100 -u christian -i ~/.ssh/id_ed25519"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate required arguments
if [ -z "$REMOTE_HOST" ] || [ -z "$REMOTE_USER" ]; then
    echo -e "${RED}Error: --host and --user are required${NC}"
    echo "Run '$0 --help' for usage"
    exit 1
fi

# Build SSH command
SSH_CMD="ssh $SSH_KEY ${REMOTE_USER}@${REMOTE_HOST}"
SCP_CMD="scp $SSH_KEY"
RSYNC_SSH="ssh $SSH_KEY"

print_header() {
    echo ""
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}▶ $1${NC}"
}

# Test connection
print_header "Deploying to Remote Server"

echo "Target: ${REMOTE_USER}@${REMOTE_HOST}"
echo "Remote directory: $REMOTE_DIR"
echo ""

print_step "Testing SSH connection..."
if ! $SSH_CMD "echo 'Connection successful'" 2>/dev/null; then
    echo -e "${RED}Failed to connect to server${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check if the server is reachable: ping $REMOTE_HOST"
    echo "2. Check SSH service: ssh ${REMOTE_USER}@${REMOTE_HOST}"
    echo "3. Verify SSH key is set up correctly"
    exit 1
fi
echo -e "${GREEN}✓ Connected${NC}"

# Detect container runtime
print_step "Detecting container runtime on server..."
if [ "$RUNTIME" = "auto" ]; then
    if $SSH_CMD "command -v docker" &>/dev/null; then
        RUNTIME="docker"
        COMPOSE_CMD="docker compose"
    elif $SSH_CMD "command -v podman" &>/dev/null; then
        RUNTIME="podman"
        COMPOSE_CMD="podman-compose"
    else
        echo -e "${RED}Neither Docker nor Podman found on server${NC}"
        echo ""
        echo "Install Docker on the server:"
        echo "  ssh ${REMOTE_USER}@${REMOTE_HOST}"
        echo "  curl -fsSL https://get.docker.com | sh"
        echo "  sudo usermod -aG docker \$USER"
        echo ""
        echo "Or install Podman:"
        echo "  sudo apt install podman podman-compose"
        exit 1
    fi
elif [ "$RUNTIME" = "docker" ]; then
    COMPOSE_CMD="docker compose"
elif [ "$RUNTIME" = "podman" ]; then
    COMPOSE_CMD="podman-compose"
fi
echo -e "${GREEN}✓ Using $RUNTIME${NC}"

# Create remote directory
print_step "Creating remote directory..."
$SSH_CMD "mkdir -p $REMOTE_DIR"

# Copy files
print_step "Copying files to server..."
echo "  Source: $SERVICE_DIR"
echo "  Destination: ${REMOTE_USER}@${REMOTE_HOST}:$REMOTE_DIR"
echo ""

if command -v rsync &>/dev/null; then
    rsync -avz --progress \
        --exclude 'node_modules' \
        --exclude '.git' \
        --exclude '*.log' \
        --exclude 'data/*.db' \
        --exclude '.env' \
        -e "$RSYNC_SSH" \
        "$SERVICE_DIR/" \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
else
    # Fallback to scp
    $SCP_CMD -r "$SERVICE_DIR/"* "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
fi

echo -e "${GREEN}✓ Files copied${NC}"

# Copy deployment scripts
print_step "Copying deployment scripts..."
$SCP_CMD "$SCRIPT_DIR/setup.sh" \
         "$SCRIPT_DIR/start.sh" \
         "$SCRIPT_DIR/stop.sh" \
         "$SCRIPT_DIR/backup.sh" \
         "$SCRIPT_DIR/health-check.sh" \
         "$SCRIPT_DIR/logs.sh" \
         "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/scripts/" 2>/dev/null || {
    $SSH_CMD "mkdir -p ${REMOTE_DIR}/scripts"
    $SCP_CMD "$SCRIPT_DIR"/*.sh "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/scripts/"
}

$SSH_CMD "chmod +x ${REMOTE_DIR}/scripts/*.sh"
echo -e "${GREEN}✓ Scripts installed${NC}"

# Check/create .env file
print_step "Checking environment configuration..."
if ! $SSH_CMD "test -f ${REMOTE_DIR}/.env"; then
    echo "Creating .env file on server..."
    $SSH_CMD "cd $REMOTE_DIR && ./scripts/setup.sh --generate-env-only" 2>/dev/null || {
        # Manual .env creation
        REDIS_PASS=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
        API_KEY=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
        
        $SSH_CMD "cat > ${REMOTE_DIR}/.env << 'EOF'
# Generated by deploy-to-server.sh
REDIS_PASSWORD=$REDIS_PASS
API_KEY=$API_KEY
CORS_ORIGIN=*
APP_PORT=8080
EOF"
    }
    echo -e "${GREEN}✓ Environment file created${NC}"
    echo ""
    echo -e "${YELLOW}Note: Check ${REMOTE_DIR}/.env on the server for credentials${NC}"
else
    echo -e "${GREEN}✓ Environment file exists${NC}"
fi

# Build containers
if [ "$BUILD" = true ]; then
    print_step "Building containers on server..."
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD -f docker-compose.home.yml build" || {
        echo -e "${YELLOW}Build failed, trying with pull...${NC}"
        $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD -f docker-compose.home.yml pull"
        $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD -f docker-compose.home.yml build"
    }
    echo -e "${GREEN}✓ Containers built${NC}"
fi

# Start services
if [ "$START" = true ]; then
    print_step "Starting services..."
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD -f docker-compose.home.yml up -d"
    echo -e "${GREEN}✓ Services started${NC}"
    
    # Wait and check health
    echo ""
    print_step "Waiting for services to start..."
    sleep 10
    
    HEALTH=$($SSH_CMD "curl -s http://localhost:8080/health" 2>/dev/null || echo "failed")
    if echo "$HEALTH" | grep -q "ok"; then
        echo -e "${GREEN}✓ Service is healthy${NC}"
    else
        echo -e "${YELLOW}Warning: Health check returned: $HEALTH${NC}"
        echo "Check logs with: $0-control.sh logs"
    fi
fi

# Summary
print_header "Deployment Complete!"

echo "Server: ${REMOTE_USER}@${REMOTE_HOST}"
echo "Directory: $REMOTE_DIR"
echo "Runtime: $RUNTIME"
echo ""
echo "Service URL: http://${REMOTE_HOST}:8080"
echo ""
echo "Useful commands:"
echo "  # Check status"
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} '$COMPOSE_CMD -f ${REMOTE_DIR}/docker-compose.home.yml ps'"
echo ""
echo "  # View logs"
echo "  ssh ${REMOTE_USER}@${REMOTE_HOST} '$COMPOSE_CMD -f ${REMOTE_DIR}/docker-compose.home.yml logs -f'"
echo ""
echo "  # Or use the remote control script:"
echo "  ./remote-control.sh --host ${REMOTE_HOST} --user ${REMOTE_USER} status"
echo ""

# Save connection info for remote-control.sh
CONFIG_FILE="$SCRIPT_DIR/.server-config"
cat > "$CONFIG_FILE" << EOF
# Auto-generated by deploy-to-server.sh
REMOTE_HOST=$REMOTE_HOST
REMOTE_USER=$REMOTE_USER
REMOTE_DIR=$REMOTE_DIR
RUNTIME=$RUNTIME
SSH_KEY_OPT=$SSH_KEY
EOF
echo "Connection saved to $CONFIG_FILE for use with remote-control.sh"
