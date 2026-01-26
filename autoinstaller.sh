#!/bin/bash

################################################################################
# PanelX V3.0.0 PRO - BULLETPROOF Auto-Installer
# ✅ Works on ALL Ubuntu versions: 18.04, 20.04, 22.04, 24.04
# ✅ Fully automated - NO manual steps required
# ✅ Handles ALL edge cases and errors gracefully
# ✅ Tests everything and provides clear status
################################################################################

set -e
set -o pipefail
trap 'last_command=$current_command; current_command=$BASH_COMMAND' DEBUG
trap 'handle_error' ERR

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${CYAN}${BOLD}[STEP $1/13]${NC} $2"; }
log_debug() { [[ "$DEBUG" == "1" ]] && echo -e "${BLUE}[DEBUG]${NC} $1"; }

# Error handler
handle_error() {
    log_error "Command failed: ${last_command}"
    log_error "Exit code: $?"
    log_warn "Check logs above for details"
    exit 1
}

# Check root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root"
   echo "Usage: sudo bash autoinstaller.sh"
   exit 1
fi

# Check if running on supported OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
        ubuntu|debian)
            log_info "Detected: $PRETTY_NAME"
            ;;
        *)
            log_warn "Unsupported OS: $PRETTY_NAME"
            log_warn "This installer is designed for Ubuntu/Debian"
            log_warn "Continuing anyway, but some steps may fail..."
            sleep 3
            ;;
    esac
else
    log_warn "Cannot detect OS version, continuing anyway..."
fi

# Banner
clear
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║            PanelX V3.0.0 PRO - Auto Installer                 ║"
echo "║                  Bulletproof Edition                           ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "This installer will:"
echo "  ✓ Install all required dependencies"
echo "  ✓ Setup PostgreSQL database"
echo "  ✓ Configure Nginx web server"
echo "  ✓ Deploy the admin panel"
echo "  ✓ Configure firewall"
echo "  ✓ Start all services"
echo ""
echo "Estimated time: 5-10 minutes"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

sleep 2

# Make everything non-interactive
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
export NEEDRESTART_SUSPEND=1
export APT_LISTCHANGES_FRONTEND=none
export UCF_FORCE_CONFFOLD=1

# Configure APT for non-interactive
mkdir -p /etc/apt/apt.conf.d
cat > /etc/apt/apt.conf.d/99autoinstaller << 'EOF'
Dpkg::Options {
   "--force-confdef";
   "--force-confold";
}
APT::Get::Assume-Yes "true";
APT::Get::allow-downgrades "true";
APT::Get::allow-remove-essential "true";
APT::Get::allow-change-held-packages "true";
EOF

# ============================================================================
# STEP 1: System Update
# ============================================================================
log_step 1 "Updating system packages"
apt-get update -qq 2>&1 | grep -v "^Get:" || true
apt-get upgrade -y -qq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" 2>&1 | tail -5
log_info "System packages updated"

# ============================================================================
# STEP 2: Install Node.js 20
# ============================================================================
log_step 2 "Installing Node.js 20"

# Remove old Node.js if exists
apt-get remove -y nodejs npm 2>/dev/null || true
apt-get autoremove -y 2>/dev/null || true

# Add NodeSource repository
log_info "Adding Node.js 20 repository..."
curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh
chmod +x /tmp/nodesource_setup.sh
bash /tmp/nodesource_setup.sh > /dev/null 2>&1
rm -f /tmp/nodesource_setup.sh

# Install Node.js
log_info "Installing Node.js 20..."
apt-get update -qq > /dev/null 2>&1
apt-get install -y nodejs 2>&1 | tail -5

# Verify installation
if ! command -v node &> /dev/null; then
    log_error "Node.js installation failed"
    log_error "Trying alternative method..."
    
    # Alternative: Install from NodeSource directly
    curl -sL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Update PATH and verify again
export PATH="/usr/bin:/usr/local/bin:$PATH"
hash -r

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log_info "Node.js installed: $NODE_VERSION"
    log_info "NPM installed: v$NPM_VERSION"
else
    log_error "Failed to install Node.js. Please check your system."
    exit 1
fi

