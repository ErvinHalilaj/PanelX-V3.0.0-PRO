# 🚀 PanelX V3.0.0 PRO - Complete Deployment Guide

## ✅ **QUICK FIX FOR MISSING FRONTEND**

If you installed the panel but only see the dashboard without sidebar/navigation:

### **Run This On Your VPS:**

```bash
# Download and run the frontend builder
curl -fsSL https://raw.githubusercontent.com/ErvinHalilaj/PanelX-V3.0.0-PRO/main/build-frontend.sh | sudo bash
```

This will:
- Build the React frontend application
- Create the `dist/` folder with all assets
- Restart the backend
- Enable full navigation and all 60+ pages

**Alternative manual build:**

```bash
cd /home/panelx/webapp
sudo -u panelx npm install
sudo -u panelx NODE_OPTIONS='--max-old-space-size=4096' npm run build
sudo -u panelx pm2 restart panelx
```

---

## 📦 **COMPLETE FRESH INSTALLATION**

### **One-Command Install (Recommended):**

```bash
curl -fsSL https://raw.githubusercontent.com/ErvinHalilaj/PanelX-V3.0.0-PRO/main/autoinstaller.sh | sudo bash
```

### **What It Does:**

**Step 1-5: System Setup** (2-3 min)
- Updates system packages
- Installs Node.js 20
- Installs PostgreSQL
- Installs Nginx
- Installs FFmpeg and dependencies

**Step 6-7: User & Database** (30 sec)
- Creates `panelx` system user
- Creates PostgreSQL database
- Sets up credentials

**Step 8-9: Application** (3-5 min)
- Clones project from GitHub
- Installs ALL npm dependencies (including runtime deps)

**Step 9B: Frontend Build** (3-5 min) ⭐ **NEW!**
- Builds React frontend with Vite
- Creates dist/ folder
- Compiles all 60+ pages

**Step 10-11: Configuration** (1 min)
- Creates `.env` file with secure secrets
- Configures PM2 with dotenv support
- Starts backend

**Step 12-13: Web Server** (1 min)
- Configures Nginx reverse proxy
- Opens firewall ports
- Tests services

**Step 14: Database** (30 sec)
- Pushes database schema
- Creates all tables

**Total Time:** 10-15 minutes

---

## 🎯 **After Installation**

### **Access Your Panel:**

```
http://YOUR_SERVER_IP
```

You should see:
- ✅ **Sidebar** on the left with navigation
- ✅ **Dashboard** with live statistics
- ✅ **60+ Pages** accessible via sidebar
- ✅ **Real-time updates** via WebSocket

### **Default Credentials:**

No default admin user is created. You'll need to create one via the database or registration page.

---

## 📊 **Available Features & Pages**

### **Streams & Content (10 pages)**
- `/streams` - Live TV management
- `/movies` - VOD/Movies
- `/series` - TV Series
- `/categories` - Content categories
- `/epg` - EPG sources
- `/recordings` - DVR recordings
- `/timeshift` - Timeshift
- `/adaptive-bitrate` - ABR settings
- `/schedules` - Stream schedules
- `/media-manager` - Media files

### **Users & Lines (8 pages)**
- `/users` - User accounts
- `/lines` - Lines/subscriptions
- `/connections` - Active connections
- `/connection-history` - Connection logs
- `/packages` - Packages/pricing
- `/activation-codes` - Activation codes
- `/reserved-usernames` - Reserved names
- `/most-watched` - Popular content

### **Servers & Monitoring (5 pages)**
- `/servers` - Server management
- `/monitoring` - System monitoring
- `/stream-status` - Stream health
- `/access-outputs` - Output monitoring
- `/signals` - Signal quality

### **Security (9 pages)**
- `/security` - Security dashboard
- `/advanced-security` - Advanced features
- `/blocked-ips` - IP blocking
- `/blocked-uas` - UA blocking
- `/two-factor` - 2FA settings
- `/fingerprinting` - Device fingerprinting
- `/autoblock-rules` - Auto-block rules
- `/impersonation-logs` - Impersonation detection
- `/activity-logs` - Activity tracking

### **Analytics (4 pages)**
- `/analytics` - Detailed analytics
- `/most-watched` - Top content
- `/stats-snapshots` - Statistics
- `/epg-data` - EPG viewer

### **Reseller System (3 pages)**
- `/reseller-management` - Reseller admin
- `/reseller-groups` - Reseller groups
- `/credit-transactions` - Credits

### **Devices (4 pages)**
- `/devices` - Device templates
- `/mag-devices` - MAG boxes
- `/enigma2-devices` - Enigma2
- `/created-channels` - Custom channels

### **Advanced (10 pages)**
- `/transcode` - Transcoding profiles
- `/bouquets` - Channel bouquets
- `/looping-channels` - Loop channels
- `/watch-folders` - Auto-import
- `/webhooks` - Webhook integration
- `/cron-jobs` - Scheduled tasks
- `/backups` - Backup manager
- `/tickets` - Support tickets
- `/branding` - Custom branding
- `/settings` - System settings

### **API & System (2 pages)**
- `/api` - API documentation
- `/settings` - Global settings

**Total: 60+ pages**

---

## 🔧 **Troubleshooting**

### **Issue: Frontend Not Building**

**Symptom:** Only dashboard visible, no sidebar

**Solution:**
```bash
cd /home/panelx/webapp
sudo -u panelx npm install
sudo -u panelx NODE_OPTIONS='--max-old-space-size=4096' npm run build
sudo -u panelx pm2 restart panelx
```

### **Issue: Database Tables Missing**

**Symptom:** Errors like "relation does not exist"

**Solution:**
```bash
cd /home/panelx/webapp
sudo -u panelx npx drizzle-kit push
sudo -u panelx pm2 restart panelx
```

### **Issue: Backend Crashing**

**Check logs:**
```bash
sudo -u panelx pm2 logs panelx --lines 50
```

**Common fixes:**
```bash
# Missing dependencies
cd /home/panelx/webapp
sudo -u panelx npm install

# Environment variables not loading
cat /home/panelx/webapp/.env
sudo -u panelx pm2 restart panelx --update-env

# Database not accessible
sudo systemctl status postgresql
sudo systemctl start postgresql
```

### **Issue: Port 5000 Not Listening**

**Solution:**
```bash
# Kill any process on port 5000
sudo fuser -k 5000/tcp

# Restart backend
sudo -u panelx pm2 restart panelx

# Check if listening
netstat -tuln | grep :5000
```

### **Issue: 502 Bad Gateway**

**Solution:**
```bash
# Wait 60 seconds for backend to start
sleep 60

# Check PM2 status
sudo -u panelx pm2 list

# Restart if needed
sudo -u panelx pm2 restart panelx
```

---

## 🎨 **Customization**

### **Branding:**
Navigate to `/branding` to customize:
- Panel name
- Logo
- Colors
- Favicon

### **Settings:**
Navigate to `/settings` to configure:
- System defaults
- Email settings
- API keys
- Integrations

---

## 📝 **Management Commands**

### **PM2 Process Management:**
```bash
# List processes
sudo -u panelx pm2 list

# View logs
sudo -u panelx pm2 logs panelx

# Restart
sudo -u panelx pm2 restart panelx

# Stop
sudo -u panelx pm2 stop panelx

# Delete
sudo -u panelx pm2 delete panelx
```

### **Nginx:**
```bash
# Test config
sudo nginx -t

# Restart
sudo systemctl restart nginx

# View logs
sudo tail -f /var/log/nginx/error.log
```

### **PostgreSQL:**
```bash
# Connect to database
sudo -u postgres psql panelx

# List tables
\dt

# View data
SELECT * FROM users LIMIT 10;
```

### **System:**
```bash
# Check disk space
df -h

# Check memory
free -h

# Check CPU
top

# Check processes
ps aux | grep tsx
```

---

## 🔐 **Security Recommendations**

1. **Change database password:**
```sql
ALTER USER panelx WITH PASSWORD 'new_secure_password';
```

Update `/home/panelx/webapp/.env` accordingly.

2. **Enable firewall:**
```bash
sudo ufw enable
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
```

3. **Setup SSL/HTTPS:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

4. **Regular backups:**
Use the `/backups` page or:
```bash
pg_dump panelx > backup_$(date +%Y%m%d).sql
```

---

## 🚀 **Performance Optimization**

### **For High Traffic:**

1. **Increase PM2 instances:**
Edit `/home/panelx/webapp/ecosystem.config.cjs`:
```javascript
instances: 4, // Or use 'max' for CPU count
exec_mode: 'cluster'
```

2. **Increase memory limits:**
```javascript
max_memory_restart: '2G'
```

3. **Enable Nginx caching:**
Add to `/etc/nginx/sites-available/panelx`:
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m;
proxy_cache my_cache;
```

---

## 📚 **Additional Resources**

- **GitHub:** https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO
- **Issues:** Report bugs via GitHub Issues
- **Documentation:** See README.md in project root

---

## ✅ **Success Checklist**

After installation, verify:

- [ ] Can access panel at `http://YOUR_SERVER_IP`
- [ ] Sidebar is visible on the left
- [ ] Can navigate to different pages (streams, users, etc.)
- [ ] Dashboard shows live statistics
- [ ] PM2 shows process as "online"
- [ ] Database tables exist (`sudo -u postgres psql panelx -c "\dt"`)
- [ ] No errors in logs (`sudo -u panelx pm2 logs panelx`)
- [ ] Port 5000 is listening (`netstat -tuln | grep :5000`)
- [ ] Nginx is running (`systemctl status nginx`)
- [ ] Firewall allows ports 80/443 (`sudo ufw status`)

---

**🎉 Congratulations! Your professional IPTV management panel is ready!**
