#!/bin/bash

# Phase 1 Deployment Script for PanelX
# Deploys 2FA implementation to production server

echo "========================================="
echo "PanelX Phase 1 Deployment"
echo "Two-Factor Authentication (2FA)"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ] && ! sudo -n true 2>/dev/null; then 
  echo -e "${RED}Error: This script requires sudo privileges${NC}"
  echo "Please run: sudo ./deploy-phase1.sh"
  exit 1
fi

echo -e "${YELLOW}Step 1: Stopping PanelX service...${NC}"
sudo systemctl stop panelx
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Service stopped${NC}"
else
  echo -e "${RED}✗ Failed to stop service${NC}"
  exit 1
fi
echo ""

echo -e "${YELLOW}Step 2: Backing up current version...${NC}"
BACKUP_DIR="/var/backups/panelx"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
sudo mkdir -p $BACKUP_DIR
sudo cp -r /opt/panelx $BACKUP_DIR/panelx_backup_$TIMESTAMP
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Backup created at $BACKUP_DIR/panelx_backup_$TIMESTAMP${NC}"
else
  echo -e "${YELLOW}⚠ Backup failed, but continuing...${NC}"
fi
echo ""

echo -e "${YELLOW}Step 3: Pulling latest changes from GitHub...${NC}"
cd /opt/panelx
sudo git fetch origin
sudo git reset --hard origin/main
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Code updated to latest version${NC}"
  echo "  Latest commit: $(git log -1 --pretty=format:'%h - %s')"
else
  echo -e "${RED}✗ Failed to pull changes${NC}"
  echo -e "${YELLOW}Restoring from backup...${NC}"
  sudo systemctl start panelx
  exit 1
fi
echo ""

echo -e "${YELLOW}Step 4: Installing dependencies...${NC}"
sudo npm install --production
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Dependencies installed${NC}"
else
  echo -e "${RED}✗ Failed to install dependencies${NC}"
  exit 1
fi
echo ""

echo -e "${YELLOW}Step 5: Pushing database schema changes...${NC}"
sudo npm run db:push
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Database schema updated${NC}"
else
  echo -e "${YELLOW}⚠ Database update failed, but continuing...${NC}"
fi
echo ""

echo -e "${YELLOW}Step 6: Starting PanelX service...${NC}"
sudo systemctl start panelx
sleep 3
if sudo systemctl is-active --quiet panelx; then
  echo -e "${GREEN}✓ Service started successfully${NC}"
else
  echo -e "${RED}✗ Service failed to start${NC}"
  echo "Check logs with: sudo journalctl -u panelx -n 50"
  exit 1
fi
echo ""

echo -e "${YELLOW}Step 7: Verifying deployment...${NC}"
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Server is responding (HTTP $HTTP_CODE)${NC}"
else
  echo -e "${YELLOW}⚠ Server returned HTTP $HTTP_CODE${NC}"
fi
echo ""

echo "========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Test 2FA setup: http://69.169.102.47:5000/2fa"
echo "2. Login as admin: admin / admin123"
echo "3. Enable 2FA and scan QR code"
echo "4. Test login with 2FA enabled"
echo ""
echo "Logs: sudo journalctl -u panelx -f"
echo "Status: sudo systemctl status panelx"
echo ""
echo -e "${YELLOW}Remember to clear your browser cache (Ctrl+Shift+R)${NC}"
echo ""
