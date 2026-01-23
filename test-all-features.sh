#!/bin/bash
# Comprehensive PanelX Testing Script
# Tests all features and functionalities

set -e

echo "=== PanelX Comprehensive Testing ==="
echo "Date: $(date)"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    ((FAILED++))
  fi
}

# Base URL
BASE_URL="http://localhost:5000"
COOKIES="/tmp/panelx-test-cookies.txt"

echo "Step 1: Testing Server Health"
echo "================================"

# Test 1: Server is running
curl -s "$BASE_URL/api/stats" > /dev/null
test_result $? "Server is running and responding"

# Test 2: Stats API returns valid JSON
STATS=$(curl -s "$BASE_URL/api/stats")
echo "$STATS" | jq . > /dev/null 2>&1
test_result $? "Stats API returns valid JSON"

# Test 3: Stats contain expected fields
echo "$STATS" | jq -e '.totalStreams' > /dev/null 2>&1
test_result $? "Stats contain totalStreams field"

echo ""
echo "Step 2: Testing Authentication"
echo "================================"

# Test 4: Login with admin credentials
LOGIN_RESPONSE=$(curl -s -c "$COOKIES" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
echo "$LOGIN_RESPONSE" | jq -e '.username == "admin"' > /dev/null 2>&1
test_result $? "Admin login successful"

# Test 5: Session is maintained
AUTH_CHECK=$(curl -s -b "$COOKIES" "$BASE_URL/api/auth/me")
echo "$AUTH_CHECK" | jq -e '.username == "admin"' > /dev/null 2>&1
test_result $? "Session authentication works"

echo ""
echo "Step 3: Testing Streams API"
echo "================================"

# Test 6: Get streams list
STREAMS=$(curl -s -b "$COOKIES" "$BASE_URL/api/streams")
if [ ! -z "$STREAMS" ]; then
  test_result 0 "Streams API endpoint accessible"
else
  test_result 1 "Streams API endpoint accessible"
fi

# Test 7: Create new stream
CREATE_STREAM=$(curl -s -b "$COOKIES" -X POST "$BASE_URL/api/streams" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Stream",
    "sourceUrl": "http://example.com/test.m3u8",
    "streamType": "live",
    "categoryId": 1
  }')
echo "$CREATE_STREAM" | jq -e '.id' > /dev/null 2>&1
test_result $? "Create stream"

# Get the created stream ID
STREAM_ID=$(echo "$CREATE_STREAM" | jq -r '.id')

# Test 8: Update stream
if [ ! -z "$STREAM_ID" ] && [ "$STREAM_ID" != "null" ]; then
  UPDATE_STREAM=$(curl -s -b "$COOKIES" -X PUT "$BASE_URL/api/streams/$STREAM_ID" \
    -H "Content-Type: application/json" \
    -d '{"name": "Test Stream Updated"}')
  echo "$UPDATE_STREAM" | jq -e '.name == "Test Stream Updated"' > /dev/null 2>&1
  test_result $? "Update stream"
  
  # Test 9: Delete stream
  curl -s -b "$COOKIES" -X DELETE "$BASE_URL/api/streams/$STREAM_ID" > /dev/null
  test_result $? "Delete stream"
else
  test_result 1 "Update stream (skipped - no stream created)"
  test_result 1 "Delete stream (skipped - no stream created)"
fi

echo ""
echo "Step 4: Testing Lines API"
echo "================================"

# Test 10: Get lines list
LINES=$(curl -s -b "$COOKIES" "$BASE_URL/api/lines/list")
if [ ! -z "$LINES" ]; then
  test_result 0 "Lines API endpoint accessible"
else
  test_result 1 "Lines API endpoint accessible"
fi

# Test 11: Create new line
CREATE_LINE=$(curl -s -b "$COOKIES" -X POST "$BASE_URL/api/lines" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user_'"$(date +%s)"'",
    "password": "test123",
    "maxConnections": 1,
    "enabled": true
  }')
echo "$CREATE_LINE" | jq -e '.id' > /dev/null 2>&1
test_result $? "Create line"

LINE_ID=$(echo "$CREATE_LINE" | jq -r '.id')

# Test 12: Bulk operations
if [ ! -z "$LINE_ID" ] && [ "$LINE_ID" != "null" ]; then
  # Bulk toggle
  curl -s -b "$COOKIES" -X POST "$BASE_URL/api/lines/bulk-toggle" \
    -H "Content-Type: application/json" \
    -d '{"ids": ['"$LINE_ID"'], "enabled": false}' > /dev/null
  test_result $? "Bulk toggle lines"
  
  # Bulk delete
  curl -s -b "$COOKIES" -X POST "$BASE_URL/api/lines/bulk-delete" \
    -H "Content-Type: application/json" \
    -d '{"ids": ['"$LINE_ID"']}' > /dev/null
  test_result $? "Bulk delete lines"
else
  test_result 1 "Bulk toggle lines (skipped - no line created)"
  test_result 1 "Bulk delete lines (skipped - no line created)"
fi

echo ""
echo "Step 5: Testing Categories API"
echo "================================"

# Test 13: Get categories
CATEGORIES=$(curl -s -b "$COOKIES" "$BASE_URL/api/categories")
if [ ! -z "$CATEGORIES" ]; then
  test_result 0 "Categories API endpoint accessible"
else
  test_result 1 "Categories API endpoint accessible"
fi

# Test 14: Create category
CREATE_CAT=$(curl -s -b "$COOKIES" -X POST "$BASE_URL/api/categories" \
  -H "Content-Type: application/json" \
  -d '{"categoryName": "Test Category", "categoryType": "live"}')
echo "$CREATE_CAT" | jq -e '.id' > /dev/null 2>&1
test_result $? "Create category"

CAT_ID=$(echo "$CREATE_CAT" | jq -r '.id')

# Test 15: Delete category
if [ ! -z "$CAT_ID" ] && [ "$CAT_ID" != "null" ]; then
  curl -s -b "$COOKIES" -X DELETE "$BASE_URL/api/categories/$CAT_ID" > /dev/null
  test_result $? "Delete category"
else
  test_result 1 "Delete category (skipped - no category created)"
fi

echo ""
echo "Step 6: Testing Streaming Functionality"
echo "================================"

# Test 16: M3U Playlist generation
M3U_RESPONSE=$(curl -s "$BASE_URL/get.php?username=testuser1&password=test123&type=m3u_plus&output=ts")
echo "$M3U_RESPONSE" | grep -q "#EXTM3U"
test_result $? "M3U playlist generation"

# Test 17: Get stream by line credentials
if echo "$M3U_RESPONSE" | grep -q "http://localhost:5000/live/"; then
  test_result 0 "Stream URL generation in M3U"
else
  test_result 1 "Stream URL generation in M3U"
fi

# Test 18: Player API authentication
PLAYER_AUTH=$(curl -s "$BASE_URL/player_api.php?username=testuser1&password=test123")
echo "$PLAYER_AUTH" | jq -e '.user_info' > /dev/null 2>&1
test_result $? "Player API authentication"

echo ""
echo "Step 7: Testing Import Functionality"
echo "================================"

# Test 19: M3U Import endpoint exists
IMPORT_TEST=$(curl -s -w "%{http_code}" -o /dev/null -b "$COOKIES" -X POST "$BASE_URL/api/streams/import-m3u" \
  -H "Content-Type: application/json" \
  -d '{"content": "#EXTM3U\n#EXTINF:-1,Test\nhttp://test.com/stream.m3u8", "streamType": "live"}')
if [ "$IMPORT_TEST" != "404" ]; then
  test_result 0 "M3U import endpoint exists"
else
  test_result 1 "M3U import endpoint exists"
fi

echo ""
echo "Step 8: Testing Admin Features"
echo "================================"

# Test 20: Get all users
USERS=$(curl -s -b "$COOKIES" "$BASE_URL/api/users")
if [ ! -z "$USERS" ]; then
  test_result 0 "Users API endpoint accessible"
else
  test_result 1 "Users API endpoint accessible"
fi

# Test 21: Activity logs
LOGS=$(curl -s -b "$COOKIES" "$BASE_URL/api/activity-logs")
if [ ! -z "$LOGS" ]; then
  test_result 0 "Activity logs endpoint accessible"
else
  test_result 1 "Activity logs endpoint accessible"
fi

# Test 22: Server stats
SERVERS=$(curl -s -b "$COOKIES" "$BASE_URL/api/servers")
if [ ! -z "$SERVERS" ]; then
  test_result 0 "Servers API endpoint accessible"
else
  test_result 1 "Servers API endpoint accessible"
fi

echo ""
echo "================================"
echo "Test Summary"
echo "================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
TOTAL=$((PASSED + FAILED))
PERCENTAGE=$((PASSED * 100 / TOTAL))
echo "Success Rate: $PERCENTAGE%"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠ Some tests failed. Review above for details.${NC}"
  exit 1
fi
