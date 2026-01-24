# 🎬 Visual Update Guide - Step by Step

## 🚀 Updating Your Server (Complete Visual Guide)

---

## Method 1: Automatic Update (RECOMMENDED) ⚡

### Step 1: Connect to Your Server via SSH

**Windows (using PuTTY or PowerShell):**
```powershell
ssh user@your-server-ip
```

**Mac/Linux (using Terminal):**
```bash
ssh user@your-server-ip
```

**What you should see:**
```
Welcome to Ubuntu 22.04 LTS
user@server:~$
```

---

### Step 2: Download and Run Update Script

**Copy and paste this entire command:**
```bash
cd /opt/panelx && \
wget -O update-server.sh https://raw.githubusercontent.com/ErvinHalilaj/PanelX-V3.0.0-PRO/main/update-server.sh && \
chmod +x update-server.sh && \
sudo ./update-server.sh
```

**What the script does:**
1. ✅ Backs up database
2. ✅ Stops PanelX service
3. ✅ Downloads latest code
4. ✅ Installs dependencies
5. ✅ Restarts service
6. ✅ Verifies everything works

**Expected output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 PanelX Server Update Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Navigating to project directory...
✅ In /opt/panelx

🛑 Stopping PanelX service...
✅ Stopped systemd service

📥 Pulling latest changes from GitHub...
✅ Updated to latest commit: 9f047f9

📦 Installing dependencies...
✅ Dependencies installed

🚀 Starting PanelX service...
✅ Started systemd service

