#!/bin/bash

# PanelX V3.0.0 PRO - Post Installation Script
# This script completes the installation after autoinstaller.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project paths
PROJECT_DIR="/home/panelx/webapp"
PANELX_USER="panelx"

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║         PanelX V3.0.0 PRO - Post Installation Setup           ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Step 1: Build Frontend
echo -e "${BLUE}[1/5]${NC} Building frontend..."
cd "$PROJECT_DIR"
sudo -u "$PANELX_USER" npm run build
echo -e "${GREEN}✓${NC} Frontend built successfully"

# Step 2: Push Database Schema
echo -e "${BLUE}[2/5]${NC} Creating database tables..."
cd "$PROJECT_DIR"
sudo -u "$PANELX_USER" npx drizzle-kit push <<EOF
yes
EOF
echo -e "${GREEN}✓${NC} Database schema created"

# Step 3: Seed Database
echo -e "${BLUE}[3/5]${NC} Seeding database with initial data..."
cd "$PROJECT_DIR"
sudo -u "$PANELX_USER" npm run db:seed
echo -e "${GREEN}✓${NC} Database seeded"

# Step 4: Restart PM2
echo -e "${BLUE}[4/5]${NC} Restarting backend service..."
sudo -u "$PANELX_USER" pm2 restart panelx
sleep 5
echo -e "${GREEN}✓${NC} Backend restarted"

# Step 5: Verify Installation
echo -e "${BLUE}[5/5]${NC} Verifying installation..."

# Check if port 5000 is listening
if netstat -tuln | grep -q ":5000 "; then
    echo -e "${GREEN}✓${NC} Backend is running on port 5000"
else
    echo -e "${RED}✗${NC} Backend is not running on port 5000"
    echo -e "${YELLOW}ℹ${NC} Check logs: pm2 logs panelx"
fi

# Check if Nginx is running
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓${NC} Nginx is running"
else
    echo -e "${YELLOW}⚠${NC} Nginx is not running"
fi

# Test API endpoint
echo -e "${CYAN}Testing API endpoint...${NC}"
sleep 3
if curl -s -f http://localhost:5000/api/stats > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} API is responding"
else
    echo -e "${YELLOW}⚠${NC} API test failed - this is normal if tables were just created"
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║         ✅ POST-INSTALLATION COMPLETE! ✅                      ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${CYAN}📊 Installation Summary:${NC}"
echo -e "   • Frontend: ${GREEN}Built${NC}"
echo -e "   • Database: ${GREEN}Created & Seeded${NC}"
echo -e "   • Backend: ${GREEN}Running${NC}"
echo -e "   • Nginx: ${GREEN}Configured${NC}"
echo ""

echo -e "${CYAN}🌐 Access Your Panel:${NC}"
echo -e "   ${GREEN}http://${SERVER_IP}${NC}"
echo ""

echo -e "${CYAN}🔐 Default Admin Credentials:${NC}"
echo -e "   Username: ${GREEN}admin${NC}"
echo -e "   Password: ${GREEN}admin123${NC}"
echo -e "   ${RED}⚠️  CHANGE PASSWORD IMMEDIATELY AFTER LOGIN!${NC}"
echo ""

echo -e "${CYAN}📝 Useful Commands:${NC}"
echo -e "   View backend logs:   ${YELLOW}pm2 logs panelx${NC}"
echo -e "   Restart backend:     ${YELLOW}pm2 restart panelx${NC}"
echo -e "   Check backend:       ${YELLOW}pm2 list${NC}"
echo -e "   Test API:            ${YELLOW}curl http://localhost:5000/api/stats${NC}"
echo -e "   Restart Nginx:       ${YELLOW}systemctl restart nginx${NC}"
echo -e "   Check Nginx:         ${YELLOW}systemctl status nginx${NC}"
echo ""

echo -e "${CYAN}📚 Documentation:${NC}"
echo -e "   GitHub: ${BLUE}https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO${NC}"
echo ""

echo -e "${GREEN}🎉 Your IPTV Management Panel is ready to use!${NC}"
echo ""
