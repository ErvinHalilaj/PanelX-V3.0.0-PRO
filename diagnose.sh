#!/bin/bash

# PanelX Diagnostic Script
# Run this script to diagnose issues with your PanelX installation

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              PanelX IPTV - Diagnostic Tool                    ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${YELLOW}[WARNING] Not running as root. Some checks may fail.${NC}"
   echo -e "${YELLOW}          Run with: sudo bash diagnose.sh${NC}"
   echo ""
fi

# Installation directory
INSTALL_DIR="/opt/panelx"

echo -e "${BLUE}[1] Checking Installation Directory...${NC}"
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${GREEN}✓ Directory exists: $INSTALL_DIR${NC}"
    cd "$INSTALL_DIR"
else
    echo -e "${RED}✗ Directory not found: $INSTALL_DIR${NC}"
    echo -e "${RED}  PanelX may not be installed. Run install.sh first.${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}[2] Checking Node.js Installation...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js installed: $NODE_VERSION${NC}"
    if [[ "${NODE_VERSION:1:2}" -lt 18 ]]; then
        echo -e "${YELLOW}⚠ Node.js version is older than 18. May cause issues.${NC}"
    fi
else
    echo -e "${RED}✗ Node.js not found${NC}"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓ NPM installed: $NPM_VERSION${NC}"
else
    echo -e "${RED}✗ NPM not found${NC}"
fi

echo ""
echo -e "${BLUE}[3] Checking PostgreSQL...${NC}"
if command -v psql &> /dev/null; then
    PG_VERSION=$(psql --version | awk '{print $3}')
    echo -e "${GREEN}✓ PostgreSQL installed: $PG_VERSION${NC}"
    
    if systemctl is-active --quiet postgresql; then
        echo -e "${GREEN}✓ PostgreSQL service is running${NC}"
    else
        echo -e "${RED}✗ PostgreSQL service is NOT running${NC}"
        echo -e "  Fix: sudo systemctl start postgresql"
    fi
else
    echo -e "${RED}✗ PostgreSQL not found${NC}"
fi

