# 🚀 Fresh Installation Guide - Ubuntu 24.04

## **One-Command Installation** (EASIEST)

**Copy and paste this on your Ubuntu 24.04 server:**

```bash
wget https://raw.githubusercontent.com/ErvinHalilaj/PanelX-V3.0.0-PRO/main/install-panelx.sh && chmod +x install-panelx.sh && ./install-panelx.sh
```

**That's it!** The script will:
- ✅ Install all dependencies (Node.js, PostgreSQL, FFmpeg)
- ✅ Configure PostgreSQL authentication
- ✅ Create database and user
- ✅ Clone PanelX repository
- ✅ Install npm packages
- ✅ Create environment file
- ✅ Initialize database schema
- ✅ Create systemd service
- ✅ Configure firewall
- ✅ Start the service
- ✅ Verify everything works

**Installation time:** 5-10 minutes

---

## **What's Fixed**

### 1. **Database Authentication** ✅
- Automatically configures PostgreSQL to use `md5` authentication
- No more "password authentication failed" errors
- Creates user with proper permissions

### 2. **Better Error Messages** ✅
- Shows exactly what's wrong if database connection fails
- Tests connection on startup
- Masks password in error logs

### 3. **Connection Pooling** ✅
- Configures proper connection pool settings
- Handles connection errors gracefully
- Auto-reconnects if connection drops

### 4. **Systemd Service** ✅
- Proper service configuration
- Auto-restart on failure
- Logs to systemd journal

---

## **After Installation**

**Access your panel:**
```
http://your-server-ip:5000
```

**Default login:**
- Username: `admin`
- Password: `admin123`

**⚠️ Change password after first login!**

---

## **Useful Commands**

```bash
# Check service status
sudo systemctl status panelx

# View logs (real-time)
sudo journalctl -u panelx -f

# View last 50 lines
sudo journalctl -u panelx -n 50

# Restart service
sudo systemctl restart panelx

# Stop service
sudo systemctl stop panelx

# Start service
sudo systemctl start panelx

# Test API
curl http://localhost:5000/api/stats
```

---

## **Troubleshooting**

### Service won't start
```bash
# Check logs
sudo journalctl -u panelx -n 100 --no-pager

# Check if port is in use
lsof -i :5000

# Kill process on port
fuser -k 5000/tcp

# Restart service
sudo systemctl restart panelx
```

### Database connection error
```bash
# Check PostgreSQL
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Test connection
PGPASSWORD=panelx123 psql -h localhost -U panelx -d panelx -c "SELECT 1;"
```

### Can't access from browser
```bash
# Check firewall
sudo ufw status

# Allow port 5000
sudo ufw allow 5000/tcp

# Check if service is listening
netstat -tulpn | grep 5000
```

---

## **Update Existing Installation**

If you already have PanelX installed and want to update:

```bash
cd /opt/panelx
sudo systemctl stop panelx
git pull origin main
npm install
sudo systemctl start panelx
```

---

## **Complete Reinstall**

If you want to completely remove and reinstall:

```bash
# Stop and remove service
sudo systemctl stop panelx
sudo systemctl disable panelx
sudo rm /etc/systemd/system/panelx.service

# Remove installation
sudo rm -rf /opt/panelx

# Drop database
sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS panelx;
DROP USER IF EXISTS panelx;
EOF

# Run installation script
wget https://raw.githubusercontent.com/ErvinHalilaj/PanelX-V3.0.0-PRO/main/install-panelx.sh
chmod +x install-panelx.sh
./install-panelx.sh
```

---

## **Installation Script Features**

The installation script (`install-panelx.sh`):

1. ✅ **Checks prerequisites** - Verifies system compatibility
2. ✅ **Updates system** - Runs apt update/upgrade
3. ✅ **Installs Node.js 20.x** - Latest LTS version
4. ✅ **Installs PostgreSQL** - Version 14/15/16
5. ✅ **Installs FFmpeg** - For stream transcoding
6. ✅ **Configures PostgreSQL** - Fixes authentication
7. ✅ **Creates database** - With proper permissions
8. ✅ **Tests connection** - Verifies database works
9. ✅ **Clones repository** - From GitHub
10. ✅ **Installs packages** - npm install
11. ✅ **Creates .env** - With secure random secret
12. ✅ **Pushes schema** - Creates all tables
13. ✅ **Verifies tables** - Checks database structure
14. ✅ **Creates service** - Systemd configuration
15. ✅ **Configures firewall** - Opens port 5000
16. ✅ **Starts service** - Launches PanelX
17. ✅ **Tests API** - Verifies it's working

**Total steps:** 12  
**Automation:** 100%  
**Manual intervention:** 0

---

## **What Gets Installed**

### System Packages:
- Node.js 20.x (LTS)
- npm 10.x
- PostgreSQL 16
- FFmpeg
- Git
- Build tools

### PanelX Components:
- Backend server (Express + Hono)
- Database schema (Drizzle ORM)
- Frontend (React + TypeScript)
- API endpoints (72+ endpoints)
- Streaming engine (FFmpeg manager)
- Export service (CSV/Excel/M3U)

### Database Tables:
- users
- streams
- lines
- categories
- bouquets
- servers
- tickets
- activity_logs
- credit_transactions
- connection_history
- And 30+ more tables

---

## **Security Recommendations**

After installation:

1. **Change admin password** immediately
2. **Change database password**:
   ```bash
   sudo -u postgres psql -c "ALTER USER panelx WITH PASSWORD 'new-strong-password';"
   ```
   Then update `/opt/panelx/.env` with new password

3. **Change SESSION_SECRET**:
   ```bash
   cd /opt/panelx
   nano .env
   # Change SESSION_SECRET to a new random value
   ```

4. **Enable firewall** (if not already):
   ```bash
   sudo ufw enable
   sudo ufw allow 22/tcp
   sudo ufw allow 5000/tcp
   ```

5. **Setup SSL/TLS** (recommended):
   - Use Nginx as reverse proxy
   - Get free SSL from Let's Encrypt
   - Force HTTPS

---

## **Performance Tuning**

For production use:

### PostgreSQL:
```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/16/main/postgresql.conf

# Increase connections
max_connections = 200

# Increase shared buffers (25% of RAM)
shared_buffers = 2GB

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Node.js:
```bash
# Edit systemd service
sudo nano /etc/systemd/system/panelx.service

# Add environment variables
Environment=NODE_ENV=production
Environment=NODE_OPTIONS=--max-old-space-size=4096

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart panelx
```

---

## **Monitoring**

### System Resources:
```bash
# CPU and Memory
htop

# Disk usage
df -h

# PostgreSQL status
sudo systemctl status postgresql
```

### PanelX Logs:
```bash
# Real-time logs
sudo journalctl -u panelx -f

# Filter by priority
sudo journalctl -u panelx -p err

# Last 24 hours
sudo journalctl -u panelx --since "24 hours ago"
```

### Database:
```bash
# Active connections
PGPASSWORD=panelx123 psql -h localhost -U panelx -d panelx -c "SELECT count(*) FROM pg_stat_activity;"

# Database size
PGPASSWORD=panelx123 psql -h localhost -U panelx -d panelx -c "SELECT pg_size_pretty(pg_database_size('panelx'));"
```

---

## **Backup**

### Database Backup:
```bash
# Backup database
PGPASSWORD=panelx123 pg_dump -h localhost -U panelx panelx > panelx_backup_$(date +%Y%m%d).sql

# Restore database
PGPASSWORD=panelx123 psql -h localhost -U panelx panelx < panelx_backup_20260124.sql
```

### Full Backup:
```bash
# Backup everything
sudo tar -czf panelx_full_backup_$(date +%Y%m%d).tar.gz /opt/panelx /etc/systemd/system/panelx.service

# Restore
sudo tar -xzf panelx_full_backup_20260124.tar.gz -C /
```

---

## **Need Help?**

If installation fails, send:

1. **Installation log** (screenshot or paste output)
2. **Service status**: `sudo systemctl status panelx`
3. **Service logs**: `sudo journalctl -u panelx -n 100`
4. **Database test**: `PGPASSWORD=panelx123 psql -h localhost -U panelx -d panelx -c "SELECT 1;"`

---

**Repository:** https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO  
**Latest Commit:** Check GitHub for latest  
**Status:** ✅ Production Ready

**Installation time:** 5-10 minutes  
**Difficulty:** Easy  
**Automation:** 100%

🚀 **Ready to install!**
