# 🔧 Troubleshooting Guide - 500 Internal Server Error

## Problem
You're seeing "500 Internal Server Error" from nginx after installation completed.

## Root Cause
The error indicates that nginx is running but cannot proxy requests to the Express.js backend because:
1. The Node.js application isn't running
2. Database connection failed
3. Missing environment configuration

## ✅ Step-by-Step Fix

### Step 1: Check if Node.js Application is Running

```bash
# Check PM2 processes
pm2 list

# Expected output should show 'panelx' with status 'online'
# If it shows 'stopped' or 'errored', continue to next steps
```

### Step 2: Check Application Logs

```bash
# View PM2 logs to see what went wrong
pm2 logs panelx --lines 50

# Common errors you might see:
# - Database connection error
# - Missing dependencies
# - Port already in use
```

### Step 3: Check Environment Configuration

```bash
# Navigate to project directory
cd /home/panelx/webapp

# Check if .env file exists and has correct values
cat .env

# Should contain:
# DATABASE_URL=postgresql://panelx:password@localhost:5432/panelx
# SESSION_SECRET=your-secret-key
# PORT=5000
```

### Step 4: Fix Database Connection

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# If not running, start it:
sudo systemctl start postgresql

# Test database connection
psql -U panelx -d panelx -c "SELECT 1;"

# If connection fails, check password in .env matches database password
```

### Step 5: Create .env File (if missing)

```bash
cd /home/panelx/webapp

# Create .env file with correct configuration
cat > .env << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://panelx:panelx123@localhost:5432/panelx

# Server Configuration
PORT=5000
NODE_ENV=production

# Security
SESSION_SECRET=$(openssl rand -base64 32)
COOKIE_SECURE=false

# Optional
LOG_LEVEL=info
EOF

# Make sure file has correct permissions
chmod 600 .env
chown panelx:panelx .env
```

### Step 6: Install Missing Dependencies

```bash
cd /home/panelx/webapp

# Install all dependencies
npm install

# Install specific missing packages if needed
npm install bcryptjs cors express-session pg drizzle-orm
```

### Step 7: Restart the Application

```bash
# As panelx user
sudo -u panelx pm2 restart all

# Wait 5 seconds
sleep 5

# Check status again
sudo -u panelx pm2 list
sudo -u panelx pm2 logs panelx --lines 20
```

### Step 8: Test Backend Directly

```bash
# Test if backend is responding on port 5000
curl http://localhost:5000/api/stats

# Expected: JSON response with stats
# If you get "Connection refused", backend isn't running
# If you get JSON, backend is working but nginx config might be wrong
```

### Step 9: Check Nginx Configuration

```bash
# Test nginx configuration
sudo nginx -t

# View nginx error log
sudo tail -50 /var/log/nginx/error.log

# Restart nginx
sudo systemctl restart nginx
```

### Step 10: Fix Nginx Proxy Configuration

If backend is running but nginx still shows 500 error:

```bash
# Edit nginx config
sudo nano /etc/nginx/sites-available/panelx

# Make sure proxy_pass points to correct port:
location /api {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

# Save and test
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## 🚀 Quick Fix Script

Run this all-in-one fix script:

```bash
#!/bin/bash

echo "=== PanelX Troubleshooting Script ==="
echo ""

# 1. Check PostgreSQL
echo "1. Checking PostgreSQL..."
sudo systemctl start postgresql
sleep 2

# 2. Create .env if missing
echo "2. Creating .env file..."
cd /home/panelx/webapp
if [ ! -f .env ]; then
    cat > .env << 'EOF'
DATABASE_URL=postgresql://panelx:panelx123@localhost:5432/panelx
PORT=5000
NODE_ENV=production
SESSION_SECRET=$(openssl rand -base64 32)
COOKIE_SECURE=false
EOF
    chmod 600 .env
    chown panelx:panelx .env
    echo "✅ .env created"
else
    echo "✅ .env exists"
fi

# 3. Install dependencies
echo "3. Installing missing dependencies..."
npm install bcryptjs cors @types/bcryptjs @types/cors 2>&1 | tail -5

# 4. Restart application
echo "4. Restarting application..."
sudo -u panelx pm2 delete all 2>/dev/null || true
sudo -u panelx pm2 start ecosystem.config.cjs
sleep 5

# 5. Check status
echo "5. Checking status..."
sudo -u panelx pm2 list

# 6. Test backend
echo "6. Testing backend..."
curl -s http://localhost:5000/api/stats | head -10

# 7. Restart nginx
echo "7. Restarting nginx..."
sudo systemctl restart nginx

echo ""
echo "=== Troubleshooting Complete ==="
echo "Now try accessing: http://your-server-ip"
```

Save as `fix-panelx.sh`, make executable and run:

```bash
chmod +x fix-panelx.sh
sudo ./fix-panelx.sh
```

## 🎯 Most Common Issues & Solutions

### Issue 1: Database Connection Failed
**Error:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution:**
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Issue 2: Missing bcryptjs Module
**Error:** `Cannot find package 'bcryptjs'`

**Solution:**
```bash
cd /home/panelx/webapp
npm install bcryptjs cors @types/bcryptjs @types/cors
pm2 restart all
```

### Issue 3: Port 5000 Already in Use
**Error:** `EADDRINUSE: address already in use :::5000`

**Solution:**
```bash
# Kill process on port 5000
sudo fuser -k 5000/tcp

# Or change port in .env
echo "PORT=8000" >> .env
pm2 restart all
```

### Issue 4: Permission Denied
**Error:** `EACCES: permission denied`

**Solution:**
```bash
# Fix ownership
sudo chown -R panelx:panelx /home/panelx/webapp
sudo -u panelx pm2 restart all
```

### Issue 5: SESSION_SECRET Not Set
**Error:** `WARNING: SESSION_SECRET not set`

**Solution:**
```bash
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> /home/panelx/webapp/.env
pm2 restart all
```

## 📊 Verification Checklist

After running fixes, verify each component:

```bash
# ✅ PostgreSQL running
sudo systemctl status postgresql | grep "active (running)"

# ✅ Node.js app running
sudo -u panelx pm2 list | grep "online"

# ✅ Backend responding
curl http://localhost:5000/api/stats

# ✅ Nginx running
sudo systemctl status nginx | grep "active (running)"

# ✅ Nginx can reach backend
curl -I http://localhost/api/stats

# ✅ All working
curl http://your-server-ip
```

## 🆘 Still Not Working?

If you're still seeing errors after all these steps:

1. **Share the logs:**
```bash
# Get all relevant logs
echo "=== PM2 Logs ===" > debug.log
pm2 logs panelx --nostream --lines 100 >> debug.log
echo "" >> debug.log
echo "=== Nginx Error Log ===" >> debug.log
sudo tail -100 /var/log/nginx/error.log >> debug.log
echo "" >> debug.log
echo "=== PM2 Status ===" >> debug.log
pm2 list >> debug.log

cat debug.log
```

2. **Check if you have enough RAM:**
```bash
free -h
# Should have at least 2GB free for the application
```

3. **Try running in development mode:**
```bash
cd /home/panelx/webapp
npx tsx server/index.ts
# This will show errors directly in terminal
```

## 💡 Quick Access After Fix

Once everything is running:

- **Admin Panel:** http://your-server-ip
- **API:** http://your-server-ip/api/stats
- **Health Check:** http://your-server-ip/api/health

---

**Need More Help?**
Share the output from:
```bash
pm2 logs panelx --lines 50
sudo tail -50 /var/log/nginx/error.log
```
