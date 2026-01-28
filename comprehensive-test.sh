#!/bin/bash

# PanelX Comprehensive API Testing Script
BASE_URL="http://69.169.102.47"
COOKIE_FILE="/tmp/panelx_cookies.txt"

echo "======================================"
echo "PanelX Comprehensive API Testing"
echo "======================================"
echo ""

# Test 1: Login
echo "[TEST 1] Testing Login..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
echo "Login Response: $LOGIN_RESPONSE"
echo ""

# Test 2: Check Auth
echo "[TEST 2] Testing Auth Check..."
AUTH_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/auth/me")
echo "Auth Response: $AUTH_RESPONSE"
echo ""

# Test 3: Dashboard Stats
echo "[TEST 3] Testing Dashboard Stats..."
STATS_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/stats")
echo "Stats Response: $STATS_RESPONSE"
echo ""

# Test 4: System Monitoring Metrics
echo "[TEST 4] Testing System Monitoring..."
MONITORING_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/monitoring/metrics")
echo "Monitoring Response: $MONITORING_RESPONSE"
echo ""

# Test 5: Health Checks
echo "[TEST 5] Testing Health Checks..."
HEALTH_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/monitoring/health")
echo "Health Response: $HEALTH_RESPONSE"
echo ""

# Test 6: Streams List
echo "[TEST 6] Testing Streams List..."
STREAMS_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/streams")
echo "Streams Response (first 500 chars): ${STREAMS_RESPONSE:0:500}"
echo ""

# Test 7: Create a New Stream
echo "[TEST 7] Testing Create Stream..."
CREATE_STREAM=$(curl -s -b "$COOKIE_FILE" -X POST "$BASE_URL/api/streams" \
  -H "Content-Type: application/json" \
  -d '{
    "streamName": "Test Stream",
    "streamType": "live",
    "sourceUrl": "http://example.com/test.m3u8",
    "enabled": true
  }')
echo "Create Stream Response: $CREATE_STREAM"
echo ""

# Test 8: Update Stream (if created successfully)
STREAM_ID=$(echo "$CREATE_STREAM" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
if [ -n "$STREAM_ID" ]; then
  echo "[TEST 8] Testing Update Stream (ID: $STREAM_ID)..."
  UPDATE_STREAM=$(curl -s -b "$COOKIE_FILE" -X PUT "$BASE_URL/api/streams/$STREAM_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "streamName": "Test Stream Updated",
      "streamType": "live",
      "sourceUrl": "http://example.com/test-updated.m3u8",
      "enabled": false
    }')
  echo "Update Stream Response: $UPDATE_STREAM"
  echo ""
fi

# Test 9: Users List
echo "[TEST 9] Testing Users List..."
USERS_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/users")
echo "Users Response (first 300 chars): ${USERS_RESPONSE:0:300}"
echo ""

# Test 10: Create User
echo "[TEST 10] Testing Create User..."
CREATE_USER=$(curl -s -b "$COOKIE_FILE" -X POST "$BASE_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser123",
    "password": "testpass123",
    "role": "admin",
    "credits": 100
  }')
echo "Create User Response: $CREATE_USER"
echo ""

# Test 11: Servers List
echo "[TEST 11] Testing Servers List..."
SERVERS_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/servers")
echo "Servers Response: $SERVERS_RESPONSE"
echo ""

# Test 12: Create Server
echo "[TEST 12] Testing Create Server..."
CREATE_SERVER=$(curl -s -b "$COOKIE_FILE" -X POST "$BASE_URL/api/servers" \
  -H "Content-Type: application/json" \
  -d '{
    "serverName": "Test Server 1",
    "serverUrl": "http://192.168.1.100",
    "serverPort": 80,
    "enabled": true
  }')
echo "Create Server Response: $CREATE_SERVER"
echo ""

# Test 13: Lines List
echo "[TEST 13] Testing Lines List..."
LINES_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/lines")
echo "Lines Response (first 500 chars): ${LINES_RESPONSE:0:500}"
echo ""

# Test 14: Categories List
echo "[TEST 14] Testing Categories List..."
CATEGORIES_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/categories")
echo "Categories Response: $CATEGORIES_RESPONSE"
echo ""

# Test 15: WebSocket Connection
echo "[TEST 15] Testing WebSocket Availability..."
WS_RESPONSE=$(curl -s -I "$BASE_URL/socket.io/")
echo "WebSocket Response Headers:"
echo "$WS_RESPONSE" | grep -E "(HTTP|upgrade|connection)"
echo ""

# Test 16: Delete Test Stream (cleanup)
if [ -n "$STREAM_ID" ]; then
  echo "[TEST 16] Testing Delete Stream (ID: $STREAM_ID)..."
  DELETE_STREAM=$(curl -s -b "$COOKIE_FILE" -X DELETE "$BASE_URL/api/streams/$STREAM_ID")
  echo "Delete Stream Response: $DELETE_STREAM"
  echo ""
fi

echo "======================================"
echo "Testing Complete!"
echo "======================================"
echo ""
echo "Summary:"
echo "- Login: $(echo "$LOGIN_RESPONSE" | grep -q '"id"' && echo '✅ PASS' || echo '❌ FAIL')"
echo "- Auth Check: $(echo "$AUTH_RESPONSE" | grep -q '"id"' && echo '✅ PASS' || echo '❌ FAIL')"
echo "- Dashboard Stats: $(echo "$STATS_RESPONSE" | grep -q 'totalStreams' && echo '✅ PASS' || echo '❌ FAIL')"
echo "- System Monitoring: $(echo "$MONITORING_RESPONSE" | grep -q 'cpu' && echo '✅ PASS' || echo '❌ FAIL')"
echo "- Health Checks: $(echo "$HEALTH_RESPONSE" | grep -q 'overall' && echo '✅ PASS' || echo '❌ FAIL')"
echo "- Streams CRUD: $(echo "$CREATE_STREAM" | grep -q '"id"' && echo '✅ PASS' || echo '❌ FAIL')"
echo "- Users CRUD: $(echo "$CREATE_USER" | grep -q '"id"' && echo '✅ PASS' || echo '❌ FAIL')"
echo "- Servers CRUD: $(echo "$CREATE_SERVER" | grep -q '"id"' && echo '✅ PASS' || echo '❌ FAIL')"

# Cleanup
rm -f "$COOKIE_FILE"
