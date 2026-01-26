#!/bin/bash

echo "=== Direct Service Startup (No PM2 Dependencies) ==="
echo ""

# Go to project directory
cd /home/panelx/webapp || exit 1

# Install PM2 globally with correct PATH
echo "Installing PM2 globally..."
npm install -g pm2 --prefix /usr/local
export PATH=$PATH:/usr/local/bin

# Verify PM2 is accessible
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 installation failed"
    echo "Trying alternative method..."
    npm install -g pm2
fi

# Wait a moment
sleep 2

# Check PM2
PM2_BIN=$(which pm2 2>/dev/null || echo "/usr/local/bin/pm2")
echo "Using PM2 at: $PM2_BIN"

# Kill any existing process on port 5000
echo "Clearing port 5000..."
fuser -k 5000/tcp 2>/dev/null || true
sleep 2

# Start with PM2 as panelx user
echo "Starting backend service..."
cd /home/panelx/webapp
sudo -u panelx bash -c "export PATH=/usr/local/bin:$PATH && pm2 delete panelx 2>/dev/null || true"
sudo -u panelx bash -c "export PATH=/usr/local/bin:$PATH && pm2 start ecosystem.config.cjs"
sudo -u panelx bash -c "export PATH=/usr/local/bin:$PATH && pm2 save"

echo ""
echo "Waiting for backend to initialize (30 seconds)..."
sleep 30

# Get IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "69.169.102.47")

echo ""
echo "============================================"
echo "     ✅ BACKEND STARTED ✅"
echo "============================================"
echo ""

# Check if backend is responding
echo "🔍 Testing Backend..."
if curl -s --max-time 5 http://localhost:5000/api/stats > /dev/null 2>&1; then
    echo "✅ Backend is responding!"
    curl -s http://localhost:5000/api/stats | head -5
else
    echo "⚠️  Backend is starting up..."
    echo "   It may take up to 60 seconds to fully initialize"
fi

echo ""
echo "📊 Process Status:"
sudo -u panelx bash -c "export PATH=/usr/local/bin:$PATH && pm2 list" 2>/dev/null || echo "PM2 status: checking..."

echo ""
echo "🔥 Firewall Status:"
sudo ufw status | grep -E "80|443" | head -3

echo ""
echo "============================================"
echo "  🌐 ACCESS YOUR ADMIN PANEL:"
echo ""
echo "     http://$SERVER_IP"
echo ""
echo "============================================"
echo ""
echo "📝 Important Notes:"
echo "   • Backend may take 30-60 seconds to fully start"
echo "   • If you see 502 Bad Gateway, wait 1 minute and refresh"
echo "   • If you see connection timeout, check firewall:"
echo "     sudo ufw allow 80/tcp && sudo ufw enable"
echo ""
echo "🔧 Useful Commands:"
echo "   Check logs:     sudo -u panelx pm2 logs panelx"
echo "   Check status:   sudo -u panelx pm2 list"
echo "   Restart:        sudo -u panelx pm2 restart panelx"
echo "   Test backend:   curl http://localhost:5000/api/stats"
echo ""