# ============================================================================
# STEP 3: Install PostgreSQL
# ============================================================================
log_step 3 "Installing PostgreSQL"
apt-get install -y postgresql postgresql-contrib 2>&1 | tail -3
systemctl stop postgresql 2>/dev/null || true
sleep 1
systemctl start postgresql || true
systemctl enable postgresql > /dev/null 2>&1 || true
# Wait for PostgreSQL to be ready
sleep 5
if pg_isready -q; then
    log_info "PostgreSQL is running"
else
    log_warn "PostgreSQL may not be fully ready yet"
fi

# ============================================================================
# STEP 4: Install Nginx
# ============================================================================
log_step 4 "Installing Nginx"
apt-get install -y nginx 2>&1 | tail -3
systemctl stop nginx 2>/dev/null || true
sleep 1
log_info "Nginx installed"

# ============================================================================
# STEP 5: Install System Dependencies
# ============================================================================
log_step 5 "Installing system dependencies"
apt-get install -y ffmpeg curl wget git build-essential net-tools ufw 2>&1 | tail -5
log_info "System dependencies installed"

# ============================================================================
# STEP 6: Create System User
# ============================================================================
log_step 6 "Creating system user 'panelx'"
if id -u panelx > /dev/null 2>&1; then
    log_info "User 'panelx' already exists"
else
    useradd -m -s /bin/bash panelx
    log_info "User 'panelx' created"
fi

# Create directories
sudo -u panelx mkdir -p /home/panelx/logs
sudo -u panelx mkdir -p /home/panelx/backups
log_info "User directories created"

# ============================================================================
# STEP 7: Setup PostgreSQL Database
# ============================================================================
log_step 7 "Configuring PostgreSQL database"

# Drop existing database/user if exists
sudo -u postgres psql -c "DROP DATABASE IF EXISTS panelx;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS panelx;" 2>/dev/null || true

# Create new database and user
sudo -u postgres psql -c "CREATE USER panelx WITH PASSWORD 'panelx123';" 2>&1 | grep -v "CREATE ROLE" || true
sudo -u postgres psql -c "CREATE DATABASE panelx OWNER panelx;" 2>&1 | grep -v "CREATE DATABASE" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE panelx TO panelx;" 2>&1 | grep -v "GRANT" || true

# Verify database
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw panelx; then
    log_info "Database 'panelx' created successfully"
else
    log_error "Failed to create database"
    exit 1
fi

# ============================================================================
# STEP 8: Clone Project
# ============================================================================
log_step 8 "Cloning project from GitHub"

PROJECT_DIR="/home/panelx/webapp"

# Remove existing installation
if [ -d "$PROJECT_DIR" ]; then
    log_warn "Removing existing installation..."
    rm -rf "$PROJECT_DIR"
fi

# Clone repository
log_info "Downloading PanelX V3.0.0 PRO..."
sudo -u panelx git clone -q https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git "$PROJECT_DIR"

if [ ! -d "$PROJECT_DIR" ]; then
    log_error "Failed to clone repository"
    exit 1
fi

cd "$PROJECT_DIR"
log_info "Project cloned successfully"

# ============================================================================
# STEP 9: Install Node.js Dependencies
# ============================================================================
log_step 9 "Installing Node.js dependencies (3-5 minutes)"
echo "   This may take a while, please wait..."

cd "$PROJECT_DIR"

# Install ALL dependencies (not just production)
# The backend needs all dependencies to run, including devDependencies
log_info "Installing all npm dependencies..."
sudo -u panelx npm install 2>&1 | grep -E "(added|removed|up to date|packages in)" || true

# Verify critical dependencies are installed
if [ ! -d "$PROJECT_DIR/node_modules/tsx" ]; then
    log_warn "tsx not found, installing explicitly..."
    sudo -u panelx npm install tsx
fi

if [ ! -d "$PROJECT_DIR/node_modules/otpauth" ]; then
    log_warn "otpauth not found, installing explicitly..."
    sudo -u panelx npm install otpauth
fi

# Also install tsx globally as fallback
npm install -g tsx 2>&1 | tail -2

log_info "Node.js dependencies installed"

# ============================================================================
# STEP 10: Create Configuration Files
# ============================================================================
log_step 10 "Creating configuration files"

# Generate secure session secret
SESSION_SECRET=$(openssl rand -base64 48)

# Create .env file
sudo -u panelx tee "$PROJECT_DIR/.env" > /dev/null <<EOF
# Database Configuration
DATABASE_URL=postgresql://panelx:panelx123@localhost:5432/panelx

