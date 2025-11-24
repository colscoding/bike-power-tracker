#!/bin/bash

# Deployment script for BPT Service
# Handles production deployment

set -e

echo "🚢 BPT Service Deployment"
echo "========================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check for required files
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found!"
    exit 1
fi

if [ ! -f ".env" ]; then
    print_info ".env file not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_info "Please configure .env file before deploying"
        exit 1
    else
        print_error ".env.example not found!"
        exit 1
    fi
fi

# Parse deployment mode
DEPLOY_MODE="${1:-production}"

case $DEPLOY_MODE in
    production|prod)
        print_info "Deploying to production..."

        # Pull latest images if using remote registry
        # docker-compose pull

        # Build images
        print_info "Building production images..."
        docker-compose build app

        # Run tests
        print_info "Running tests..."
        ./test.sh all || {
            print_error "Tests failed! Deployment aborted."
            exit 1
        }

        # Stop existing containers
        print_info "Stopping existing containers..."
        docker-compose down

        # Start services
        print_info "Starting services..."
        docker-compose up -d

        # Wait for health checks
        print_info "Waiting for services to be healthy..."
        sleep 10

        # Check service health
        if docker-compose ps | grep -q "unhealthy"; then
            print_error "Some services are unhealthy!"
            docker-compose ps
            exit 1
        fi

        print_success "Deployment complete!"
        docker-compose ps
        ;;

    development|dev)
        print_info "Starting development environment..."

        # Start with development profile
        docker-compose --profile dev up -d

        print_success "Development environment started!"
        docker-compose ps
        ;;

    stop)
        print_info "Stopping all services..."
        docker-compose down
        print_success "Services stopped"
        ;;

    restart)
        print_info "Restarting services..."
        docker-compose restart
        print_success "Services restarted"
        ;;

    logs)
        docker-compose logs -f
        ;;

    *)
        echo "Usage: $0 [production|development|stop|restart|logs]"
        exit 1
        ;;
esac

echo ""