echo ""
echo -e "${BLUE}[4] Checking Database Connection...${NC}"
if [ -f "$INSTALL_DIR/.env" ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"
    
    # Extract DATABASE_URL
    DATABASE_URL=$(grep "^DATABASE_URL=" "$INSTALL_DIR/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    
    if [ -n "$DATABASE_URL" ]; then
        echo -e "${GREEN}✓ DATABASE_URL is set${NC}"
        
        # Extract database name
        DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*://[^@]*@[^/]*/\([^?]*\).*|\1|p')
        DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
        
        echo -e "  Database: $DB_NAME"
        echo -e "  User: $DB_USER"
        
        # Test connection
        if sudo -u postgres psql -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
            echo -e "${GREEN}✓ Database connection successful${NC}"
            
            # Check if tables exist
            TABLE_COUNT=$(sudo -u postgres psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
            if [ "$TABLE_COUNT" -gt 0 ]; then
                echo -e "${GREEN}✓ Database has $TABLE_COUNT tables${NC}"
            else
                echo -e "${YELLOW}⚠ Database exists but has no tables${NC}"
                echo -e "  Fix: cd $INSTALL_DIR && npm run db:push"
            fi
        else
            echo -e "${RED}✗ Cannot connect to database${NC}"
        fi
    else
        echo -e "${RED}✗ DATABASE_URL not set in .env${NC}"
    fi
else
    echo -e "${RED}✗ .env file not found${NC}"
fi

echo ""
echo -e "${BLUE}[5] Checking PanelX Service...${NC}"
if systemctl list-unit-files | grep -q "panelx.service"; then
    echo -e "${GREEN}✓ Systemd service exists${NC}"
    
    if systemctl is-active --quiet panelx; then
        echo -e "${GREEN}✓ Service is running${NC}"
        PID=$(systemctl show -p MainPID --value panelx)
        echo -e "  PID: $PID"
    else
        echo -e "${RED}✗ Service is NOT running${NC}"
        echo -e "  Fix: sudo systemctl start panelx"
        echo -e "  Check logs: sudo journalctl -u panelx -n 50 --no-pager"
    fi
    
    if systemctl is-enabled --quiet panelx; then
        echo -e "${GREEN}✓ Service is enabled (auto-start)${NC}"
    else
        echo -e "${YELLOW}⚠ Service is not enabled${NC}"
        echo -e "  Fix: sudo systemctl enable panelx"
    fi
else
    echo -e "${RED}✗ Systemd service not found${NC}"
fi

echo ""
echo -e "${BLUE}[6] Checking Port Availability...${NC}"
PORT=$(grep "^PORT=" "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "5000")
echo -e "  Configured port: $PORT"

if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
    echo -e "${GREEN}✓ Port $PORT is in use (service likely running)${NC}"
    PROC=$(sudo lsof -i :$PORT -t 2>/dev/null | head -1)
    if [ -n "$PROC" ]; then
        PROC_NAME=$(ps -p $PROC -o comm= 2>/dev/null)
        echo -e "  Process: $PROC_NAME (PID: $PROC)"
    fi
else
    echo -e "${YELLOW}⚠ Port $PORT is not in use${NC}"
    echo -e "  Service may not be running or is misconfigured"
fi

echo ""
echo -e "${BLUE}[7] Checking Firewall...${NC}"
if command -v ufw &> /dev/null; then
    if ufw status | grep -q "Status: active"; then
        echo -e "${GREEN}✓ UFW firewall is active${NC}"
        if ufw status | grep -q "$PORT/tcp.*ALLOW"; then
            echo -e "${GREEN}✓ Port $PORT is allowed in firewall${NC}"
        else
            echo -e "${YELLOW}⚠ Port $PORT is NOT allowed in firewall${NC}"
            echo -e "  Fix: sudo ufw allow $PORT/tcp"
        fi
    else
        echo -e "${CYAN}ℹ UFW firewall is not active${NC}"
    fi
else
    echo -e "${CYAN}ℹ UFW not installed${NC}"
fi

echo ""
echo -e "${BLUE}[8] Testing API Endpoints...${NC}"
SERVER_URL="http://localhost:$PORT"

# Test root endpoint
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$SERVER_URL/" | grep -q "200\|302"; then
    echo -e "${GREEN}✓ Web interface is accessible${NC}"
else
    echo -e "${RED}✗ Cannot reach web interface${NC}"
fi

# Test player_api.php with demo credentials
API_RESPONSE=$(curl -s --connect-timeout 5 "$SERVER_URL/player_api.php?username=testuser1&password=test123" 2>/dev/null)
if [ -n "$API_RESPONSE" ]; then
    if echo "$API_RESPONSE" | grep -q "user_info\|server_info"; then
        echo -e "${GREEN}✓ Player API is responding${NC}"
        if echo "$API_RESPONSE" | grep -q '"auth":1' || echo "$API_RESPONSE" | grep -q '"auth": 1'; then
            echo -e "${GREEN}✓ Test user authenticated successfully${NC}"
        else
            echo -e "${YELLOW}⚠ Test user authentication failed (user may not exist)${NC}"
            echo -e "  This is normal if you haven't created testuser1 yet"
        fi
    else
        echo -e "${YELLOW}⚠ Player API returned unexpected response${NC}"
    fi
else
    echo -e "${RED}✗ Player API not responding${NC}"
fi

echo ""
echo -e "${BLUE}[9] Checking Application Files...${NC}"
if [ -f "$INSTALL_DIR/dist/index.cjs" ]; then
    echo -e "${GREEN}✓ Application is built (dist/index.cjs exists)${NC}"
else
    echo -e "${YELLOW}⚠ Application not built${NC}"
    echo -e "  Fix: cd $INSTALL_DIR && npm run build"
fi

if [ -f "$INSTALL_DIR/package.json" ]; then
    echo -e "${GREEN}✓ package.json exists${NC}"
else
    echo -e "${RED}✗ package.json not found${NC}"
fi

if [ -d "$INSTALL_DIR/node_modules" ]; then
    echo -e "${GREEN}✓ Dependencies installed (node_modules exists)${NC}"
else
    echo -e "${YELLOW}⚠ Dependencies not installed${NC}"
    echo -e "  Fix: cd $INSTALL_DIR && npm install"
fi

echo ""
echo -e "${BLUE}[10] Recent Service Logs...${NC}"
if systemctl is-active --quiet panelx; then
    echo -e "Last 10 log entries:"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"
    sudo journalctl -u panelx -n 10 --no-pager 2>/dev/null || echo "Could not fetch logs"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"
else
    echo -e "${YELLOW}Service not running - no logs available${NC}"
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                     DIAGNOSTIC SUMMARY                        ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Generate recommendations
echo -e "${BLUE}Recommendations:${NC}"
echo ""

if ! systemctl is-active --quiet panelx 2>/dev/null; then
    echo -e "${YELLOW}1. Service is not running. Start it with:${NC}"
    echo -e "   sudo systemctl start panelx"
    echo ""
fi

if ! sudo -u postgres psql -d "$DB_NAME" -c "SELECT 1;" &>/dev/null 2>&1; then
    echo -e "${YELLOW}2. Database connection issue. Check:${NC}"
    echo -e "   - PostgreSQL is running: sudo systemctl status postgresql"
    echo -e "   - DATABASE_URL in .env is correct"
    echo ""
fi

if [ ! -f "$INSTALL_DIR/dist/index.cjs" ]; then
    echo -e "${YELLOW}3. Application needs to be built:${NC}"
    echo -e "   cd $INSTALL_DIR && npm run build"
    echo ""
fi

echo -e "${BLUE}Quick Fix Commands:${NC}"
echo -e "  Restart service:  sudo systemctl restart panelx"
echo -e "  View live logs:   sudo journalctl -u panelx -f"
echo -e "  Rebuild app:      cd $INSTALL_DIR && npm run build"
echo -e "  Init database:    cd $INSTALL_DIR && npm run db:push"
echo ""

echo -e "${GREEN}Diagnostic complete!${NC}"
echo ""

# Test URL for user
SERVER_IP=$(hostname -I | awk '{print $1}')
echo -e "${CYAN}Test URLs:${NC}"
echo -e "  Web Panel:  http://$SERVER_IP:$PORT"
echo -e "  Player API: http://$SERVER_IP:$PORT/player_api.php?username=testuser1&password=test123"
echo -e "  M3U URL:    http://$SERVER_IP:$PORT/get.php?username=testuser1&password=test123&type=m3u_plus&output=ts"
echo ""
