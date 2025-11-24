#!/bin/bash

# Create a new Redis stream
# Usage: ./create-stream.sh <stream-name>

STREAM_NAME=${1:-"test-stream"}
API_URL="http://localhost:3000"

echo "Creating stream: $STREAM_NAME"
echo ""

curl -X POST "$API_URL/api/streams/create" \
  -H "Content-Type: application/json" \
  -d "{\"streamName\": \"$STREAM_NAME\"}" \
  -w "\n\nStatus: %{http_code}\n"

echo ""
