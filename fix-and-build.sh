#!/bin/bash

#############################################################
# PanelX Complete Fix - Build and Start Service
# Run this on your server to build and start PanelX
#############################################################

set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║  PanelX Complete Fix - Build & Start Service     ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Stop service
echo -e "${BLUE}[1/6]${NC} Stopping PanelX service..."
systemctl stop panelx 2>/dev/null || true

# Navigate to installation directory
echo -e "${BLUE}[2/6]${NC} Navigating to /opt/panelx..."
cd /opt/panelx

# Pull latest fixes (already done, but just in case)
echo -e "${BLUE}[3/6]${NC} Ensuring latest code..."
git pull origin main || true

# Build the client
echo -e "${BLUE}[4/6]${NC} Building client (this may take 1-2 minutes)..."
echo -e "${YELLOW}Note: Building React frontend with Vite...${NC}"
npm run build

# Verify build directory exists
if [ ! -d "public" ]; then
    echo "❌ Build failed - public directory not created"
    exit 1
fi

echo -e "${GREEN}✓ Build completed successfully${NC}"

# Restart service
echo -e "${BLUE}[5/6]${NC} Starting PanelX service..."
systemctl start panelx

# Wait for service to start
sleep 5

# Check service status
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
        echo "📊 Service Status:"
        echo "  systemctl status panelx"
        echo ""
        echo "📝 View Logs:"
        echo "  journalctl -u panelx -f"
        echo ""
        echo "🔄 Restart Service:"
        echo "  systemctl restart panelx"
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
    echo "❌ Service failed to start. Checking logs..."
    journalctl -u panelx -n 30 --no-pager
    echo ""
    echo "Troubleshooting:"
    echo "1. Check if port 5000 is in use: lsof -i :5000"
    echo "2. View full logs: journalctl -u panelx -n 50"
    echo "3. Check build directory: ls -la /opt/panelx/public"
    exit 1
fi
