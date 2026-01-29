#!/bin/bash

################################################################################
# PanelX V3.0.0 PRO - Real-Time Stats Debugging Script
# Checks WebSocket, StreamProxy, and real-time connection tracking
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=================================================="
echo "PanelX V3.0.0 PRO - Real-Time Stats Debug"
echo "=================================================="
echo ""

# Check if running as root or panelx
if [ "$USER" != "root" ] && [ "$USER" != "panelx" ]; then
    echo -e "${YELLOW}⚠️  Run as root or panelx user${NC}"
fi

echo -e "${BLUE}[1/8] Checking PM2 backend status...${NC}"
if pm2 list | grep -q "panelx.*online"; then
    echo -e "${GREEN}✅ Backend is online${NC}"
    pm2 list | grep panelx
else
    echo -e "${RED}❌ Backend is NOT online${NC}"
    echo "Fix: sudo -u panelx pm2 start ecosystem.config.cjs"
    exit 1
fi

echo ""
echo -e "${BLUE}[2/8] Checking backend port 5000...${NC}"
if netstat -tuln 2>/dev/null | grep -q ":5000"; then
    echo -e "${GREEN}✅ Port 5000 is listening${NC}"
else
    echo -e "${RED}❌ Port 5000 is NOT listening${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}[3/8] Testing API endpoint...${NC}"
API_RESPONSE=$(curl -s http://localhost:5000/api/stats)
if echo "$API_RESPONSE" | grep -q "totalStreams"; then
    echo -e "${GREEN}✅ API is responding${NC}"
    echo "$API_RESPONSE" | head -c 200
else
    echo -e "${RED}❌ API is NOT responding${NC}"
    echo "Response: $API_RESPONSE"
    exit 1
fi

echo ""
echo ""
echo -e "${BLUE}[4/8] Testing WebSocket endpoint...${NC}"
# Test if WebSocket path is accessible
WS_TEST=$(curl -s -w "%{http_code}" http://localhost:5000/socket.io/ -o /dev/null)
if [ "$WS_TEST" = "200" ] || [ "$WS_TEST" = "400" ]; then
    echo -e "${GREEN}✅ WebSocket endpoint is accessible (HTTP $WS_TEST)${NC}"
else
    echo -e "${YELLOW}⚠️  WebSocket endpoint returned HTTP $WS_TEST${NC}"
fi

echo ""
echo -e "${BLUE}[5/8] Checking active stream connections...${NC}"
CONNECTIONS=$(curl -s http://localhost:5000/api/connections)
if echo "$CONNECTIONS" | grep -q "id"; then
    echo -e "${GREEN}✅ Connections API is working${NC}"
    echo "Active connections:"
    echo "$CONNECTIONS" | head -c 300
else
    echo -e "${YELLOW}⚠️  No active connections or API error${NC}"
    echo "Response: $CONNECTIONS"
fi

echo ""
echo ""
echo -e "${BLUE}[6/8] Testing stream proxy stats...${NC}"
PROXY_STATS=$(curl -s http://localhost:5000/api/bandwidth/stats 2>/dev/null || echo "{}")
if echo "$PROXY_STATS" | grep -q "activeConnections\|totalBandwidth"; then
    echo -e "${GREEN}✅ StreamProxy stats are available${NC}"
    echo "$PROXY_STATS" | head -c 300
else
    echo -e "${YELLOW}⚠️  StreamProxy stats not available${NC}"
    echo "Response: $PROXY_STATS"
fi

echo ""
echo ""
echo -e "${BLUE}[7/8] Checking backend logs for WebSocket activity...${NC}"
echo "Last 10 lines with WebSocket or Connection mentions:"
pm2 logs panelx --nostream --lines 50 | grep -i -E "websocket|connection|stream" | tail -10 || echo "No recent WebSocket/connection logs"

echo ""
echo ""
echo -e "${BLUE}[8/8] Testing live stream URL...${NC}"
echo "Testing: http://69.169.102.47/live/testuser1/test123/5.ts"
STREAM_TEST=$(curl -s -w "%{http_code}" -o /dev/null --max-time 5 http://localhost:5000/live/testuser1/test123/5.ts)
if [ "$STREAM_TEST" = "200" ]; then
    echo -e "${GREEN}✅ Stream URL is accessible (HTTP 200)${NC}"
elif [ "$STREAM_TEST" = "401" ]; then
    echo -e "${YELLOW}⚠️  Stream URL returned 401 (invalid credentials)${NC}"
elif [ "$STREAM_TEST" = "404" ]; then
    echo -e "${YELLOW}⚠️  Stream URL returned 404 (stream not found)${NC}"
else
    echo -e "${YELLOW}⚠️  Stream URL returned HTTP $STREAM_TEST${NC}"
fi

echo ""
echo "=================================================="
echo "Diagnostic Summary"
echo "=================================================="
echo ""

echo -e "${YELLOW}Expected Behavior:${NC}"
echo "1. When you open: http://69.169.102.47/live/testuser1/test123/5.ts"
echo "2. Backend should create a connection in StreamProxy"
echo "3. WebSocket should broadcast the new connection count"
echo "4. Dashboard should update in real-time (2-second intervals)"
echo ""

echo -e "${YELLOW}If dashboard is NOT updating:${NC}"
echo ""
echo "A) Check browser console (F12) for WebSocket errors:"
echo "   - Should see: 'WebSocket connected'"
echo "   - Should see: '[WebSocket] Dashboard update: X connections'"
echo ""
echo "B) Check if stream is actually playing in VLC:"
echo "   - Open VLC: Media → Open Network Stream"
echo "   - URL: http://69.169.102.47/live/testuser1/test123/5.ts"
echo "   - If it plays, connection should show in dashboard"
echo ""
echo "C) Verify line credentials and stream ID:"
echo "   curl http://localhost:5000/api/lines | grep testuser1"
echo "   curl http://localhost:5000/api/streams | grep '\"id\":5'"
echo ""
echo "D) Check PM2 logs in real-time:"
echo "   pm2 logs panelx"
echo "   (Look for '[StreamProxy] New connection' messages)"
echo ""

echo -e "${GREEN}Commands to monitor:${NC}"
echo "  pm2 logs panelx                    - Live backend logs"
echo "  curl http://localhost:5000/api/connections  - Check active connections"
echo "  curl http://localhost:5000/api/bandwidth/stats  - Check bandwidth stats"
echo ""

echo "=================================================="
echo "Debugging complete!"
echo "=================================================="
