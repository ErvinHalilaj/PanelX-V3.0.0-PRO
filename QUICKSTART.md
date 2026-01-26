# 🚀 PanelX V3.0.0 PRO - Quick Start Guide

## ⚡ One-Command Installation (Tested & Working)

```bash
curl -fsSL https://raw.githubusercontent.com/ErvinHalilaj/PanelX-V3.0.0-PRO/main/install-vps-tested.sh | sudo bash
```

**OR** manual installation:

```bash
git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git
cd PanelX-V3.0.0-PRO
chmod +x install-vps-tested.sh
sudo ./install-vps-tested.sh
```

---

## 📋 Prerequisites

- **Ubuntu 22.04+** (or Debian 11+)
- **4GB RAM minimum** (8GB recommended)
- **20GB disk space**
- **Root access** (sudo)
- **Clean VPS** (fresh installation recommended)

---

## 🎯 What the Installer Does

1. ✅ Updates system packages
2. ✅ Installs Node.js 20
3. ✅ Installs PostgreSQL 15
4. ✅ Installs Nginx
5. ✅ Installs FFmpeg
6. ✅ Creates `panelx` user
7. ✅ Sets up database
8. ✅ Clones project from GitHub
9. ✅ Installs dependencies
10. ✅ Creates `.env` configuration
11. ✅ Configures PM2 (process manager)
12. ✅ Configures Nginx (reverse proxy)
13. ✅ Sets up firewall rules
14. ✅ Tests installation

---

## ⏱️ Installation Time

- **Fast server:** 5-10 minutes
- **Average server:** 10-15 minutes
- **Slow server:** 15-20 minutes

---

## 🌐 After Installation

### Access Your Panel

Open your browser and go to:
```
http://YOUR_SERVER_IP
```

### Default Setup

- **Database:** panelx
- **Database User:** panelx  
- **Database Password:** panelx123
- **Backend Port:** 5000
- **Project Directory:** `/home/panelx/webapp`

### Create Admin User

The installer doesn't create default admin credentials. Create your first admin user via API:

```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "YourSecurePassword123!",
    "email": "admin@example.com",
    "role": "admin"
  }'
```

---

## 🔧 Management Commands

### View Logs
```bash
sudo -u panelx pm2 logs panelx
```

### Restart Application
```bash
sudo -u panelx pm2 restart panelx
```

### Stop Application
```bash
sudo -u panelx pm2 stop panelx
```

### Check Status
```bash
sudo -u panelx pm2 list
```

### View Backend Logs (Last 50 lines)
```bash
sudo -u panelx pm2 logs panelx --lines 50 --nostream
```

### Restart Nginx
```bash
sudo systemctl restart nginx
```

### Check Nginx Status
```bash
sudo systemctl status nginx
```

---

## 🐛 Troubleshooting

### Can't Access Panel (Connection Timeout)

**Check if firewall allows HTTP:**
```bash
sudo ufw status
```

Should show:
```
80/tcp    ALLOW    Anywhere
443/tcp   ALLOW    Anywhere
```

If not, run:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Backend Not Running

**Check PM2 status:**
```bash
sudo -u panelx pm2 list
```

If status is "stopped" or "errored":
```bash
sudo -u panelx pm2 restart panelx
sudo -u panelx pm2 logs panelx --lines 30
```

### Database Connection Error

**Check PostgreSQL is running:**
```bash
sudo systemctl status postgresql
```

**Test database connection:**
```bash
psql -U panelx -d panelx -h localhost -c "SELECT 1;"
# Password: panelx123
```

### Nginx 502 Bad Gateway

**Check if backend is responding:**
```bash
curl http://localhost:5000/api/stats
```

If no response:
```bash
sudo -u panelx pm2 restart panelx
sleep 5
curl http://localhost:5000/api/stats
```

---

## 📊 Health Check

Run this to check everything:

