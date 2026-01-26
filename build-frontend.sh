#!/bin/bash

################################################################################
# PanelX V3.0.0 PRO - Frontend Build Script
# Run this if the frontend wasn't built during installation
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║          PanelX V3.0.0 PRO - Frontend Builder                 ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

PROJECT_DIR="/home/panelx/webapp"

# Check if we're in the right directory
if [ ! -d "$PROJECT_DIR" ]; then
    log_error "Project directory not found: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    log_error "package.json not found!"
    exit 1
fi

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
    log_info "Installing dependencies first..."
    sudo -u panelx npm install
fi

# Clean previous build
log_info "Cleaning previous build..."
sudo -u panelx rm -rf dist 2>/dev/null || true
sudo -u panelx rm -rf node_modules/.vite 2>/dev/null || true

# Build frontend
log_info "Building React frontend..."
log_info "This may take 3-5 minutes, please wait..."
echo ""

sudo -u panelx bash -c "cd $PROJECT_DIR && NODE_OPTIONS='--max-old-space-size=4096' npm run build"

echo ""

# Verify build
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    BUILD_SIZE=$(du -sh dist | cut -f1)
    log_info "✅ Frontend built successfully!"
    log_info "Build size: $BUILD_SIZE"
    log_info "Build location: $PROJECT_DIR/dist"
    echo ""
    
    # Restart backend
    log_info "Restarting backend to serve new frontend..."
    sudo -u panelx pm2 restart panelx 2>/dev/null || log_warn "Could not restart PM2 (may not be running)"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Frontend is ready!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Access your admin panel at: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
    echo ""
    echo "You should now see:"
    echo "  ✓ Sidebar navigation"
    echo "  ✓ All 60+ admin pages"
    echo "  ✓ Full functionality"
    echo ""
else
    log_error "Build failed! Check the output above for errors."
    exit 1
fi