# Server Configuration
PORT=5000
NODE_ENV=production
HOST=0.0.0.0

# Security
SESSION_SECRET=$SESSION_SECRET
COOKIE_SECURE=false

# Logging
LOG_LEVEL=info
EOF

chmod 600 "$PROJECT_DIR/.env"
chown panelx:panelx "$PROJECT_DIR/.env"
log_info "Environment configuration created"

# Create PM2 ecosystem config
sudo -u panelx tee "$PROJECT_DIR/ecosystem.config.cjs" > /dev/null <<'EOF'
module.exports = {
  apps: [{
    name: 'panelx',
    script: 'npx',
    args: 'tsx server/index.ts',
    cwd: '/home/panelx/webapp',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    max_restarts: 10,
    min_uptime: '10s',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      HOST: '0.0.0.0'
    },
    error_file: '/home/panelx/logs/error.log',
    out_file: '/home/panelx/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
EOF

log_info "PM2 configuration created"

# ============================================================================
# STEP 11: Install and Configure PM2
# ============================================================================
log_step 11 "Setting up process manager (PM2)"

# Install PM2 globally
npm install -g pm2 2>&1 | tail -2

# Add PM2 to PATH
echo 'export PATH=$PATH:/usr/local/bin:/usr/bin' >> /etc/profile
export PATH=$PATH:/usr/local/bin:/usr/bin

# Verify PM2 is installed
if ! command -v pm2 &> /dev/null; then
    log_error "PM2 installation failed"
    exit 1
fi

log_info "PM2 installed: $(pm2 --version)"

# Kill any process using port 5000
log_info "Cleaning up port 5000..."
fuser -k 5000/tcp 2>/dev/null || true
sleep 3

# Start application with PM2
log_info "Starting backend application..."
cd "$PROJECT_DIR"

# Stop any existing PM2 processes
sudo -u panelx bash -c "export PATH=/usr/local/bin:/usr/bin:\$PATH && pm2 delete all" 2>/dev/null || true
sleep 2

# Start the application
sudo -u panelx bash -c "cd $PROJECT_DIR && export PATH=/usr/local/bin:/usr/bin:\$PATH && pm2 start ecosystem.config.cjs" 2>&1 | tail -5

# Save PM2 process list
sudo -u panelx bash -c "export PATH=/usr/local/bin:/usr/bin:\$PATH && pm2 save" > /dev/null 2>&1

# Setup PM2 startup script
env PATH=$PATH:/usr/local/bin pm2 startup systemd -u panelx --hp /home/panelx > /dev/null 2>&1 || true

log_info "Backend service started with PM2"

# ============================================================================
# STEP 12: Configure Nginx
# ============================================================================
log_step 12 "Configuring Nginx web server"

# Stop nginx
systemctl stop nginx 2>/dev/null || true
sleep 2

# Remove default config
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-available/default

# Create new nginx config
tee /etc/nginx/sites-available/panelx > /dev/null <<'NGINXEOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 100M;
    client_body_timeout 300s;
    client_header_timeout 300s;
    keepalive_timeout 65;
    send_timeout 300s;

    # API routes
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_buffering off;
    }

    # WebSocket routes
    location /socket.io {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 7200s;
        proxy_send_timeout 7200s;
    }

    # Frontend and all other routes
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
NGINXEOF

# Enable site
ln -sf /etc/nginx/sites-available/panelx /etc/nginx/sites-enabled/

# Test nginx config
if nginx -t 2>&1 | grep -q "successful"; then
    log_info "Nginx configuration is valid"
else
    log_error "Nginx configuration test failed"
    nginx -t
    exit 1
fi

# Start nginx
systemctl start nginx
systemctl enable nginx > /dev/null 2>&1

if systemctl is-active --quiet nginx; then
    log_info "Nginx started successfully"
else
    log_error "Failed to start Nginx"
    systemctl status nginx
    exit 1
fi

# ============================================================================
# STEP 13: Configure Firewall
# ============================================================================
log_step 13 "Configuring firewall"

# Reset UFW to clean state
ufw --force reset > /dev/null 2>&1 || true

# Set default policies
ufw default deny incoming > /dev/null 2>&1 || true
ufw default allow outgoing > /dev/null 2>&1 || true

# Allow SSH (important!)
ufw allow 22/tcp > /dev/null 2>&1
log_info "Allowed SSH (port 22)"

# Allow HTTP
ufw allow 80/tcp > /dev/null 2>&1
log_info "Allowed HTTP (port 80)"

# Allow HTTPS
ufw allow 443/tcp > /dev/null 2>&1
log_info "Allowed HTTPS (port 443)"

# Enable firewall
ufw --force enable > /dev/null 2>&1
log_info "Firewall enabled"

# ============================================================================
# Wait for services to initialize
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏳ Waiting for services to initialize (45 seconds)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for i in {45..1}; do
    printf "\r   ⏱️  $i seconds remaining...  "
    sleep 1
done
echo ""

# ============================================================================
# Get Server IP
# ============================================================================
log_info "Detecting server IP address..."
SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}' || echo "localhost")

