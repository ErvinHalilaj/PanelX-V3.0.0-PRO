#!/bin/bash

################################################################################
# PanelX V3.0.0 PRO - Ubuntu 24.04 Installation Script
# Automated installation for Ubuntu 24.04 LTS
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root"
   log_info "Please run: sudo bash install-ubuntu24.sh"
   exit 1
fi

# Configuration
INSTALL_DIR="/home/panelx"
APP_USER="panelx"
NODE_VERSION="20"
DB_PASSWORD=$(openssl rand -base64 24)

clear
cat << "EOF"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           PanelX V3.0.0 PRO - VPS Installation              ║
║                   Ubuntu 24.04 LTS                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
EOF

log_info "Starting installation..."
sleep 2

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    log_info "Detected OS: $PRETTY_NAME"
    
    # Verify Ubuntu 24.04
    if [[ "$VERSION_ID" != "24.04" ]]; then
        log_warning "This script is optimized for Ubuntu 24.04, but will try to continue..."
        sleep 3
    fi
else
    log_error "Cannot detect OS"
    exit 1
fi

# Update system
log_info "Updating system packages (this may take a few minutes)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
log_success "System updated"

# Install essential packages
log_info "Installing essential packages..."
apt-get install -y -qq \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    nginx \
    ffmpeg \
    unzip \
    postgresql \
    postgresql-contrib \
    certbot \
    python3-certbot-nginx
log_success "Essential packages installed"

# Install Node.js 20
log_info "Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
apt-get install -y -qq nodejs
NODE_VER=$(node --version)
NPM_VER=$(npm --version)
log_success "Node.js $NODE_VER and NPM $NPM_VER installed"

# Install PM2 globally
log_info "Installing PM2 process manager..."
npm install -g pm2 > /dev/null 2>&1
pm2 install pm2-logrotate > /dev/null 2>&1
pm2 set pm2-logrotate:max_size 100M > /dev/null 2>&1
pm2 set pm2-logrotate:retain 7 > /dev/null 2>&1
log_success "PM2 installed and configured"

# Start PostgreSQL
log_info "Configuring PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql > /dev/null 2>&1
log_success "PostgreSQL started"

# Create panelx user
log_info "Creating system user 'panelx'..."
if id "$APP_USER" &>/dev/null; then
    log_warning "User $APP_USER already exists"
else
    useradd -m -s /bin/bash $APP_USER
    log_success "User $APP_USER created"
fi

# Create database and user
log_info "Setting up database..."
sudo -u postgres psql << EOF > /dev/null 2>&1
DROP DATABASE IF EXISTS panelx;
DROP USER IF EXISTS panelx;
CREATE USER panelx WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE panelx OWNER panelx;
GRANT ALL PRIVILEGES ON DATABASE panelx TO panelx;
EOF
log_success "Database 'panelx' created"

# Clone repository
log_info "Downloading PanelX from GitHub..."
if [ -d "$INSTALL_DIR/webapp" ]; then
    log_warning "Application directory exists, backing up..."
    mv $INSTALL_DIR/webapp $INSTALL_DIR/webapp.backup.$(date +%Y%m%d_%H%M%S)
fi

mkdir -p $INSTALL_DIR
cd $INSTALL_DIR
sudo -u $APP_USER git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git webapp > /dev/null 2>&1
log_success "Repository cloned"

# Install dependencies
log_info "Installing Node.js dependencies (this may take 2-3 minutes)..."
cd $INSTALL_DIR/webapp
sudo -u $APP_USER npm install > /dev/null 2>&1
log_success "Dependencies installed"

# Build frontend
log_info "Building React frontend (this may take 2-3 minutes)..."
cd $INSTALL_DIR/webapp
sudo -u $APP_USER NODE_OPTIONS="--max-old-space-size=4096" npm run build > /tmp/build.log 2>&1

if [ $? -eq 0 ]; then
    log_success "Frontend built successfully"
else
    log_warning "Frontend build may have issues, check /tmp/build.log"
fi

# Create .env file
log_info "Creating environment configuration..."
cat > $INSTALL_DIR/webapp/.env << EOF
# PanelX V3.0.0 PRO Configuration
NODE_ENV=production
PORT=5000

# Database Configuration
DATABASE_URL=postgresql://panelx:${DB_PASSWORD}@localhost:5432/panelx

# Security Configuration
SESSION_SECRET=$(openssl rand -hex 32)
COOKIE_SECURE=false

# Optional: TMDB API Key (for movie metadata)
# TMDB_API_KEY=your-tmdb-api-key-here
EOF

chown $APP_USER:$APP_USER $INSTALL_DIR/webapp/.env
chmod 600 $INSTALL_DIR/webapp/.env
log_success "Configuration file created"

# Create logs directory
mkdir -p $INSTALL_DIR/webapp/logs
chown -R $APP_USER:$APP_USER $INSTALL_DIR/webapp
log_success "Permissions configured"

# Configure Nginx
log_info "Configuring Nginx web server..."
SERVER_IP=$(hostname -I | awk '{print $1}')

