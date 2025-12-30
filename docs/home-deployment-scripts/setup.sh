#!/bin/bash
#
# Bike Power Tracker - Home Deployment Setup Script
# This script sets up the environment for running the service on a home server
#
# Usage: ./setup.sh [--with-cloudflare] [--with-sqlite] [--with-postgres]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(dirname "$SCRIPT_DIR")}"
SERVICE_DIR="${PROJECT_ROOT}/packages/service"
DATA_DIR="${SERVICE_DIR}/data"
BACKUP_DIR="${HOME}/bike-tracker-backups"

# Parse arguments
WITH_CLOUDFLARE=false
WITH_SQLITE=false
WITH_POSTGRES=false

for arg in "$@"; do
    case $arg in
        --with-cloudflare)
            WITH_CLOUDFLARE=true
            shift
            ;;
        --with-sqlite)
            WITH_SQLITE=true
            shift
            ;;
        --with-postgres)
            WITH_POSTGRES=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --with-cloudflare    Set up Cloudflare Tunnel for remote access"
            echo "  --with-sqlite        Include SQLite database configuration"
            echo "  --with-postgres      Include PostgreSQL database configuration"
            echo "  --help               Show this help message"
            exit 0
            ;;
    esac
done

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

generate_password() {
    openssl rand -base64 32 | tr -d '/+=' | head -c 32
}

# Main setup
print_header "Bike Power Tracker - Home Setup"

echo "This script will set up the Bike Power Tracker service for home deployment."
echo ""
echo "Configuration:"
echo "  - Service directory: $SERVICE_DIR"
echo "  - Data directory: $DATA_DIR"
echo "  - Backup directory: $BACKUP_DIR"
echo "  - Cloudflare Tunnel: $WITH_CLOUDFLARE"
echo "  - SQLite: $WITH_SQLITE"
echo "  - PostgreSQL: $WITH_POSTGRES"
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Check prerequisites
print_header "Checking Prerequisites"

MISSING_DEPS=false

if ! check_command docker; then
    if check_command podman; then
        print_warning "Using Podman instead of Docker"
        CONTAINER_CMD="podman"
        COMPOSE_CMD="podman-compose"
    else
        print_error "Neither Docker nor Podman is installed"
        echo ""
        echo "Install Docker with:"
        echo "  curl -fsSL https://get.docker.com | sh"
        echo "  sudo usermod -aG docker \$USER"
        echo ""
        MISSING_DEPS=true
    fi
else
    CONTAINER_CMD="docker"
    COMPOSE_CMD="docker compose"
fi

check_command openssl || MISSING_DEPS=true
check_command curl || MISSING_DEPS=true

if [ "$MISSING_DEPS" = true ]; then
    print_error "Please install missing dependencies and run again."
    exit 1
fi

# Create directories
print_header "Creating Directories"

mkdir -p "$DATA_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "$SERVICE_DIR/nginx"

print_success "Created $DATA_DIR"
print_success "Created $BACKUP_DIR"

# Generate environment file
print_header "Generating Environment Configuration"

ENV_FILE="$SERVICE_DIR/.env"

if [ -f "$ENV_FILE" ]; then
    print_warning ".env file already exists"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Keeping existing .env file"
    else
        rm "$ENV_FILE"
    fi
fi

if [ ! -f "$ENV_FILE" ]; then
    REDIS_PASSWORD=$(generate_password)
    API_KEY=$(generate_password)
    
    cat > "$ENV_FILE" << EOF
# Bike Power Tracker - Home Deployment Configuration
# Generated on $(date)

# Redis Configuration
REDIS_PASSWORD=$REDIS_PASSWORD

# CORS - Set to your domain or * for local development
CORS_ORIGIN=*

# API Key (recommended for remote access)
API_KEY=$API_KEY

# Port Configuration
APP_PORT=8080
EOF

    if [ "$WITH_POSTGRES" = true ]; then
        POSTGRES_PASSWORD=$(generate_password)
        cat >> "$ENV_FILE" << EOF

# PostgreSQL Configuration
POSTGRES_USER=biketracker
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=biketracker
DATABASE_URL=postgresql://biketracker:$POSTGRES_PASSWORD@postgres:5432/biketracker?schema=public
EOF
    fi

    if [ "$WITH_SQLITE" = true ]; then
        cat >> "$ENV_FILE" << EOF

# SQLite Configuration
DATABASE_URL=file:/app/data/biketracker.db
EOF
    fi

    if [ "$WITH_CLOUDFLARE" = true ]; then
        cat >> "$ENV_FILE" << EOF

# Cloudflare Tunnel (set after creating tunnel)
# CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here
EOF
    fi

    chmod 600 "$ENV_FILE"
    print_success "Generated .env file with secure passwords"
    echo ""
    echo "Important credentials saved to $ENV_FILE:"
    echo "  - Redis Password: $REDIS_PASSWORD"
    echo "  - API Key: $API_KEY"
    [ "$WITH_POSTGRES" = true ] && echo "  - PostgreSQL Password: $POSTGRES_PASSWORD"
fi

# Create docker-compose.home.yml
print_header "Creating Docker Compose Configuration"

COMPOSE_FILE="$SERVICE_DIR/docker-compose.home.yml"

