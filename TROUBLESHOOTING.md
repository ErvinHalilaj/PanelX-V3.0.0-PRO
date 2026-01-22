# PanelX Troubleshooting Guide

## Quick Start Diagnostic

If your PanelX installation is not working properly, follow these steps:

### 1. Run the Diagnostic Script

```bash
cd /opt/panelx
sudo bash diagnose.sh
```

This will check:
- ✅ Installation directory
- ✅ Node.js and npm versions
- ✅ PostgreSQL installation and service status
- ✅ Database connection
- ✅ PanelX service status
- ✅ Port availability
- ✅ Firewall configuration
- ✅ API endpoints
- ✅ Application files

### 2. Run the API Test Script

```bash
cd /opt/panelx
bash test-api.sh
```

Or test with custom credentials:

```bash
bash test-api.sh --server 192.168.1.100 --port 5000 --username myuser --password mypass
```

This will test all Player API endpoints and generate a success report.

## Common Problems and Solutions

### Problem 1: Service Won't Start

**Symptoms:**
- `systemctl status panelx` shows "inactive" or "failed"
- Cannot access web interface
- Port 5000 not listening

**Solution:**

```bash
# Check the error logs
sudo journalctl -u panelx -n 100 --no-pager

# Common fixes:
cd /opt/panelx

# 1. Rebuild the application
npm run build

# 2. Ensure database is set up
npm run db:push

# 3. Check .env file exists and is valid
cat .env

# 4. Restart service
sudo systemctl restart panelx

# 5. If still failing, run manually to see errors
npm start
```

### Problem 2: Authentication Fails (auth: 0)

**Symptoms:**
- Player API returns `"auth": 0`
- IPTV apps can't connect
- M3U playlist shows 401 Unauthorized

**Solution:**

```bash
# Check if test user exists
cd /opt/panelx
sudo bash manage-admin.sh
# Select option 1 to list users

# If no users exist, the database wasn't seeded properly
npm run db:push

# Then restart the service to trigger seeding
sudo systemctl restart panelx

# Verify users were created
sudo -u postgres psql -d panelx -c "SELECT id, username, enabled FROM lines;"

# Create a new line manually if needed
sudo bash manage-admin.sh
# Select option 2 to add a line
```

### Problem 3: Database Connection Error

**Symptoms:**
- Logs show "connect ECONNREFUSED" or "password authentication failed"
- Service crashes immediately
- Cannot query database

**Solution:**

```bash
# 1. Check PostgreSQL is running
sudo systemctl status postgresql
sudo systemctl start postgresql

# 2. Verify database exists
sudo -u postgres psql -l | grep panelx

# 3. Test connection with credentials from .env
DATABASE_URL=$(grep DATABASE_URL /opt/panelx/.env | cut -d'=' -f2)
echo $DATABASE_URL

# 4. If database doesn't exist, reinstall
cd /opt/panelx
sudo bash uninstall.sh
sudo bash install.sh
```

### Problem 4: No Streams or Categories

**Symptoms:**
- Player API returns empty arrays
- IPTV apps show "No channels"
- M3U playlist is empty

**Solution:**

```bash
# Check if tables have data
sudo -u postgres psql -d panelx -c "SELECT COUNT(*) FROM streams;"
sudo -u postgres psql -d panelx -c "SELECT COUNT(*) FROM categories;"

# If 0 results, database wasn't seeded
cd /opt/panelx

# Run database push
npm run db:push

# Restart to trigger seeding
sudo systemctl restart panelx

# Check logs to confirm seeding
sudo journalctl -u panelx -n 50 --no-pager | grep "seed"

# Manually seed if needed (when service is stopped)
sudo systemctl stop panelx
node -e "require('./dist/index.cjs')"
# Wait for it to start, then Ctrl+C after seeing "Server listening"
sudo systemctl start panelx
```

### Problem 5: Streams Won't Play

**Symptoms:**
- Authentication works
- Channels appear in player
- Playback fails with "Stream unavailable"

**Possible Causes:**

