#!/bin/bash

# List all available Redis streams
# Usage: ./list-streams.sh

API_URL="http://localhost:3000"

echo "Fetching all streams..."
echo ""

curl -X GET "$API_URL/api/streams" \
  -H "Content-Type: application/json" \
  -w "\n\nStatus: %{http_code}\n" \
  | jq '.' 2>/dev/null

echo ""
