#!/bin/bash

#############################################################
# PanelX Complete Installation & Fix Script
# Handles both new installation and updates
#############################################################

set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║     PanelX Installation & Setup v3.1.0           ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

INSTALL_DIR="/opt/panelx"

# Check if /opt/panelx exists
if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${RED}[ERROR]${NC} /opt/panelx directory not found!"
    echo ""
    echo "It looks like PanelX is not installed or was removed."
    echo ""
    echo "Would you like to run a fresh installation? (y/n)"
    read -p "> " response
    
    if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
        echo "Installation cancelled."
        exit 1
    fi
    
    echo ""
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║        Running Fresh Installation                ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""
    
    # Download and run the full installer
    echo -e "${BLUE}[1/2]${NC} Downloading complete installer..."
    cd /root
    wget -q https://raw.githubusercontent.com/ErvinHalilaj/PanelX-V3.0.0-PRO/main/install-production.sh -O install-production.sh
    chmod +x install-production.sh
    
    echo -e "${BLUE}[2/2]${NC} Running installation..."
    echo ""
    ./install-production.sh
    
    exit 0
fi

# If we get here, /opt/panelx exists, proceed with update and build
echo -e "${BLUE}[1/6]${NC} Stopping PanelX service..."
systemctl stop panelx 2>/dev/null || true

echo -e "${BLUE}[2/6]${NC} Navigating to /opt/panelx..."
cd "$INSTALL_DIR"

echo -e "${BLUE}[3/6]${NC} Pulling latest fixes from GitHub..."
git pull origin main || {
    echo -e "${RED}[ERROR]${NC} Git pull failed. Trying to reset..."
    git fetch origin
    git reset --hard origin/main
}

echo -e "${BLUE}[4/6]${NC} Building client (this may take 1-2 minutes)..."
echo -e "${YELLOW}Note: Building React frontend with Vite...${NC}"
npm run build

# Verify build directory exists
if [ ! -d "dist/public" ]; then
    echo -e "${RED}❌ Build failed - dist/public directory not created${NC}"
    echo ""
    echo "Build output:"
    ls -la dist/ 2>/dev/null || echo "dist/ directory doesn't exist"
    exit 1
fi

echo -e "${GREEN}✓ Build completed successfully${NC}"
echo "Build output:"
ls -lh dist/public/ | head -5

echo -e "${BLUE}[5/6]${NC} Starting PanelX service..."
systemctl start panelx

# Wait for service to start
sleep 5

echo -e "${BLUE}[6/6]${NC} Checking service status..."
if systemctl is-active --quiet panelx; then
    echo ""
    echo -e "${GREEN}✅ Service started successfully!${NC}"
    echo ""
    echo "Testing API..."
    sleep 2
    
    if curl -f -s http://localhost:5000/api/stats > /dev/null; then
        echo -e "${GREEN}✅ API responding correctly!${NC}"
        echo ""
        echo "╔═══════════════════════════════════════════════════╗"
        echo "║        🎉 PANELX IS NOW RUNNING! 🎉              ║"
        echo "╚═══════════════════════════════════════════════════╝"
        echo ""
        echo "🌐 Panel URL: http://$(hostname -I | awk '{print $1}'):5000"
        echo "👤 Username: admin"
        echo "🔑 Password: admin123"
        echo ""
        echo "📊 Service Commands:"
        echo "  Status:  systemctl status panelx"
        echo "  Logs:    journalctl -u panelx -f"
        echo "  Restart: systemctl restart panelx"
        echo "  Stop:    systemctl stop panelx"
        echo ""
        echo "🧪 Test API:"
        echo "  curl http://localhost:5000/api/stats"
        echo ""
    else
        echo -e "${YELLOW}⚠️  Service is running but API not responding yet.${NC}"
        echo "Checking logs..."
        journalctl -u panelx -n 20 --no-pager
    fi
else
    echo ""
    echo -e "${RED}❌ Service failed to start.${NC}"
    echo ""
    echo "Checking logs..."
    journalctl -u panelx -n 30 --no-pager
    echo ""
    echo "Troubleshooting:"
    echo "1. Check if port 5000 is in use: lsof -i :5000"
    echo "2. View full logs: journalctl -u panelx -n 50"
    echo "3. Check build directory: ls -la /opt/panelx/dist/public"
    echo "4. Check service file: cat /etc/systemd/system/panelx.service"
    exit 1
fi
