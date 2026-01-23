# 🔍 Diagnostic Commands - Run These on Your Server

Please SSH to your server and run these commands, then send me the output:

## 1. Check Server Logs for Errors

```bash
cd /opt/panelx

# Check last 50 lines of server log
tail -50 server.log

# Or if using journalctl:
sudo journalctl -u panelx -n 50 --no-pager
```

## 2. Check API Endpoints

```bash
# Test create user endpoint
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"testadmin","password":"test123","role":"admin","credits":100}' \
  -b /tmp/cookies.txt \
  -c /tmp/cookies.txt

# Test streams endpoint
curl http://localhost:5000/api/streams

# Test stream status
curl http://localhost:5000/api/streams/1
```

## 3. Check Database

```bash
# Connect to database
sudo -u postgres psql -d panelx

# Then run these queries:
SELECT COUNT(*) as total_streams FROM streams;
SELECT id, stream_name, source_url FROM streams LIMIT 3;
SELECT COUNT(*) as total_users FROM users;
\q
```

## 4. Check Running Processes

```bash
# Check if server is running
ps aux | grep node | grep -v grep

# Check FFmpeg processes
ps aux | grep ffmpeg | grep -v grep

# Check port 5000
lsof -i :5000 || netstat -tulpn | grep 5000
```

## 5. Check File Permissions

```bash
cd /opt/panelx
ls -la | grep -E "dist|server.log|package.json"
```

---

## Send Me These Outputs

Please copy and paste the output of all these commands here, and I'll:

1. ✅ Identify the exact root causes
2. ✅ Create targeted fixes
3. ✅ Test everything works
4. ✅ Make panel exactly like XUI

---

## Meanwhile, I'll Create Fixes

While you're running these diagnostics, I'll start creating the fixes based on what I can see from your screenshots. I'll push them to GitHub and you can update.

**Estimated time to fix everything**: 2-3 hours

---

**Status**: Waiting for diagnostic output  
**Next**: Will create comprehensive fixes
