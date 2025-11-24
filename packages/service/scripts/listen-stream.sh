#!/bin/bash

# Listen to real-time messages from a Redis stream (Server-Sent Events)
# Usage: ./listen-stream.sh <stream-name>
# Press Ctrl+C to stop listening

STREAM_NAME=${1:-"test-stream"}
API_URL="http://localhost:3000"

echo "Listening to stream: $STREAM_NAME"
echo "Press Ctrl+C to stop..."
echo ""
echo "----------------------------------------"

curl -N "$API_URL/api/streams/$STREAM_NAME/listen" 2>/dev/null | while IFS= read -r line; do
  if [[ $line == data:* ]]; then
    # Extract JSON from "data: {...}" format
    json_data="${line#data: }"
    echo "$json_data" | jq '.' 2>/dev/null || echo "$json_data"
  fi
done
