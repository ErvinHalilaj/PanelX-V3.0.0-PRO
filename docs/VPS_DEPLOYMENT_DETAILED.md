# Complete VPS Deployment Guide - PanelX V3.0.0 PRO

## Part 1: Getting Your VPS Ready

### Step 1.1: Create VPS on Hetzner (Recommended)

1. **Go to Hetzner Cloud Console**
   - Visit: https://console.hetzner.cloud/
   - Sign up if you don't have an account
   - Verify your email

2. **Create a New Project**
   - Click "New Project"
   - Name it: `PanelX-Production`

3. **Add a Server**
   - Click "Add Server"
   - Location: Choose closest to your users (e.g., Nuremberg for EU, Ashburn for US)
   - Image: **Ubuntu 22.04**
   - Type: **CPX21** (4GB RAM, 3 vCPU, 80GB) - €4.51/mo
   - Networking: Keep defaults
   - SSH Keys: Add your SSH public key (or create password-based access)
   - Name: `panelx-server`
   - Click "Create & Buy Now"

4. **Note Your Server IP**
   - Once created, copy the IPv4 address
   - Example: `123.45.67.89`

### Step 1.2: Connect to Your VPS

**On Linux/Mac:**
```bash
ssh root@123.45.67.89
# Enter password if you didn't use SSH keys
```

**On Windows:**
- Use PuTTY: https://www.putty.org/
- Or use Windows Terminal with SSH:
```bash
ssh root@123.45.67.89
```

**First Login:**
```bash
# You should see:
# root@panelx-server:~#

# Update system
apt update && apt upgrade -y
```

---

## Part 2: Automated Installation (Easiest Method)

### Step 2.1: Clone the Repository

```bash
# Install git if not present
apt install -y git

# Clone PanelX repository
cd /root
git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git
cd PanelX-V3.0.0-PRO

# Make installer executable
chmod +x install-vps.sh

# List files to verify
ls -la
```

### Step 2.2: Run the Automated Installer

```bash
# Run the installer (takes 5-10 minutes)
./install-vps.sh
```

**What the installer does:**
1. ✅ Installs Node.js 20.x
2. ✅ Installs PostgreSQL 15
3. ✅ Installs Nginx web server
4. ✅ Installs FFmpeg for streaming
5. ✅ Installs PM2 process manager
6. ✅ Creates PostgreSQL database
7. ✅ Installs project dependencies
8. ✅ Builds React frontend (this will work with VPS memory!)
9. ✅ Configures firewall (ports 22, 80, 443, 5000)
10. ✅ Sets up auto-start on boot

**Installation Output (example):**
```
[INFO] Installing Node.js 20.x...
[INFO] Installing PostgreSQL 15...
[INFO] Creating database 'panelx'...
[INFO] Installing project dependencies...
[INFO] Building frontend... (this may take 2-3 minutes)
[SUCCESS] Build completed successfully!
[INFO] Starting PanelX with PM2...
[SUCCESS] PanelX is now running!

===========================================
PanelX V3.0.0 PRO Installation Complete!
===========================================

Access your panel at: http://123.45.67.89

Next steps:
1. Configure .env file
2. Set SESSION_SECRET
3. (Optional) Configure domain
===========================================
```

### Step 2.3: Configure Environment Variables

```bash
# Edit .env file
cd /home/panelx/webapp
nano .env
```

**Update these values:**
```env
# Database (already set by installer)
DATABASE_URL=postgresql://panelx:panelx_password_123@localhost:5432/panelx

# Server
PORT=5000
NODE_ENV=production

# Security - IMPORTANT: Change this!
SESSION_SECRET=change-this-to-a-random-secret-key-minimum-32-characters

# Cookies (set to true if using HTTPS)
COOKIE_SECURE=false

# Optional: TMDB API for movie metadata
TMDB_API_KEY=your-tmdb-api-key-here
```

**Generate a secure SESSION_SECRET:**
```bash
# Generate random secret
openssl rand -hex 32
# Copy the output and paste it as SESSION_SECRET
```

**Save and exit:**
- Press `Ctrl+X`
- Press `Y` to confirm
- Press `Enter` to save

### Step 2.4: Restart Services

```bash
# Restart PM2 services to load new .env
sudo -u panelx pm2 restart all

# Check status
sudo -u panelx pm2 status

# You should see:
# │ id │ name   │ status  │ cpu │ memory │
# │ 0  │ panelx │ online  │ 0%  │ 120 MB │
```

### Step 2.5: Verify Installation

