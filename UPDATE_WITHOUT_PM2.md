# 🔧 Update PanelX Without PM2

## Your Server Setup
- **Location**: `/opt/panelx`
- **No PM2 installed**: Using different process manager

---

## Step 1: Find How Your Panel is Running

Run these commands to find out:

```bash
# Check if using systemd service
systemctl status panelx

# Or check all running node processes
ps aux | grep node

# Or check if running with supervisor
supervisorctl status

# Or check if running with screen/tmux
screen -ls
# or
tmux ls

# Or check port 5000
lsof -i :5000
# or
netstat -tulpn | grep 5000
```

**Tell me the output of these commands!**

---

## Step 2: Update Based on Your Setup

### Option A: If Using Systemd Service

```bash
# Stop service
sudo systemctl stop panelx

# Navigate to directory
cd /opt/panelx

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build frontend
npm run build

# Start service
sudo systemctl start panelx

# Check status
sudo systemctl status panelx

# Check logs
sudo journalctl -u panelx -f
```

### Option B: If Running Manually (node/npm)

```bash
# Find and kill the process
ps aux | grep node
# Note the PID number
kill <PID>

# Or kill by port
fuser -k 5000/tcp

# Navigate to directory
cd /opt/panelx

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build frontend
npm run build

# Start server manually
nohup npm start > server.log 2>&1 &

# Or
nohup node server/index.js > server.log 2>&1 &

# Check if running
ps aux | grep node
curl http://localhost:5000/api/stats
```

### Option C: If Using Screen/Tmux

```bash
# Attach to screen
screen -r panelx
# or
tmux attach -t panelx

# Inside screen/tmux, press Ctrl+C to stop server

# Navigate to directory
cd /opt/panelx

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build frontend
npm run build

# Start server
npm start

# Detach: Press Ctrl+A then D (screen) or Ctrl+B then D (tmux)
```

---

## Step 3: Install PM2 (Recommended)

PM2 is the best process manager for Node.js. Install it:

```bash
# Install PM2 globally
npm install -g pm2

# Navigate to panelx
cd /opt/panelx

# Create PM2 config
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'panelx',
    script: 'npm',
    args: 'start',
    cwd: '/opt/panelx',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
EOF

# Create logs directory
mkdir -p logs

# Kill any running process
fuser -k 5000/tcp

# Start with PM2
pm2 start ecosystem.config.cjs

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it outputs

# Check status
pm2 status
pm2 logs panelx
```

---

## Quick Update Script (No PM2)

Create this script:

```bash
#!/bin/bash

echo "🔄 Stopping PanelX..."
# Kill process on port 5000
fuser -k 5000/tcp 2>/dev/null
sleep 2

echo "📥 Pulling latest code..."
cd /opt/panelx
git pull origin main

echo "📦 Installing dependencies..."
npm install

echo "🏗️ Building frontend..."
npm run build

echo "🚀 Starting PanelX..."
nohup npm start > server.log 2>&1 &

sleep 5

echo "✅ Checking status..."
ps aux | grep node | grep -v grep
curl -s http://localhost:5000/api/stats | head -5

echo ""
echo "🎉 Update complete!"
echo "Don't forget to clear browser cache (Ctrl+F5)"
```

Save as `/opt/panelx/update.sh`:

```bash
cd /opt/panelx
nano update.sh
# Paste the script above
# Save with Ctrl+X, then Y, then Enter

# Make executable
chmod +x update.sh

# Run it
./update.sh
```

---

## If Build Takes Too Long

### Option 1: Build in Sandbox, Upload to Server

I can build it here and you upload the dist folder:

```bash
# I'll create dist.tar.gz in sandbox
# Then you download and upload to your server

# On your server:
cd /opt/panelx
# Upload dist.tar.gz here, then:
tar -xzf dist.tar.gz
fuser -k 5000/tcp
nohup npm start > server.log 2>&1 &
```

Want me to create the pre-built dist.tar.gz? Say "yes build it"!

---

## After Update

### Verify:

```bash
# Check if running
ps aux | grep node | grep -v grep

# Check port
lsof -i :5000
# or
netstat -tulpn | grep 5000

# Test API
curl http://localhost:5000/api/stats

# Check logs
tail -f /opt/panelx/server.log
```

### In Browser:

1. Clear cache: `Ctrl + Shift + Delete`
2. Hard refresh: `Ctrl + F5`
3. Go to: `http://your-server-ip:5000`
4. Login and test Create Line

---

## What to Tell Me

**Run this and send me the output:**

```bash
cd /opt/panelx

# Check what's running
echo "=== RUNNING PROCESSES ==="
ps aux | grep node | grep -v grep

echo ""
echo "=== PORT 5000 ==="
lsof -i :5000 2>/dev/null || netstat -tulpn | grep 5000

echo ""
echo "=== SYSTEMD SERVICES ==="
systemctl list-units | grep panelx || echo "No systemd service"

echo ""
echo "=== DIRECTORY INFO ==="
pwd
ls -la | grep -E "package.json|ecosystem|dist|server.log"

echo ""
echo "=== CURRENT VERSION ==="
git log --oneline | head -3
```

**Send me the output and I'll give you the exact commands for your setup!**

---

## Quick Questions

1. **How do you normally start/stop the panel?** (command you use)
2. **Is there a service file?** (`systemctl status panelx`)
3. **Should I create pre-built dist.tar.gz for you?** (saves build time)

---

**Status**: Waiting for your server info  
**Next**: Will provide exact commands based on your setup
