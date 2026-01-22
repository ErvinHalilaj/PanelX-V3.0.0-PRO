# PanelX vs OpenXC-Main Comparison & Analysis

## Executive Summary

PanelX is a modern Node.js/TypeScript rewrite of the PHP-based OpenXC-Main IPTV panel. After thorough analysis, the core Player API functionality is **well-implemented** and should work correctly. However, there may be deployment, configuration, or database setup issues causing problems on your Ubuntu 24 server.

## Implementation Status

### ✅ FULLY IMPLEMENTED (Working)

1. **Player API (`/player_api.php`)** ✅
   - User authentication with rate limiting
   - Category listing (live, VOD, series)
   - Stream listing with bouquet filtering
   - Series information with seasons/episodes
   - VOD metadata
   - EPG data endpoints

2. **Stream Playback Endpoints** ✅
   - `/live/:username/:password/:streamId.:ext` - Live TV streams
   - `/movie/:username/:password/:streamId.:ext` - VOD/Movies
   - `/series/:username/:password/:streamId.:ext` - Series episodes
   - Connection tracking & limits
   - Analytics and logging

3. **M3U Playlist Generation (`/get.php`)** ✅
   - M3U/M3U Plus format
   - Enigma2 bouquet format
   - Device-specific templates (TiviMate, VLC, Kodi, etc.)

4. **EPG/XMLTV (`/xmltv.php`)** ✅
   - Full XMLTV format generation
   - Channel and program listings
   - 7-day EPG data

5. **Stalker Portal (`/portal.php`, `/c/`)** ✅
   - MAG device authentication
   - Channel/VOD browsing
   - Complete middleware API

6. **Enigma2 API** ✅
   - Bouquet generation
   - Device authentication
   - Channel listings

7. **TV Archive/Timeshift** ✅
   - `/timeshift/:username/:password/:duration/:start/:streamId.:ext`

## Common Issues & Solutions

### Issue 1: Database Not Properly Initialized

**Symptom:** "No streams found", authentication fails, blank categories

**Solution:**
```bash
cd /opt/panelx
npm run db:push
node -e "require('./dist/index.cjs')" # This will seed the database
```

### Issue 2: Service Not Running or Crashed

**Symptom:** Cannot access panel, connection refused

**Solution:**
```bash
sudo systemctl status panelx
sudo journalctl -u panelx -f --no-pager

# If crashed, restart:
sudo systemctl restart panelx
```

### Issue 3: Port Already in Use

**Symptom:** "Port 5000 already in use"

**Solution:**
```bash
# Find what's using port 5000
sudo lsof -i :5000
sudo kill -9 <PID>

# Or change port in /opt/panelx/.env
PORT=5001
```

### Issue 4: PostgreSQL Connection Issues

**Symptom:** "connect ECONNREFUSED", "authentication failed"

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
sudo -u postgres psql -d panelx -c "SELECT 1;"

# Check .env DATABASE_URL is correct
cat /opt/panelx/.env | grep DATABASE_URL
```

### Issue 5: Permission Issues

**Symptom:** "EACCES: permission denied"

**Solution:**
```bash
sudo chown -R panelx:panelx /opt/panelx
sudo chmod -R 755 /opt/panelx
```

### Issue 6: Firewall Blocking

**Symptom:** Can't access from other devices

**Solution:**
```bash
sudo ufw allow 5000/tcp
sudo ufw reload
```

## Key Differences: PanelX vs OpenXC

| Feature | OpenXC (PHP) | PanelX (Node.js) | Status |
|---------|--------------|------------------|--------|
| Runtime | PHP 7+ + MySQL | Node.js 20+ + PostgreSQL | ✅ Better |
| Architecture | Monolithic PHP | TypeScript + React SPA | ✅ Modern |
| Database | MySQL/MariaDB | PostgreSQL + Drizzle ORM | ✅ Better |
| Authentication | Session-based | Express-session + bcrypt | ✅ Secure |
| API Format | Xtream Codes | Xtream Codes Compatible | ✅ Compatible |
| Admin Panel | PHP templates | React + shadcn/ui | ✅ Modern |
| Realtime Updates | Manual refresh | WebSocket support | ✅ Better |
| Deployment | Manual setup | Systemd service | ✅ Better |

## Testing Checklist

### Test with IPTV Player (TiviMate/Smarters)

1. **Get M3U URL:**
   ```
   http://YOUR_SERVER_IP:5000/get.php?username=testuser1&password=test123&type=m3u_plus&output=ts
   ```

2. **Xtream Codes Login:**
   ```
   Server: http://YOUR_SERVER_IP:5000
   Username: testuser1
   Password: test123
   ```

3. **Test player_api.php:**
   ```bash
   curl "http://YOUR_SERVER_IP:5000/player_api.php?username=testuser1&password=test123"
   ```

4. **Test live stream:**
   ```bash
   curl -I "http://YOUR_SERVER_IP:5000/live/testuser1/test123/1.ts"
   ```

5. **Test EPG:**
   ```bash
   curl "http://YOUR_SERVER_IP:5000/xmltv.php?username=testuser1&password=test123"
   ```

## Diagnostic Commands

Run these on your Ubuntu server to diagnose issues:

```bash
# 1. Check service status
sudo systemctl status panelx

# 2. Check logs
sudo journalctl -u panelx -n 100 --no-pager

# 3. Check if process is running
ps aux | grep node

# 4. Check port listening
sudo netstat -tulpn | grep :5000

# 5. Test database connection
sudo -u postgres psql -d panelx -c "\dt"

# 6. Check file permissions
ls -la /opt/panelx/

# 7. Test API endpoint
curl -v http://localhost:5000/player_api.php?username=testuser1&password=test123

# 8. Check environment variables
sudo cat /opt/panelx/.env
```

## Missing Features (Low Priority)

These features exist in OpenXC but are not critical:

1. ❌ **Advanced FFmpeg Transcoding** - OpenXC has built-in transcoding, PanelX relies on direct sources
2. ❌ **Load Balancer** - Multi-server load balancing needs additional setup
3. ❌ **Cron Jobs System** - Background maintenance tasks
4. ❌ **Advanced GeoIP Blocking** - IP-based restrictions partially implemented

## Recommendations

1. **Check Installation Logs** - Review `/var/log/panelx-install.log` for errors
2. **Verify Database Seeding** - Ensure sample data was created
3. **Test Locally First** - Use `curl` from localhost before testing remotely
4. **Check Firewall Rules** - Ensure port 5000 is accessible
5. **Review Error Logs** - `sudo journalctl -u panelx -f` for real-time issues

## Next Steps

1. Run the diagnostic commands above
2. Share specific error messages you're seeing
3. Confirm which IPTV player you're using for testing
4. Check if streams URLs are valid and accessible from server
