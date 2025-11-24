#!/bin/bash

# Demo script showing all Redis Streams operations
# Usage: ./demo.sh

API_URL="http://localhost:3000"
STREAM_NAME="demo-stream-$(date +%s)"

echo "========================================"
echo "Redis Streams API Demo"
echo "========================================"
echo ""

# Check if server is running
echo "1. Checking if server is running..."
if ! curl -s "$API_URL" > /dev/null 2>&1; then
  echo "❌ Server not running. Start it with: npm start"
  exit 1
fi
echo "✅ Server is running"
echo ""

# Create a stream
echo "2. Creating stream: $STREAM_NAME"
curl -s -X POST "$API_URL/api/streams/create" \
  -H "Content-Type: application/json" \
  -d "{\"streamName\": \"$STREAM_NAME\"}" | jq '.'
echo ""
sleep 1

# Send multiple messages
echo "3. Sending messages to the stream..."
for i in {1..3}; do
  echo "   Message $i..."
  curl -s -X POST "$API_URL/api/streams/$STREAM_NAME/messages" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"Demo message #$i\", \"author\": \"demo-script\"}" | jq -c '.'
  sleep 0.5
done
echo ""

# List all streams
echo "4. Listing all streams..."
curl -s -X GET "$API_URL/api/streams" | jq '.streams[] | {name, length}'
echo ""

# Get messages from the stream
echo "5. Getting messages from $STREAM_NAME..."
curl -s -X GET "$API_URL/api/streams/$STREAM_NAME/messages?count=10" | jq '.messages[] | {author: .data.author, message: .data.message}'
echo ""

echo "========================================"
echo "Demo completed successfully!"
echo "========================================"
echo ""
echo "Stream created: $STREAM_NAME"
echo ""
echo "To listen to real-time messages, run:"
echo "  ./scripts/listen-stream.sh $STREAM_NAME"
echo ""
echo "Then in another terminal, send messages with:"
echo "  ./scripts/send-message.sh $STREAM_NAME 'Your message here'"
echo ""
