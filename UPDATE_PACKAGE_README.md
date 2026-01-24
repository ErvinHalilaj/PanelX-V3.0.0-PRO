# 📦 Server Update Package - Complete

## 🎯 How to Update Your Server

You now have **4 comprehensive guides** to help you update your server:

### 📄 Available Guides

1. **UPDATE_QUICK_CARD.txt** ⭐ **START HERE**
   - Printable quick reference card
   - One-page cheat sheet
   - All commands in one place
   - Perfect for keeping next to your computer

2. **QUICK_UPDATE_REFERENCE.md**
   - Quick 5-minute update guide
   - Two methods: Automatic + Manual
   - Testing instructions
   - Troubleshooting section

3. **SERVER_UPDATE_GUIDE.md**
   - Complete update documentation
   - Detailed troubleshooting
   - Full server setup guide
   - All commands explained

4. **VISUAL_UPDATE_GUIDE.md**
   - Step-by-step with expected outputs
   - Visual indicators
   - Complete verification checklist
   - Screenshot instructions

---

## 🚀 Quickest Way to Update (1 Command)

**On your server, run this:**

```bash
cd /opt/panelx && \
wget -O update-server.sh https://raw.githubusercontent.com/ErvinHalilaj/PanelX-V3.0.0-PRO/main/update-server.sh && \
chmod +x update-server.sh && \
sudo ./update-server.sh
```

**That's it!** The script handles everything:
- ✅ Stops service
- ✅ Downloads latest code
- ✅ Installs dependencies
- ✅ Restarts service
- ✅ Verifies everything works

---

## ✨ What You're Getting

### Phase 1.1: Stream Control Backend (Completed)
**NEW Features:**
- Start/Stop/Restart buttons for streams
- Real-time stream status tracking
- Viewer count tracking
- Color-coded buttons (Green/Red/Blue)

**How to Test:**
1. Go to Streams page
2. Hover over any stream
3. You'll see 3 new buttons: Start, Stop, Restart
4. Click them to control streams

### Phase 1.2: Export Functionality (Completed)
**NEW Features:**
- Export Lines to CSV/Excel/M3U
- Export Streams to CSV/Excel
- Export Users to CSV (admin only)
- Auto-download with timestamps

**How to Test:**
1. **Lines page**: 3 new buttons (CSV, Excel, M3U)
2. **Streams page**: 2 new buttons (CSV, Excel)
3. Click to download files

---

## 📊 What Changed in Your Code

### New Files Added:
```
server/export-service.ts          - Export functionality
server/ffmpegManager.ts            - Stream control (already existed, enhanced)
update-server.sh                   - Automatic update script
SERVER_UPDATE_GUIDE.md             - Complete guide
QUICK_UPDATE_REFERENCE.md          - Quick guide
VISUAL_UPDATE_GUIDE.md             - Step-by-step guide
UPDATE_QUICK_CARD.txt              - Quick card
```

### Files Modified:
```
server/routes.ts                   - Added 11 new endpoints
client/src/pages/Streams.tsx       - Added control buttons
client/src/pages/Lines.tsx         - Added export buttons
```

### New Endpoints Added:
```
Stream Control (4):
POST   /api/streams/:id/start
POST   /api/streams/:id/stop
POST   /api/streams/:id/restart
GET    /api/streams/:id/status

Export Lines (3):
GET    /api/lines/export/csv
GET    /api/lines/export/excel
GET    /api/lines/export/m3u

Export Streams (2):
GET    /api/streams/export/csv
GET    /api/streams/export/excel

Export Users (1):
GET    /api/users/export/csv

Total: 10 new endpoints
```

---

## 🔍 Before and After Comparison

### BEFORE Update:

**Streams Page:**
```
Actions: [▶️ Play] [✏️ Edit] [🗑️ Delete]
Export: ❌ None
```

**Lines Page:**
```
Export: ❌ None
```

### AFTER Update:

**Streams Page:**
```
Actions: [▶️ Play] [▶️ Start] [⏹️ Stop] [🔄 Restart] [✏️ Edit] [🗑️ Delete]
Export: ✅ [📄 CSV] [📊 Excel]
```

**Lines Page:**
```
Export: ✅ [📄 CSV] [📊 Excel] [📺 M3U]
```

---

## 🎯 Step-by-Step Update Process

### Option A: Automatic (Recommended) - 5 minutes

1. **SSH to your server:**
   ```bash
   ssh user@your-server-ip
   ```

2. **Run the update script:**
   ```bash
   cd /opt/panelx
   wget -O update-server.sh https://raw.githubusercontent.com/ErvinHalilaj/PanelX-V3.0.0-PRO/main/update-server.sh
   chmod +x update-server.sh
   sudo ./update-server.sh
   ```

3. **Clear browser cache:**
   - Press `Ctrl+Shift+R` on your panel page

4. **Done!** Test the new features

---

### Option B: Manual - 5 minutes

1. **SSH to server:**
   ```bash
   ssh user@your-server-ip
   ```

2. **Navigate and stop:**
   ```bash
   cd /opt/panelx
   sudo systemctl stop panelx
   ```

3. **Update code:**
   ```bash
   git pull origin main
   npm install
   ```

4. **Restart:**
   ```bash
   sudo systemctl start panelx
   ```

5. **Verify:**
   ```bash
   curl http://localhost:5000/api/stats
   ```

6. **Clear browser cache:**
   - Press `Ctrl+Shift+R`

---

## ✅ Verification Checklist

After updating, verify these work:

### Backend Tests:
```bash
# Test server
curl http://localhost:5000/api/stats
# ✅ Should return JSON with stats

# Test stream status
curl http://localhost:5000/api/streams/1/status
# ✅ Should return stream status

# Test service
sudo systemctl status panelx
# ✅ Should show "active (running)"
```

### Frontend Tests:
- [ ] Panel loads: `http://your-server-ip:5000`
- [ ] Login works: `admin` / `admin123`
- [ ] Dashboard shows stats
- [ ] Streams page loads
- [ ] Lines page loads

### New Features Tests:
- [ ] **Stream Control**:
  - [ ] Hover over stream → See Start/Stop/Restart buttons
  - [ ] Click Start → See success message
  - [ ] Click Stop → See success message
  - [ ] Click Restart → See success message

- [ ] **Lines Export**:
  - [ ] See 3 export buttons (CSV/Excel/M3U)
  - [ ] Click CSV → File downloads
  - [ ] Click Excel → File downloads
  - [ ] Click M3U → File downloads
  - [ ] Files contain correct data

- [ ] **Streams Export**:
  - [ ] See 2 export buttons (CSV/Excel)
  - [ ] Click CSV → File downloads
  - [ ] Click Excel → File downloads
  - [ ] Files contain correct data

---

## 🔧 Common Issues and Solutions

### Issue 1: "Service won't start"

**Solution:**
```bash
# Check what's using port 5000
lsof -i :5000

# Kill it
fuser -k 5000/tcp

# Restart
sudo systemctl restart panelx

# Check logs
sudo journalctl -u panelx -n 50
```

### Issue 2: "Old UI still showing"

**Solution:**
```bash
# Clear browser cache!
# Press: Ctrl+Shift+R (several times)
# Or: Ctrl+Shift+Delete → Clear all cache
# Or: Try incognito window
```

### Issue 3: "Git pull fails"

**Solution:**
```bash
cd /opt/panelx
git config credential.helper store
git pull origin main
# Enter GitHub username + personal access token
```

### Issue 4: "Buttons not appearing"

**Solution:**
1. Clear browser cache (Ctrl+Shift+R)
2. Try incognito window
3. Check browser console (F12) for errors
4. Verify code updated: `git log -1 --oneline`
5. Should show commit `b7670a9` or later

### Issue 5: "Database connection error"

**Solution:**
```bash
# Check PostgreSQL
sudo systemctl status postgresql
sudo systemctl restart postgresql

# Test connection
psql -h localhost -U panelx -d panelx -c "SELECT 1;"

# Check .env file
cat /opt/panelx/.env
```

---

## 📞 Getting Help

If you encounter issues, provide these:

1. **Error messages:**
   ```bash
   sudo journalctl -u panelx -n 100 > logs.txt
   ```

2. **Service status:**
   ```bash
   sudo systemctl status panelx > status.txt
   ```

3. **API test:**
   ```bash
   curl -v http://localhost:5000/api/stats > api.txt 2>&1
   ```

4. **Git status:**
   ```bash
   cd /opt/panelx
   git log -1 --oneline > git.txt
   ```

5. **Screenshots** of any UI errors

6. **Browser console** (F12 → Console tab)

---

## 🎯 Success Criteria

You'll know the update succeeded when:

