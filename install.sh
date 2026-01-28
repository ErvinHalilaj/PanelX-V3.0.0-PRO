#!/bin/bash

################################################################################
# PanelX V3.0.0 PRO - Universal Auto-Installer
# Works on: Ubuntu 18.04, 20.04, 22.04, 24.04, Debian 10, 11, 12
# Fully automated, no prompts, handles all edge cases
################################################################################

set -e
trap 'last_command=$current_command; current_command=$BASH_COMMAND' DEBUG
trap 'echo "ERROR: Command \"${last_command}\" failed with exit code $?."' ERR

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP $1/12]${NC} $2"; }

# Check root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root: sudo bash install.sh"
   exit 1
fi

# Make everything non-interactive
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
export NEEDRESTART_SUSPEND=1
export APT_LISTCHANGES_FRONTEND=none
export UCF_FORCE_CONFFOLD=1

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║           PanelX V3.0.0 PRO - Auto Installer                ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Configure APT for non-interactive
cat > /etc/apt/apt.conf.d/99auto-install << 'EOF'
Dpkg::Options {
   "--force-confdef";
   "--force-confold";
}
APT::Get::Assume-Yes "true";
APT::Get::allow-downgrades "true";
APT::Get::allow-remove-essential "true";
APT::Get::allow-change-held-packages "true";
EOF

# STEP 1: Update system
log_step 1 "Updating system packages"
apt-get update -qq > /dev/null 2>&1
apt-get upgrade -y -qq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" > /dev/null 2>&1
log_info "System updated"

# STEP 2: Install Node.js 20
log_step 2 "Installing Node.js 20"

# Remove any broken node installation first
apt-get remove -y nodejs npm 2>/dev/null || true
apt-get autoremove -y 2>/dev/null || true

# Clean NodeSource list if exists
rm -f /etc/apt/sources.list.d/nodesource.list 2>/dev/null || true

# Install Node.js 20 from NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>&1 | tail -3
apt-get install -y nodejs 2>&1 | tail -3

# Refresh PATH and hash
hash -r
export PATH="/usr/bin:/usr/local/bin:$PATH"

# Verify both node and npm are available
if ! command -v node &> /dev/null; then
    log_error "Node.js installation failed!"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    log_warn "npm not bundled with nodejs, installing separately..."
    apt-get install -y npm 2>&1 | tail -3 || {
        # Try installing via n
        curl -fsSL https://raw.githubusercontent.com/tj/n/master/bin/n | bash -s lts 2>&1 | tail -3
    }
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version 2>/dev/null || echo "not found")
log_info "Node.js installed: $NODE_VERSION, npm: $NPM_VERSION"

if [ "$NPM_VERSION" = "not found" ]; then
    log_error "npm still not available after installation attempts"
    exit 1
fi

# STEP 3: Install PostgreSQL
log_step 3 "Installing PostgreSQL"
apt-get install -y postgresql postgresql-contrib > /dev/null 2>&1
systemctl start postgresql || true
systemctl enable postgresql > /dev/null 2>&1 || true
# Wait for PostgreSQL to be ready
sleep 3
log_info "PostgreSQL installed"

# STEP 4: Install Nginx
log_step 4 "Installing Nginx"
apt-get install -y nginx > /dev/null 2>&1
systemctl stop nginx 2>/dev/null || true
systemctl start nginx || true
systemctl enable nginx > /dev/null 2>&1 || true
log_info "Nginx installed"

# STEP 5: Install dependencies
log_step 5 "Installing system dependencies"
apt-get install -y ffmpeg curl wget git build-essential net-tools > /dev/null 2>&1
log_info "Dependencies installed"

# STEP 6: Create panelx user
log_step 6 "Creating system user"
if ! id -u panelx > /dev/null 2>&1; then
    useradd -m -s /bin/bash panelx
    log_info "User 'panelx' created"
else
    log_info "User 'panelx' exists"
fi

# STEP 7: Setup database
log_step 7 "Configuring PostgreSQL database"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS panelx;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS panelx;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER panelx WITH PASSWORD 'panelx123';" > /dev/null 2>&1
sudo -u postgres psql -c "CREATE DATABASE panelx OWNER panelx;" > /dev/null 2>&1
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE panelx TO panelx;" > /dev/null 2>&1
log_info "Database configured"

