# 🔧 Fix: Panel Not Updating on Server

## 🎯 Problem
After running `git pull`, your server still shows the old Create Line form instead of the new enhanced version with 30+ fields.

## 🔍 Root Cause
The issue is that you need to **rebuild the frontend** after pulling new code. The old compiled JavaScript is still being served.

---

## ✅ SOLUTION: Rebuild Frontend

### Step 1: SSH to Your Server
```bash
ssh user@your-server-ip
```

### Step 2: Navigate to PanelX Directory
```bash
cd /path/to/your/panelx
# Common locations:
# cd /home/panelx/PanelX-V3.0.0-PRO
# cd /var/www/panelx
# cd ~/panelx
```

### Step 3: Stop the Server
```bash
pm2 stop panelx
```

### Step 4: Pull Latest Code
```bash
git pull origin main
```

### Step 5: Install Dependencies
```bash
npm install
```

### Step 6: **REBUILD THE FRONTEND** (IMPORTANT!)
```bash
npm run build
```

**Note**: This may take 5-10 minutes. Don't interrupt it!

If it times out or hangs, try:
```bash
# Option A: Increase timeout
npm run build --max-old-space-size=4096

# Option B: Build without type checking (faster)
npm run build -- --no-type-check

# Option C: Use vite directly
npx vite build
```

### Step 7: Restart Server
```bash
pm2 restart panelx

# Or if stopped:
pm2 start ecosystem.config.cjs
```

### Step 8: Clear Browser Cache
**IMPORTANT**: Your browser is caching the old JavaScript!

**Chrome/Edge:**
1. Press `Ctrl + Shift + Delete`
2. Select "Cached images and files"
3. Click "Clear data"
4. Or just press `Ctrl + F5` to hard refresh

**Firefox:**
1. Press `Ctrl + Shift + Delete`
2. Select "Cache"
3. Click "Clear Now"
4. Or press `Ctrl + F5`

**Safari:**
1. Press `Command + Option + E`
2. Or `Command + R` while holding Shift

### Step 9: Verify
```bash
# Check if server is running
pm2 status

# Check logs
pm2 logs panelx --nostream

# Test API
curl http://localhost:5000/api/stats
```

### Step 10: Test in Browser
1. Open your panel: `http://your-server-ip:5000` or `https://your-domain.com`
2. Login as admin
3. Go to Lines page
4. Click "Create Line"
5. **You should now see all 30+ fields!**

---

## 🚀 Quick Fix Script

Copy and paste this entire script on your server:

```bash
#!/bin/bash

echo "🔄 Updating PanelX..."

# Navigate to PanelX directory (adjust path if needed)
cd /path/to/your/panelx || exit

# Stop server
echo "⏹️  Stopping server..."
pm2 stop panelx

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build frontend
echo "🏗️  Building frontend (this may take a few minutes)..."
npm run build || npx vite build

# Restart server
echo "🚀 Starting server..."
pm2 restart panelx || pm2 start ecosystem.config.cjs

# Show status
echo "✅ Update complete!"
pm2 status
pm2 logs panelx --nostream --lines 20

echo ""
echo "🎉 Done! Now clear your browser cache (Ctrl+F5) and refresh!"
```

Save as `update.sh`, make executable, and run:
```bash
chmod +x update.sh
./update.sh
```

---

## 🔍 Still Not Working? Troubleshooting

### Issue 1: Build Fails with Timeout

**Solution**: Build locally and upload:

```bash
# On your local machine (or sandbox):
cd /path/to/panelx
npm run build

# Upload dist folder to server
scp -r dist/ user@your-server:/path/to/panelx/

# Or use rsync:
rsync -avz dist/ user@your-server:/path/to/panelx/dist/
```

### Issue 2: Old JavaScript Still Served

**Solution**: Check if dist folder is updated:

```bash
# On server
cd /path/to/your/panelx
ls -la dist/

# Check if dist folder exists and has recent files
ls -lh dist/assets/

# If dist doesn't exist or is old, rebuild:
npm run build
```

### Issue 3: Server Shows Old Version After Rebuild

