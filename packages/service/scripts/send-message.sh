#!/bin/bash

# Send a message to a Redis stream
# Usage: ./send-message.sh <stream-name> <message> [author]

STREAM_NAME=${1:-"test-stream"}
MESSAGE=${2:-"Hello from curl!123"}
AUTHOR=${3:-"script-user"}
API_URL="http://localhost:3000"

echo "Sending message to stream: $STREAM_NAME"
echo "Message: $MESSAGE"
echo "Author: $AUTHOR"
echo ""

curl -X POST "$API_URL/api/streams/$STREAM_NAME/messages" \
  -H "Content-Type: application/json" \
-d "{\"message\": {\"power\": 123}, \"author\": \"$AUTHOR\"}" \
  -w "\n\nStatus: %{http_code}\n"

echo ""