```bash
# Test backend API
curl http://localhost:5000/api/stats

# Should return JSON:
# {"totalUsers":0,"totalLines":0,"activeConnections":0,...}

# Check if Nginx is running
systemctl status nginx

# Check if PostgreSQL is running
systemctl status postgresql
```

---

## Part 3: Accessing Your Admin Panel

### Step 3.1: Open in Browser

1. **Go to:** `http://123.45.67.89` (use your actual VPS IP)

2. **You should see:**
   - 🎨 Beautiful modern admin panel UI
   - 📊 Dashboard with charts
   - 📋 60 admin pages accessible via sidebar

3. **If you see a blank page:**
   - Check browser console (F12)
   - Check PM2 logs: `pm2 logs panelx`
   - Verify build completed: `ls -la /home/panelx/webapp/dist/public/`

### Step 3.2: Create First Admin User

```bash
# SSH to your VPS
ssh root@123.45.67.89

# Create admin user via API
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "YourSecurePassword123!",
    "email": "admin@yourdomain.com",
    "role": "admin"
  }'

# You should get a response with the created user
```

### Step 3.3: Login

1. Go to login page (if implemented)
2. Or access admin panel directly
3. All 60 pages should be accessible

---

## Part 4: Domain Configuration (Optional but Recommended)

### Step 4.1: Point Domain to VPS

**In your domain registrar (Namecheap, GoDaddy, etc.):**

1. **Add A Record:**
   - Type: `A`
   - Name: `panel` (or `@` for root domain)
   - Value: `123.45.67.89` (your VPS IP)
   - TTL: `300` (5 minutes)

2. **Wait for DNS propagation:**
   - Usually 5-30 minutes
   - Test: `ping panel.yourdomain.com`

### Step 4.2: Configure Nginx for Domain

```bash
# Edit Nginx config
nano /etc/nginx/sites-available/panelx
```

**Update server_name:**
```nginx
server {
    listen 80;
    server_name panel.yourdomain.com;  # <-- Change this
    
    # ... rest of config stays the same
}
```

**Save and restart Nginx:**
```bash
nginx -t  # Test config
systemctl restart nginx
```

### Step 4.3: Install SSL Certificate (HTTPS)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate (automatic)
certbot --nginx -d panel.yourdomain.com

# Follow prompts:
# 1. Enter email address
# 2. Agree to terms
# 3. Choose: Redirect HTTP to HTTPS (option 2)

# Certbot will:
# - Get free SSL certificate
# - Configure Nginx automatically
# - Set up auto-renewal
```

**Update .env for HTTPS:**
```bash
nano /home/panelx/webapp/.env

# Change:
COOKIE_SECURE=true

# Save and restart
sudo -u panelx pm2 restart all
```

**Access panel with HTTPS:**
- `https://panel.yourdomain.com` ✅

---

## Part 5: Manual Installation (Alternative Method)

If the automated installer doesn't work, here's the manual step-by-step:

### Step 5.1: Install Node.js 20

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Install Node.js
apt-get install -y nodejs

# Verify
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### Step 5.2: Install PostgreSQL 15

```bash
# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Start service
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE panelx;
CREATE USER panelx WITH ENCRYPTED PASSWORD 'panelx_password_123';
GRANT ALL PRIVILEGES ON DATABASE panelx TO panelx;
ALTER DATABASE panelx OWNER TO panelx;
\q
EOF

# Verify
sudo -u postgres psql -c "\l" | grep panelx
```

### Step 5.3: Install Nginx

```bash
# Install Nginx
apt install -y nginx

# Start service
systemctl start nginx
systemctl enable nginx

# Verify
curl http://localhost
# Should show Nginx welcome page
```

### Step 5.4: Install FFmpeg

```bash
# Install FFmpeg
apt install -y ffmpeg

# Verify
ffmpeg -version
```

### Step 5.5: Install PM2

```bash
# Install PM2 globally
npm install -g pm2

# Verify
pm2 --version
```

### Step 5.6: Create User and Clone Repository

```bash
# Create user
useradd -m -s /bin/bash panelx

# Clone repository
cd /home/panelx
git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git webapp
chown -R panelx:panelx webapp

# Switch to panelx user
su - panelx
cd webapp
```

### Step 5.7: Install Dependencies

```bash
# Install all dependencies
npm install

# This will take 2-3 minutes
```

### Step 5.8: Create .env File

