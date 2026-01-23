# 🔄 PanelX Update Guide - Update Your Existing Server

## 📋 Overview

This guide will help you update your existing PanelX installation on your server with all the new features and improvements.

---

## ⚠️ IMPORTANT: Backup First!

**BEFORE updating, create a backup of your current panel:**

```bash
# 1. Backup your database
pg_dump -U panelx panelx > backup_before_update_$(date +%Y%m%d_%H%M%S).sql

# 2. Backup your code
cd /path/to/your/panelx
tar -czf ../panelx_backup_$(date +%Y%m%d_%H%M%S).tar.gz .

# 3. Backup your .env file
cp .env .env.backup

# 4. Backup your streams directory (if you have custom streams)
tar -czf ../streams_backup_$(date +%Y%m%d_%H%M%S).tar.gz streams/
```

---

## 🎯 Update Methods

### Method 1: Git Pull (Recommended) ✅

**Use this if your server has the PanelX repository cloned from GitHub**

```bash
# 1. Navigate to your PanelX directory
cd /path/to/your/panelx

# 2. Check current status
git status

# 3. Stash any local changes (if you have custom modifications)
git stash save "Local changes before update"

# 4. Pull latest changes from GitHub
git pull origin main

# 5. If you had local changes, review and re-apply them
git stash list
# git stash pop  # Only if you want to re-apply your changes

# 6. Install any new dependencies
npm install

# 7. Run database migrations (if any)
npm run db:migrate

# 8. Restart the server
pm2 restart panelx

# 9. Check logs
pm2 logs panelx --nostream
```

---

### Method 2: Fresh Clone (Clean Installation) ✅

**Use this if you want a completely fresh installation**

```bash
# 1. Stop the current server
pm2 stop panelx
# or
pm2 delete panelx

# 2. Navigate to parent directory
cd /path/to/parent/directory

# 3. Rename old directory (keep as backup)
mv panelx panelx_old_$(date +%Y%m%d)

# 4. Clone the latest version
git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO panelx

# 5. Navigate to new directory
cd panelx

# 6. Copy your .env file from backup
cp ../panelx_old_*/\.env .env

# Or create new .env with your settings:
cat > .env << EOF
NODE_ENV=production
DATABASE_URL=postgresql://panelx:your_password@localhost:5432/panelx
PORT=5000
SESSION_SECRET=$(openssl rand -hex 32)
EOF

# 7. Install dependencies
npm install

# 8. Run database migrations
npm run db:migrate

# 9. Start server with PM2
pm2 start ecosystem.config.cjs

# 10. Save PM2 configuration
pm2 save

# 11. Check status
pm2 status
pm2 logs panelx --nostream
```

---

### Method 3: Manual File Update (Advanced) ⚠️

**Use this if you can't use Git and want to keep your custom modifications**

```bash
# 1. Download the latest code
wget https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO/archive/refs/heads/main.zip

# 2. Extract
unzip main.zip

# 3. Stop server
pm2 stop panelx

# 4. Backup current installation
cd /path/to/your/panelx
cd ..
cp -r panelx panelx_backup_$(date +%Y%m%d)

# 5. Copy new files (keeping your .env and custom changes)
cd PanelX-V3.0.0-PRO-main
cp -r client /path/to/your/panelx/
cp -r server /path/to/your/panelx/
cp -r shared /path/to/your/panelx/
cp package.json /path/to/your/panelx/
cp package-lock.json /path/to/your/panelx/
# Copy other files as needed

# 6. Install dependencies
cd /path/to/your/panelx
npm install

# 7. Run migrations
npm run db:migrate

# 8. Restart server
pm2 restart panelx
```

---

## 📝 What's New in This Update

### ✨ Enhanced Create Line Form

**30+ fields added vs old version:**

#### Basic Tab
- ✅ Password visibility toggle (show/hide)
- ✅ Owner/Member selection dropdown
- ✅ Package selection
- ✅ Connection Limit Type (Package/Custom)
- ✅ No Expiration checkbox
- ✅ Quick Duration buttons (1M, 3M, 6M, 1Y)
- ✅ Bouquet Type (All/Selected) radio buttons
- ✅ Improved bouquet multi-selection

#### Security Tab
- ✅ Forced Country (Override GeoIP)
- ✅ ISP Lock
- ✅ Allowed Domains (Web Players)
- ✅ All existing fields improved

#### Advanced Tab
- ✅ Output Formats selection (M3U8, TS, RTMP)
- ✅ Play Token field
- ✅ Reseller Notes
- ✅ Admin Enabled toggle

### 🚀 Streaming Engine Improvements
- ✅ FFmpeg process management optimized
- ✅ On-Demand streaming perfected
- ✅ Load balancer enhancements
- ✅ Better error handling
- ✅ Improved logging

### 🎨 UI/UX Improvements
- ✅ Modern, clean design
- ✅ Better form layout
- ✅ Field descriptions/tooltips
- ✅ Improved error messages
- ✅ Better loading states

---

## 🔍 Post-Update Verification

After updating, verify everything is working:

### 1. Check Server Status
```bash
# Check if server is running
pm2 status

# Check logs
pm2 logs panelx --nostream

# Test API
curl http://localhost:5000/api/stats
```

### 2. Test Panel Access
```bash
# Open in browser
http://your-server-ip:5000

# Or with domain
https://your-domain.com
```

### 3. Test Create Line Form
1. Login as admin
2. Go to Lines page
3. Click "Create Line"
4. Verify all new fields are present:
   - Password toggle (eye icon)
   - Quick duration buttons
   - Bouquet Type radio buttons
   - Output Formats checkboxes
   - All new fields in Security and Advanced tabs

### 4. Test Streaming
```bash
# Test HLS stream
curl http://localhost:5000/live/testuser1/test123/1.m3u8

# Test M3U playlist
curl "http://localhost:5000/get.php?username=testuser1&password=test123&type=m3u_plus&output=ts"
```

### 5. Test Database
```bash
# Connect to database
psql -U panelx -d panelx

# Check tables
\dt

# Check lines
SELECT id, username, enabled FROM lines LIMIT 5;

# Exit
\q
```

---

## 🐛 Troubleshooting

### Issue 1: Server Won't Start

**Check logs:**
```bash
pm2 logs panelx
```

**Common causes:**
- Port 5000 already in use
- Database connection failed
- Missing dependencies

**Solutions:**
```bash
# Kill process on port 5000
fuser -k 5000/tcp

# Check database connection
psql -U panelx -d panelx -c "SELECT 1;"

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue 2: Database Migration Failed

```bash
# Check current migration status
npm run db:migrate -- --check

# Force run migrations
npm run db:migrate

# If still failing, check database logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Issue 3: Old Form Still Showing

**Browser cache issue:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+F5)
3. Try incognito/private window

**Code not updated:**
```bash
# Verify latest code
cd /path/to/your/panelx
git log --oneline | head -5

# Should show latest commits:
# d18ba57 FINAL SUMMARY
# 19c4242 Final test report
# 9ea8973 Complete implementation
```

### Issue 4: FFmpeg Not Working

```bash
# Check if FFmpeg is installed
ffmpeg -version

# Install FFmpeg if missing
sudo apt install -y ffmpeg

# Check FFmpeg processes
ps aux | grep ffmpeg

# Check streams directory
ls -la streams/

# Restart server
pm2 restart panelx
```

---

## 🔄 Rollback (If Needed)

If something goes wrong, you can rollback:

### Rollback Code
```bash
# Stop current server
pm2 stop panelx

# Restore from backup
cd /path/to/parent/directory
rm -rf panelx
cp -r panelx_backup_YYYYMMDD panelx  # Use your backup date

# Restart
cd panelx
pm2 start ecosystem.config.cjs
```

### Rollback Database
```bash
# Restore database from backup
psql -U panelx -d panelx < backup_before_update_YYYYMMDD_HHMMSS.sql
```

---

## 📊 Update Checklist

Use this checklist to track your update:

- [ ] **Pre-Update**
  - [ ] Backup database
  - [ ] Backup code
  - [ ] Backup .env file
  - [ ] Note current version/commit

- [ ] **Update**
  - [ ] Stop server
  - [ ] Pull/clone latest code
  - [ ] Copy .env file
  - [ ] Run npm install
  - [ ] Run database migrations
  - [ ] Start server

- [ ] **Verification**
  - [ ] Server starts successfully
  - [ ] Can login to admin panel
  - [ ] Create Line form shows new fields
  - [ ] Streaming works
  - [ ] Database queries work
  - [ ] No errors in logs

- [ ] **Post-Update**
  - [ ] Test all features
  - [ ] Monitor logs for 24 hours
  - [ ] Verify performance
  - [ ] Keep backup for 1 week

---

## 🎯 Quick Update Commands

**For most users, this is all you need:**

```bash
# Navigate to your panel
cd /path/to/your/panelx

# Backup
pg_dump -U panelx panelx > backup_$(date +%Y%m%d).sql

# Update
git pull origin main
npm install
npm run db:migrate

# Restart
pm2 restart panelx

# Verify
pm2 logs panelx --nostream
curl http://localhost:5000/api/stats

# Done! ✅
```

---

## 📞 Support

If you encounter issues:

1. **Check logs**: `pm2 logs panelx`
2. **Check documentation**: Read COMPLETE_IMPLEMENTATION_REPORT.md
3. **Check GitHub issues**: https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO/issues
4. **Rollback**: Use backup if needed

---

## 🎉 After Successful Update

You now have:
- ✅ Enhanced Create Line form with 30+ fields
- ✅ Password visibility toggle
- ✅ Quick duration buttons
- ✅ All new security fields
- ✅ Modern UI design
- ✅ Improved streaming engine
- ✅ Better performance

**Enjoy your updated panel! 🚀**

---

## 📝 Update History

| Date | Version | Commit | Changes |
|------|---------|--------|---------|
| 2026-01-22 | v3.0.0 PRO | d18ba57 | Complete implementation |
| | | 19c4242 | Final test report |
| | | 9ea8973 | Complete docs |
| | | 37d8891 | Enhanced Create Line |

---

**Last Updated**: January 22, 2026  
**Update Guide Version**: 1.0  
**Status**: Ready to Use ✅