1. **Invalid Source URLs** - The sample streams use placeholder URLs
   ```bash
   # Check actual stream URLs
   sudo -u postgres psql -d panelx -c "SELECT id, name, source_url FROM streams LIMIT 5;"
   
   # These must be real, accessible m3u8/ts URLs
   # Update with real URLs via admin panel
   ```

2. **Firewall/Network Issues**
   ```bash
   # Test if server can reach stream sources
   curl -I "http://example.com/stream.m3u8"
   
   # Allow outbound connections
   sudo ufw allow out 80/tcp
   sudo ufw allow out 443/tcp
   ```

3. **Stream Server Down**
   - Check if upstream source is working
   - Use direct URL in VLC to test

### Problem 6: Cannot Access from Other Devices

**Symptoms:**
- Works on localhost
- External devices can't connect
- Mobile apps show connection error

**Solution:**

```bash
# 1. Check service is listening on all interfaces
netstat -tuln | grep :5000
# Should show 0.0.0.0:5000, NOT 127.0.0.1:5000

# 2. If showing 127.0.0.1, update index.ts
# Change: app.listen(PORT, '127.0.0.1')
# To:     app.listen(PORT, '0.0.0.0')

# 3. Allow firewall
sudo ufw allow 5000/tcp
sudo ufw reload

# 4. Test from another device
curl http://YOUR_SERVER_IP:5000/
```

### Problem 7: High Memory Usage / Crashes

**Symptoms:**
- Service crashes after running for a while
- System becomes slow
- OOM (Out of Memory) errors in logs

**Solution:**

```bash
# 1. Check memory usage
free -h
ps aux | grep node

# 2. Limit Node.js memory
sudo systemctl edit panelx
# Add:
# [Service]
# Environment="NODE_OPTIONS=--max-old-space-size=512"

# 3. Restart
sudo systemctl daemon-reload
sudo systemctl restart panelx

# 4. Clean up stale connections (run via cron)
sudo -u postgres psql -d panelx -c "DELETE FROM active_connections WHERE last_ping < NOW() - INTERVAL '5 minutes';"
```

### Problem 8: EPG Not Working

**Symptoms:**
- XMLTV is empty or has no programs
- Players don't show guide data
- Program info missing

**Solution:**

```bash
# Check if EPG data exists
sudo -u postgres psql -d panelx -c "SELECT COUNT(*) FROM epg_data;"

# Check if streams have EPG channel IDs
sudo -u postgres psql -d panelx -c "SELECT id, name, epg_channel_id FROM streams WHERE epg_channel_id IS NOT NULL;"

# EPG needs to be imported via admin panel
# Go to: Admin Panel > EPG Sources
# Add EPG source URL (XMLTV format)
# Run import

# Or manually insert test EPG data
sudo -u postgres psql -d panelx <<EOF
INSERT INTO epg_data (channel_id, title, start_time, end_time)
VALUES ('channel1', 'Test Program', NOW(), NOW() + INTERVAL '1 hour');
EOF
```

## Manual Service Management

```bash
# Start service
sudo systemctl start panelx

# Stop service
sudo systemctl stop panelx

# Restart service
sudo systemctl restart panelx

# Check status
sudo systemctl status panelx

# Enable auto-start on boot
sudo systemctl enable panelx

# Disable auto-start
sudo systemctl disable panelx

# View real-time logs
sudo journalctl -u panelx -f

# View last 100 lines
sudo journalctl -u panelx -n 100 --no-pager
```

## Database Management

```bash
# Access database
sudo -u postgres psql -d panelx

# List all tables
\dt

# Check user counts
SELECT role, COUNT(*) FROM users GROUP BY role;

# Check line counts
SELECT enabled, COUNT(*) FROM lines GROUP BY enabled;

# Check stream counts
SELECT stream_type, COUNT(*) FROM streams GROUP BY stream_type;

# Check active connections
SELECT COUNT(*) FROM active_connections;

# Exit
\q

# Backup database
sudo -u postgres pg_dump panelx > /tmp/panelx_backup.sql

# Restore database
sudo -u postgres psql -d panelx < /tmp/panelx_backup.sql
```