```bash
cat > .env << 'EOF'
DATABASE_URL=postgresql://panelx:panelx_password_123@localhost:5432/panelx
PORT=5000
NODE_ENV=production
SESSION_SECRET=change-this-to-a-random-secret-key-minimum-32-characters
COOKIE_SECURE=false
EOF

# Generate secure secret
SESSION_SECRET=$(openssl rand -hex 32)
sed -i "s/change-this-to-a-random-secret-key-minimum-32-characters/$SESSION_SECRET/" .env
```

### Step 5.9: Build Frontend

```bash
# Build React frontend
npm run build

# This will take 2-3 minutes
# Should complete successfully with 4GB RAM

# Verify build
ls -lh dist/public/
# Should show index.html, assets/, favicon.png
```

### Step 5.10: Configure Nginx

```bash
# Exit from panelx user
exit

# Copy Nginx config
cp /home/panelx/webapp/nginx.conf /etc/nginx/sites-available/panelx

# Update server IP
sed -i "s/your_server_ip/$(hostname -I | awk '{print $1}')/" /etc/nginx/sites-available/panelx

# Enable site
ln -s /etc/nginx/sites-available/panelx /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test config
nginx -t

# Restart Nginx
systemctl restart nginx
```

### Step 5.11: Start Application with PM2

```bash
# Switch to panelx user
su - panelx
cd webapp

# Start with PM2
pm2 start ecosystem.production.cjs

# Save PM2 process list
pm2 save

# Exit panelx user
exit

# Setup PM2 startup script (as root)
env PATH=$PATH:/usr/bin pm2 startup systemd -u panelx --hp /home/panelx
```

### Step 5.12: Configure Firewall

```bash
# Allow SSH
ufw allow 22/tcp

# Allow HTTP
ufw allow 80/tcp

# Allow HTTPS
ufw allow 443/tcp

# Allow application port
ufw allow 5000/tcp

# Enable firewall
ufw --force enable

# Check status
ufw status
```

---

## Part 6: Testing and Verification

### Step 6.1: Check All Services

```bash
# Check PM2 status
sudo -u panelx pm2 status

# Check Nginx
systemctl status nginx

# Check PostgreSQL
systemctl status postgresql

# Check application logs
sudo -u panelx pm2 logs panelx --nostream | tail -20
```

### Step 6.2: Test API Endpoints

```bash
# Health check
curl http://localhost:5000/api/stats

# Should return:
# {"totalUsers":0,"totalLines":0,"activeConnections":0,...}

# Test through Nginx
curl http://$(hostname -I | awk '{print $1}')/api/stats
```

### Step 6.3: Test Frontend

```bash
# Check if index.html is served
curl -I http://$(hostname -I | awk '{print $1}')

# Should return:
# HTTP/1.1 200 OK
# Content-Type: text/html
```

### Step 6.4: Browser Testing

1. **Open browser:** `http://your-vps-ip`

2. **You should see:**
   - Modern admin panel interface
   - Sidebar with 60+ pages
   - Dashboard with charts
   - Responsive design

3. **Test navigation:**
   - Click "Dashboard" - should load real-time stats
   - Click "Streams" - should show stream management
   - Click "Users" - should show user management
   - All 60 pages should be accessible

---

## Part 7: Production Optimization

### Step 7.1: Enable PM2 Cluster Mode

```bash
# Edit PM2 config
nano /home/panelx/webapp/ecosystem.production.cjs
```

**Update for cluster mode:**
```javascript
module.exports = {
  apps: [{
    name: 'panelx',
    script: 'tsx',
    args: 'server/index.ts',
    instances: 'max',  // <-- Use all CPU cores
    exec_mode: 'cluster',  // <-- Enable cluster mode
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    max_memory_restart: '1G',
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

**Restart:**
```bash
sudo -u panelx pm2 restart panelx
sudo -u panelx pm2 save
```

### Step 7.2: Setup Log Rotation

```bash
# Install PM2 logrotate module
sudo -u panelx pm2 install pm2-logrotate

# Configure
sudo -u panelx pm2 set pm2-logrotate:max_size 10M
sudo -u panelx pm2 set pm2-logrotate:retain 7
sudo -u panelx pm2 set pm2-logrotate:compress true
```

### Step 7.3: Setup Monitoring

```bash
# Install PM2 Plus (optional)
sudo -u panelx pm2 plus

# Or use basic monitoring
sudo -u panelx pm2 monit
```

### Step 7.4: Database Optimization

```bash
# Tune PostgreSQL
nano /etc/postgresql/15/main/postgresql.conf

# Add/update these settings:
shared_buffers = 1GB          # 25% of RAM
effective_cache_size = 3GB     # 75% of RAM
maintenance_work_mem = 256MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10MB
min_wal_size = 1GB
max_wal_size = 4GB

# Restart PostgreSQL
systemctl restart postgresql
```

### Step 7.5: Setup Automatic Backups

```bash
# Create backup script
cat > /home/panelx/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/panelx/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
sudo -u postgres pg_dump panelx | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C /home/panelx webapp

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /home/panelx/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add this line:
0 2 * * * /home/panelx/backup.sh >> /home/panelx/backup.log 2>&1
```

---

## Part 8: Troubleshooting

### Issue 1: Frontend Shows Blank Page

**Check browser console (F12):**
```
Error: Failed to load module script
```

**Solution:**
```bash
# Verify build files exist
ls -la /home/panelx/webapp/dist/public/

# Should show:
# - index.html
# - assets/ (with .js and .css files)
# - favicon.png

# If missing, rebuild:
cd /home/panelx/webapp
sudo -u panelx npm run build
```

### Issue 2: API Returns 502 Bad Gateway

**Check if backend is running:**
```bash
sudo -u panelx pm2 status

# If stopped:
sudo -u panelx pm2 restart panelx
```

### Issue 3: Database Connection Error

**Check PostgreSQL:**
```bash
systemctl status postgresql

# Test connection
sudo -u postgres psql -c "SELECT version();"

# Verify database exists
sudo -u postgres psql -c "\l" | grep panelx
```

**Check .env DATABASE_URL:**
```bash
cat /home/panelx/webapp/.env | grep DATABASE_URL

# Should be:
# DATABASE_URL=postgresql://panelx:panelx_password_123@localhost:5432/panelx
```

### Issue 4: Port 5000 Already in Use

```bash
# Find what's using the port
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or change port in .env
echo "PORT=8000" >> /home/panelx/webapp/.env
sudo -u panelx pm2 restart panelx
```

### Issue 5: Build Fails with Out of Memory

**Increase swap:**
```bash
# Create 4GB swap file
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Verify
free -h
```

**Build with more memory:**
```bash
cd /home/panelx/webapp
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

---

## Part 9: Maintenance

### Daily Tasks

```bash
# Check service status
sudo -u panelx pm2 status

# View recent logs
sudo -u panelx pm2 logs panelx --lines 50
```

### Weekly Tasks

```bash
# Update system packages
apt update && apt upgrade -y

# Check disk space
df -h

# Check backups
ls -lh /home/panelx/backups/
```

### Monthly Tasks

```bash
# Update Node.js dependencies
cd /home/panelx/webapp
sudo -u panelx npm update

# Rebuild application
sudo -u panelx npm run build
sudo -u panelx pm2 restart panelx

# Optimize database
sudo -u postgres psql panelx -c "VACUUM ANALYZE;"
```

---

## Part 10: Scaling and Performance

### Vertical Scaling (Upgrade VPS)

**When to upgrade:**
- CPU usage consistently > 80%
- RAM usage > 90%
- Response times > 500ms

**Upgrade path:**
- 4GB → 8GB (Hetzner CPX31: €9.51/mo)
- 8GB → 16GB (Hetzner CPX41: €20.42/mo)

### Horizontal Scaling (Multiple Servers)

**Setup load balancer:**
1. Deploy PanelX on 2+ VPS servers
2. Setup PostgreSQL replication
3. Use Nginx as load balancer
4. Use shared Redis for sessions

### CDN Integration

**For static assets:**
```bash
# Upload dist/public/ to Cloudflare, AWS S3, or similar
# Update Nginx to serve assets from CDN
```

---

## Summary

You've successfully deployed PanelX V3.0.0 PRO! 🎉

**What you have now:**
- ✅ Complete IPTV admin panel running on VPS
- ✅ 60 admin pages accessible
- ✅ 445+ API endpoints functional
- ✅ PostgreSQL database configured
- ✅ Nginx reverse proxy with SSL
- ✅ PM2 process manager with auto-restart
- ✅ Automatic backups configured
- ✅ Production-ready setup

**Access your panel:**
- HTTP: `http://your-vps-ip`
- HTTPS: `https://panel.yourdomain.com` (if configured)

**Support:**
- Documentation: All .md files in repository
- Issues: https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO/issues

---

**🎯 Next Steps:**
1. Create admin users
2. Configure IPTV streams
3. Add EPG sources
4. Setup servers
5. Invite users

Enjoy your new professional IPTV panel! 🚀
