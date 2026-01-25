#!/bin/bash
###############################################################################
# PanelX Rollback Script
# 
# Rolls back to a previous backup in case of deployment failure
###############################################################################

set -e

echo "🔄 PanelX Rollback Script"
echo "================================================"

# Configuration
PROJECT_DIR="/home/user/webapp"
BACKUP_DIR="/home/user/backups"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    log_error "Backup directory not found: $BACKUP_DIR"
    exit 1
fi

# List available backups
log_info "Available backups:"
echo ""
ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null || {
    log_error "No backups found!"
    exit 1
}
echo ""

# Get backup file from argument or prompt
if [ -z "$1" ]; then
    read -p "Enter backup filename to restore (or 'latest' for most recent): " BACKUP_CHOICE
else
    BACKUP_CHOICE="$1"
fi

# Determine backup file
if [ "$BACKUP_CHOICE" = "latest" ]; then
    BACKUP_FILE=$(ls -t "$BACKUP_DIR"/*.tar.gz | head -1)
    log_info "Using latest backup: $(basename $BACKUP_FILE)"
else
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_CHOICE"
fi

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Confirmation
echo ""
log_info "About to restore from: $BACKUP_FILE"
read -p "This will replace current deployment. Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log_info "Rollback cancelled"
    exit 0
fi

# Stop services
log_info "Stopping PM2 services..."
pm2 stop all 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true

# Backup current state (just in case)
log_info "Creating safety backup of current state..."
SAFETY_BACKUP="$BACKUP_DIR/pre_rollback_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$SAFETY_BACKUP" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=dist \
    -C "$PROJECT_DIR/.." webapp/ 2>/dev/null || true

# Remove current deployment
log_info "Removing current deployment..."
cd "$PROJECT_DIR/.."
rm -rf webapp_old 2>/dev/null || true
mv webapp webapp_old 2>/dev/null || true

# Extract backup
log_info "Restoring from backup..."
tar -xzf "$BACKUP_FILE" -C "$PROJECT_DIR/.."

cd "$PROJECT_DIR"

# Reinstall dependencies
log_info "Reinstalling dependencies..."
npm ci --production=false --timeout=300000

# Rebuild
log_info "Rebuilding application..."
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build 2>&1 | tail -10 || log_error "Build failed but continuing..."

# Restart services
log_info "Starting services..."
pm2 start ecosystem.config.cjs
sleep 3

# Health check
if curl -s http://localhost:3000 > /dev/null; then
    log_info "✅ Rollback successful!"
    log_info "Services are running"
    pm2 list
else
    log_error "❌ Rollback failed - service not responding"
    pm2 logs --nostream --lines 20
    exit 1
fi

echo ""
echo "================================================"
log_info "🎉 Rollback completed successfully!"
echo "================================================"
log_info "Restored from: $(basename $BACKUP_FILE)"
log_info "Safety backup: $(basename $SAFETY_BACKUP)"
echo ""