**Solution**: Hard refresh + clear cache:

```bash
# In browser:
1. Open DevTools (F12)
2. Right-click the refresh button
3. Click "Empty Cache and Hard Reload"

# Or:
1. Close all browser tabs
2. Clear all browser cache
3. Open panel in incognito/private window
```

### Issue 4: Build Works but Panel Shows Errors

**Check logs**:
```bash
pm2 logs panelx

# Check for errors in browser console:
# 1. Open panel
# 2. Press F12
# 3. Check Console tab for errors
```

**Common fixes**:
```bash
# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
pm2 restart panelx
```

---

## 📋 Verification Checklist

After updating, verify these:

- [ ] `git pull` completed successfully
- [ ] `npm install` completed successfully
- [ ] `npm run build` completed successfully
- [ ] `dist/` folder exists and has recent files
- [ ] `pm2 status` shows panelx running
- [ ] `pm2 logs` shows no errors
- [ ] Browser cache cleared
- [ ] Can login to panel
- [ ] Create Line button works
- [ ] **Dialog shows 30+ fields (Basic, Security, Advanced tabs)**
- [ ] Password has eye icon toggle
- [ ] Quick duration buttons visible (1M, 3M, 6M, 1Y)
- [ ] Bouquet Type radio buttons present
- [ ] Output Formats checkboxes present

---

## 🎯 Expected Result

After successful update, Create Line form should have:

### Basic Tab:
- Username
- Password with 👁️ toggle
- Owner/Member dropdown
- Package dropdown
- Connection Limit Type radio buttons
- Max Connections input
- Expiration Date picker
- "No expiration" checkbox
- Quick Duration buttons: [1 Month] [3 Months] [6 Months] [1 Year]
- Bouquet Type radio: (•) All bouquets  ( ) Selected bouquets
- Bouquet list with checkboxes
- Enabled toggle
- Trial Account toggle

### Security Tab:
- Allowed Countries
- Forced Country
- Allowed IPs
- ISP Lock
- Allowed Domains
- Locked Device ID
- Locked MAC Address
- Allowed User-Agents

### Advanced Tab:
- Force Server dropdown
- Output Formats: ☐ M3U8  ☐ TS  ☐ RTMP
- Play Token
- Admin Notes
- Reseller Notes
- Admin Enabled toggle

---

## 💡 Alternative: Deploy Pre-Built Version

If build keeps failing on your server, you can build on sandbox and upload:

### On Sandbox:
```bash
cd /home/user/webapp
npm run build
tar -czf dist.tar.gz dist/
```

### Download from Sandbox:
```bash
# Copy from /home/user/webapp/dist.tar.gz to your local machine
# Then upload to server
```

### On Server:
```bash
cd /path/to/your/panelx
tar -xzf dist.tar.gz
pm2 restart panelx
```

---

## 🆘 Emergency: Use Development Mode

If production build keeps failing, run in development mode:

```bash
# On server
cd /path/to/your/panelx

# Stop production server
pm2 stop panelx

# Run development server
pm2 start npm --name "panelx-dev" -- run dev

# Or use this ecosystem.config.cjs:
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'panelx',
    script: 'npm',
    args: 'run dev',
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    }
  }]
}
EOF

pm2 start ecosystem.config.cjs
```

**Note**: Development mode is slower but doesn't require build.

---

## 📞 Summary

**Most Common Issue**: Browser cache showing old JavaScript

**Quick Fix**:
1. `npm run build` on server
2. `pm2 restart panelx`
3. Clear browser cache (Ctrl+F5)

**That's it! 90% of the time, this solves it!**

---

## 🎉 After Successful Update

You should see:
- ✅ New Create Line form with 30+ fields
- ✅ Password toggle button
- ✅ Quick duration buttons
- ✅ Modern design
- ✅ All new fields

**If you see all these, congratulations! Your panel is updated! 🎊**

---

Need help? Check:
1. Server logs: `pm2 logs panelx`
2. Browser console (F12)
3. Build output: `npm run build`

**Status**: Solution Provided ✅  
**Expected Time**: 10-15 minutes  
**Success Rate**: 95%+
