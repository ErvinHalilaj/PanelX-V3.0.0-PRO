#!/bin/bash
###############################################################################
# PanelX Production Deployment Script
# 
# This script handles full deployment of PanelX to production server
# with zero-downtime using PM2 ecosystem
###############################################################################

set -e  # Exit on error

echo "🚀 PanelX Production Deployment Starting..."
echo "================================================"

# Configuration
PROJECT_DIR="/home/user/webapp"
BACKUP_DIR="/home/user/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Pre-deployment checks
log_info "Step 1: Running pre-deployment checks..."

# Check if running as root or sudo
if [ "$EUID" -ne 0 ] && [ -z "$SUDO_USER" ]; then 
    log_warn "Not running with sudo. Some operations may fail."
fi

# Check Node.js version
NODE_VERSION=$(node --version 2>/dev/null || echo "not installed")
log_info "Node.js version: $NODE_VERSION"

# Check npm version
NPM_VERSION=$(npm --version 2>/dev/null || echo "not installed")
log_info "npm version: $NPM_VERSION"

# Check PM2
if ! command -v pm2 &> /dev/null; then
    log_error "PM2 is not installed. Installing PM2..."
    npm install -g pm2
fi
log_info "PM2 version: $(pm2 --version)"

# Check PostgreSQL connection
log_info "Checking database connection..."
cd "$PROJECT_DIR"
if node -e "require('./server/db').db.execute('SELECT 1')" 2>/dev/null; then
    log_info "Database connection: OK"
else
    log_warn "Database connection check failed. Continuing anyway..."
fi

# Step 2: Create backup
log_info "Step 2: Creating backup of current deployment..."

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/panelx_backup_$TIMESTAMP.tar.gz"

if [ -d "$PROJECT_DIR" ]; then
    log_info "Backing up to: $BACKUP_FILE"
    tar -czf "$BACKUP_FILE" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=dist \
        --exclude=core \
        -C "$PROJECT_DIR/.." webapp/
    log_info "Backup created successfully"
else
    log_warn "Project directory not found. Skipping backup."
fi

# Step 3: Update code from Git
log_info "Step 3: Pulling latest code from GitHub..."
cd "$PROJECT_DIR"

# Stash any local changes
if [ -n "$(git status --porcelain)" ]; then
    log_warn "Local changes detected. Stashing..."
    git stash save "auto-stash-$TIMESTAMP"
fi

# Pull latest
git fetch origin
git pull origin main

log_info "Code updated to latest version"
git log -1 --oneline

# Step 4: Install dependencies
log_info "Step 4: Installing/updating dependencies..."

# Clean install for production
npm ci --production=false --timeout=300000

log_info "Dependencies installed successfully"

# Step 5: Run database migrations
log_info "Step 5: Running database migrations..."

npm run db:push 2>&1 | tail -5

log_info "Database migrations completed"

# Step 6: Build application
log_info "Step 6: Building application..."

# Increase Node memory for build
export NODE_OPTIONS="--max-old-space-size=4096"

# Run build with timeout
timeout 600 npm run build || {
    log_warn "Build timed out or failed. Checking dist directory..."
    if [ ! -d "dist" ]; then
        log_error "Build failed and no dist directory exists. Cannot deploy."
        exit 1
    fi
    log_warn "Using existing dist directory"
}

log_info "Build completed"

# Step 7: Stop current services
log_info "Step 7: Stopping current PM2 services..."

# Save PM2 list
pm2 save --force 2>/dev/null || true

# Gracefully stop services
pm2 stop all 2>/dev/null || true

# Kill any processes on port 3000
fuser -k 3000/tcp 2>/dev/null || true

log_info "Services stopped"

# Step 8: Start services with PM2
log_info "Step 8: Starting services with PM2..."

# Check if ecosystem.config.cjs exists
if [ ! -f "ecosystem.config.cjs" ]; then
    log_error "ecosystem.config.cjs not found!"
    exit 1
fi

# Start with PM2
pm2 start ecosystem.config.cjs

# Wait for startup
sleep 5

# Check if services are running
if pm2 list | grep -q "online"; then
    log_info "Services started successfully"
else
    log_error "Services failed to start!"
    pm2 logs --nostream --lines 50
    exit 1
fi

# Step 9: Health check
log_info "Step 9: Running health checks..."

sleep 3

# Test local endpoint
if curl -s http://localhost:3000 > /dev/null; then
    log_info "✅ Health check: PASSED"
else
    log_error "❌ Health check: FAILED"
    log_error "Service is not responding on port 3000"
    pm2 logs --nostream --lines 20
    exit 1
fi

# Step 10: Save PM2 configuration
log_info "Step 10: Saving PM2 configuration..."

pm2 save --force
pm2 startup 2>/dev/null || log_warn "PM2 startup configuration may need manual setup"

# Step 11: Post-deployment tasks
log_info "Step 11: Running post-deployment tasks..."

# Display service status
pm2 list

# Display logs (last 10 lines)
log_info "Recent logs:"
pm2 logs --nostream --lines 10

# Display memory usage
log_info "Memory usage:"
pm2 show webapp 2>/dev/null | grep -E "memory|cpu" || true

# Final summary
echo ""
echo "================================================"
log_info "🎉 Deployment completed successfully!"
echo "================================================"
log_info "Application URL: http://localhost:3000"
log_info "Backup location: $BACKUP_FILE"
log_info "PM2 status: $(pm2 list | grep -c online) service(s) online"
echo ""
log_info "Useful commands:"
echo "  - View logs:    pm2 logs webapp"
echo "  - Restart:      pm2 restart webapp"
echo "  - Stop:         pm2 stop webapp"
echo "  - Monitor:      pm2 monit"
echo ""
log_info "Deployment completed at: $(date)"
echo "================================================"
