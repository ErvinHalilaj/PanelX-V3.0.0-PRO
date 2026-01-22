#!/bin/bash

# PanelX API Testing Script
# Tests all Player API endpoints with sample data

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║            PanelX IPTV - API Testing Tool                     ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
SERVER="localhost"
PORT="5000"
USERNAME="testuser1"
PASSWORD="test123"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --server)
            SERVER="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --username)
            USERNAME="$2"
            shift 2
            ;;
        --password)
            PASSWORD="$2"
            shift 2
            ;;
        --help)
            echo "Usage: ./test-api.sh [options]"
            echo ""
            echo "Options:"
            echo "  --server <ip>      Server IP or hostname (default: localhost)"
            echo "  --port <port>      Server port (default: 5000)"
            echo "  --username <user>  Line username (default: testuser1)"
            echo "  --password <pass>  Line password (default: test123)"
            echo ""
            echo "Example:"
            echo "  ./test-api.sh --server 192.168.1.100 --port 5000 --username myuser --password mypass"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

BASE_URL="http://$SERVER:$PORT"

echo -e "${BLUE}Testing Configuration:${NC}"
echo -e "  Server:   $SERVER"
echo -e "  Port:     $PORT"
echo -e "  Username: $USERNAME"
echo -e "  Password: $PASSWORD"
echo -e "  Base URL: $BASE_URL"
echo ""

