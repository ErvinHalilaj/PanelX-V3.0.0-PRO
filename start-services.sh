#!/bin/bash

# Quick fix for PM2 path issue and start services

echo "=== Fixing PM2 and Starting Services ==="
echo ""

# Find where PM2 is installed
PM2_PATH=$(which pm2 2>/dev/null || find /usr -name pm2 2>/dev/null | head -1)

if [ -z "$PM2_PATH" ]; then
    echo "Installing PM2..."
    npm install -g pm2
    PM2_PATH=$(which pm2)
fi

echo "PM2 found at: $PM2_PATH"

# Go to project
cd /home/panelx/webapp || exit 1

# Start with PM2
echo "Starting application..."
sudo -u panelx $PM2_PATH delete panelx 2>/dev/null || true
sudo -u panelx $PM2_PATH start ecosystem.config.cjs
sudo -u panelx $PM2_PATH save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u panelx --hp /home/panelx

echo ""
echo "Waiting for backend to start..."
sleep 5

# Get server IP
SERVER_IP=$(curl -s ifconfig.me || echo "69.169.102.47")

echo ""
echo "============================================"
echo "     ✅ SERVICES STARTED! ✅"
echo "============================================"
echo ""
echo "📊 Service Status:"
sudo -u panelx $PM2_PATH list
echo ""
echo "🔍 Backend Test:"
curl -s http://localhost:5000/api/stats 2>&1 | head -10 || echo "⚠️  Backend starting (may take 30 seconds)..."
echo ""
echo "🔥 Firewall Status:"
sudo ufw status | grep -E "80|443"
echo ""
echo "🌐 ACCESS YOUR PANEL:"
echo ""
echo "   🌍 http://$SERVER_IP"
echo ""
echo "============================================"
echo ""
echo "📝 Management Commands:"
echo "   View logs:    sudo -u panelx pm2 logs panelx"
echo "   Restart:      sudo -u panelx pm2 restart panelx"
echo "   Stop:         sudo -u panelx pm2 stop panelx"
echo "   Status:       sudo -u panelx pm2 list"
echo ""
echo "⏰ Note: Backend may take 30-60 seconds to fully start"
echo "   If you get connection errors, wait 1 minute then refresh"
echo ""
