#!/bin/bash

# Build script for BPT Service
# Builds Docker images for production and development

set -e

echo "🔨 Building BPT Service Docker Images"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Parse arguments
BUILD_TYPE="${1:-all}"

case $BUILD_TYPE in
    prod|production)
        print_info "Building production image..."
        docker build -t bpt-service:latest -t bpt-service:production .
        print_success "Production image built"
        ;;
    dev|development)
        print_info "Building development image..."
        docker build -f Dockerfile.dev -t bpt-service:dev .
        print_success "Development image built"
        ;;
    all)
        print_info "Building production image..."
        docker build -t bpt-service:latest -t bpt-service:production .
        print_success "Production image built"

        print_info "Building development image..."
        docker build -f Dockerfile.dev -t bpt-service:dev .
        print_success "Development image built"
        ;;
    *)
        echo "Usage: $0 [prod|dev|all]"
        exit 1
        ;;
esac

echo ""
print_success "Build complete!"
echo ""
echo "Available commands:"
echo "  Production:  docker-compose up"
echo "  Development: docker-compose --profile dev up app-dev"
echo ""