🔍 Verifying server status...
✅ Server is working! Stats API response:
{
  "totalStreams": 4,
  "totalLines": 4,
  "activeConnections": 0,
  ...
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Update Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Step 3: Clear Your Browser Cache

**CRITICAL STEP** - Old JavaScript/CSS may be cached!

**Option A: Hard Refresh (Quick)**
- **Windows/Linux**: Press `Ctrl + Shift + R`
- **Mac**: Press `Cmd + Shift + R`

**Option B: Clear Cache (Thorough)**
1. Press `Ctrl + Shift + Delete` (Windows/Linux)
2. Or `Cmd + Shift + Delete` (Mac)
3. Select "Cached images and files"
4. Select "All time"
5. Click "Clear data"

**Option C: Incognito/Private Window (Testing)**
- **Chrome**: `Ctrl + Shift + N`
- **Firefox**: `Ctrl + Shift + P`
- **Safari**: `Cmd + Shift + N`

---

### Step 4: Test New Features

#### 🎯 Test 1: Stream Control Buttons

1. **Open panel**: `http://your-server-ip:5000`
2. **Login**: `admin` / `admin123`
3. **Go to**: Streams page
4. **Hover** over any stream row
5. **You should see** 5 action buttons:
   ```
   [▶️ Play] [▶️ Start] [⏹️ Stop] [🔄 Restart] [✏️ Edit] [🗑️ Delete]
   ```
   
   **NEW buttons**: Start (green), Stop (red), Restart (blue)

6. **Test**:
   - Click **Start** → You should see: "✅ Stream started successfully"
   - Click **Stop** → You should see: "✅ Stream stopped successfully"
   - Click **Restart** → You should see: "✅ Stream restarted successfully"

**Expected behavior:**
- Buttons change color on hover
- Toast notification appears after clicking
- Stream status updates in real-time

---

#### 🎯 Test 2: Export Lines

1. **Go to**: Lines page
2. **You should see** 3 new buttons at the top:
   ```
   [📥 Bulk Actions ▼] [📄 CSV] [📊 Excel] [📺 M3U] [➕ Create Line]
   ```
   
   **NEW buttons**: CSV, Excel, M3U

3. **Test CSV Export**:
   - Click **CSV** button
   - File downloads: `lines_export_2026-01-24_123456.csv`
   - Open in Excel/Notepad
   - Should contain: Username, Password, Expires, Max Connections, etc.

4. **Test Excel Export**:
   - Click **Excel** button
   - File downloads: `lines_export_2026-01-24_123456.xlsx`
   - Open in Excel
   - Should have formatted table with all line data

5. **Test M3U Export**:
   - Click **M3U** button
   - File downloads: `lines_playlist_2026-01-24_123456.m3u`
   - Open in VLC/Media Player
   - Should contain all line URLs

**Expected file content (CSV example):**
```csv
Username,Password,Member,Expires,Max Connections,Is Trial,Is Restreamer,Status
user1,pass1,admin,2026-12-31,1,No,No,Active
user2,pass2,reseller1,2026-06-30,2,Yes,No,Active
```

---

#### 🎯 Test 3: Export Streams

1. **Go to**: Streams page
2. **You should see** 2 new buttons at the top:
   ```
   [📥 Import M3U] [🔄 Category ▼] [📄 CSV] [📊 Excel] [➕ Add Stream]
   ```
   
   **NEW buttons**: CSV, Excel

3. **Test CSV Export**:
   - Click **CSV** button
   - File downloads: `streams_export_2026-01-24_123456.csv`
   - Open file
   - Should contain: Stream Name, Source URL, Category, Type, Status

4. **Test Excel Export**:
   - Click **Excel** button
   - File downloads: `streams_export_2026-01-24_123456.xlsx`
   - Open in Excel
   - Should have formatted table

**Expected file content (CSV example):**
```csv
Stream Name,Source URL,Category,Type,Status
CNN Live,http://...,News,Live,Online
BBC World,http://...,News,Live,Offline
Discovery,http://...,Documentary,Live,Online
```

---

## Method 2: Manual Update (Alternative) 📝

If automatic script doesn't work, do it manually:

### Step 1: SSH to Server
```bash
ssh user@your-server-ip
```

### Step 2: Navigate to Project
```bash
cd /opt/panelx
```

### Step 3: Check Current Status
```bash
sudo systemctl status panelx
# Note if it's running
```

### Step 4: Stop Service
```bash
# If using systemd:
sudo systemctl stop panelx

# If using PM2:
pm2 stop panelx

# If using screen:
screen -r panelx
# Press Ctrl+C
# Press Ctrl+A, then D

# Manual/other:
fuser -k 5000/tcp
```

### Step 5: Backup (Optional but Recommended)
```bash
pg_dump -U panelx panelx > /tmp/panelx_backup_$(date +%Y%m%d).sql
```

### Step 6: Pull Latest Changes
```bash
git fetch origin main
git reset --hard origin/main
```

**What you should see:**
```
HEAD is now at 9f047f9 📚 Add server update guides
```

### Step 7: Install Dependencies
```bash
npm install
```

**What you should see:**
```
added 0 packages, changed 0 packages in 2s
```

### Step 8: Start Service
```bash
# If using systemd:
sudo systemctl start panelx
sudo systemctl status panelx

# If using PM2:
pm2 restart panelx
pm2 logs panelx --nostream

# Manual:
cd /opt/panelx
source .env
nohup npx tsx server/index.ts > server.log 2>&1 &
```

### Step 9: Verify
```bash
# Test API
curl http://localhost:5000/api/stats

# Should return JSON:
{
  "totalStreams": 4,
  "totalLines": 4,
  ...
}
```

### Step 10: Clear Browser Cache
Same as Method 1, Step 3

### Step 11: Test Features
Same as Method 1, Step 4

---

## 🔧 Troubleshooting Guide

### Issue 1: "Service failed to start"

**Check logs:**
```bash
# For systemd:
sudo journalctl -u panelx -n 50 --no-pager

# For PM2:
pm2 logs panelx --lines 50

# Manual:
tail -50 /opt/panelx/server.log
```

**Common fixes:**

**Error: "Port 5000 already in use"**
```bash
# Find what's using port:
lsof -i :5000

# Kill it:
fuser -k 5000/tcp

# Restart service:
sudo systemctl restart panelx
```

**Error: "DATABASE_URL must be set"**
```bash
# Check .env file:
cat /opt/panelx/.env

# Should contain:
DATABASE_URL=postgresql://panelx:panelx123@localhost:5432/panelx
PORT=5000
NODE_ENV=production
SESSION_SECRET=your-secret-here

# If missing, create it:
nano /opt/panelx/.env
```

**Error: "Database connection failed"**
```bash
# Check PostgreSQL:
sudo systemctl status postgresql
sudo systemctl restart postgresql

# Test connection:
psql -h localhost -U panelx -d panelx -c "SELECT 1;"
```

---

### Issue 2: "Old UI still showing"

**Solution 1: Hard Refresh**
- Press `Ctrl + Shift + R` several times

**Solution 2: Clear All Cache**
1. `Ctrl + Shift + Delete`
2. Select everything
3. Clear

**Solution 3: Incognito Window**
- Open panel in incognito/private mode
- If it works there, cache is the issue

**Solution 4: Different Browser**
- Try Chrome, Firefox, Edge
- If works in different browser, clear cache in original

**Solution 5: Server-side Cache Clear**
```bash
cd /opt/panelx
rm -rf client/.vite
sudo systemctl restart panelx
```

---

### Issue 3: "Buttons not appearing"

**Check 1: Clear cache** (see above)

**Check 2: Verify code updated**
```bash
cd /opt/panelx
git log -1 --oneline
# Should show: 9f047f9 or later
```

**Check 3: Check browser console**
1. Press `F12`
2. Click "Console" tab
3. Look for errors (red text)
4. Send screenshot if errors found

**Check 4: Hard reload assets**
```bash
# On server:
cd /opt/panelx
sudo systemctl restart panelx

# In browser:
# Ctrl+Shift+R multiple times
```

---

### Issue 4: "Export doesn't work"

**Check 1: Authentication**
- Make sure you're logged in
- Try logging out and back in

**Check 2: Check browser console**
1. Press `F12`
2. Click "Network" tab
3. Click export button
4. Look for API call
5. Check response

**Check 3: Test API directly**
```bash
# Login first to get cookie
curl -c /tmp/cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Test export
curl -b /tmp/cookies.txt http://localhost:5000/api/lines/export/csv > test.csv

# Check file
cat test.csv
```

---

### Issue 5: "Stream control doesn't work"

**Check 1: Backend endpoints**
```bash
# Test status endpoint
curl -b /tmp/cookies.txt http://localhost:5000/api/streams/1/status

# Should return:
{"status":"offline","isRunning":false}
```

**Check 2: FFmpeg installed**
```bash
which ffmpeg
# Should show: /usr/bin/ffmpeg

# If not installed:
sudo apt update && sudo apt install -y ffmpeg
```

**Check 3: Check logs**
```bash
sudo journalctl -u panelx -f
# Click Start button
# Watch for errors
```

---

## 📊 Complete Verification Checklist

Use this checklist to verify everything works:

### Backend Verification
```bash
# 1. Server responding
curl http://localhost:5000/api/stats
# ✅ Returns JSON with stats

# 2. Service running
sudo systemctl status panelx
# ✅ Active (running)

# 3. Port listening
lsof -i :5000
# ✅ Shows node/tsx process

# 4. Database connected
psql -h localhost -U panelx -d panelx -c "SELECT COUNT(*) FROM users;"
# ✅ Returns count

# 5. Logs clean
sudo journalctl -u panelx -n 20
# ✅ No errors
```

### Frontend Verification
- [ ] Panel loads: `http://your-server-ip:5000`
- [ ] Login works: `admin` / `admin123`
- [ ] Dashboard shows stats
- [ ] Streams page loads
- [ ] Lines page loads
- [ ] Categories page loads

### New Features Verification
- [ ] Stream control buttons appear on hover
- [ ] Start button works (green, success message)
- [ ] Stop button works (red, success message)
- [ ] Restart button works (blue, success message)
- [ ] Lines CSV export downloads file
- [ ] Lines Excel export downloads file
- [ ] Lines M3U export downloads file
- [ ] Streams CSV export downloads file
- [ ] Streams Excel export downloads file
- [ ] Downloaded files contain correct data
- [ ] Filenames include timestamp

---

## 🎯 Expected Behavior Summary

### Stream Control
**Before**: Only had Play, Edit, Delete buttons  
**After**: Now has Play, **Start**, **Stop**, **Restart**, Edit, Delete  

**Visual**: 
- Start button: Green, appears on hover
- Stop button: Red, appears on hover
- Restart button: Blue, appears on hover

**Functionality**:
- Click Start → FFmpeg process starts
- Click Stop → FFmpeg process stops
- Click Restart → Process stops and starts
- Toast notification shows success/error

### Export Functionality
**Before**: No export buttons  
**After**: 
- Lines: 3 export buttons (CSV, Excel, M3U)
- Streams: 2 export buttons (CSV, Excel)

**Visual**:
- Buttons next to "Create Line" / "Add Stream"
- Icons: 📄 CSV, 📊 Excel, 📺 M3U

**Functionality**:
- Click button → File downloads automatically
- Filename: `[entity]_export_[timestamp].[ext]`
- Contains all data from current view

---

## 💡 Pro Tips

1. **Always backup before updating**
   ```bash
   pg_dump -U panelx panelx > backup_$(date +%Y%m%d).sql
   ```

2. **Use screen for long updates**
   ```bash
   screen -S update
   ./update-server.sh
   # Press Ctrl+A, then D to detach
   ```

3. **Monitor logs during testing**
   ```bash
   # Terminal 1: Run tests
   # Terminal 2: Watch logs
   sudo journalctl -u panelx -f
   ```

4. **Test in incognito first**
   - Ensures fresh UI
   - No cache issues
   - Clear indication if update worked

5. **Keep update script**
   ```bash
   # Future updates:
   cd /opt/panelx
   sudo ./update-server.sh
   ```

---

## 📞 Getting Help

If you encounter issues, provide:

1. **Error messages**:
   ```bash
   sudo journalctl -u panelx -n 100 --no-pager > panelx_logs.txt
   ```

2. **Service status**:
   ```bash
   sudo systemctl status panelx > panelx_status.txt
   ```

3. **API test**:
   ```bash
   curl -v http://localhost:5000/api/stats > panelx_api.txt 2>&1
   ```

4. **Screenshots** of any UI errors

5. **Browser console** (F12 → Console tab)

Send all these files for analysis.

---

## ✅ Success Indicators

You'll know update succeeded when:

1. ✅ Script shows "Update Complete!"
2. ✅ API returns stats: `curl http://localhost:5000/api/stats`
3. ✅ Panel loads in browser
4. ✅ New buttons visible (after cache clear)
5. ✅ Features work (click → download/success)
6. ✅ No errors in logs
7. ✅ Old features still work (Dashboard, CRUD)

---

**Latest Commit**: `9f047f9`  
**Date**: 2026-01-24  
**Status**: ✅ Ready to update  
**Time**: 5 minutes  
**Difficulty**: Easy  

**Repository**: https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO
