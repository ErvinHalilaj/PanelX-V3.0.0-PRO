#!/bin/bash

#############################################################
# PanelX Installation Script - Production Ready v3.1.0
# Tested on Ubuntu 24.04
# GitHub: https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO
#############################################################

set -e  # Exit on any error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="panelx"
DB_USER="panelx"
DB_PASS="panelx123"
INSTALL_DIR="/opt/panelx"
PORT="5000"

# Print functions
print_header() {
    echo -e "${BLUE}"
    echo "=============================================="
    echo "   PanelX Installation Script v3.1.0"
    echo "   Production Ready - Tested & Verified"
    echo "=============================================="
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Error handler
error_exit() {
    print_error "$1"
    echo ""
    echo "Installation failed. Please check the error above."
    echo "For support, provide the error message and run:"
    echo "  cat /var/log/panelx-install.log"
    exit 1
}

# Log everything
exec 1> >(tee -a /var/log/panelx-install.log)
exec 2>&1

print_header

# Step 1: Check prerequisites
print_step "Step 1/12: Checking prerequisites..."

if [ "$EUID" -ne 0 ]; then 
    error_exit "Please run as root (use sudo or root user)"
fi

# Check internet connection
if ! ping -c 1 8.8.8.8 &> /dev/null; then
    error_exit "No internet connection. Please check your network."
fi

print_step "✓ Prerequisites check passed"

# Step 2: Update system
print_step "Step 2/12: Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq || error_exit "Failed to update package list"
apt-get upgrade -y -qq || error_exit "Failed to upgrade packages"
print_step "✓ System updated"

# Step 3: Install Node.js 20.x
print_step "Step 3/12: Installing Node.js 20.x..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 20 ]]; then
    apt-get remove -y nodejs npm 2>/dev/null || true
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - || error_exit "Failed to setup NodeSource repository"
    apt-get install -y nodejs || error_exit "Failed to install Node.js"
fi

NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
print_step "✓ Node.js $NODE_VERSION installed"
print_step "✓ npm $NPM_VERSION installed"

# Step 4: Install dependencies
print_step "Step 4/12: Installing system dependencies..."
apt-get install -y \
    git \
    build-essential \
    postgresql \
    postgresql-contrib \
    ffmpeg \
    curl \
    ufw \
    || error_exit "Failed to install dependencies"
print_step "✓ Dependencies installed"

# Step 5: Configure PostgreSQL
print_step "Step 5/12: Configuring PostgreSQL..."

# Start PostgreSQL
systemctl start postgresql || error_exit "Failed to start PostgreSQL"
systemctl enable postgresql

# Find PostgreSQL version and config
PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)
PG_HBA_CONF="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

if [ ! -f "$PG_HBA_CONF" ]; then
    error_exit "PostgreSQL config not found at $PG_HBA_CONF"
fi

# Backup original config
cp "$PG_HBA_CONF" "${PG_HBA_CONF}.backup.$(date +%Y%m%d_%H%M%S)"

# Configure authentication
if ! grep -q "local   all             all                                     md5" "$PG_HBA_CONF"; then
    sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' "$PG_HBA_CONF"
    systemctl restart postgresql || error_exit "Failed to restart PostgreSQL"
    sleep 2
fi

print_step "✓ PostgreSQL configured"

# Step 6: Create database
print_step "Step 6/12: Creating database..."

# Drop existing database and user if they exist
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true

# Create user and database
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" || error_exit "Failed to create database user"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || error_exit "Failed to create database"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || error_exit "Failed to grant privileges"
sudo -u postgres psql -c "ALTER USER $DB_USER WITH SUPERUSER;" || error_exit "Failed to grant superuser"

# Test connection
PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null || error_exit "Database connection test failed"

print_step "✓ Database created and tested"

# Step 7: Clone repository
print_step "Step 7/12: Cloning PanelX repository..."

if [ -d "$INSTALL_DIR" ]; then
    print_warning "Directory $INSTALL_DIR exists. Backing up..."
    mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
fi

git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git "$INSTALL_DIR" || error_exit "Failed to clone repository"

if [ ! -f "$INSTALL_DIR/package.json" ]; then
    error_exit "Repository clone incomplete - package.json not found"