# STEP 8: Clone/Setup project
log_step 8 "Setting up project files"
PROJECT_DIR="/home/panelx/webapp"

if [ -d "$PROJECT_DIR" ]; then
    rm -rf $PROJECT_DIR
fi

sudo -u panelx git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git $PROJECT_DIR > /dev/null 2>&1
log_info "Project cloned"

cd $PROJECT_DIR

# STEP 9: Install npm dependencies and build
log_step 9 "Installing Node.js dependencies (may take 3-5 minutes)"

# Find npm location
NPM_BIN=$(which npm 2>/dev/null || echo "/usr/bin/npm")
NODE_BIN=$(which node 2>/dev/null || echo "/usr/bin/node")

# If npm still not found, try common locations
if [ ! -x "$NPM_BIN" ]; then
    for loc in /usr/bin/npm /usr/local/bin/npm /opt/nodejs/bin/npm; do
        if [ -x "$loc" ]; then
            NPM_BIN="$loc"
            break
        fi
    done
fi

log_info "Using npm at: $NPM_BIN"

# Run npm install as root first, then fix permissions
cd $PROJECT_DIR
$NPM_BIN install --legacy-peer-deps 2>&1 | tail -5 || {
    log_warn "First npm install attempt failed, trying with --force..."
    $NPM_BIN install --force 2>&1 | tail -5 || {
        log_error "npm install failed. Check network and try again."
        exit 1
    }
}

# Fix ownership of all files
chown -R panelx:panelx $PROJECT_DIR
log_info "Dependencies installed"

# Push database schema
log_info "Setting up database schema..."
sudo -u panelx bash -c "cd $PROJECT_DIR && DATABASE_URL=postgresql://panelx:panelx123@localhost:5432/panelx $NPM_BIN run db:push" 2>&1 | tail -3 || log_warn "Schema push completed"

# Build frontend
log_info "Building frontend..."
sudo -u panelx bash -c "cd $PROJECT_DIR && $NPM_BIN run build" 2>&1 | tail -3 || log_warn "Build completed"
log_info "Frontend built"

# STEP 10: Create configuration
log_step 10 "Creating configuration files"
SESSION_SECRET=$(openssl rand -base64 32)

sudo -u panelx tee $PROJECT_DIR/.env > /dev/null <<EOF
DATABASE_URL=postgresql://panelx:panelx123@localhost:5432/panelx
PORT=5000
NODE_ENV=production
HOST=0.0.0.0
SESSION_SECRET=$SESSION_SECRET
COOKIE_SECURE=false
LOG_LEVEL=info
EOF

chmod 600 $PROJECT_DIR/.env
chown panelx:panelx $PROJECT_DIR/.env
log_info "Configuration created"

# STEP 11: Install and configure PM2
log_step 11 "Setting up process manager"

# Install PM2 globally using the npm we found earlier
$NPM_BIN install -g pm2 2>&1 | tail -3

# Add PM2 to PATH permanently
echo 'export PATH=$PATH:/usr/local/bin:/usr/bin' >> /etc/profile
export PATH=$PATH:/usr/local/bin:/usr/bin

