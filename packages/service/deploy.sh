#!/bin/bash

# Deployment script for Bike Power Tracker Service
# Usage: ./deploy.sh [--no-build]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Change to script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    
    if [ ! -f "docker-compose.prod.yml" ]; then
        log_error "docker-compose.prod.yml not found. Are you in the correct directory?"
        exit 1
    fi
    
    log_info "Prerequisites check passed."
}

# Generate secure random string
generate_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    else
        # Fallback to /dev/urandom
        head -c 32 /dev/urandom | xxd -p | tr -d '\n'
    fi
}

# Create .env file if it doesn't exist
setup_env() {
    if [ ! -f .env ]; then
        log_info "Creating .env file with secure defaults..."
        
        cat > .env << EOF
# Redis Configuration
REDIS_PASSWORD=$(generate_secret)

# API Security (optional - leave empty to disable authentication)
# API_KEY=$(generate_secret)

# CORS Configuration
# Set to specific origin in production, e.g., https://yourdomain.com
CORS_ORIGIN=*

# Application Port (internal, exposed via Nginx on port 80)
APP_PORT=3000
EOF
        
        chmod 600 .env
        log_warn "Created .env file with generated secrets."
        log_warn "Review and edit .env before proceeding if needed."
        log_warn "To enable API authentication, uncomment API_KEY in .env"
    else
        log_info "Using existing .env file."
    fi
}

# Load and validate environment
load_env() {
    set -a
    source .env
    set +a
    
    if [ -z "${REDIS_PASSWORD:-}" ]; then
        log_error "REDIS_PASSWORD is not set in .env file."
        exit 1
    fi
    
    log_info "Environment loaded successfully."
}

# Deploy the application
deploy() {
    local build_flag="--build"
    
    if [[ "${1:-}" == "--no-build" ]]; then
        build_flag=""
        log_info "Skipping build (using existing images)..."
    fi
    
    log_info "Deploying Bike Power Tracker Service..."
    echo "  CORS_ORIGIN: ${CORS_ORIGIN:-*}"
    echo "  API_KEY: ${API_KEY:+enabled}${API_KEY:-disabled}"
    
    # Pull latest base images
    log_info "Pulling latest base images..."
    docker compose -f docker-compose.prod.yml pull redis nginx || true
    
    # Build and start containers
    log_info "Starting containers..."
    docker compose -f docker-compose.prod.yml up -d $build_flag
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 5
    
    # Health check
    if ! docker compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log_error "Some containers failed to start. Check logs with:"
        echo "  docker compose -f docker-compose.prod.yml logs"
        exit 1
    fi
}

# Verify deployment
verify() {
    log_info "Verifying deployment..."
    
    # Check container status
    docker compose -f docker-compose.prod.yml ps
    
    # Test health endpoint
    sleep 2
    if curl -sf http://localhost/health > /dev/null 2>&1; then
        log_info "Health check passed!"
    else
        log_warn "Health check failed. Service may still be starting..."
        log_warn "Try: curl http://localhost/health"
    fi
}

# Main execution
main() {
    log_info "=== Bike Power Tracker Deployment ==="
    
    check_prerequisites
    setup_env
    load_env
    deploy "$@"
    verify
    
    echo ""
    log_info "=== Deployment Complete ==="
    echo ""
    echo "Service is running at: http://localhost (port 80)"
    echo ""
    echo "Useful commands:"
    echo "  View logs:      docker compose -f docker-compose.prod.yml logs -f"
    echo "  Stop service:   docker compose -f docker-compose.prod.yml down"
    echo "  Restart:        docker compose -f docker-compose.prod.yml restart"
    echo "  View status:    docker compose -f docker-compose.prod.yml ps"
    echo ""
}

main "$@"
