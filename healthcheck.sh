#!/bin/bash
###############################################################################
# PanelX Health Check Script
# 
# Monitors application health and sends alerts if issues detected
###############################################################################

# Configuration
API_URL="http://localhost:3000"
HEALTHCHECK_INTERVAL=60  # seconds
MAX_FAILURES=3

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Health check function
check_health() {
    local failures=0
    
    # Check 1: HTTP endpoint
    if ! curl -sf "$API_URL" > /dev/null 2>&1; then
        log_error "❌ HTTP endpoint unreachable"
        ((failures++))
    else
        log_info "✅ HTTP endpoint OK"
    fi
    
    # Check 2: PM2 process
    if ! pm2 list | grep -q "webapp.*online"; then
        log_error "❌ PM2 process not running"
        ((failures++))
    else
        log_info "✅ PM2 process running"
    fi
    
    # Check 3: Port 3000 listening
    if ! netstat -tuln 2>/dev/null | grep -q ":3000"; then
        log_error "❌ Port 3000 not listening"
        ((failures++))
    else
        log_info "✅ Port 3000 listening"
    fi
    
    # Check 4: Memory usage
    local mem_usage=$(pm2 jlist 2>/dev/null | jq '.[0].monit.memory' 2>/dev/null || echo 0)
    local mem_mb=$((mem_usage / 1024 / 1024))
    if [ "$mem_mb" -gt 2048 ]; then
        log_warn "⚠️  High memory usage: ${mem_mb}MB"
    else
        log_info "✅ Memory usage OK: ${mem_mb}MB"
    fi
    
    # Check 5: CPU usage
    local cpu_usage=$(pm2 jlist 2>/dev/null | jq '.[0].monit.cpu' 2>/dev/null || echo 0)
    if [ "$cpu_usage" -gt 80 ]; then
        log_warn "⚠️  High CPU usage: ${cpu_usage}%"
    else
        log_info "✅ CPU usage OK: ${cpu_usage}%"
    fi
    
    return $failures
}

# Main monitoring loop
if [ "$1" = "monitor" ]; then
    log_info "🔍 Starting continuous health monitoring..."
    log_info "Interval: ${HEALTHCHECK_INTERVAL}s"
    
    consecutive_failures=0
    
    while true; do
        echo ""
        log_info "Running health check..."
        
        if check_health; then
            consecutive_failures=0
        else
            ((consecutive_failures++))
            log_error "Health check failed (${consecutive_failures}/${MAX_FAILURES})"
            
            if [ "$consecutive_failures" -ge "$MAX_FAILURES" ]; then
                log_error "🚨 MAX FAILURES REACHED - SERVICE MAY BE DOWN!"
                # Add notification logic here (email, webhook, etc.)
                
                # Attempt auto-restart
                log_info "Attempting automatic restart..."
                pm2 restart webapp
                sleep 10
                
                if check_health; then
                    log_info "✅ Auto-restart successful"
                    consecutive_failures=0
                else
                    log_error "❌ Auto-restart failed - manual intervention required"
                fi
            fi
        fi
        
        sleep "$HEALTHCHECK_INTERVAL"
    done
else
    # Single health check
    log_info "Running one-time health check..."
    echo ""
    
    if check_health; then
        echo ""
        log_info "✅ All checks passed - system healthy"
        exit 0
    else
        echo ""
        log_error "❌ Some checks failed - investigate immediately"
        exit 1
    fi
fi
