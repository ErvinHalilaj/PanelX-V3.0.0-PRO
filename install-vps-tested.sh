#!/bin/bash

#############################################
# PanelX V3.0.0 PRO - TESTED INSTALLER
# Automated installation for Ubuntu 22.04+
#############################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (use sudo)"
   exit 1
fi

log_info "Starting PanelX V3.0.0 PRO installation..."
echo ""

# Step 1: Update system
log_info "Step 1/10: Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# Step 2: Install Node.js 20
log_info "Step 2/10: Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
NODE_VERSION=$(node --version)
log_info "Node.js installed: $NODE_VERSION"

# Step 3: Install PostgreSQL
log_info "Step 3/10: Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql postgresql-contrib
fi
systemctl start postgresql
systemctl enable postgresql
log_info "PostgreSQL installed and started"

# Step 4: Install Nginx
log_info "Step 4/10: Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
fi
systemctl start nginx
systemctl enable nginx
log_info "Nginx installed and started"

# Step 5: Install FFmpeg and other dependencies
log_info "Step 5/10: Installing FFmpeg and dependencies..."
apt-get install -y ffmpeg curl wget git build-essential

# Step 6: Create panelx user
log_info "Step 6/10: Creating panelx user..."
if ! id -u panelx > /dev/null 2>&1; then
    useradd -m -s /bin/bash panelx
    log_info "User 'panelx' created"
else
    log_info "User 'panelx' already exists"
fi

# Step 7: Create PostgreSQL database
log_info "Step 7/10: Setting up database..."
sudo -u postgres psql -c "CREATE USER panelx WITH PASSWORD 'panelx123';" 2>/dev/null || log_warn "User panelx already exists in PostgreSQL"
sudo -u postgres psql -c "CREATE DATABASE panelx OWNER panelx;" 2>/dev/null || log_warn "Database panelx already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE panelx TO panelx;"
log_info "Database configured"

# Step 8: Clone/Setup project
log_info "Step 8/10: Setting up project files..."
PROJECT_DIR="/home/panelx/webapp"

if [ -d "$PROJECT_DIR" ]; then
    log_warn "Project directory already exists, skipping clone"
else
    log_info "Cloning from GitHub..."
    sudo -u panelx git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git $PROJECT_DIR
fi

cd $PROJECT_DIR

# Step 9: Install dependencies
log_info "Step 9/10: Installing Node.js dependencies..."
sudo -u panelx npm install --production 2>&1 | tail -5
log_info "Dependencies installed"

# Step 10: Create .env file
log_info "Step 10/10: Creating configuration..."
SESSION_SECRET=$(openssl rand -base64 32)

sudo -u panelx tee $PROJECT_DIR/.env > /dev/null <<EOF
# Database Configuration
DATABASE_URL=postgresql://panelx:panelx123@localhost:5432/panelx

# Server Configuration
PORT=5000
NODE_ENV=production
HOST=0.0.0.0

# Security
SESSION_SECRET=$SESSION_SECRET
COOKIE_SECURE=false

# Optional
LOG_LEVEL=info
EOF

chmod 600 $PROJECT_DIR/.env
log_info "Configuration file created"

# Step 11: Configure PM2
log_info "Configuring PM2..."
npm install -g pm2

# Create PM2 ecosystem file
sudo -u panelx tee $PROJECT_DIR/ecosystem.config.cjs > /dev/null <<'EOF'
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
      PORT: 5000
    },
    error_file: '/home/panelx/logs/panelx-error.log',
    out_file: '/home/panelx/logs/panelx-out.log',
    time: true
  }]
};
EOF

# Create logs directory
sudo -u panelx mkdir -p /home/panelx/logs

# Start with PM2
log_info "Starting application..."
sudo -u panelx pm2 delete panelx 2>/dev/null || true
sudo -u panelx pm2 start $PROJECT_DIR/ecosystem.config.cjs
sudo -u panelx pm2 save
pm2 startup systemd -u panelx --hp /home/panelx

# Wait for app to start
sleep 5

# Step 12: Configure Nginx
log_info "Configuring Nginx..."
tee /etc/nginx/sites-available/panelx > /dev/null <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 100M;

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
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# Enable site
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/panelx /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Step 13: Configure firewall
log_info "Configuring firewall..."
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw status

# Step 14: Test installation
log_info "Testing installation..."
sleep 3

# Get server IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo "============================================"
echo ""
log_info "Testing backend..."
if curl -s http://localhost:5000/api/stats > /dev/null 2>&1; then
    log_info "✅ Backend is responding"
else
    log_warn "⚠️  Backend test failed, checking status..."
    sudo -u panelx pm2 list
    sudo -u panelx pm2 logs panelx --lines 10 --nostream
fi

echo ""
log_info "Testing Nginx..."
if curl -s -I http://localhost | grep -q "HTTP"; then
    log_info "✅ Nginx is working"
else
    log_error "❌ Nginx test failed"
fi

echo ""
echo "============================================"
echo "     🎉 INSTALLATION COMPLETE! 🎉"
echo "============================================"
echo ""
echo "📊 Service Status:"
sudo -u panelx pm2 list
echo ""
echo "🌐 Access your panel at:"
echo "   http://$SERVER_IP"
echo "   http://localhost (from server)"
echo ""
echo "📝 Important Information:"
echo "   • Database: panelx"
echo "   • Database User: panelx"
echo "   • Database Password: panelx123"
echo "   • Backend Port: 5000"
echo "   • Project Directory: /home/panelx/webapp"
echo ""
echo "🔧 Useful Commands:"
echo "   • View logs: sudo -u panelx pm2 logs panelx"
echo "   • Restart app: sudo -u panelx pm2 restart panelx"
echo "   • Stop app: sudo -u panelx pm2 stop panelx"
echo "   • Check status: sudo -u panelx pm2 list"
echo ""
echo "⚠️  Default credentials need to be created via API"
echo "============================================"