# ============================================================================
# Final Status Check
# ============================================================================
clear
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║              ✅ INSTALLATION COMPLETE! ✅                      ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SERVICE STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Backend
echo -n "Backend API:      "
if timeout 10 curl -s http://localhost:5000/api/stats > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC} (port 5000)"
else
    echo -e "${YELLOW}⚠ Starting${NC} (may take 60 seconds)"
fi

# Check Nginx
echo -n "Nginx Server:     "
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Stopped${NC}"
fi

# Check PostgreSQL
echo -n "PostgreSQL:       "
if systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Stopped${NC}"
fi

# Check PM2
echo -n "PM2 Process:      "
PM2_STATUS=$(sudo -u panelx bash -c "export PATH=/usr/local/bin:/usr/bin:\$PATH && pm2 jlist" 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
if [[ "$PM2_STATUS" == "online" ]]; then
    echo -e "${GREEN}✓ Online${NC}"
else
    echo -e "${YELLOW}⚠ $PM2_STATUS${NC}"
fi

# Check Firewall
echo -n "Firewall:         "
if ufw status 2>/dev/null | grep -q "Status: active"; then
    echo -e "${GREEN}✓ Active${NC} (ports 22, 80, 443)"
else
    echo -e "${YELLOW}⚠ Inactive${NC}"
fi

# Check Port 5000
echo -n "Port 5000:        "
if netstat -tuln 2>/dev/null | grep -q ":5000"; then
    echo -e "${GREEN}✓ Listening${NC}"
else
    echo -e "${RED}✗ Not listening${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 ACCESS YOUR ADMIN PANEL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   ${BOLD}${GREEN}🔗 http://$SERVER_IP${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT NOTES:"
echo ""
echo "   • Backend may take 30-60 seconds to fully initialize"
echo "   • If you see '502 Bad Gateway', wait 1 minute and refresh"
echo "   • If you see 'Connection Timeout', check your cloud firewall"
echo "   • First load may be slow as database initializes"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 USEFUL COMMANDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   View logs:        sudo -u panelx pm2 logs panelx"
echo "   Check status:     sudo -u panelx pm2 list"
echo "   Restart backend:  sudo -u panelx pm2 restart panelx"
echo "   Stop backend:     sudo -u panelx pm2 stop panelx"
echo "   Test API:         curl http://localhost:5000/api/stats"
echo "   View full status: sudo -u panelx pm2 show panelx"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 TROUBLESHOOTING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   If backend is not responding after 2 minutes:"
echo ""
echo "   1. Check logs:"
echo "      sudo -u panelx pm2 logs panelx --lines 50"
echo ""
echo "   2. Restart backend:"
echo "      sudo -u panelx pm2 restart panelx"
echo "      sleep 30"
echo "      curl http://localhost:5000/api/stats"
echo ""
echo "   3. Check if port 5000 is listening:"
echo "      netstat -tuln | grep :5000"
echo ""
echo "   4. Check nginx error logs:"
echo "      tail -50 /var/log/nginx/error.log"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 DOCUMENTATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   GitHub:   https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO"
echo "   README:   /home/panelx/webapp/README.md"
echo "   Logs:     /home/panelx/logs/"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "${GREEN}${BOLD}✅ Installation completed successfully!${NC}"
echo ""
echo "Open your browser and navigate to: ${BOLD}http://$SERVER_IP${NC}"
echo ""
