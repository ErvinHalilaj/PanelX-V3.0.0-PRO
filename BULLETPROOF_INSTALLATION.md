# 🚀 PanelX V3.0.0 PRO - Bulletproof Installation Guide

## ✅ **ONE-COMMAND INSTALLATION**

This installer has been **tested and verified** to work on **ALL Ubuntu versions** without any manual intervention.

### **Quick Install (Recommended)**

```bash
curl -fsSL https://raw.githubusercontent.com/ErvinHalilaj/PanelX-V3.0.0-PRO/main/autoinstaller.sh | sudo bash
```

### **Alternative: Manual Download**

```bash
wget https://raw.githubusercontent.com/ErvinHalilaj/PanelX-V3.0.0-PRO/main/autoinstaller.sh
chmod +x autoinstaller.sh
sudo ./autoinstaller.sh
```

---

## 📋 **What This Installer Does**

The bulletproof autoinstaller performs these steps **completely automatically**:

### ✅ **Step 1-5: System Setup** (2-3 minutes)
- Updates all system packages
- Installs Node.js 20 (latest LTS)
- Installs and configures PostgreSQL database
- Installs Nginx web server
- Installs FFmpeg and system dependencies

### ✅ **Step 6-7: User & Database** (30 seconds)
- Creates dedicated `panelx` system user
- Creates PostgreSQL database with proper permissions
- Sets up secure database credentials

### ✅ **Step 8-9: Application Setup** (3-5 minutes)
- Clones PanelX V3.0.0 PRO from GitHub
- Installs all Node.js dependencies (445+ endpoints, 60 pages)
- Installs TypeScript runtime (tsx)

### ✅ **Step 10-11: Configuration** (1 minute)
- Generates secure environment configuration
- Creates `.env` file with random SESSION_SECRET
- Configures PM2 process manager
- Starts backend application

### ✅ **Step 12-13: Web Server & Firewall** (1 minute)
- Configures Nginx as reverse proxy
- Sets up proper routing for API and WebSocket
- Opens firewall ports (22, 80, 443)
- Enables UFW firewall

### ✅ **Final: Verification** (45 seconds)
- Waits for services to initialize
- Tests all components
- Displays access URL and status

---

## ⏱️ **Installation Time**

- **Minimum:** 5 minutes (fast VPS)
- **Average:** 7-8 minutes (standard VPS)
- **Maximum:** 10-12 minutes (slow connection)

---

## 🖥️ **System Requirements**

### **Operating System** (ALL Ubuntu versions supported!)
- ✅ Ubuntu 24.04 LTS (Noble Numbat)
- ✅ Ubuntu 22.04 LTS (Jammy Jellyfish)
- ✅ Ubuntu 20.04 LTS (Focal Fossa)
- ✅ Ubuntu 18.04 LTS (Bionic Beaver)
- ✅ Debian 12 (Bookworm)
- ✅ Debian 11 (Bullseye)
- ✅ Debian 10 (Buster)

### **Hardware Requirements**
- **RAM:** 2GB minimum (4GB+ recommended)
- **CPU:** 1 core minimum (2+ cores recommended)
- **Storage:** 10GB minimum (20GB+ recommended)
- **Network:** Public IP address

### **Network Requirements**
- ✅ Ports 80 and 443 must be accessible from internet
- ✅ Firewall rules will be configured automatically
- ✅ If using cloud provider (AWS/DigitalOcean/Hetzner), ensure Security Group allows ports 80/443

---

## 🔥 **What Makes This Installer "Bulletproof"?**

### ✅ **1. Handles ALL Edge Cases**
- Detects existing installations and removes them cleanly
- Works on fresh and existing VPS
- Handles interrupted installations
- Cleans up port conflicts automatically

### ✅ **2. Completely Non-Interactive**
- **Zero prompts** during installation
- **No manual steps** required
- **No stuck installations** on package configuration
- APT configured to always accept defaults

### ✅ **3. Robust Error Handling**
- Detects and reports failures immediately
- Shows exact command that failed
- Provides clear error messages
- Continues installation when possible

### ✅ **4. Service Management**
- PM2 for reliable process management
- Auto-restart on crashes
- Persistent across server reboots
- Proper logging and monitoring

### ✅ **5. Security First**
- UFW firewall configured automatically
- Secure PostgreSQL setup
- Random SESSION_SECRET generation
- Proper file permissions

### ✅ **6. Comprehensive Testing**
- Tests each service after installation
- Verifies backend API is responding
- Checks Nginx proxy configuration
- Reports detailed status at the end

---

## 📊 **After Installation**

Once installation completes (5-10 minutes), you'll see:

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║              ✅ INSTALLATION COMPLETE! ✅                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SERVICE STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Backend API:      ✓ Running (port 5000)
Nginx Server:     ✓ Running
PostgreSQL:       ✓ Running
PM2 Process:      ✓ Online
Firewall:         ✓ Active (ports 22, 80, 443)
Port 5000:        ✓ Listening

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 ACCESS YOUR ADMIN PANEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   🔗 http://YOUR_SERVER_IP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### **Access Your Panel**

1. **Open your browser**
2. **Navigate to:** `http://YOUR_SERVER_IP`
3. **Wait 30-60 seconds** if you see "502 Bad Gateway" (backend is still initializing)
4. **Refresh the page** after waiting

---

## 🎯 **What You Get**

### **Complete IPTV Admin Panel**
- ✅ **60 Frontend Pages** (Dashboard, Users, Streams, Analytics, etc.)
- ✅ **445 Backend Endpoints** (Full REST API)
- ✅ **146 Database Tables** (Complete data model)
- ✅ **Real-time WebSocket** (Live monitoring and updates)
- ✅ **Modern UI** (Tailwind CSS + Radix UI components)
- ✅ **Production Ready** (PM2 + Nginx + PostgreSQL)

### **Key Features**
- 📺 Stream Management (Live TV, Movies, Series, VOD)
- 👥 User & Reseller Management
- 📊 Advanced Analytics & Reports
- 🔒 Security Features (IP blocking, 2FA)
- 💳 Billing & Subscriptions
- 🌍 Multi-server Architecture
- 📡 EPG Integration
- 🎬 Content Organization (Categories, Genres, Bouquets)
- 🔄 Automatic Updates
- 📱 Device Management

---

## 🛠️ **Useful Management Commands**

### **Service Management**

```bash
# View real-time logs
sudo -u panelx pm2 logs panelx

# Check service status
sudo -u panelx pm2 list

# Restart backend
sudo -u panelx pm2 restart panelx

# Stop backend
sudo -u panelx pm2 stop panelx

# Start backend
sudo -u panelx pm2 start panelx
```

### **Testing & Debugging**

```bash
# Test API endpoint
curl http://localhost:5000/api/stats

# Check if backend is running
netstat -tuln | grep :5000

# View full PM2 details
sudo -u panelx pm2 show panelx

# Check Nginx status
systemctl status nginx

# View Nginx error logs
tail -50 /var/log/nginx/error.log

# Check firewall status
sudo ufw status
```

### **System Information**

```bash
# Check server IP
curl ifconfig.me

# Check system resources
free -h
df -h

# Check PostgreSQL
systemctl status postgresql
```

---

## 🔧 **Troubleshooting Guide**

### **Issue: "Connection Timeout" in Browser**

**Cause:** Firewall blocking ports 80/443

**Solution 1:** Check UFW firewall
```bash
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**Solution 2:** Check cloud provider firewall
- **AWS:** Check Security Groups (allow 0.0.0.0/0 on port 80/443)
- **DigitalOcean:** Check Firewall settings
- **Hetzner:** Check Cloud Firewall rules
- **Vultr:** Check Firewall configuration

---

### **Issue: "502 Bad Gateway"**

**Cause:** Backend not fully started yet

**Solution:**
```bash
# Wait 60 seconds and refresh browser
# OR check backend status
sudo -u panelx pm2 list

# If not running, restart it
sudo -u panelx pm2 restart panelx

# Wait 30 seconds
sleep 30

# Test API
curl http://localhost:5000/api/stats
```

---

### **Issue: Backend Not Responding**

**Cause:** Backend crashed or not started

**Solution:**
```bash
# Check PM2 status
sudo -u panelx pm2 list

# View logs to see error
sudo -u panelx pm2 logs panelx --lines 50

# Restart backend
sudo -u panelx pm2 restart panelx

# Wait and test
sleep 30
curl http://localhost:5000/api/stats
```

---

### **Issue: "Cannot Connect to Database"**

**Cause:** PostgreSQL not running

**Solution:**
```bash
# Check PostgreSQL status
systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify database exists
sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw panelx && echo "Database OK" || echo "Database missing"

# Restart backend
sudo -u panelx pm2 restart panelx
```

---

### **Issue: Port 5000 Already in Use**

**Solution:**
```bash
# Kill process on port 5000
sudo fuser -k 5000/tcp

# Wait a moment
sleep 3

# Restart backend
sudo -u panelx pm2 restart panelx
```

---

## 📝 **Configuration Files**

### **Environment Configuration**
- **Location:** `/home/panelx/webapp/.env`
- **Purpose:** Application configuration (database, port, secrets)
- **Permissions:** 600 (readable only by panelx user)

### **PM2 Configuration**
- **Location:** `/home/panelx/webapp/ecosystem.config.cjs`
- **Purpose:** Process manager configuration
- **Features:** Auto-restart, logging, memory limits

### **Nginx Configuration**
- **Location:** `/etc/nginx/sites-available/panelx`
- **Purpose:** Web server and reverse proxy
- **Features:** API routing, WebSocket support, SSL-ready

### **Application Code**
- **Location:** `/home/panelx/webapp/`
- **Owner:** panelx user
- **Contents:** Full admin panel source code

### **Log Files**
- **PM2 Logs:** `/home/panelx/logs/`
- **Nginx Logs:** `/var/log/nginx/`
- **PostgreSQL Logs:** `/var/log/postgresql/`

---

## 🔐 **Security Notes**

### **Default Credentials**

⚠️ **IMPORTANT:** Change these immediately after installation!

```
PostgreSQL:
  Database: panelx
  Username: panelx
  Password: panelx123
```

### **Session Secret**

The installer automatically generates a **secure random SESSION_SECRET** (48 characters, base64-encoded).

Location: `/home/panelx/webapp/.env`

### **Firewall Configuration**

The installer enables UFW firewall and allows:
- **Port 22:** SSH (for administration)
- **Port 80:** HTTP (web traffic)
- **Port 443:** HTTPS (SSL/TLS traffic)

### **File Permissions**

- `.env` file: **600** (readable only by panelx user)
- Application directory: Owned by **panelx** user
- Logs directory: Owned by **panelx** user

---

## 📚 **Additional Documentation**

- **Main README:** `/home/panelx/webapp/README.md`
- **GitHub Repository:** https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO
- **API Documentation:** Check `/home/panelx/webapp/server/routes.ts`
- **Database Schema:** Check `/home/panelx/webapp/shared/schema.ts`

---

## 🚀 **Next Steps After Installation**

1. ✅ **Access your panel:** Open `http://YOUR_SERVER_IP` in browser
2. ✅ **Change database password:** Update PostgreSQL password
3. ✅ **Configure streams:** Add your IPTV stream sources
4. ✅ **Create users:** Set up admin accounts
5. ✅ **Configure EPG:** Set up Electronic Program Guide
6. ✅ **Setup SSL:** Configure HTTPS with Let's Encrypt (optional)
7. ✅ **Backup configuration:** Save your `.env` file securely

---

## 💡 **Pro Tips**

### **1. Setup SSL/HTTPS (Recommended for Production)**

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate (replace your-domain.com)
sudo certbot --nginx -d your-domain.com

# Auto-renew certificate
sudo certbot renew --dry-run
```

### **2. Monitor System Resources**

```bash
# Install htop for better monitoring
sudo apt-get install -y htop

# Run htop
htop
```

### **3. Setup Automated Backups**

```bash
# Create backup script
sudo -u panelx cat > /home/panelx/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump panelx > /home/panelx/backups/db_$DATE.sql
find /home/panelx/backups -name "db_*.sql" -mtime +7 -delete
EOF

sudo chmod +x /home/panelx/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -u panelx -l 2>/dev/null; echo "0 2 * * * /home/panelx/backup.sh") | crontab -u panelx -
```

### **4. Increase Backend Memory (If Needed)**

Edit `/home/panelx/webapp/ecosystem.config.cjs` and change:
```javascript
max_memory_restart: '2G'  // Change from 1G to 2G
```

Then restart:
```bash
sudo -u panelx pm2 restart panelx
```

---

## 🎉 **Success Criteria**

Your installation is **successful** when:

✅ All services show "Running/Online" status
✅ `curl http://localhost:5000/api/stats` returns JSON
✅ Opening `http://YOUR_SERVER_IP` shows admin panel
✅ Firewall shows ports 80/443 as "ALLOW"
✅ PM2 shows `panelx` process as "online"

---

## 📞 **Support**

If you encounter issues not covered in this guide:

1. **Check logs:** `sudo -u panelx pm2 logs panelx --lines 100`
2. **Check GitHub issues:** https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO/issues
3. **Review troubleshooting section** above
4. **Verify system requirements** are met

---

## ✅ **Installation Checklist**

Before running the installer, ensure:

- [ ] You have **root access** (`sudo` privileges)
- [ ] Server has **2GB+ RAM** (4GB recommended)
- [ ] Server has **public IP address**
- [ ] Ports **80 and 443** are available
- [ ] You have **SSH access** to the server
- [ ] Operating system is **Ubuntu 18.04+** or **Debian 10+**

After installation:

- [ ] All services show "Running" status
- [ ] Backend API responds at `http://localhost:5000/api/stats`
- [ ] Admin panel loads at `http://YOUR_SERVER_IP`
- [ ] Firewall is active and configured
- [ ] You've saved the `.env` file backup

---

## 🏆 **Conclusion**

This **bulletproof installer** is designed to handle **all Ubuntu versions** and **all edge cases** without requiring any manual intervention.

**Installation is truly:**
- ✅ **One command** (`curl ... | sudo bash`)
- ✅ **Zero prompts** (fully automated)
- ✅ **5-10 minutes** (depending on VPS speed)
- ✅ **Verified and tested** (production-ready)

**Just run the command and access your panel!**

```bash
curl -fsSL https://raw.githubusercontent.com/ErvinHalilaj/PanelX-V3.0.0-PRO/main/autoinstaller.sh | sudo bash
```

---

**Made with ❤️ for PanelX V3.0.0 PRO**

*Last Updated: 2026-01-26*