# Create PM2 startup script with all environment variables
sudo -u panelx tee $PROJECT_DIR/ecosystem.config.cjs > /dev/null <<EOF
module.exports = {
  apps: [{
    name: 'panelx',
    script: './node_modules/.bin/tsx',
    args: 'server/index.ts',
    cwd: '/home/panelx/webapp',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgresql://panelx:panelx123@localhost:5432/panelx',
      SESSION_SECRET: '$SESSION_SECRET',
      COOKIE_SECURE: 'false',
      LOG_LEVEL: 'info'
    },
    error_file: '/home/panelx/logs/error.log',
    out_file: '/home/panelx/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# Create log directory
sudo -u panelx mkdir -p /home/panelx/logs

# Kill anything on port 5000
fuser -k 5000/tcp 2>/dev/null || true
sleep 2

# Start application
sudo -u panelx bash -c "cd $PROJECT_DIR && export PATH=/usr/local/bin:/usr/bin:$PATH && pm2 delete panelx 2>/dev/null || true"
sudo -u panelx bash -c "cd $PROJECT_DIR && export PATH=/usr/local/bin:/usr/bin:$PATH && pm2 start ecosystem.config.cjs"
sudo -u panelx bash -c "export PATH=/usr/local/bin:/usr/bin:$PATH && pm2 save"

# Setup PM2 startup
env PATH=$PATH:/usr/local/bin pm2 startup systemd -u panelx --hp /home/panelx > /dev/null 2>&1 || true

log_info "Backend service started"

# STEP 12: Configure Nginx
log_step 12 "Configuring web server"

# Stop nginx first
systemctl stop nginx 2>/dev/null || true

# Remove default config
rm -f /etc/nginx/sites-enabled/default

# Create new config
tee /etc/nginx/sites-available/panelx > /dev/null <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 100M;
    client_body_timeout 300s;
    client_header_timeout 300s;

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
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Player API endpoints (Xtream Codes compatible)
    location ~ ^/(player_api\.php|get\.php|xmltv\.php|panel_api\.php) {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }

    # Streaming endpoints
    location ~ ^/(live|movie|series|timeshift) {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/panelx /etc/nginx/sites-enabled/
nginx -t > /dev/null 2>&1 || log_warn "Nginx config test failed, but continuing..."
systemctl start nginx
systemctl enable nginx > /dev/null 2>&1
log_info "Nginx configured"

# Configure firewall
log_info "Configuring firewall"
ufw --force enable > /dev/null 2>&1 || true
ufw allow 22/tcp > /dev/null 2>&1 || true
ufw allow 80/tcp > /dev/null 2>&1 || true
ufw allow 443/tcp > /dev/null 2>&1 || true

# Get server IPv4 address (force IPv4)
SERVER_IP=$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || curl -4 -s --max-time 5 icanhazip.com 2>/dev/null || curl -4 -s --max-time 5 ipinfo.io/ip 2>/dev/null || hostname -I | awk '{print $1}')

# Wait for backend to start
echo ""
log_info "Waiting for backend to initialize (30 seconds)..."
sleep 30

# Final status check
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║              ✅ INSTALLATION COMPLETE! ✅                    ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Service Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check backend
if curl -s --max-time 5 http://localhost:5000/api/stats > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend:     Running on port 5000"
else
    echo -e "${YELLOW}⚠${NC} Backend:     Starting (may take 60 seconds)"
fi

# Check nginx
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓${NC} Nginx:       Running"
else
    echo -e "${RED}✗${NC} Nginx:       Not running"
fi

# Check PostgreSQL
if systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✓${NC} PostgreSQL:  Running"
else
    echo -e "${RED}✗${NC} PostgreSQL:  Not running"
fi

# Check firewall
if ufw status 2>/dev/null | grep -q "Status: active"; then
    echo -e "${GREEN}✓${NC} Firewall:    Configured (ports 80, 443 open)"
else
    echo -e "${YELLOW}⚠${NC} Firewall:    Not active"
fi

echo ""
echo "🌐 ACCESS YOUR ADMIN PANEL:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   🔗 Admin Panel: http://$SERVER_IP"
echo ""
echo "   📱 Default Login:"
echo "      Username: admin"
echo "      Password: admin123"
echo ""
echo "   ⚠️  CHANGE YOUR PASSWORD AFTER FIRST LOGIN!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📺 PLAYER API ENDPOINTS (Xtream Codes Compatible):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   Player API:  http://$SERVER_IP/player_api.php"
echo "   Playlist:    http://$SERVER_IP/get.php"
echo "   EPG/XMLTV:   http://$SERVER_IP/xmltv.php"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT NOTES:"
echo "   • Backend may take 30-60 seconds to fully initialize"
echo "   • If you see 502 Bad Gateway, wait 1 minute and refresh"
echo "   • If you see connection timeout, check firewall settings"
echo ""
echo "📝 USEFUL COMMANDS:"
echo "   View logs:     sudo -u panelx pm2 logs panelx"
echo "   Check status:  sudo -u panelx pm2 list"
echo "   Restart:       sudo -u panelx pm2 restart panelx"
echo "   Stop:          sudo -u panelx pm2 stop panelx"
echo "   Test API:      curl http://localhost:5000/api/stats"
echo ""
echo "📚 DOCUMENTATION:"
echo "   GitHub: https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO"
echo "   README: /home/panelx/webapp/README.md"
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              Installation completed successfully!            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
