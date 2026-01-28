#!/bin/bash

##############################################
# PanelX Update Script
# Pulls latest changes and restarts services
##############################################

set -e

echo "=================================="
echo "PanelX Update Script"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Change to project directory
cd /home/panelx/webapp

echo -e "${BLUE}[1/7]${NC} Pulling latest changes from GitHub..."
sudo -u panelx git fetch origin
sudo -u panelx git reset --hard origin/main
echo -e "${GREEN}✓${NC} Code updated"
echo ""

echo -e "${BLUE}[2/7]${NC} Installing dependencies..."
sudo -u panelx npm install
echo -e "${GREEN}✓${NC} Dependencies installed"
echo ""

echo -e "${BLUE}[3/7]${NC} Building frontend..."
sudo -u panelx npm run build
echo -e "${GREEN}✓${NC} Frontend built"
echo ""

echo -e "${BLUE}[4/7]${NC} Stopping PM2 process..."
sudo -u panelx pm2 delete panelx 2>/dev/null || true
sleep 2
echo -e "${GREEN}✓${NC} PM2 stopped"
echo ""

echo -e "${BLUE}[5/7]${NC} Starting PM2 with updated code..."
sudo -u panelx pm2 start /home/panelx/webapp/ecosystem.config.cjs
sleep 5
echo -e "${GREEN}✓${NC} PM2 started"
echo ""

echo -e "${BLUE}[6/7]${NC} Checking service status..."
sudo -u panelx pm2 list
echo ""

echo -e "${BLUE}[7/7]${NC} Testing API endpoint..."
sleep 3
curl -s http://localhost:5000/api/stats | jq . || echo "Waiting for service to start..."
echo ""

echo "=================================="
echo -e "${GREEN}✓${NC} Update Complete!"
echo "=================================="
echo ""
echo "Service Status:"
sudo -u panelx pm2 list
echo ""
echo "Recent Logs:"
sudo -u panelx pm2 logs panelx --lines 20 --nostream
echo ""
echo "Panel URL: http://$(curl -s ifconfig.me)"
echo "Login: admin / admin123"
echo ""
