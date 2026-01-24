#!/bin/bash

#############################################################
# PanelX Quick Fix - __dirname Error Fix
# Run this on your server to fix the service startup issue
#############################################################

set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║  PanelX Quick Fix - Service Startup Error        ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Stop service
echo -e "${BLUE}[1/5]${NC} Stopping PanelX service..."
systemctl stop panelx 2>/dev/null || true

# Navigate to installation directory
echo -e "${BLUE}[2/5]${NC} Navigating to /opt/panelx..."
cd /opt/panelx

# Pull latest fixes
echo -e "${BLUE}[3/5]${NC} Pulling latest fixes from GitHub..."
git pull origin main

# Restart service
echo -e "${BLUE}[4/5]${NC} Starting PanelX service..."
systemctl start panelx

# Wait for service to start
sleep 3

# Check service status
echo -e "${BLUE}[5/5]${NC} Checking service status..."
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
        echo "║             🎉 FIX APPLIED SUCCESSFULLY! 🎉      ║"
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
    else
        echo "⚠️  Service is running but API not responding yet. Check logs:"
        echo "  journalctl -u panelx -n 20"
    fi
else
    echo ""
    echo "❌ Service failed to start. Checking logs..."
    journalctl -u panelx -n 20 --no-pager
    exit 1
fi
