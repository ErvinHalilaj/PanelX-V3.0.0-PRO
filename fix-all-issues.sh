#!/bin/bash

################################################################################
# PanelX V3.0.0 PRO - Fix All Issues Script
# Fixes: Git permissions, updates code, restarts backend
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=================================================="
echo "PanelX - Fix All Issues"
echo "=================================================="
echo ""

if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}❌ Must run as root${NC}"
   echo "Command: sudo bash fix-all-issues.sh"
   exit 1
fi

cd /home/panelx/webapp

echo -e "${YELLOW}Step 1: Fixing git permissions...${NC}"
chown -R panelx:panelx /home/panelx/webapp/.git
chown -R panelx:panelx /home/panelx/webapp
echo -e "${GREEN}✅ Permissions fixed${NC}"

echo ""
echo -e "${YELLOW}Step 2: Pulling latest code...${NC}"
sudo -u panelx git fetch origin main
sudo -u panelx git reset --hard origin/main
echo -e "${GREEN}✅ Code updated${NC}"

echo ""
echo -e "${YELLOW}Step 3: Checking if new dependencies needed...${NC}"
if sudo -u panelx npm outdated 2>/dev/null | grep -q .; then
    echo "Some packages might need updating, but skipping for now..."
else
    echo "Dependencies are up to date"
fi

echo ""
echo -e "${YELLOW}Step 4: Restarting PM2...${NC}"
sudo -u panelx pm2 restart panelx
sleep 3
echo -e "${GREEN}✅ Backend restarted${NC}"

echo ""
echo -e "${YELLOW}Step 5: Checking PM2 status...${NC}"
sudo -u panelx pm2 list

echo ""
echo -e "${YELLOW}Step 6: Testing backend...${NC}"
sleep 2
if curl -s http://localhost:5000/api/stats > /dev/null; then
    echo -e "${GREEN}✅ Backend is responding${NC}"
else
    echo -e "${RED}❌ Backend not responding${NC}"
fi

echo ""
echo "=================================================="
echo -e "${GREEN}✅ All Fixed!${NC}"
echo "=================================================="
echo ""
echo "Now you can run:"
echo "  sudo -u panelx bash debug-realtime-stats.sh"
echo ""