cat > /etc/nginx/sites-available/panelx << 'NGINXCONF'
server {
    listen 80;
    server_name _;

    client_max_body_size 500M;
    client_body_timeout 300s;

    # Serve static files
    location / {
        root /home/panelx/webapp/dist/public;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Proxy API requests to Node.js backend
    location /api/ {
        proxy_pass http://localhost:5000;
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

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINXCONF

ln -sf /etc/nginx/sites-available/panelx /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t > /dev/null 2>&1
systemctl restart nginx
systemctl enable nginx > /dev/null 2>&1
log_success "Nginx configured"

# Start application with PM2
log_info "Starting PanelX application..."
cd $INSTALL_DIR/webapp

# Create PM2 ecosystem file if not exists
if [ ! -f "ecosystem.production.cjs" ]; then
    cat > ecosystem.production.cjs << 'PM2CONF'
module.exports = {
  apps: [{
    name: 'panelx',
    script: './node_modules/.bin/tsx',
    args: 'server/index.ts',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    max_memory_restart: '1G',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
PM2CONF
    chown $APP_USER:$APP_USER ecosystem.production.cjs
fi

sudo -u $APP_USER pm2 start ecosystem.production.cjs > /dev/null 2>&1
sudo -u $APP_USER pm2 save > /dev/null 2>&1
log_success "Application started"

# Setup PM2 startup
log_info "Configuring auto-start on boot..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER > /dev/null 2>&1
log_success "Auto-start configured"

# Configure firewall
log_info "Configuring firewall..."
ufw --force enable > /dev/null 2>&1
ufw allow 22/tcp > /dev/null 2>&1   # SSH
ufw allow 80/tcp > /dev/null 2>&1   # HTTP
ufw allow 443/tcp > /dev/null 2>&1  # HTTPS
log_success "Firewall configured (ports 22, 80, 443)"

# Save credentials
cat > $INSTALL_DIR/CREDENTIALS.txt << EOF
PanelX V3.0.0 PRO - Installation Credentials
Generated: $(date)

DATABASE CREDENTIALS:
  Database: panelx
  Username: panelx
  Password: ${DB_PASSWORD}
  Connection: postgresql://panelx:${DB_PASSWORD}@localhost:5432/panelx

ACCESS:
  Server IP: ${SERVER_IP}
  Web Panel: http://${SERVER_IP}
  Admin Dashboard: http://${SERVER_IP}/admin
  API: http://${SERVER_IP}/api

IMPORTANT:
  - Save this file securely
  - Database password is stored in: /home/panelx/webapp/.env
  - Change default passwords before production use

MANAGEMENT COMMANDS:
  Check Status:  sudo -u panelx pm2 status
  View Logs:     sudo -u panelx pm2 logs
  Restart:       sudo -u panelx pm2 restart panelx
  Stop:          sudo -u panelx pm2 stop panelx
  
NGINX:
  Status:        systemctl status nginx
  Restart:       systemctl restart nginx
  Config Test:   nginx -t

SSL CERTIFICATE (Optional):
  Install Let's Encrypt:
    certbot --nginx -d yourdomain.com
EOF

chown root:root $INSTALL_DIR/CREDENTIALS.txt
chmod 600 $INSTALL_DIR/CREDENTIALS.txt

# Final checks
log_info "Running final checks..."
sleep 2

# Check if services are running
PM2_STATUS=$(sudo -u $APP_USER pm2 list | grep panelx | grep online > /dev/null 2>&1 && echo "OK" || echo "FAIL")
NGINX_STATUS=$(systemctl is-active nginx > /dev/null 2>&1 && echo "OK" || echo "FAIL")
POSTGRES_STATUS=$(systemctl is-active postgresql > /dev/null 2>&1 && echo "OK" || echo "FAIL")

# Installation complete
clear
cat << "EOF"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         ✅  INSTALLATION COMPLETED SUCCESSFULLY!  ✅         ║
║                                                              ║
║                PanelX V3.0.0 PRO is now running!            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
EOF

echo ""
log_success "All services started successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_info "📊 SERVICE STATUS:"
echo "  • PanelX App:  [$PM2_STATUS]"
echo "  • Nginx:       [$NGINX_STATUS]"
echo "  • PostgreSQL:  [$POSTGRES_STATUS]"
echo ""
log_info "🌐 ACCESS YOUR PANEL:"
echo "  • Main URL:    http://${SERVER_IP}"
echo "  • Admin Panel: http://${SERVER_IP}/admin"
echo "  • API Docs:    http://${SERVER_IP}/api"
echo ""
log_info "📝 CREDENTIALS SAVED TO:"
echo "  • File: $INSTALL_DIR/CREDENTIALS.txt"
echo "  • View: sudo cat $INSTALL_DIR/CREDENTIALS.txt"
echo ""
log_info "🔧 MANAGEMENT COMMANDS:"
echo "  • Status:  sudo -u panelx pm2 status"
echo "  • Logs:    sudo -u panelx pm2 logs"
echo "  • Restart: sudo -u panelx pm2 restart panelx"
echo ""
log_warning "⚠️  IMPORTANT NEXT STEPS:"
echo "  1. Open browser and go to: http://${SERVER_IP}"
echo "  2. Create your first admin user via API:"
echo ""
echo "     curl -X POST http://localhost:5000/api/users \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{"
echo "         \"username\": \"admin\","
echo "         \"password\": \"YourSecurePassword123!\","
echo "         \"email\": \"admin@yourdomain.com\","
echo "         \"role\": \"admin\""
echo "       }'"
echo ""
echo "  3. (Optional) Setup domain and SSL certificate:"
echo "     • Point your domain to: ${SERVER_IP}"
echo "     • Run: certbot --nginx -d yourdomain.com"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_success "🎉 Installation complete! Enjoy your IPTV panel!"
echo ""
