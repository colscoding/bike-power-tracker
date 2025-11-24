#!/bin/bash

# Setup script for BPT Service
# This script sets up the development environment

set -e  # Exit on error

echo "🚀 BPT Service Setup Script"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js v14 or higher."
    exit 1
fi

print_success "Node.js $(node --version) found"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm."
    exit 1
fi

print_success "npm $(npm --version) found"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_info "Docker is not installed. Docker is optional but recommended."
else
    print_success "Docker $(docker --version | cut -d ' ' -f3 | tr -d ',') found"
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_info "Docker Compose is not installed. Docker Compose is optional but recommended."
else
    print_success "Docker Compose found"
fi

echo ""
echo "📦 Installing dependencies..."

# Install npm dependencies
npm install

print_success "Dependencies installed"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    print_info "Creating .env file from .env.example..."
    cp .env.example .env
    print_success ".env file created"
else
    print_info ".env file already exists"
fi

echo ""
echo "🔍 Running code quality checks..."

# Run linter
npm run lint || print_info "Linting found issues (can be fixed with 'npm run lint:fix')"

echo ""
print_success "Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start Redis: docker-compose up redis -d"
echo "  2. Start the app: npm start"
echo "  3. Or use Docker: docker-compose up"
echo "  4. Run tests: npm test"
echo "  5. Development mode: npm run dev"
echo ""