cat > "$COMPOSE_FILE" << 'EOF'
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    container_name: bike_tracker_redis
    command: >
      redis-server 
      --requirepass ${REDIS_PASSWORD} 
      --appendonly yes 
      --maxmemory 100mb 
      --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 30s
      timeout: 3s
      retries: 5
    networks:
      - backend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 128M

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: bike_tracker_service
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - CORS_ORIGIN=${CORS_ORIGIN:-*}
      - API_KEY=${API_KEY:-}
EOF

if [ "$WITH_SQLITE" = true ]; then
    cat >> "$COMPOSE_FILE" << 'EOF'
      - DATABASE_URL=${DATABASE_URL:-}
    volumes:
      - sqlite_data:/app/data
EOF
elif [ "$WITH_POSTGRES" = true ]; then
    cat >> "$COMPOSE_FILE" << 'EOF'
      - DATABASE_URL=${DATABASE_URL:-}
EOF
fi

cat >> "$COMPOSE_FILE" << 'EOF'
    depends_on:
      redis:
        condition: service_healthy
EOF

if [ "$WITH_POSTGRES" = true ]; then
    cat >> "$COMPOSE_FILE" << 'EOF'
      postgres:
        condition: service_healthy
EOF
fi

cat >> "$COMPOSE_FILE" << 'EOF'
    networks:
      - backend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 256M
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s

  nginx:
    image: nginx:alpine
    container_name: bike_tracker_nginx
    ports:
      - "${APP_PORT:-8080}:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app
    networks:
      - backend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 64M
EOF

if [ "$WITH_POSTGRES" = true ]; then
    cat >> "$COMPOSE_FILE" << 'EOF'

  postgres:
    image: postgres:16-alpine
    container_name: bike_tracker_postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-biketracker}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-biketracker}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-biketracker} -d ${POSTGRES_DB:-biketracker}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 256M
EOF
fi

if [ "$WITH_CLOUDFLARE" = true ]; then
    cat >> "$COMPOSE_FILE" << 'EOF'

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: bike_tracker_tunnel
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
    networks:
      - backend
    restart: unless-stopped
    depends_on:
      - nginx
    profiles:
      - cloudflare
EOF
fi

cat >> "$COMPOSE_FILE" << 'EOF'

volumes:
  redis_data:
EOF

if [ "$WITH_SQLITE" = true ]; then
    cat >> "$COMPOSE_FILE" << 'EOF'
  sqlite_data:
EOF
fi

if [ "$WITH_POSTGRES" = true ]; then
    cat >> "$COMPOSE_FILE" << 'EOF'
  postgres_data:
EOF
fi

cat >> "$COMPOSE_FILE" << 'EOF'

networks:
  backend:
EOF

print_success "Created docker-compose.home.yml"

# Create nginx config
print_header "Creating Nginx Configuration"

cat > "$SERVICE_DIR/nginx/default.conf" << 'EOF'
upstream backend {
    server app:3000;
}

server {
    listen 80;
    server_name localhost;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy all requests to the Node.js application
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeout for long-running SSE connections
        proxy_read_timeout 24h;
        proxy_send_timeout 24h;
    }

    # Health check endpoint (no logging)
    location /health {
        proxy_pass http://backend;
        access_log off;
    }
}
EOF

print_success "Created nginx/default.conf"

# Copy helper scripts
print_header "Installing Helper Scripts"

# Create scripts directory
SCRIPTS_INSTALL_DIR="$SERVICE_DIR/scripts"
mkdir -p "$SCRIPTS_INSTALL_DIR"

# Copy scripts from docs if they exist, otherwise create them
for script in start.sh stop.sh backup.sh health-check.sh update.sh; do
    if [ -f "$SCRIPT_DIR/$script" ]; then
        cp "$SCRIPT_DIR/$script" "$SCRIPTS_INSTALL_DIR/"
        chmod +x "$SCRIPTS_INSTALL_DIR/$script"
        print_success "Installed $script"
    fi
done

# Final instructions
print_header "Setup Complete!"

echo "Next steps:"
echo ""
echo "1. Navigate to the service directory:"
echo "   cd $SERVICE_DIR"
echo ""
echo "2. Start the services:"
echo "   $COMPOSE_CMD -f docker-compose.home.yml up -d --build"
echo ""
echo "3. Check status:"
echo "   $COMPOSE_CMD -f docker-compose.home.yml ps"
echo ""
echo "4. View logs:"
echo "   $COMPOSE_CMD -f docker-compose.home.yml logs -f"
echo ""
echo "5. Access the service:"
echo "   http://localhost:8080/health"
echo ""

if [ "$WITH_CLOUDFLARE" = true ]; then
    echo ""
    print_warning "Cloudflare Tunnel Setup Required:"
    echo ""
    echo "1. Create a tunnel at https://one.dash.cloudflare.com"
    echo "2. Get your tunnel token"
    echo "3. Add to .env: CLOUDFLARE_TUNNEL_TOKEN=your-token"
    echo "4. Start with: $COMPOSE_CMD -f docker-compose.home.yml --profile cloudflare up -d"
    echo ""
fi

echo "Your API key for authenticated requests:"
grep "API_KEY=" "$ENV_FILE" | cut -d= -f2
echo ""
echo "Documentation: $PROJECT_ROOT/docs/HOME_DEPLOYMENT.md"