# Test function
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected="$3"
    
    echo -n "Testing $name... "
    
    response=$(curl -s --connect-timeout 10 --max-time 30 "$url" 2>/dev/null)
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 "$url" 2>/dev/null)
    
    if [ -z "$response" ]; then
        echo -e "${RED}FAIL${NC} (No response)"
        return 1
    fi
    
    if [ "$http_code" != "200" ]; then
        echo -e "${RED}FAIL${NC} (HTTP $http_code)"
        return 1
    fi
    
    if [ -n "$expected" ]; then
        if echo "$response" | grep -q "$expected"; then
            echo -e "${GREEN}PASS${NC}"
            return 0
        else
            echo -e "${YELLOW}WARN${NC} (Unexpected response)"
            return 1
        fi
    else
        echo -e "${GREEN}PASS${NC} (HTTP 200)"
        return 0
    fi
}

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Starting API Tests...${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: Root endpoint
echo -e "${YELLOW}[1] Web Interface${NC}"
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$BASE_URL/" | grep -q "200\|302"; then
    echo -e "${GREEN}✓ Root endpoint accessible${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ Root endpoint failed${NC}"
    ((FAIL_COUNT++))
fi
echo ""

# Test 2: Player API - Authentication
echo -e "${YELLOW}[2] Player API - Authentication${NC}"
AUTH_URL="$BASE_URL/player_api.php?username=$USERNAME&password=$PASSWORD"
AUTH_RESPONSE=$(curl -s --connect-timeout 10 "$AUTH_URL" 2>/dev/null)

if [ -n "$AUTH_RESPONSE" ]; then
    if echo "$AUTH_RESPONSE" | grep -q "user_info"; then
        echo -e "${GREEN}✓ Player API responding${NC}"
        ((PASS_COUNT++))
        
        if echo "$AUTH_RESPONSE" | grep -q '"auth":\s*1' || echo "$AUTH_RESPONSE" | grep -q '"status":\s*"Active"'; then
            echo -e "${GREEN}✓ Authentication successful${NC}"
            ((PASS_COUNT++))
            echo -e "  User authenticated and active"
        elif echo "$AUTH_RESPONSE" | grep -q '"auth":\s*0'; then
            echo -e "${RED}✗ Authentication failed (auth: 0)${NC}"
            echo -e "  Check if user '$USERNAME' exists and is enabled"
            ((FAIL_COUNT++))
        else
            echo -e "${YELLOW}⚠ Unexpected auth response${NC}"
            ((FAIL_COUNT++))
        fi
    else
        echo -e "${RED}✗ Player API returned unexpected format${NC}"
        ((FAIL_COUNT++))
    fi
else
    echo -e "${RED}✗ No response from Player API${NC}"
    ((FAIL_COUNT++))
fi
echo ""

# Test 3: Categories
echo -e "${YELLOW}[3] Content Categories${NC}"

test_endpoint "Live Categories" "$BASE_URL/player_api.php?username=$USERNAME&password=$PASSWORD&action=get_live_categories" "category_id"
[ $? -eq 0 ] && ((PASS_COUNT++)) || ((FAIL_COUNT++))

test_endpoint "VOD Categories" "$BASE_URL/player_api.php?username=$USERNAME&password=$PASSWORD&action=get_vod_categories" "category_id"
[ $? -eq 0 ] && ((PASS_COUNT++)) || ((FAIL_COUNT++))

test_endpoint "Series Categories" "$BASE_URL/player_api.php?username=$USERNAME&password=$PASSWORD&action=get_series_categories" "category_id"
[ $? -eq 0 ] && ((PASS_COUNT++)) || ((FAIL_COUNT++))

echo ""

# Test 4: Stream Lists
echo -e "${YELLOW}[4] Stream Lists${NC}"

test_endpoint "Live Streams" "$BASE_URL/player_api.php?username=$USERNAME&password=$PASSWORD&action=get_live_streams"
[ $? -eq 0 ] && ((PASS_COUNT++)) || ((FAIL_COUNT++))

test_endpoint "VOD Streams" "$BASE_URL/player_api.php?username=$USERNAME&password=$PASSWORD&action=get_vod_streams"
[ $? -eq 0 ] && ((PASS_COUNT++)) || ((FAIL_COUNT++))

test_endpoint "Series List" "$BASE_URL/player_api.php?username=$USERNAME&password=$PASSWORD&action=get_series"
[ $? -eq 0 ] && ((PASS_COUNT++)) || ((FAIL_COUNT++))

echo ""

# Test 5: M3U Playlist
echo -e "${YELLOW}[5] M3U Playlist Generation${NC}"
M3U_URL="$BASE_URL/get.php?username=$USERNAME&password=$PASSWORD&type=m3u_plus&output=ts"
M3U_RESPONSE=$(curl -s --connect-timeout 10 "$M3U_URL" 2>/dev/null)

if [ -n "$M3U_RESPONSE" ]; then
    if echo "$M3U_RESPONSE" | grep -q "#EXTM3U"; then
        echo -e "${GREEN}✓ M3U playlist generated${NC}"
        STREAM_COUNT=$(echo "$M3U_RESPONSE" | grep -c "^#EXTINF")
        echo -e "  Found $STREAM_COUNT streams"
        ((PASS_COUNT++))
    else
        echo -e "${RED}✗ Invalid M3U format${NC}"
        ((FAIL_COUNT++))
    fi
else
    echo -e "${RED}✗ M3U generation failed${NC}"
    ((FAIL_COUNT++))
fi
echo ""

# Test 6: XMLTV EPG
echo -e "${YELLOW}[6] XMLTV EPG${NC}"
EPG_URL="$BASE_URL/xmltv.php?username=$USERNAME&password=$PASSWORD"
EPG_RESPONSE=$(curl -s --connect-timeout 10 "$EPG_URL" 2>/dev/null)

if [ -n "$EPG_RESPONSE" ]; then
    if echo "$EPG_RESPONSE" | grep -q "<?xml"; then
        echo -e "${GREEN}✓ XMLTV EPG generated${NC}"
        CHANNEL_COUNT=$(echo "$EPG_RESPONSE" | grep -c "<channel")
        PROGRAM_COUNT=$(echo "$EPG_RESPONSE" | grep -c "<programme")
        echo -e "  Channels: $CHANNEL_COUNT"
        echo -e "  Programs: $PROGRAM_COUNT"
        ((PASS_COUNT++))
    else
        echo -e "${RED}✗ Invalid XMLTV format${NC}"
        ((FAIL_COUNT++))
    fi
else
    echo -e "${RED}✗ XMLTV generation failed${NC}"
    ((FAIL_COUNT++))
fi
echo ""

# Test 7: Stalker Portal
echo -e "${YELLOW}[7] Stalker Portal (MAG)${NC}"
PORTAL_URL="$BASE_URL/portal.php?type=stb&action=handshake"
PORTAL_RESPONSE=$(curl -s --connect-timeout 10 "$PORTAL_URL" 2>/dev/null)

if [ -n "$PORTAL_RESPONSE" ]; then
    if echo "$PORTAL_RESPONSE" | grep -q "js"; then
        echo -e "${GREEN}✓ Stalker Portal responding${NC}"
        ((PASS_COUNT++))
    else
        echo -e "${YELLOW}⚠ Stalker Portal unusual response${NC}"
        ((FAIL_COUNT++))
    fi
else
    echo -e "${RED}✗ Stalker Portal not responding${NC}"
    ((FAIL_COUNT++))
fi
echo ""

# Test 8: Enigma2 API
echo -e "${YELLOW}[8] Enigma2 Device Support${NC}"
E2_URL="$BASE_URL/get.php?username=$USERNAME&password=$PASSWORD&type=enigma2"
E2_RESPONSE=$(curl -s --connect-timeout 10 "$E2_URL" 2>/dev/null)

if [ -n "$E2_RESPONSE" ]; then
    if echo "$E2_RESPONSE" | grep -q "#SERVICE\|#NAME"; then
        echo -e "${GREEN}✓ Enigma2 bouquet generated${NC}"
        ((PASS_COUNT++))
    else
        echo -e "${YELLOW}⚠ Enigma2 unusual format${NC}"
        ((FAIL_COUNT++))
    fi
else
    echo -e "${RED}✗ Enigma2 generation failed${NC}"
    ((FAIL_COUNT++))
fi
echo ""

# Summary
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                       TEST SUMMARY                            ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo ""

TOTAL_TESTS=$((PASS_COUNT + FAIL_COUNT))
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((PASS_COUNT * 100 / TOTAL_TESTS))
    echo -e "Success Rate: $SUCCESS_RATE%"
fi
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Panel is working correctly.${NC}"
    echo ""
    echo -e "${CYAN}Connection URLs:${NC}"
    echo -e "  Xtream Codes API:"
    echo -e "    Server: http://$SERVER:$PORT"
    echo -e "    Username: $USERNAME"
    echo -e "    Password: $PASSWORD"
    echo ""
    echo -e "  M3U Playlist:"
    echo -e "    $M3U_URL"
    echo ""
    echo -e "  EPG URL:"
    echo -e "    $EPG_URL"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠ Some tests failed. Check the output above for details.${NC}"
    echo ""
    echo -e "${BLUE}Common Issues:${NC}"
    echo -e "  1. User doesn't exist: Create lines using admin panel or manage-admin.sh"
    echo -e "  2. Database empty: Run 'npm run db:push' to create tables"
    echo -e "  3. Service not running: Check 'sudo systemctl status panelx'"
    echo ""
    exit 1
fi
