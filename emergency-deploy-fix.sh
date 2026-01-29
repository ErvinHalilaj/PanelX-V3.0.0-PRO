#!/bin/bash

# PanelX V3.0.0 PRO - Emergency Deployment Fix Script
# Fixes: Node.js version, missing dependencies, permissions, and deploys fixes

set -e  # Exit on error

echo "=================================================="
echo "PanelX V3.0.0 PRO - Emergency Deployment Fix"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as panelx user
if [ "$USER" != "panelx" ]; then
    echo -e "${RED}❌ Error: This script must be run as 'panelx' user${NC}"
    echo "Run: sudo -u panelx bash emergency-deploy-fix.sh"
    exit 1
fi

# Navigate to project directory
cd /home/panelx/webapp || {
    echo -e "${RED}❌ Error: Cannot access /home/panelx/webapp${NC}"
    exit 1
}

echo -e "${YELLOW}Step 1: Fixing Git permissions...${NC}"
# This will be needed: sudo chown -R panelx:panelx /home/panelx/webapp/.git
# But we'll print the instruction for the admin to run
echo -e "${YELLOW}⚠️  Admin action required:${NC}"
echo "Run this command as root or with sudo:"
echo "  sudo chown -R panelx:panelx /home/panelx/webapp/.git"
echo ""
read -p "Press Enter after you've run the above command..."

echo -e "${YELLOW}Step 2: Checking Node.js version...${NC}"
NODE_VERSION=$(node -v | cut -d'v' -f2)
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)

echo "Current Node.js version: v$NODE_VERSION"

if [ "$MAJOR_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Node.js v$NODE_VERSION is too old (need v20+)${NC}"
    echo ""
    echo -e "${YELLOW}Installing Node.js v20 LTS...${NC}"
    echo "⚠️  Admin action required:"
    echo "Run these commands as root or with sudo:"
    echo ""
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -"
    echo "  sudo apt-get install -y nodejs"
    echo ""
    read -p "Press Enter after you've installed Node.js v20..."
    
    # Verify installation
    NEW_NODE_VERSION=$(node -v)
    echo "New Node.js version: $NEW_NODE_VERSION"
    
    NEW_MAJOR=$(echo $NEW_NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NEW_MAJOR" -lt 20 ]; then
        echo -e "${RED}❌ Node.js upgrade failed${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Node.js version is compatible${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Pulling latest code from GitHub...${NC}"
git fetch origin main
git reset --hard origin/main
echo -e "${GREEN}✅ Code updated${NC}"

echo ""
echo -e "${YELLOW}Step 4: Installing missing dependencies...${NC}"
# Clean install to fix any package issues
rm -rf node_modules package-lock.json
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

echo ""
echo -e "${YELLOW}Step 5: Installing missing @radix-ui packages...${NC}"
npm install @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-checkbox
echo -e "${GREEN}✅ Radix UI packages installed${NC}"

echo ""
echo -e "${YELLOW}Step 6: Building frontend...${NC}"
npm run build
echo -e "${GREEN}✅ Frontend built successfully${NC}"

echo ""
echo -e "${YELLOW}Step 7: Restarting backend with PM2...${NC}"
pm2 delete panelx 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
echo -e "${GREEN}✅ Backend restarted${NC}"

echo ""
echo -e "${YELLOW}Step 8: Verifying deployment...${NC}"
sleep 3

# Check if backend is responding
if curl -s http://localhost:5000/api/auth/check > /dev/null; then
    echo -e "${GREEN}✅ Backend is responding${NC}"
else
    echo -e "${RED}❌ Backend is not responding${NC}"
    echo "Check logs with: pm2 logs panelx"
fi

# Check PM2 status
pm2 list

echo ""
echo "=================================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Open browser: http://69.169.102.47"
echo "2. Login: admin / admin123"
echo "3. Test line editing (Lines page)"
echo "4. Test bouquet stream selection (Bouquets page)"
echo "5. Test VLC: http://69.169.102.47/live/testuser1/test123/5.ts"
echo ""
echo "If you see any issues:"
echo "  - Check backend logs: pm2 logs panelx"
echo "  - Check process status: pm2 list"
echo "  - Restart if needed: pm2 restart panelx"
echo ""
