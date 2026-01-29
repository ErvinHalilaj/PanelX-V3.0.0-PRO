#!/bin/bash

################################################################################
# PanelX V3.0.0 PRO - Quick Update & Test Script
# Pulls latest code and tests real-time stats
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=================================================="
echo "PanelX - Quick Update & Test"
echo "=================================================="
echo ""

if [ "$USER" != "panelx" ]; then
    echo -e "${RED}❌ Run as panelx user${NC}"
    echo "Command: sudo -u panelx bash $0"
    exit 1
fi

cd /home/panelx/webapp

echo -e "${YELLOW}Step 1: Pulling latest code...${NC}"
git pull origin main
echo -e "${GREEN}✅ Code updated${NC}"

echo ""
echo -e "${YELLOW}Step 2: Testing backend...${NC}"
sleep 2
if curl -s http://localhost:5000/api/auth/check > /dev/null; then
    echo -e "${GREEN}✅ Backend is responding${NC}"
else
    echo -e "${RED}❌ Backend not responding${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Testing WebSocket...${NC}"
WS_CODE=$(curl -s -w "%{http_code}" http://localhost:5000/socket.io/ -o /dev/null)
echo "WebSocket endpoint: HTTP $WS_CODE"
if [ "$WS_CODE" = "200" ] || [ "$WS_CODE" = "400" ]; then
    echo -e "${GREEN}✅ WebSocket is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  WebSocket might have issues${NC}"
fi

echo ""
echo -e "${YELLOW}Step 4: Checking active connections...${NC}"
CONN_COUNT=$(curl -s http://localhost:5000/api/bandwidth/stats | grep -o '"activeConnections":[0-9]*' | grep -o '[0-9]*' || echo "0")
echo "Active connections: $CONN_COUNT"

echo ""
echo -e "${YELLOW}Step 5: Checking PM2 status...${NC}"
pm2 list

echo ""
echo "=================================================="
echo -e "${GREEN}✅ Update Complete!${NC}"
echo "=================================================="
echo ""
echo "Now test real-time stats:"
echo ""
echo "1. Open VLC: Media → Open Network Stream"
echo "2. URL: http://69.169.102.47/live/testuser1/test123/5.ts"
echo "3. Click Play"
echo ""
echo "4. Open dashboard: http://69.169.102.47"
echo "5. Open browser console (F12)"
echo "6. Look for: 'WebSocket connected'"
echo "7. Dashboard should show active connection count"
echo ""
echo "Monitor backend logs:"
echo "  pm2 logs panelx"
echo ""
