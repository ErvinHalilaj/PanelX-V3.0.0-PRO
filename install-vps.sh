#!/bin/bash

################################################################################
# PanelX V3.0.0 PRO - VPS Installation Script
# Automated installation for Ubuntu 20.04/22.04 or Debian 11/12
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
   log_error "This script must be run as root (use sudo)"
   exit 1
fi

# Configuration
INSTALL_DIR="/home/panelx"
APP_USER="panelx"
NODE_VERSION="20"
POSTGRES_VERSION="15"

log_info "========================================="
log_info "PanelX V3.0.0 PRO - VPS Installation"
log_info "========================================="

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    log_error "Cannot detect OS"
    exit 1
fi

log_info "Detected OS: $OS $VERSION"

# Update system
log_info "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install essential packages
log_info "Installing essential packages..."
apt-get install -y \
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
    unzip

# Install Node.js
log_info "Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
NODE_VER=$(node --version)
NPM_VER=$(npm --version)
log_success "Node.js $NODE_VER installed"
log_success "NPM $NPM_VER installed"

# Install PM2 globally
log_info "Installing PM2..."
npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
log_success "PM2 installed"

# Install PostgreSQL
log_info "Installing PostgreSQL $POSTGRES_VERSION..."
apt-get install -y postgresql postgresql-contrib

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql
log_success "PostgreSQL installed and started"

# Create panelx user
log_info "Creating panelx user..."
if id "$APP_USER" &>/dev/null; then
    log_warning "User $APP_USER already exists"
else
    useradd -m -s /bin/bash $APP_USER
    log_success "User $APP_USER created"
fi

# Create database and user
log_info "Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE USER panelx WITH PASSWORD 'CHANGE_THIS_PASSWORD';" 2>/dev/null || log_warning "PostgreSQL user already exists"
sudo -u postgres psql -c "CREATE DATABASE panelx OWNER panelx;" 2>/dev/null || log_warning "PostgreSQL database already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE panelx TO panelx;" 2>/dev/null
log_success "PostgreSQL database configured"

# Clone repository or copy files
log_info "Setting up application files..."
if [ ! -d "$INSTALL_DIR/webapp" ]; then
    mkdir -p $INSTALL_DIR
    cd $INSTALL_DIR
    
    # If running from the repo, copy files
    if [ -d "/tmp/panelx-install" ]; then
        cp -r /tmp/panelx-install/* ./webapp/
    else
        log_info "Please copy your application files to $INSTALL_DIR/webapp/"
        log_info "Or clone from GitHub:"
        log_info "git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git $INSTALL_DIR/webapp"
    fi
    
    chown -R $APP_USER:$APP_USER $INSTALL_DIR
else
    log_warning "Application directory already exists"
fi

# Install application dependencies
if [ -d "$INSTALL_DIR/webapp" ]; then
    log_info "Installing application dependencies..."
    cd $INSTALL_DIR/webapp
    sudo -u $APP_USER npm install --production
    log_success "Dependencies installed"
    
    # Build client
    log_info "Building React frontend..."
    sudo -u $APP_USER npm run build:client 2>/dev/null || log_warning "Client build failed or script not found"
fi

# Create .env file
log_info "Creating .env file..."
cat > $INSTALL_DIR/webapp/.env << EOF
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://panelx:CHANGE_THIS_PASSWORD@localhost:5432/panelx
SESSION_SECRET=$(openssl rand -hex 32)
COOKIE_SECURE=false
EOF
chown $APP_USER:$APP_USER $INSTALL_DIR/webapp/.env
log_success ".env file created (remember to update DATABASE_URL password)"

# Create logs directory
mkdir -p $INSTALL_DIR/webapp/logs
chown -R $APP_USER:$APP_USER $INSTALL_DIR/webapp/logs

# Run database migrations
if [ -f "$INSTALL_DIR/webapp/package.json" ]; then
    log_info "Running database migrations..."
    cd $INSTALL_DIR/webapp
    sudo -u $APP_USER npm run db:push 2>/dev/null || log_warning "Database migration failed or script not found"
fi

# Configure Nginx
log_info "Configuring Nginx..."
if [ -f "$INSTALL_DIR/webapp/nginx.conf" ]; then
    cp $INSTALL_DIR/webapp/nginx.conf /etc/nginx/sites-available/panelx
    
    # Update server_name with actual IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    sed -i "s/your-domain.com/$SERVER_IP/g" /etc/nginx/sites-available/panelx
    
    # Enable site
    ln -sf /etc/nginx/sites-available/panelx /etc/nginx/sites-enabled/
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx config
    nginx -t
    systemctl restart nginx
    systemctl enable nginx
    log_success "Nginx configured"
else
    log_warning "Nginx config file not found"
fi

# Start application with PM2
log_info "Starting application with PM2..."
cd $INSTALL_DIR/webapp
sudo -u $APP_USER pm2 start ecosystem.production.cjs
sudo -u $APP_USER pm2 save
pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
log_success "Application started"

# Configure firewall
log_info "Configuring firewall..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw status
log_success "Firewall configured"

# Create systemd service for PM2
log_info "Creating systemd service..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER

# Installation complete
log_success "========================================="
log_success "Installation Complete!"
log_success "========================================="
echo ""
log_info "Next Steps:"
echo "  1. Update database password in: $INSTALL_DIR/webapp/.env"
echo "  2. Access your panel at: http://$SERVER_IP"
echo "  3. Admin dashboard: http://$SERVER_IP/admin"
echo "  4. Check logs: pm2 logs panelx-production"
echo "  5. Monitor: pm2 monit"
echo ""
log_info "Commands:"
echo "  pm2 status              - Check application status"
echo "  pm2 restart all         - Restart application"
echo "  pm2 logs               - View logs"
echo "  systemctl status nginx  - Check Nginx status"
echo ""
log_warning "Security Reminders:"
echo "  - Change the PostgreSQL password in .env"
echo "  - Set up SSL certificate with Let's Encrypt"
echo "  - Configure your domain name"
echo "  - Review and update SESSION_SECRET"
echo ""