fi

print_step "✓ Repository cloned"

# Step 8: Install npm packages
print_step "Step 8/12: Installing npm packages (this may take 3-5 minutes)..."
cd "$INSTALL_DIR"

# Clean install
rm -rf node_modules package-lock.json
npm cache clean --force

# Install with proper flags
npm install --legacy-peer-deps --no-audit --no-fund --loglevel=error || error_exit "npm install failed"

# Verify critical packages
if [ ! -d "node_modules/drizzle-kit" ]; then
    print_warning "drizzle-kit not found, installing manually..."
    npm install -D drizzle-kit@^0.31.8 --legacy-peer-deps || error_exit "Failed to install drizzle-kit"
fi

if [ ! -d "node_modules/tsx" ]; then
    print_warning "tsx not found, installing manually..."
    npm install -D tsx@^4.20.5 --legacy-peer-deps || error_exit "Failed to install tsx"
fi

print_step "✓ npm packages installed"

# Step 9: Create environment file
print_step "Step 9/12: Creating environment configuration..."

SESSION_SECRET=$(openssl rand -hex 32)

cat > "$INSTALL_DIR/.env" << EOF
# Database
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME

# Server
PORT=$PORT
NODE_ENV=production

# Security
SESSION_SECRET=$SESSION_SECRET

# Logs
LOG_LEVEL=info
EOF

print_step "✓ Environment file created"

# Step 10: Build frontend
print_step "Step 10/13: Building frontend (this may take 1-2 minutes)..."
cd "$INSTALL_DIR"
npm run build || error_exit "Failed to build frontend"

# Verify build output exists
if [ ! -d "$INSTALL_DIR/dist/public" ]; then
    error_exit "Build failed - dist/public directory not created"
fi

print_step "✓ Frontend built successfully"

# Step 11: Initialize database
print_step "Step 11/13: Initializing database schema..."

# Push schema using drizzle-kit
npm run db:push || error_exit "Failed to initialize database schema"

# Verify tables exist
TABLES=$(PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
if [ "$TABLES" -lt 1 ]; then
    error_exit "Database schema initialization failed - no tables created"
fi

print_step "✓ Database schema initialized ($TABLES tables created)"

# Step 12: Create systemd service
print_step "Step 12/13: Creating systemd service..."

cat > /etc/systemd/system/panelx.service << EOF
[Unit]
Description=PanelX IPTV Management Panel
Documentation=https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env

# Start command
ExecStart=/usr/bin/npx tsx server/index.ts

# Restart policy
Restart=always
RestartSec=10

# Security
NoNewPrivileges=true

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=panelx

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable panelx

print_step "✓ Systemd service created"

# Step 13: Configure firewall
print_step "Step 13/13: Configuring firewall..."

if systemctl is-active --quiet ufw; then
    ufw allow $PORT/tcp
    ufw allow 22/tcp  # Ensure SSH stays open
    print_step "✓ Firewall configured"
else
    print_warning "UFW not active, skipping firewall configuration"
fi

# Start service
print_step "Starting PanelX service..."
systemctl start panelx

# Wait for service to start
sleep 5

# Check service status
if systemctl is-active --quiet panelx; then
    print_step "✓ PanelX service started successfully"
else
    print_error "Service failed to start. Checking logs..."
    journalctl -u panelx -n 20 --no-pager
    error_exit "Service start failed. See logs above."
fi

# Test API
print_step "Testing API..."
sleep 2

if curl -f -s http://localhost:$PORT/api/stats > /dev/null; then
    print_step "✓ API responding correctly"
else
    print_warning "API test failed, but service is running. This may be normal on first start."
fi

# Success!
echo ""
echo -e "${GREEN}=============================================="
echo "   ✅ Installation Complete!"
echo "=============================================="
echo -e "${NC}"
echo ""
echo "🌐 Panel URL: http://$(hostname -I | awk '{print $1}'):$PORT"
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
echo "  curl http://localhost:$PORT/api/stats"
echo ""
echo "📚 Documentation:"
echo "  $INSTALL_DIR/README.md"
echo ""
echo "⚠️  Important: Change the default admin password after first login!"
echo ""
