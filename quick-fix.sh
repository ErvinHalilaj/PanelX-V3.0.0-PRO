#!/bin/bash

# PanelX Quick Fix Script - Run this if PM2 shows errored status

echo "🔧 PanelX Quick Fix - Resolving PM2 Error"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="/home/panelx/webapp"
PANELX_USER="panelx"

# Step 1: Check PM2 logs
echo -e "${YELLOW}[1/7]${NC} Checking PM2 logs for errors..."
sudo -u "$PANELX_USER" pm2 logs panelx --lines 20 --nostream
echo ""

# Step 2: Check if database exists
echo -e "${YELLOW}[2/7]${NC} Checking database connection..."
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw panelx; then
    echo -e "${GREEN}✓${NC} Database 'panelx' exists"
else
    echo -e "${RED}✗${NC} Database 'panelx' not found!"
    exit 1
fi

# Step 3: Check .env file
echo -e "${YELLOW}[3/7]${NC} Checking environment configuration..."
if [ -f "$PROJECT_DIR/.env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    if grep -q "DATABASE_URL" "$PROJECT_DIR/.env"; then
        echo -e "${GREEN}✓${NC} DATABASE_URL is set"
    else
        echo -e "${RED}✗${NC} DATABASE_URL not found in .env"
        exit 1
    fi
else
    echo -e "${RED}✗${NC} .env file not found!"
    exit 1
fi

# Step 4: Install any missing dependencies
echo -e "${YELLOW}[4/7]${NC} Checking dependencies..."
cd "$PROJECT_DIR"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}!${NC} Installing dependencies..."
    sudo -u "$PANELX_USER" npm install
else
    echo -e "${GREEN}✓${NC} Dependencies installed"
fi

# Step 5: Push database schema (create tables)
echo -e "${YELLOW}[5/7]${NC} Creating database tables..."
cd "$PROJECT_DIR"
sudo -u "$PANELX_USER" npx drizzle-kit push --force 2>&1 | grep -v "WARNING" || echo "Schema push attempted"

# Step 6: Seed database with initial data
echo -e "${YELLOW}[6/7]${NC} Seeding database..."
cd "$PROJECT_DIR"
sudo -u "$PANELX_USER" npm run db:seed 2>&1 || echo "Seeding attempted"

# Step 7: Restart PM2
echo -e "${YELLOW}[7/7]${NC} Restarting backend..."
sudo -u "$PANELX_USER" pm2 delete panelx 2>/dev/null || true
sleep 2
cd "$PROJECT_DIR"
sudo -u "$PANELX_USER" pm2 start ecosystem.config.cjs
sleep 5

# Check status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 FINAL STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check PM2 status
PM2_STATUS=$(sudo -u "$PANELX_USER" pm2 jlist 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
echo -n "PM2 Process: "
if [[ "$PM2_STATUS" == "online" ]]; then
    echo -e "${GREEN}✓ Online${NC}"
else
    echo -e "${RED}✗ $PM2_STATUS${NC}"
fi

# Check port 5000
echo -n "Port 5000: "
if netstat -tuln | grep -q ":5000 "; then
    echo -e "${GREEN}✓ Listening${NC}"
else
    echo -e "${RED}✗ Not listening${NC}"
fi

# Test API
echo -n "API Test: "
sleep 3
if curl -s -f http://localhost:5000/api/stats > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Responding${NC}"
else
    echo -e "${YELLOW}⚠ Not responding (may need more time)${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get server IP
SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}' || echo "localhost")

if [[ "$PM2_STATUS" == "online" ]]; then
    echo -e "${GREEN}✅ Backend is now running!${NC}"
    echo ""
    echo "Access your panel at: http://$SERVER_IP"
    echo ""
    echo "Default credentials:"
    echo "  Username: admin"
    echo "  Password: admin123"
    echo ""
else
    echo -e "${YELLOW}⚠ Backend is still having issues${NC}"
    echo ""
    echo "View detailed logs:"
    echo "  sudo -u panelx pm2 logs panelx --lines 50"
    echo ""
    echo "Try manual start to see error:"
    echo "  cd $PROJECT_DIR"
    echo "  sudo -u panelx npx tsx server/index.ts"
    echo ""
fi
