# 🚨 Manual Deployment Fix Guide - PanelX V3.0.0 PRO

## Current Issues Blocking Deployment

1. ❌ **Node.js v18.19.1** (too old - need v20+)
2. ❌ **Missing package** `@radix-ui/react-scroll-area`
3. ❌ **Git permission denied** on `.git/FETCH_HEAD`

---

## 🔧 Step-by-Step Manual Fix

### Step 1: Fix Git Permissions (Run as root or with sudo)

```bash
sudo chown -R panelx:panelx /home/panelx/webapp/.git
sudo chown -R panelx:panelx /home/panelx/webapp
```

**Verify:**
```bash
ls -la /home/panelx/webapp/.git/FETCH_HEAD
# Should show: panelx panelx
```

---

### Step 2: Upgrade Node.js to v20 LTS (Run as root or with sudo)

```bash
# Add Node.js 20 repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -

# Install Node.js 20
sudo apt-get install -y nodejs

# Verify version
node -v
# Should show: v20.x.x
```

**Critical:** If `node -v` still shows v18, you may need to:
```bash
# Remove old Node.js
sudo apt-get remove -y nodejs
sudo apt-get autoremove -y

# Install again
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# Verify
node -v
npm -v
```

---

### Step 3: Pull Latest Code (Run as panelx user)

```bash
cd /home/panelx/webapp

# Switch to panelx user if needed
sudo -u panelx bash

# Pull latest code
git fetch origin main
git reset --hard origin/main
```

---

### Step 4: Clean Install Dependencies (Run as panelx user)

```bash
cd /home/panelx/webapp

# Remove old node_modules and lock file
rm -rf node_modules package-lock.json

# Fresh install
npm install

# Install missing packages explicitly
npm install @radix-ui/react-scroll-area @radix-ui/react-checkbox @radix-ui/react-select
```

**Expected result:** No EBADENGINE errors, clean install

---

### Step 5: Build Frontend (Run as panelx user)

```bash
cd /home/panelx/webapp

# Build
npm run build
```

**Expected output:**
```
✓ built in Xms
✓ X modules transformed.
dist/index.html                   X kB
dist/assets/index-xxx.js          X kB
```

**If build fails:**
- Check Node.js version: `node -v` (must be 20+)
- Check for missing packages in error message
- Install missing packages: `npm install <package-name>`

---

### Step 6: Restart Backend (Run as panelx user)

```bash
cd /home/panelx/webapp

# Stop old process
pm2 delete panelx

# Start fresh
pm2 start ecosystem.config.cjs

# Save PM2 state
pm2 save

# Check status
pm2 list
pm2 logs panelx --lines 50
```

**Expected output:**
```
┌─────┬──────────┬─────────┬─────────┬──────────┐
│ id  │ name     │ status  │ restart │ uptime   │
├─────┼──────────┼─────────┼─────────┼──────────┤
│ 0   │ panelx   │ online  │ 0       │ 2s       │
└─────┴──────────┴─────────┴─────────┴──────────┘
```

Logs should show:
```
✅ Database connected successfully
Server listening on port 5000
```

---

### Step 7: Test Deployment

#### Test 1: Backend Health
```bash
curl http://localhost:5000/api/auth/check
```

**Expected:** JSON response (not 502 error)

#### Test 2: Frontend Access
Open browser: `http://69.169.102.47`

**Expected:** Login page loads (not nginx 502)

#### Test 3: Login
- Username: `admin`
- Password: `admin123`

**Expected:** Dashboard loads successfully

#### Test 4: Line Editing (THE FIX WE DEPLOYED)
1. Go to **Lines** page
2. Click **Edit** on line "testuser1"
3. Change **Max Connections** from 1 to 5
4. Click **Save**

**Expected:** ✅ "Success: Line updated successfully"
**Before fix:** ❌ "No values to set" error

#### Test 5: Bouquet Stream Selection (THE FIX WE DEPLOYED)
1. Go to **Bouquets** page
2. Click **Edit** on "Premium Package"
3. **NEW:** You should now see checkboxes for streams
4. Check the box next to "cna" (ID: 5)
5. Click **Save Changes**

**Expected:** ✅ "Success: Bouquet updated successfully"
**Before fix:** ❌ No way to add streams

#### Test 6: VLC Streaming
Open VLC → Media → Open Network Stream:
```
http://69.169.102.47/live/testuser1/test123/5.ts
```

**Expected:** Stream plays (after you assign stream 5 to the bouquet in Test 5)

---

## 🔍 Troubleshooting

### Issue: "Cannot find module @radix-ui/react-scroll-area"

**Fix:**
```bash
cd /home/panelx/webapp
npm install @radix-ui/react-scroll-area @radix-ui/react-checkbox @radix-ui/react-select
npm run build
```

### Issue: "EBADENGINE: requires node >= 20"

**Fix:** You still have Node.js v18. Follow Step 2 again carefully.

Check which Node.js is being used:
```bash
which node
node -v
```

If `/usr/local/bin/node` shows v18 but `/usr/bin/node` shows v20:
```bash
# Update alternatives
sudo update-alternatives --install /usr/bin/node node /usr/local/bin/node 20
```

### Issue: "error: cannot open '.git/FETCH_HEAD': Permission denied"

**Fix:**
```bash
sudo chown -R panelx:panelx /home/panelx/webapp
```

### Issue: Backend shows "online" but returns 502

**Check logs:**
```bash
pm2 logs panelx --lines 100
```

Look for:
- Database connection errors
- Port 5000 already in use
- Module import errors

**Fix port conflict:**
```bash
# Kill anything on port 5000
sudo fuser -k 5000/tcp
pm2 restart panelx
```

### Issue: Frontend shows 502 Bad Gateway

**Causes:**
1. Backend not running: `pm2 list` should show "online"
2. Nginx not configured correctly
3. Build failed

**Fix:**
```bash
# Check nginx config
sudo nginx -t

# Check if nginx is running
sudo systemctl status nginx

# Restart nginx
sudo systemctl restart nginx

# Check backend
pm2 list
curl http://localhost:5000/api/auth/check
```

---

## 📊 Quick Status Check Commands

```bash
# Node.js version
node -v

# Backend status
pm2 list
pm2 logs panelx --lines 20

# Backend health
curl http://localhost:5000/api/auth/check

# Nginx status
sudo systemctl status nginx

# Disk space
df -h

# Memory
free -h

# Port 5000 usage
sudo lsof -i :5000
```

---

## ✅ Success Criteria

After following all steps, you should have:

1. ✅ Node.js v20+ installed
2. ✅ All dependencies installed without errors
3. ✅ Frontend built successfully
4. ✅ Backend online in PM2
5. ✅ Login page accessible at http://69.169.102.47
6. ✅ Can login with admin/admin123
7. ✅ Can edit lines and save changes
8. ✅ Can assign streams to bouquets
9. ✅ VLC streaming works

---

## 🆘 If Nothing Works

**Nuclear option - fresh reinstall:**

```bash
# Backup database
sudo -u postgres pg_dump panelx_db > /tmp/panelx_backup.sql

# Clean slate
cd /home/panelx
rm -rf webapp
git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git webapp
cd webapp

# Install
npm install
npm run build

# Restore database
sudo -u postgres psql panelx_db < /tmp/panelx_backup.sql

# Start
pm2 delete panelx
pm2 start ecosystem.config.cjs
pm2 save
```

---

## 📞 Support

If you're still stuck:
1. Run: `pm2 logs panelx --lines 100`
2. Save the output
3. Report the error with logs

GitHub: https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO
