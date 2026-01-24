# 🔄 Server Update Guide - Latest Changes

## Quick Update (5 minutes)

### Step 1: SSH to Your Server
```bash
ssh user@your-server-ip
```

### Step 2: Navigate to Project
```bash
cd /opt/panelx
```

### Step 3: Stop the Service
```bash
# If using systemd:
sudo systemctl stop panelx

# If using PM2:
pm2 stop panelx

# If using screen:
screen -r panelx
# Then press Ctrl+C to stop
# Press Ctrl+A, then D to detach

# If running manually:
fuser -k 5000/tcp
```

### Step 4: Pull Latest Changes
```bash
git pull origin main
```

### Step 5: Install Dependencies (if any new packages)
```bash
npm install
```

### Step 6: Restart the Service
```bash
# If using systemd:
sudo systemctl start panelx
sudo systemctl status panelx

# If using PM2:
pm2 restart panelx
pm2 logs panelx --nostream

# If using screen:
screen -S panelx
DATABASE_URL="postgresql://panelx:panelx123@localhost:5432/panelx" PORT=5000 NODE_ENV=development SESSION_SECRET="your-secret" npx tsx server/index.ts
# Then press Ctrl+A, then D to detach

# If running manually:
cd /opt/panelx
DATABASE_URL="postgresql://panelx:panelx123@localhost:5432/panelx" PORT=5000 NODE_ENV=production SESSION_SECRET="your-secret" nohup npx tsx server/index.ts > server.log 2>&1 &
```

### Step 7: Verify It's Working
```bash
# Test API
curl http://localhost:5000/api/stats

# Check if you get JSON response with stats
```

### Step 8: Clear Browser Cache
1. Open your panel: `http://your-server-ip:5000`
2. Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
3. Or press `Ctrl+Shift+Delete` and clear cached images/files

---

## 🎯 What You Should Test

### New Feature 1: Stream Control (Phase 1.1)
1. Login to panel: `http://your-server:5000`
2. Go to **Streams** page
3. Hover over any stream row
4. You should see **5 action buttons**:
   - Play (blue)
   - **Start** (green) ← NEW
   - **Stop** (red) ← NEW
   - **Restart** (blue) ← NEW
   - Edit (white)
   - Delete (red)

**Test**:
- Click **Start** → Should start FFmpeg process
- Click **Stop** → Should stop stream
- Click **Restart** → Should restart stream
- Check for success/error messages

### New Feature 2: Export Functionality (Phase 1.2)

#### Test Lines Export:
1. Go to **Lines** page
2. You should see **3 new buttons** at the top:
   - **CSV** button
   - **Excel** button
   - **M3U** button

**Test**:
- Click **CSV** → Should download `lines_export_[timestamp].csv`
- Click **Excel** → Should download `lines_export_[timestamp].xlsx`
- Click **M3U** → Should download `lines_playlist_[timestamp].m3u`
- Open files to verify data is correct

#### Test Streams Export:
1. Go to **Streams** page
2. You should see **2 new buttons** at the top:
   - **CSV** button
   - **Excel** button

**Test**:
- Click **CSV** → Should download `streams_export_[timestamp].csv`
- Click **Excel** → Should download `streams_export_[timestamp].xlsx`
- Open files to verify data is correct

---

## 🔧 Troubleshooting

### Issue: Git pull fails with "Authentication failed"
**Solution**:
```bash
cd /opt/panelx
git config credential.helper store
git pull origin main
# Enter GitHub username and personal access token when prompted
```

### Issue: Service won't start
**Check logs**:
```bash
# For systemd:
sudo journalctl -u panelx -n 50

# For PM2:
pm2 logs panelx

# For manual:
tail -50 server.log
```

**Common fixes**:
```bash
# Check if port 5000 is already in use:
lsof -i :5000

# Kill process using port 5000:
fuser -k 5000/tcp

# Check database connection:
psql -h localhost -U panelx -d panelx -c "SELECT 1;"

# Restart PostgreSQL if needed:
sudo systemctl restart postgresql
```

### Issue: NPM install fails
**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Issue: Server starts but features don't work
**Check environment variables**:
```bash
# Verify .env file exists
cat /opt/panelx/.env

# Should contain:
# DATABASE_URL=postgresql://panelx:panelx123@localhost:5432/panelx
# PORT=5000
# NODE_ENV=production
# SESSION_SECRET=your-secret-here
```

### Issue: Old UI still showing after update
**Solution**:
1. **Clear browser cache** (most common issue):
   - Press `Ctrl+Shift+Delete`
   - Select "Cached images and files"
   - Choose "All time"
   - Clear data

2. **Hard refresh**:
   - Press `Ctrl+Shift+R` (Windows/Linux)
   - Press `Cmd+Shift+R` (Mac)

3. **Try incognito/private window**:
   - Chrome: `Ctrl+Shift+N`
   - Firefox: `Ctrl+Shift+P`

---

## 📋 Verification Checklist

After updating, verify these work:

### Backend Tests:
```bash
# Test stream control endpoints
curl -X POST http://localhost:5000/api/streams/1/status

# Test export endpoints (with authentication)
curl http://localhost:5000/api/lines/export/csv -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

### Frontend Tests:
- [ ] Dashboard loads
- [ ] Streams page loads
- [ ] Lines page loads
- [ ] Stream control buttons visible on hover
- [ ] Export buttons visible (Lines: 3 buttons, Streams: 2 buttons)
- [ ] Clicking Start shows success message
- [ ] Clicking Export CSV downloads file
- [ ] Downloaded files contain correct data

---

## 🚀 Full Server Setup (If Starting Fresh)

If you need to set up from scratch:

### 1. Install Dependencies
```bash
sudo apt update
sudo apt install -y postgresql nodejs npm git
```

### 2. Setup Database
```bash
sudo -u postgres createuser panelx
sudo -u postgres createdb panelx
sudo -u postgres psql -c "ALTER USER panelx WITH PASSWORD 'panelx123';"
```

### 3. Clone Repository
```bash
cd /opt
sudo git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO panelx
sudo chown -R $USER:$USER panelx
cd panelx
```

### 4. Install Packages
```bash
npm install
```

### 5. Setup Environment
```bash
cat > .env << 'EOF'
DATABASE_URL=postgresql://panelx:panelx123@localhost:5432/panelx
PORT=5000
NODE_ENV=production
SESSION_SECRET=$(openssl rand -hex 32)
EOF
```

### 6. Initialize Database
```bash
npm run db:push
```

### 7. Create Systemd Service
```bash
sudo nano /etc/systemd/system/panelx.service
```

Paste this:
```ini
[Unit]
Description=PanelX IPTV Panel
After=network.target postgresql.service

[Service]
Type=simple
User=panelx
WorkingDirectory=/opt/panelx
EnvironmentFile=/opt/panelx/.env
ExecStart=/usr/bin/npx tsx server/index.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable panelx
sudo systemctl start panelx
sudo systemctl status panelx
```

---

## 📞 Quick Commands Reference

```bash
# Update panel
cd /opt/panelx && git pull origin main && npm install && sudo systemctl restart panelx

# Check status
sudo systemctl status panelx

# View logs
sudo journalctl -u panelx -f

# Restart service
sudo systemctl restart panelx

# Check if running
curl http://localhost:5000/api/stats

# View server logs
tail -f /opt/panelx/server.log

# Check port
lsof -i :5000

# Kill process on port 5000
fuser -k 5000/tcp
```

---

## 🎯 What's New in This Update

### Commit: `707cfa7` - Progress Report
- Added `ENTERPRISE_PROGRESS.md` documentation

### Commit: `a9292d1` - Export Functionality
- **NEW**: Export Lines to CSV/Excel/M3U
- **NEW**: Export Streams to CSV/Excel
- **NEW**: Export Users to CSV (admin only)
- **Files**: `server/export-service.ts` (new)
- **Endpoints**: 7 new export endpoints

### Commit: `75705c1` - Stream Control Backend
- **NEW**: Start/Stop/Restart stream buttons work
- **NEW**: Real-time stream status tracking
- **NEW**: Viewer count tracking
- **Endpoints**: 4 new stream control endpoints

---

## ✅ Success Indicators

After update, you should see:

1. **No errors in logs**
2. **Server responding on port 5000**
3. **New buttons visible in UI**:
   - Stream control buttons (Start/Stop/Restart)
   - Export buttons (CSV/Excel/M3U)
4. **Features working**:
   - Click Start → Stream starts
   - Click Export → File downloads

---

## 💡 Pro Tips

1. **Always backup before updating**:
   ```bash
   pg_dump -U panelx panelx > /opt/panelx_backup_$(date +%Y%m%d).sql
   ```

2. **Keep logs for debugging**:
   ```bash
   sudo journalctl -u panelx --since today > panelx_logs.txt
   ```

3. **Test in browser incognito first**:
   - Ensures you're seeing fresh UI
   - No cache issues

4. **Monitor logs while testing**:
   ```bash
   sudo journalctl -u panelx -f
   ```

---

## 📖 Documentation

Full documentation available in repository:
- `DEPLOYMENT_GUIDE.md` - Complete deployment
- `ENTERPRISE_PROGRESS.md` - Current progress
- `MISSING_FEATURES_ANALYSIS.md` - Full feature list
- `FINAL_COMPLETION_REPORT.md` - Previous work

---

**Repository**: https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO
**Latest Commit**: `707cfa7`
**Status**: ✅ Ready to update

---

**Need Help?** If you encounter any issues during update, send me:
1. Error messages from logs
2. Screenshots of any errors
3. Output of: `sudo systemctl status panelx`
