#!/bin/bash

echo "============================================"
echo "PanelX Lines & VLC Testing Script"
echo "============================================"
echo ""

BASE_URL="http://69.169.102.47"
COOKIE_FILE="/tmp/panelx_debug_cookies.txt"

echo "[1] Login as admin..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
echo "Login: $LOGIN_RESPONSE"
echo ""

echo "[2] Get all lines..."
LINES=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/lines")
echo "Lines (first 500 chars): ${LINES:0:500}"
echo ""

# Extract first line ID
LINE_ID=$(echo "$LINES" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "First Line ID: $LINE_ID"
echo ""

if [ -n "$LINE_ID" ]; then
  echo "[3] Get single line details..."
  LINE_DETAIL=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/lines/$LINE_ID")
  echo "Line $LINE_ID details: $LINE_DETAIL"
  echo ""
  
  # Extract username and password
  LINE_USERNAME=$(echo "$LINE_DETAIL" | grep -o '"username":"[^"]*"' | head -1 | cut -d'"' -f4)
  LINE_PASSWORD=$(echo "$LINE_DETAIL" | grep -o '"password":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "Line credentials: username=$LINE_USERNAME, password=$LINE_PASSWORD"
  echo ""
  
  echo "[4] Test UPDATE line (change notes)..."
  UPDATE_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X PUT "$BASE_URL/api/lines/$LINE_ID" \
    -H "Content-Type: application/json" \
    -d "{\"notes\":\"Test update at $(date)\"}")
  echo "Update response: $UPDATE_RESPONSE"
  echo ""
  
  echo "[5] Verify update was saved..."
  UPDATED_LINE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/lines/$LINE_ID")
  echo "Updated line: $UPDATED_LINE"
  echo ""
  
  if [ -n "$LINE_USERNAME" ] && [ -n "$LINE_PASSWORD" ]; then
    echo "[6] Test player API authentication..."
    PLAYER_AUTH=$(curl -s "$BASE_URL/player_api.php?username=$LINE_USERNAME&password=$LINE_PASSWORD")
    echo "Player API auth: ${PLAYER_AUTH:0:500}"
    echo ""
    
    echo "[7] Get live categories..."
    LIVE_CATS=$(curl -s "$BASE_URL/player_api.php?username=$LINE_USERNAME&password=$LINE_PASSWORD&action=get_live_categories")
    echo "Live categories: ${LIVE_CATS:0:300}"
    echo ""
    
    echo "[8] Get live streams..."
    LIVE_STREAMS=$(curl -s "$BASE_URL/player_api.php?username=$LINE_USERNAME&password=$LINE_PASSWORD&action=get_live_streams")
    echo "Live streams: ${LIVE_STREAMS:0:500}"
    echo ""
    
    # Extract first stream ID
    STREAM_ID=$(echo "$LIVE_STREAMS" | grep -o '"stream_id":[0-9]*' | head -1 | cut -d':' -f2)
    if [ -n "$STREAM_ID" ]; then
      echo "First stream ID: $STREAM_ID"
      STREAM_URL="$BASE_URL/live/$LINE_USERNAME/$LINE_PASSWORD/$STREAM_ID.ts"
      echo ""
      echo "[9] Test stream URL access..."
      echo "Stream URL: $STREAM_URL"
      STREAM_TEST=$(curl -I -s "$STREAM_URL" | head -10)
      echo "Stream test: $STREAM_TEST"
    else
      echo "⚠️  No streams found for this line"
    fi
  fi
fi

echo ""
echo "============================================"
echo "Diagnostics Complete"
echo "============================================"
echo ""
echo "Summary:"
echo "- Login: $(echo "$LOGIN_RESPONSE" | grep -q '"id"' && echo '✅' || echo '❌')"
echo "- Get Lines: $(echo "$LINES" | grep -q '"id"' && echo '✅' || echo '❌')"
echo "- Update Line: $(echo "$UPDATE_RESPONSE" | grep -q '"id"' && echo '✅' || echo '❌')"
echo "- Player API: $(echo "$PLAYER_AUTH" | grep -q 'user_info' && echo '✅' || echo '❌')"
echo "- Live Streams: $(echo "$LIVE_STREAMS" | grep -q 'stream_id' && echo '✅' || echo '❌')"

rm -f "$COOKIE_FILE"
