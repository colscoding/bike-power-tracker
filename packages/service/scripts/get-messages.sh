#!/bin/bash

# Get messages from a Redis stream
# Usage: ./get-messages.sh <stream-name> [count]

STREAM_NAME=${1:-"test-stream"}
COUNT=${2:-100}
API_URL="http://localhost:3000"

echo "Fetching messages from stream: $STREAM_NAME"
echo "Count: $COUNT"
echo ""

curl -X GET "$API_URL/api/streams/$STREAM_NAME/messages?count=$COUNT" \
  -H "Content-Type: application/json" \
  -w "\n\nStatus: %{http_code}\n" \
  | jq '.' 2>/dev/null || cat

echo ""