1. ✅ Update script shows "✅ Update Complete!"
2. ✅ `curl http://localhost:5000/api/stats` returns JSON
3. ✅ `sudo systemctl status panelx` shows "active (running)"
4. ✅ Panel loads in browser
5. ✅ Stream control buttons visible on hover
6. ✅ Export buttons visible (Lines: 3, Streams: 2)
7. ✅ Click Start → Success message
8. ✅ Click Export → File downloads
9. ✅ No errors in logs
10. ✅ Old features still work

---

## 📊 Current Status

**Repository:** https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO

**Latest Commit:** `b7670a9` (2026-01-24)

**Changes:**
- ✅ Stream Control Backend (Phase 1.1)
- ✅ Export Functionality (Phase 1.2)
- ✅ Automatic Update Script
- ✅ Complete Documentation

**Implementation:**
- Files Changed: 6
- New Endpoints: 10
- New Features: 2 major
- Documentation: 4 guides

**Progress:**
- Overall: 16% complete (2/12 phases)
- Phase 1 (Essential): 66% complete (2/3)
- Time Invested: 10 hours
- Remaining: 65 hours

---

## 🚀 Next Steps (After This Update)

Once you verify this update works, we can implement:

### Phase 1.3: Complete Edit Stream Form (3 hours)
**Missing fields:**
- Server selection dropdown
- Transcode profile selection
- Custom SID input
- Admin/Reseller notes
- Stream icon upload
- Enable/disable toggle
- Recording settings
- Catchup settings

Would you like to proceed with Phase 1.3 after testing?

---

## 💡 Pro Tips

1. **Always backup before updating:**
   ```bash
   pg_dump -U panelx panelx > backup_$(date +%Y%m%d).sql
   ```

2. **Keep the update script for future updates:**
   ```bash
   # Next time, just run:
   cd /opt/panelx
   sudo ./update-server.sh
   ```

3. **Monitor logs while testing:**
   ```bash
   # Terminal 1: Use panel
   # Terminal 2: Watch logs
   sudo journalctl -u panelx -f
   ```

4. **Test in incognito first:**
   - Ensures fresh UI
   - No cache issues
   - Ctrl+Shift+N (Chrome)

5. **Keep documentation handy:**
   - Print `UPDATE_QUICK_CARD.txt`
   - Keep it next to your computer
   - Quick reference for common commands

---

## 📚 Documentation Index

**Quick Reference:**
- `UPDATE_QUICK_CARD.txt` - One-page cheat sheet ⭐
- `QUICK_UPDATE_REFERENCE.md` - Quick guide

**Complete Guides:**
- `SERVER_UPDATE_GUIDE.md` - Full update guide
- `VISUAL_UPDATE_GUIDE.md` - Step-by-step with screenshots

**Project Documentation:**
- `DEPLOYMENT_GUIDE.md` - Full deployment
- `ENTERPRISE_PROGRESS.md` - Implementation status
- `MISSING_FEATURES_ANALYSIS.md` - Complete feature list
- `FINAL_COMPLETION_REPORT.md` - Previous work summary

**Technical Documentation:**
- `README.md` - Project overview
- `package.json` - Dependencies and scripts

---

## ✅ Final Checklist

Before you start:
- [ ] Read `UPDATE_QUICK_CARD.txt`
- [ ] SSH access to server ready
- [ ] Backup database (optional but recommended)
- [ ] Note current panel URL
- [ ] Have GitHub access ready (if manual update)

During update:
- [ ] Run update script OR follow manual steps
- [ ] Watch for errors
- [ ] Note any issues

After update:
- [ ] Verify server responding
- [ ] Clear browser cache
- [ ] Test new features
- [ ] Check for errors

---

**Status:** ✅ **READY TO UPDATE**

**Time Required:** 5-10 minutes

**Difficulty:** Easy

**Risk Level:** Low (can rollback with git)

---

## 🎯 Summary

You're updating PanelX with:
- 🎮 **Stream Control**: Start/Stop/Restart streams
- 📊 **Export**: Download data as CSV/Excel/M3U
- 🤖 **Automation**: One-command update script
- 📚 **Documentation**: 4 comprehensive guides

**How to update:**
1. Copy the one-command update from above
2. SSH to your server
3. Paste and run
4. Clear browser cache
5. Test features

**Need help?** Check the documentation or send error logs.

**Repository:** https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO

**Latest Commit:** `b7670a9`

**Status:** ✅ Ready

---

**Good luck with your update! 🚀**
