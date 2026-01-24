#!/bin/bash

# PanelX Installation - Root-Friendly Version
# Quick installer that works on any Ubuntu 24.04 system

set -e

echo "🚀 PanelX Installation Starting..."
echo ""

# Configuration
DB_NAME="panelx"
DB_USER="panelx"
DB_PASS="panelx123"
INSTALL_DIR="/opt/panelx"
PORT="5000"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Step 1: Updating system...${NC}"
apt update -qq
apt upgrade -y -qq

echo -e "${GREEN}✅ System updated${NC}"
echo ""

echo -e "${BLUE}Step 2: Installing Node.js 20.x...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo -e "${GREEN}✅ Node.js $(node -v) installed${NC}"
echo ""

echo -e "${BLUE}Step 3: Installing dependencies...${NC}"
apt install -y git build-essential postgresql postgresql-contrib ffmpeg curl
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

echo -e "${BLUE}Step 4: Configuring PostgreSQL...${NC}"
# Find PostgreSQL version
PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

# Backup and configure
cp "$PG_HBA" "${PG_HBA}.backup" 2>/dev/null || true
sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' "$PG_HBA"
sed -i 's/local   all             all                                     scram-sha-256/local   all             all                                     md5/' "$PG_HBA"
systemctl restart postgresql
echo -e "${GREEN}✅ PostgreSQL configured${NC}"
echo ""

echo -e "${BLUE}Step 5: Creating database...${NC}"
sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER WITH SUPERUSER;
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF

# Test connection
PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 'Connection OK' as status;" > /dev/null
echo -e "${GREEN}✅ Database created and tested${NC}"
echo ""

echo -e "${BLUE}Step 6: Cloning PanelX...${NC}"
rm -rf "$INSTALL_DIR"
git clone -q https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git "$INSTALL_DIR"
echo -e "${GREEN}✅ Repository cloned${NC}"
echo ""

echo -e "${BLUE}Step 7: Installing npm packages...${NC}"
cd "$INSTALL_DIR"
npm install --silent
echo -e "${GREEN}✅ NPM packages installed${NC}"
echo ""

echo -e "${BLUE}Step 8: Creating environment file...${NC}"
cat > "$INSTALL_DIR/.env" << EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
PORT=$PORT
NODE_ENV=production
SESSION_SECRET=$(openssl rand -hex 32)
EOF
echo -e "${GREEN}✅ Environment file created${NC}"
echo ""

echo -e "${BLUE}Step 9: Initializing database...${NC}"
cd "$INSTALL_DIR"
npm run db:push
echo -e "${GREEN}✅ Database schema created${NC}"
echo ""

echo -e "${BLUE}Step 10: Creating systemd service...${NC}"
cat > /etc/systemd/system/panelx.service << EOF
[Unit]
Description=PanelX IPTV Management Panel
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/npx tsx server/index.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
echo -e "${GREEN}✅ Service created${NC}"
echo ""

echo -e "${BLUE}Step 11: Configuring firewall...${NC}"
ufw allow $PORT/tcp > /dev/null 2>&1 || true
ufw allow 22/tcp > /dev/null 2>&1 || true
echo -e "${GREEN}✅ Firewall configured${NC}"
echo ""

echo -e "${BLUE}Step 12: Starting service...${NC}"
systemctl daemon-reload
systemctl enable panelx
systemctl start panelx
sleep 5

if systemctl is-active --quiet panelx; then
    echo -e "${GREEN}✅ PanelX service started${NC}"
else
    echo "⚠️  Service may need more time to start"
fi
echo ""

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Access Panel:"
echo "   URL: http://$SERVER_IP:$PORT"
echo ""
echo "👤 Login Credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "📋 Useful Commands:"
echo "   Status:  systemctl status panelx"
echo "   Logs:    journalctl -u panelx -f"
echo "   Restart: systemctl restart panelx"
echo "   Test:    curl http://localhost:$PORT/api/stats"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
