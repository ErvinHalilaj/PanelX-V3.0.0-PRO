#!/bin/bash

# Check installation status and complete if needed

echo "=== Checking Installation Status ==="
echo ""

# Check if npm install completed
if [ -d "/home/panelx/webapp/node_modules" ]; then
    echo "✅ Node modules installed"
else
    echo "❌ Node modules missing"
fi

# Check if .env exists
if [ -f "/home/panelx/webapp/.env" ]; then
    echo "✅ Configuration file exists"
else
    echo "❌ Configuration file missing"
fi

# Check PM2 status
if command -v pm2 &> /dev/null; then
    echo "✅ PM2 installed"
    sudo -u panelx pm2 list 2>/dev/null || echo "No PM2 processes running"
else
    echo "❌ PM2 not installed"
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx running"
else
    echo "❌ Nginx not running"
fi

# Check PostgreSQL
if systemctl is-active --quiet postgresql; then
    echo "✅ PostgreSQL running"
else
    echo "❌ PostgreSQL not running"
fi

echo ""
echo "=== Completing Installation (Step 10) ==="
echo ""

# Navigate to project
cd /home/panelx/webapp || exit 1

# Create .env if missing
if [ ! -f ".env" ]; then
    echo "Creating .env configuration..."
    SESSION_SECRET=$(openssl rand -base64 32)
    
    sudo -u panelx tee .env > /dev/null <<EOF
DATABASE_URL=postgresql://panelx:panelx123@localhost:5432/panelx
PORT=5000
NODE_ENV=production
HOST=0.0.0.0
SESSION_SECRET=$SESSION_SECRET
COOKIE_SECURE=false
LOG_LEVEL=info
EOF
    chmod 600 .env
    echo "✅ Configuration created"
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2 >/dev/null 2>&1
    echo "✅ PM2 installed"
fi

# Create PM2 config
echo "Creating PM2 configuration..."
sudo -u panelx tee ecosystem.config.cjs > /dev/null <<'EOF'
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
echo "✅ PM2 config created"

# Start application
echo "Starting application..."
sudo -u panelx pm2 delete panelx 2>/dev/null || true
sudo -u panelx pm2 start ecosystem.config.cjs
sudo -u panelx pm2 save >/dev/null 2>&1
pm2 startup systemd -u panelx --hp /home/panelx >/dev/null 2>&1
echo "✅ Application started"

sleep 5

# Configure Nginx
echo "Configuring Nginx..."
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
nginx -t
systemctl reload nginx
echo "✅ Nginx configured"

# Configure firewall
echo "Configuring firewall..."
ufw --force enable >/dev/null 2>&1
ufw allow 22/tcp >/dev/null 2>&1
ufw allow 80/tcp >/dev/null 2>&1
ufw allow 443/tcp >/dev/null 2>&1
echo "✅ Firewall configured"

# Get IP
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo "============================================"
echo "     🎉 INSTALLATION COMPLETE! 🎉"
echo "============================================"
echo ""
echo "📊 Service Status:"
sudo -u panelx pm2 list
echo ""
echo "🔍 Backend Test:"
curl -s http://localhost:5000/api/stats 2>&1 | head -5 || echo "Backend starting up..."
echo ""
echo "🌐 Access your panel at:"
echo "   http://$SERVER_IP"
echo ""
echo "📝 Useful Commands:"
echo "   View logs: sudo -u panelx pm2 logs panelx"
echo "   Restart: sudo -u panelx pm2 restart panelx"
echo "   Status: sudo -u panelx pm2 list"
echo ""
echo "============================================"
