#!/bin/bash

# Test runner script for BPT Service
# Runs tests with proper environment setup

set -e

echo "🧪 Running BPT Service Tests"
echo "============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
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

# Check if Redis is running
check_redis() {
    REDIS_HOST="${REDIS_HOST:-localhost}"
    REDIS_PORT="${REDIS_PORT:-6379}"

    if ! nc -z $REDIS_HOST $REDIS_PORT 2>/dev/null; then
        print_error "Redis is not running on $REDIS_HOST:$REDIS_PORT"
        echo ""
        echo "Please start Redis with one of:"
        echo "  docker-compose up redis -d"
        echo "  docker run -d -p 6379:6379 redis:latest"
        echo "  redis-server"
        exit 1
    fi

    print_success "Redis is running on $REDIS_HOST:$REDIS_PORT"
}

# Parse test type
TEST_TYPE="${1:-all}"

print_info "Checking Redis connection..."
check_redis

echo ""

case $TEST_TYPE in
    unit)
        print_info "Running unit tests..."
        npm run test:unit
        ;;
    integration)
        print_info "Running integration tests..."
        npm run test:integration
        ;;
    api)
        print_info "Running API tests..."
        npm run test:api
        ;;
    coverage)
        print_info "Running tests with coverage..."
        npm run test:coverage
        ;;
    all)
        print_info "Running all tests..."
        npm test
        ;;
    *)
        echo "Usage: $0 [unit|integration|api|coverage|all]"
        exit 1
        ;;
esac

if [ $? -eq 0 ]; then
    echo ""
    print_success "All tests passed!"
else
    echo ""
    print_error "Some tests failed"
    exit 1
fi
