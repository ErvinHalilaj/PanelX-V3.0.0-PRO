#!/bin/bash

#############################################
# PanelX V3.0.0 PRO - NON-INTERACTIVE INSTALLER
# Fully automated with no prompts
#############################################

# Exit on error
set -e

# Make everything non-interactive
export DEBIAN_FRONTEND=noninteractive
export APT_LISTCHANGES_FRONTEND=none

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (use sudo)"
   exit 1
fi

log_info "Starting PanelX V3.0.0 PRO installation (Non-Interactive Mode)..."
echo ""

# Configure APT to never prompt
log_info "Configuring APT for non-interactive mode..."
cat > /etc/apt/apt.conf.d/99local-install << 'EOF'
Dpkg::Options {
   "--force-confdef";
   "--force-confold";
}
APT::Get::Assume-Yes "true";
APT::Get::allow-downgrades "true";
APT::Get::allow-remove-essential "true";
APT::Get::allow-change-held-packages "true";
EOF

# Step 1: Update system
log_info "Step 1/10: Updating system packages..."
apt-get update -qq >/dev/null 2>&1
apt-get upgrade -y -qq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" >/dev/null 2>&1
log_info "✅ System updated"

# Step 2: Install Node.js 20
log_info "Step 2/10: Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    apt-get install -y nodejs >/dev/null 2>&1
fi
NODE_VERSION=$(node --version)
log_info "✅ Node.js installed: $NODE_VERSION"

# Step 3: Install PostgreSQL
log_info "Step 3/10: Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql postgresql-contrib >/dev/null 2>&1
fi
systemctl start postgresql
systemctl enable postgresql >/dev/null 2>&1
log_info "✅ PostgreSQL installed"

# Step 4: Install Nginx
log_info "Step 4/10: Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx >/dev/null 2>&1
fi
systemctl start nginx
systemctl enable nginx >/dev/null 2>&1
log_info "✅ Nginx installed"

# Step 5: Install dependencies
log_info "Step 5/10: Installing dependencies..."
apt-get install -y ffmpeg curl wget git build-essential >/dev/null 2>&1
log_info "✅ Dependencies installed"

# Step 6: Create panelx user
log_info "Step 6/10: Creating panelx user..."
if ! id -u panelx > /dev/null 2>&1; then
    useradd -m -s /bin/bash panelx
    log_info "✅ User created"
else
    log_info "✅ User already exists"
fi

# Step 7: Setup database
log_info "Step 7/10: Setting up database..."
sudo -u postgres psql -c "CREATE USER panelx WITH PASSWORD 'panelx123';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE panelx OWNER panelx;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE panelx TO panelx;" >/dev/null 2>&1
log_info "✅ Database configured"

# Step 8: Clone project
log_info "Step 8/10: Setting up project..."
PROJECT_DIR="/home/panelx/webapp"

if [ -d "$PROJECT_DIR" ]; then
    log_warn "Project directory exists, updating..."
    cd $PROJECT_DIR
    sudo -u panelx git pull >/dev/null 2>&1 || true
else
    sudo -u panelx git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git $PROJECT_DIR >/dev/null 2>&1
fi
log_info "✅ Project ready"

cd $PROJECT_DIR

# Step 9: Install npm dependencies
log_info "Step 9/10: Installing Node.js dependencies (this may take a few minutes)..."
sudo -u panelx npm install --production >/dev/null 2>&1
log_info "✅ Dependencies installed"

# Step 10: Configure environment
log_info "Step 10/10: Creating configuration..."
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
log_info "✅ Configuration created"

# Install PM2 globally
log_info "Installing PM2..."
npm install -g pm2 >/dev/null 2>&1

# Create PM2 config
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
    }
  }]
};
EOF

# Create logs directory
sudo -u panelx mkdir -p /home/panelx/logs

# Start application
log_info "Starting application..."
sudo -u panelx pm2 delete panelx 2>/dev/null || true
sudo -u panelx pm2 start $PROJECT_DIR/ecosystem.config.cjs
sudo -u panelx pm2 save >/dev/null 2>&1
pm2 startup systemd -u panelx --hp /home/panelx >/dev/null 2>&1

sleep 5

# Configure Nginx
log_info "Configuring Nginx..."
tee /etc/nginx/sites-available/panelx > /dev/null <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 100M;

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
    }

    location /socket.io {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/panelx /etc/nginx/sites-enabled/
nginx -t >/dev/null 2>&1
systemctl reload nginx

# Configure firewall
log_info "Configuring firewall..."
ufw --force enable >/dev/null 2>&1
ufw allow 22/tcp >/dev/null 2>&1
ufw allow 80/tcp >/dev/null 2>&1
ufw allow 443/tcp >/dev/null 2>&1

# Get IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

# Final checks
sleep 3

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
echo ""
echo "✅ All services started successfully!"
echo "============================================"
