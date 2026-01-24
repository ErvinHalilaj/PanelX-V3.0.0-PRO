#!/bin/bash

# 🔄 PanelX Server Update Script
# This script updates your server with the latest changes

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 PanelX Server Update Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if running on server
if [ ! -d "/opt/panelx" ]; then
    echo -e "${RED}❌ Error: /opt/panelx not found${NC}"
    echo ""
    echo "This script should be run on your server where PanelX is installed."
    echo "If PanelX is in a different directory, edit this script and change the path."
    exit 1
fi

# Step 2: Navigate to project
echo -e "${YELLOW}📂 Navigating to project directory...${NC}"
cd /opt/panelx
echo -e "${GREEN}✅ In $(pwd)${NC}"
echo ""

# Step 3: Backup database (optional but recommended)
echo -e "${YELLOW}💾 Creating database backup...${NC}"
pg_dump -U panelx panelx > /tmp/panelx_backup_$(date +%Y%m%d_%H%M%S).sql 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Database backup skipped (might not have permissions)${NC}"
}
echo ""

# Step 4: Stop service
echo -e "${YELLOW}🛑 Stopping PanelX service...${NC}"

# Try systemd first
if systemctl is-active --quiet panelx 2>/dev/null; then
    sudo systemctl stop panelx
    echo -e "${GREEN}✅ Stopped systemd service${NC}"
# Try PM2
elif pm2 describe panelx &>/dev/null; then
    pm2 stop panelx
    echo -e "${GREEN}✅ Stopped PM2 process${NC}"
# Try killing by port
else
    fuser -k 5000/tcp 2>/dev/null && echo -e "${GREEN}✅ Killed process on port 5000${NC}" || echo -e "${YELLOW}⚠️  No process on port 5000${NC}"
fi
echo ""

# Step 5: Pull latest changes
echo -e "${YELLOW}📥 Pulling latest changes from GitHub...${NC}"
git fetch origin main
git reset --hard origin/main
echo -e "${GREEN}✅ Updated to latest commit: $(git log -1 --oneline)${NC}"
echo ""

# Step 6: Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install --silent
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 7: Start service
echo -e "${YELLOW}🚀 Starting PanelX service...${NC}"

# Try systemd first
if systemctl list-unit-files | grep -q panelx.service 2>/dev/null; then
    sudo systemctl start panelx
    sleep 2
    if systemctl is-active --quiet panelx; then
        echo -e "${GREEN}✅ Started systemd service${NC}"
    else
        echo -e "${RED}❌ Failed to start systemd service${NC}"
        echo "Check logs: sudo journalctl -u panelx -n 50"
        exit 1
    fi
# Try PM2
elif command -v pm2 &>/dev/null; then
    pm2 restart panelx || pm2 start ecosystem.config.cjs
    echo -e "${GREEN}✅ Started PM2 process${NC}"
# Manual start
else
    echo -e "${YELLOW}Starting manually...${NC}"
    source .env 2>/dev/null || true
    DATABASE_URL="${DATABASE_URL:-postgresql://panelx:panelx123@localhost:5432/panelx}" \
    PORT="${PORT:-5000}" \
    NODE_ENV="${NODE_ENV:-production}" \
    SESSION_SECRET="${SESSION_SECRET:-panelx-secret}" \
    nohup npx tsx server/index.ts > server.log 2>&1 &
    echo -e "${GREEN}✅ Started manually (PID: $!)${NC}"
fi
echo ""

# Step 8: Wait for server to start
echo -e "${YELLOW}⏳ Waiting for server to start...${NC}"
for i in {1..10}; do
    if curl -s http://localhost:5000/api/stats > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is responding!${NC}"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# Step 9: Verify it's working
echo -e "${YELLOW}🔍 Verifying server status...${NC}"
STATS=$(curl -s http://localhost:5000/api/stats 2>/dev/null || echo "")
if [ -n "$STATS" ]; then
    echo -e "${GREEN}✅ Server is working! Stats API response:${NC}"
    echo "$STATS" | jq '.' 2>/dev/null || echo "$STATS"
else
    echo -e "${RED}❌ Server not responding on port 5000${NC}"
    echo "Check logs for errors"
    exit 1
fi
echo ""

# Success!
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Update Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 What to test:"
echo ""
echo "1️⃣  Stream Control (NEW)"
echo "   • Go to Streams page"
echo "   • Hover over stream → See Start/Stop/Restart buttons"
echo "   • Click to test"
echo ""
echo "2️⃣  Export Functionality (NEW)"
echo "   • Lines page → 3 export buttons (CSV/Excel/M3U)"
echo "   • Streams page → 2 export buttons (CSV/Excel)"
echo "   • Click to download"
echo ""
echo "3️⃣  Access panel:"
echo "   🌐 http://$(hostname -I | awk '{print $1}'):5000"
echo "   👤 Username: admin"
echo "   🔑 Password: admin123"
echo ""
echo "💡 Clear browser cache: Ctrl+Shift+R"
echo ""
echo "📋 View logs:"
if systemctl list-unit-files | grep -q panelx.service 2>/dev/null; then
    echo "   sudo journalctl -u panelx -f"
elif command -v pm2 &>/dev/null; then
    echo "   pm2 logs panelx"
else
    echo "   tail -f /opt/panelx/server.log"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
