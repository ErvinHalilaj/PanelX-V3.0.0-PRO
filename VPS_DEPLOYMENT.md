# 🚀 PanelX V3.0.0 PRO - VPS Deployment Guide

Complete guide for deploying PanelX to a traditional VPS server (Ubuntu/Debian)

---

## 📋 **Table of Contents**

1. [Server Requirements](#server-requirements)
2. [Quick Installation](#quick-installation)
3. [Manual Installation](#manual-installation)
4. [Configuration](#configuration)
5. [SSL Setup](#ssl-setup)
6. [Management Commands](#management-commands)
7. [Troubleshooting](#troubleshooting)

---

## 🖥️ **Server Requirements**

### **Minimum Requirements:**
- **OS**: Ubuntu 20.04/22.04 or Debian 11/12
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 50GB SSD
- **Network**: 100 Mbps

### **Recommended for Production:**
- **OS**: Ubuntu 22.04 LTS
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 100GB+ SSD
- **Network**: 1 Gbps

### **Software Stack:**
- Node.js 20.x
- PostgreSQL 15
- Nginx
- PM2 (process manager)
- FFmpeg (for streaming)

---

## ⚡ **Quick Installation (Automated)**

### **Step 1: Get a VPS**
Recommended providers:
- **Hetzner** - https://www.hetzner.com/cloud
- **DigitalOcean** - https://www.digitalocean.com/
- **Vultr** - https://www.vultr.com/
- **AWS EC2** - https://aws.amazon.com/ec2/
- **Linode** - https://www.linode.com/

### **Step 2: Connect to Your Server**
```bash
ssh root@your-server-ip
```

### **Step 3: Run Installation Script**
```bash
# Download the repository
git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git /tmp/panelx-install

# Run automated installer
cd /tmp/panelx-install
chmod +x install-vps.sh
sudo ./install-vps.sh
```

### **Step 4: Configure**
```bash
# Edit environment variables
nano /home/panelx/webapp/.env

# Update these values:
DATABASE_URL=postgresql://panelx:YOUR_STRONG_PASSWORD@localhost:5432/panelx
SESSION_SECRET=your-random-32-character-string
```

### **Step 5: Restart**
```bash
sudo -u panelx pm2 restart all
```

### **Step 6: Access Your Panel**
```
http://your-server-ip/admin
```

---

## 🔧 **Manual Installation**

### **1. Update System**
```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### **2. Install Node.js 20**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Should show v20.x.x
```

### **3. Install PostgreSQL**
```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### **4. Create Database**
```bash
sudo -u postgres psql
```

In PostgreSQL console:
```sql
CREATE USER panelx WITH PASSWORD 'your_strong_password';
CREATE DATABASE panelx OWNER panelx;
GRANT ALL PRIVILEGES ON DATABASE panelx TO panelx;
\q
```

### **5. Install PM2**
```bash
sudo npm install -g pm2
pm2 install pm2-logrotate
```

### **6. Install Nginx**
```bash
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### **7. Install FFmpeg**
```bash
sudo apt-get install -y ffmpeg
```

### **8. Create Application User**
```bash
sudo useradd -m -s /bin/bash panelx
```

### **9. Deploy Application**
```bash
# Create directory
sudo mkdir -p /home/panelx
sudo chown panelx:panelx /home/panelx

# Clone repository
sudo -u panelx git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git /home/panelx/webapp

# Install dependencies
cd /home/panelx/webapp
sudo -u panelx npm install --production

# Build React frontend
sudo -u panelx npm run build:client
```

### **10. Configure Environment**
```bash
sudo -u panelx nano /home/panelx/webapp/.env
```

Add:
```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://panelx:your_password@localhost:5432/panelx
SESSION_SECRET=$(openssl rand -hex 32)
COOKIE_SECURE=false
```

### **11. Run Database Migrations**
```bash
cd /home/panelx/webapp
sudo -u panelx npm run db:push
```

### **12. Configure Nginx**
```bash
# Copy nginx config
sudo cp /home/panelx/webapp/nginx.conf /etc/nginx/sites-available/panelx

# Update server name with your IP
SERVER_IP=$(hostname -I | awk '{print $1}')
sudo sed -i "s/your-domain.com/$SERVER_IP/g" /etc/nginx/sites-available/panelx

# Enable site
sudo ln -s /etc/nginx/sites-available/panelx /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart
sudo nginx -t
sudo systemctl restart nginx
```

### **13. Start Application**
```bash
cd /home/panelx/webapp
sudo -u panelx pm2 start ecosystem.production.cjs
sudo -u panelx pm2 save
sudo pm2 startup systemd -u panelx --hp /home/panelx
```

### **14. Configure Firewall**
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable
```

---

## ⚙️ **Configuration**

### **Environment Variables (.env)**

```env
# Server
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://panelx:password@localhost:5432/panelx

# Security
SESSION_SECRET=your-random-32-character-string
COOKIE_SECURE=false  # Set to 'true' with HTTPS

# Optional Features
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
```

### **PM2 Configuration (ecosystem.production.cjs)**

The PM2 config uses cluster mode for better performance:
- Multiple Node.js instances (one per CPU core)
- Automatic restart on crashes
- Log rotation
- Memory limit monitoring

---

## 🔒 **SSL Setup (HTTPS)**

### **Option 1: Let's Encrypt (Free)**

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal is configured automatically
# Test renewal:
sudo certbot renew --dry-run
```

### **Option 2: Cloudflare (Free + CDN)**

1. Add your domain to Cloudflare
2. Point A record to your server IP
3. Enable "Full (strict)" SSL mode
4. Cloudflare handles SSL automatically

### **After SSL Setup**

Update `.env`:
```env
COOKIE_SECURE=true
```

Uncomment HTTPS server block in `/etc/nginx/sites-available/panelx`

Restart:
```bash
sudo systemctl reload nginx
sudo -u panelx pm2 restart all
```

---

## 🎛️ **Management Commands**

### **PM2 Commands**
```bash
# View status
pm2 status

# View logs
pm2 logs panelx-production

# Restart
pm2 restart panelx-production

# Stop
pm2 stop panelx-production

# Monitor in real-time
pm2 monit

# View detailed info
pm2 show panelx-production
```

### **Nginx Commands**
```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# View logs
sudo tail -f /var/log/nginx/panelx_access.log
sudo tail -f /var/log/nginx/panelx_error.log
```

### **Database Commands**
```bash
# Connect to database
sudo -u postgres psql -d panelx

# Backup database
sudo -u postgres pg_dump panelx > panelx_backup_$(date +%Y%m%d).sql

# Restore database
sudo -u postgres psql panelx < panelx_backup_20260125.sql
```

### **Application Updates**
```bash
cd /home/panelx/webapp

# Pull latest code
sudo -u panelx git pull

# Install dependencies
sudo -u panelx npm install

# Run migrations
sudo -u panelx npm run db:push

# Rebuild frontend
sudo -u panelx npm run build:client

# Restart
sudo -u panelx pm2 restart all
```

---

## 🔍 **Troubleshooting**

### **Application Won't Start**

Check logs:
```bash
pm2 logs panelx-production --lines 100
```

Common issues:
- Database connection failed → Check `.env` DATABASE_URL
- Port already in use → `sudo lsof -i :5000`
- Permission errors → Check file ownership: `ls -la /home/panelx/webapp`

### **502 Bad Gateway**

```bash
# Check if application is running
pm2 status

# Check nginx error logs
sudo tail -f /var/log/nginx/panelx_error.log

# Restart services
sudo -u panelx pm2 restart all
sudo systemctl restart nginx
```

### **Database Connection Errors**

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
sudo -u postgres psql -d panelx -c "SELECT 1;"

# Reset password
sudo -u postgres psql
# Then: ALTER USER panelx WITH PASSWORD 'new_password';
```

### **High Memory Usage**

```bash
# Check memory
pm2 monit

# Restart to free memory
pm2 restart all

# Adjust PM2 memory limit in ecosystem.production.cjs:
# max_memory_restart: '2G'  # Change to 2GB
```

### **Streaming Issues**

```bash
# Check FFmpeg
ffmpeg -version

# Check network
sudo iftop  # Install with: sudo apt-get install iftop

# Check disk space
df -h
```

---

## 📊 **Monitoring**

### **Server Monitoring**

```bash
# CPU, Memory, Disk
htop

# Network
sudo iftop

# Disk I/O
sudo iotop
```

### **Application Monitoring**

```bash
# PM2 monitoring
pm2 monit

# Real-time logs
pm2 logs --lines 100

# Application metrics
curl http://localhost:5000/api/analytics/dashboard
```

---

## 🎯 **Access Points**

After installation, access your panel at:

- **Admin Dashboard**: `http://your-server-ip/admin`
- **API Documentation**: `http://your-server-ip/`
- **API Endpoints**: `http://your-server-ip/api/*`

With domain and SSL:
- **Admin Dashboard**: `https://your-domain.com/admin`

---

## 🆘 **Support & Documentation**

- **GitHub Repository**: https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO
- **Issues**: https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO/issues
- **Documentation**: Check repository `/docs` folder

---

## 📝 **Post-Installation Checklist**

- [ ] Change default PostgreSQL password
- [ ] Update SESSION_SECRET in .env
- [ ] Set up SSL certificate
- [ ] Configure domain name
- [ ] Set up backups (database + files)
- [ ] Configure firewall rules
- [ ] Set up monitoring/alerts
- [ ] Test streaming functionality
- [ ] Create admin user
- [ ] Review security settings

---

**🎉 Congratulations! Your PanelX V3.0.0 PRO is now deployed!**

*Last updated: 2026-01-25*
