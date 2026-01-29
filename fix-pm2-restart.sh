#!/bin/bash

################################################################################
# PanelX V3.0.0 PRO - Quick PM2 Restart Fix
# Fixes: PM2 "Process not found" error after build
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=================================================="
echo "PanelX V3.0.0 PRO - PM2 Restart Fix"
echo "=================================================="
echo ""

# Check if running as panelx user
if [ "$USER" != "panelx" ]; then
    echo -e "${RED}❌ Error: Run as panelx user${NC}"
    echo "Command: sudo -u panelx bash fix-pm2-restart.sh"
    exit 1
fi

cd /home/panelx/webapp

echo -e "${YELLOW}Step 1: Cleaning up port 5000...${NC}"
fuser -k 5000/tcp 2>/dev/null || true
sleep 2

echo -e "${YELLOW}Step 2: Removing all PM2 processes...${NC}"
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true
sleep 2

echo -e "${YELLOW}Step 3: Starting fresh PM2 process...${NC}"
pm2 start ecosystem.config.cjs

echo ""
echo -e "${YELLOW}Step 4: Saving PM2 process list...${NC}"
pm2 save

echo ""
echo -e "${YELLOW}Step 5: Checking status...${NC}"
pm2 list

echo ""
echo -e "${YELLOW}Step 6: Testing backend...${NC}"
sleep 3
curl -s http://localhost:5000/api/auth/check > /dev/null && echo -e "${GREEN}✅ Backend is responding${NC}" || echo -e "${RED}❌ Backend is not responding${NC}"

echo ""
echo "=================================================="
echo -e "${GREEN}✅ PM2 Restart Complete!${NC}"
echo "=================================================="
echo ""
echo "Commands to monitor:"
echo "  pm2 list              - Show process status"
echo "  pm2 logs panelx       - Show logs"
echo "  pm2 restart panelx    - Restart process"
echo ""
echo "Access your panel: http://69.169.102.47"
echo "Login: admin / admin123"
echo ""
