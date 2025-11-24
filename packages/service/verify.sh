#!/bin/bash

# Quick service verification script
echo "🔍 BPT Service Verification"
echo "============================"
echo ""

# Check if in service directory
if [ ! -f "server.js" ]; then
    echo "❌ Not in service directory"
    echo "   Run from: packages/service/"
    exit 1
fi

echo "✅ In service directory"

# Check if Redis is needed
echo ""
echo "📋 Checking requirements..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js installed: $NODE_VERSION"
else
    echo "❌ Node.js not found"
    exit 1
fi

# Check dependencies
if [ -d "node_modules" ]; then
    echo "✅ Dependencies installed"
else
    echo "⚠️  Dependencies not installed"
    echo "   Run: pnpm install"
    exit 1
fi

# Check Redis connection
echo ""
echo "🔌 Checking Redis..."
if nc -z localhost 6379 2>/dev/null; then
    echo "✅ Redis is running on port 6379"
    REDIS_OK=true
else
    echo "⚠️  Redis not running on port 6379"
    echo "   Start with: docker run -d -p 6379:6379 redis:latest"
    REDIS_OK=false
fi

# List key files
echo ""
echo "📁 Key files:"
[ -f "server.js" ] && echo "✅ server.js" || echo "❌ server.js missing"
[ -f "package.json" ] && echo "✅ package.json" || echo "❌ package.json missing"
[ -f "openapi.yaml" ] && echo "✅ openapi.yaml" || echo "❌ openapi.yaml missing"
[ -d "tests" ] && echo "✅ tests/" || echo "❌ tests/ missing"

# Check integration test
echo ""
if [ -f "tests/client-integration.test.js" ]; then
    echo "✅ Client integration tests present"
else
    echo "❌ Client integration tests missing"
fi

# Summary
echo ""
echo "📊 Summary:"
echo "==========="

if [ "$REDIS_OK" = true ]; then
    echo "✅ Service is ready to run"
    echo ""
    echo "Start with:"
    echo "  pnpm dev"
    echo ""
    echo "Run tests with:"
    echo "  pnpm test"
else
    echo "⚠️  Service needs Redis to run"
    echo ""
    echo "Start Redis with:"
    echo "  docker run -d -p 6379:6379 redis:latest"
    echo ""
    echo "Then start service with:"
    echo "  pnpm dev"
fi

echo ""
echo "View integration docs:"
echo "  cat INTEGRATION.md"