## Performance Optimization

### 1. Database Indexing

Already included in schema, but verify:

```sql
-- Check indexes
SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public';
```

### 2. Connection Cleanup Cron

Add to crontab:

```bash
sudo crontab -e

# Add this line to clean up stale connections every 5 minutes
*/5 * * * * sudo -u postgres psql -d panelx -c "DELETE FROM active_connections WHERE last_ping < NOW() - INTERVAL '5 minutes';" > /dev/null 2>&1
```

### 3. Log Rotation

```bash
# Create logrotate config
sudo tee /etc/logrotate.d/panelx <<EOF
/var/log/panelx/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 panelx panelx
}
EOF
```

## Getting Help

1. **Run diagnostics first**: `sudo bash /opt/panelx/diagnose.sh`
2. **Test API**: `bash /opt/panelx/test-api.sh`
3. **Check logs**: `sudo journalctl -u panelx -n 100 --no-pager`
4. **Collect info**:
   - Ubuntu version: `lsb_release -a`
   - Node version: `node -v`
   - PostgreSQL version: `psql --version`
   - Error messages from logs

## Complete Reinstallation

If nothing works:

```bash
# 1. Backup data (if any important)
sudo -u postgres pg_dump panelx > ~/panelx_backup.sql

# 2. Uninstall
cd /opt/panelx
sudo bash uninstall.sh

# 3. Clean up completely
sudo rm -rf /opt/panelx
sudo -u postgres psql -c "DROP DATABASE IF EXISTS panelx;"
sudo -u postgres psql -c "DROP USER IF EXISTS panelx;"

# 4. Reinstall
git clone https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO.git
cd PanelX-V3.0.0-PRO
sudo bash install.sh

# 5. Follow the installation wizard
```

## Testing with IPTV Players

### TiviMate

```
Add Playlist > Xtream Codes API
Name: My PanelX
Server URL: http://YOUR_IP:5000
Username: testuser1
Password: test123
```

### IPTV Smarters Pro

```
Add User > Xtream Codes Login
Name: PanelX
Server URL: http://YOUR_IP:5000 (without /player_api.php)
Username: testuser1
Password: test123
```

### VLC

```
Media > Open Network Stream
URL: http://YOUR_IP:5000/get.php?username=testuser1&password=test123&type=m3u_plus&output=ts
```

## Advanced Debugging

### Enable Debug Mode

```bash
# Edit .env
sudo nano /opt/panelx/.env

# Add or change:
NODE_ENV=development
LOG_LEVEL=debug

# Restart
sudo systemctl restart panelx

# Watch debug logs
sudo journalctl -u panelx -f
```

### Test Individual Endpoints

```bash
# Test authentication
curl -v "http://localhost:5000/player_api.php?username=testuser1&password=test123"

# Test live streams list
curl "http://localhost:5000/player_api.php?username=testuser1&password=test123&action=get_live_streams" | jq .

# Test VOD categories
curl "http://localhost:5000/player_api.php?username=testuser1&password=test123&action=get_vod_categories" | jq .

# Test M3U generation
curl "http://localhost:5000/get.php?username=testuser1&password=test123&type=m3u_plus&output=ts"

# Test XMLTV
curl "http://localhost:5000/xmltv.php?username=testuser1&password=test123"

# Test stream playback (should redirect or proxy)
curl -I "http://localhost:5000/live/testuser1/test123/1.ts"
```

## Security Checklist

- [ ] Changed default admin password
- [ ] Firewall configured (ufw allow 5000/tcp)
- [ ] Database password is strong (auto-generated)
- [ ] Service running as non-root user
- [ ] SSL/HTTPS configured (via reverse proxy like nginx)
- [ ] Regular backups configured
- [ ] Connection limits properly set
- [ ] IP blocking enabled for failed attempts

## Support

For issues specific to PanelX:
- GitHub Issues: https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO/issues
- Include output from `diagnose.sh` and `test-api.sh`