```bash
echo "=== PanelX Health Check ==="
echo ""
echo "1. Firewall Status:"
sudo ufw status | grep -E "80|443"
echo ""
echo "2. PostgreSQL:"
sudo systemctl status postgresql --no-pager | grep Active
echo ""
echo "3. Nginx:"
sudo systemctl status nginx --no-pager | grep Active
echo ""
echo "4. Backend:"
sudo -u panelx pm2 list
echo ""
echo "5. Backend Response:"
curl -s http://localhost:5000/api/stats | head -5
echo ""
echo "6. Ports:"
sudo netstat -tulpn | grep -E ":80|:5000"
```

---

## 🔐 Security Recommendations

### 1. Change Database Password

```bash
sudo -u postgres psql
ALTER USER panelx WITH PASSWORD 'your-new-secure-password';
\q

# Update .env file
sudo nano /home/panelx/webapp/.env
# Change DATABASE_URL password

# Restart app
sudo -u panelx pm2 restart panelx
```

### 2. Enable SSL/HTTPS

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

### 3. Set Up Firewall Properly

```bash
# Only allow necessary ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

---

## 📈 Performance Tuning

### For 4GB RAM VPS

Edit `/home/panelx/webapp/ecosystem.config.cjs`:

```javascript
max_memory_restart: '1G',
instances: 2,  // Use 2 instances
exec_mode: 'cluster'
```

### For 8GB+ RAM VPS

```javascript
max_memory_restart: '2G',
instances: 4,  // Use 4 instances
exec_mode: 'cluster'
```

After changes:
```bash
sudo -u panelx pm2 restart panelx
```

---

## 📝 Configuration Files

### Main Config: `.env`
Location: `/home/panelx/webapp/.env`

```env
DATABASE_URL=postgresql://panelx:panelx123@localhost:5432/panelx
PORT=5000
NODE_ENV=production
HOST=0.0.0.0
SESSION_SECRET=your-random-secret
COOKIE_SECURE=false
```

### PM2 Config
Location: `/home/panelx/webapp/ecosystem.config.cjs`

### Nginx Config
Location: `/etc/nginx/sites-available/panelx`

---

## 🆘 Getting Help

### Collect Debug Info

```bash
# Save this to debug.txt and share
{
  echo "=== System Info ==="
  uname -a
  echo ""
  echo "=== Node Version ==="
  node --version
  echo ""
  echo "=== PM2 Status ==="
  sudo -u panelx pm2 list
  echo ""
  echo "=== Backend Logs ==="
  sudo -u panelx pm2 logs panelx --lines 50 --nostream
  echo ""
  echo "=== Nginx Error Log ==="
  sudo tail -50 /var/log/nginx/error.log
  echo ""
  echo "=== Firewall ==="
  sudo ufw status
  echo ""
  echo "=== Ports ==="
  sudo netstat -tulpn | grep -E ":80|:5000"
} > debug.txt

cat debug.txt
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Connection timeout | Check firewall: `sudo ufw allow 80/tcp` |
| 502 Bad Gateway | Restart backend: `sudo -u panelx pm2 restart panelx` |
| Database error | Check PostgreSQL: `sudo systemctl restart postgresql` |
| Port 5000 in use | Kill process: `sudo fuser -k 5000/tcp` |
| Out of memory | Reduce instances in ecosystem.config.cjs |

---

## ✅ Verification Checklist

After installation, verify:

- [ ] Can access `http://YOUR_IP` in browser
- [ ] PM2 shows panelx as "online"
- [ ] `curl http://localhost:5000/api/stats` returns JSON
- [ ] PostgreSQL is running
- [ ] Nginx is running
- [ ] Firewall allows port 80

---

## 🎉 Success!

If everything works:
- ✅ Backend running on port 5000
- ✅ Nginx proxying requests
- ✅ Firewall configured
- ✅ Panel accessible via browser

**Next Steps:**
1. Create admin user via API
2. Access panel at `http://YOUR_IP`
3. Configure SSL for HTTPS
4. Set up backups
5. Configure your IPTV streams

---

**Need more help?** Check `TROUBLESHOOTING.md` or `FIX_CONNECTION_TIMEOUT.md`
