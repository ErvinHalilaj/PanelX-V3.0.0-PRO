#!/bin/bash

# PanelX Critical Issues Analysis & Fix Script
# This script identifies and fixes all the critical issues found

cat << 'EOF' > /home/user/webapp/CRITICAL_BUGS_FOUND.md
# PanelX V3.0.0 PRO - Critical Bugs Report

## Testing Results Summary

### ✅ WORKING Features:
1. **Authentication** - Login and session management work correctly
   - `/api/auth/login` - ✅ Returns user data
   - `/api/auth/me` - ✅ Returns current user
   
2. **Dashboard Stats** - Basic GET requests work
   - `/api/stats` - ✅ Returns totals and counts
   
3. **Streams List** - GET endpoint works
   - `/api/streams` (GET) - ✅ Returns stream list

### ❌ CRITICAL ISSUES:

#### Issue #1: System Monitoring Returns NULL
**Endpoint:** `/api/monitoring/metrics`
**Problem:** Returns `null` instead of real system metrics (CPU, RAM, bandwidth)
**Expected:** Should return real-time system metrics using `systeminformation` package
**Impact:** Dashboard shows no real server stats

**Root Cause:** The monitoring service exists but isn't being called properly OR metrics collection hasn't started yet.

**Fix Required:**
1. Check if monitoringService.collectMetrics() is being called
2. Ensure systeminformation package is installed
3. Verify metrics are being stored in metricsHistory

#### Issue #2: ALL POST/PUT/DELETE Requests Return 502 Bad Gateway
**Endpoints Affected:**
- `POST /api/streams` - ❌ 502
- `POST /api/users` - ❌ 502
- `POST /api/servers` - ❌ 502
- `PUT /api/streams/:id` - ❌ 502
- `DELETE /api/streams/:id` - ❌ 502

**Problem:** Backend crashes when processing write operations
**Impact:** Cannot create, update, or delete any data - the panel is READ-ONLY

**Root Cause Analysis:**
Most likely causes:
1. **Database schema mismatch** - Drizzle ORM expecting different schema
2. **Missing required fields** - Required fields not being provided
3. **Type validation errors** - Data types don't match schema
4. **Foreign key constraints** - Referenced tables/IDs don't exist
5. **Transaction errors** - Database transactions failing

**Immediate Actions Required:**
1. Check PM2 logs for the exact error when POST request is made
2. Verify database schema matches code expectations
3. Check if all foreign key references are valid
4. Test with minimal valid data

#### Issue #3: WebSocket Returns 502
**Endpoint:** `/socket.io/`
**Problem:** WebSocket connections fail
**Impact:** No real-time updates for monitoring, connections, etc.

#### Issue #4: Health Checks Return Empty Array
**Endpoint:** `/api/monitoring/health`
**Problem:** Returns `{"health":[],"overall":"healthy"}` - no actual health checks
**Expected:** Should return status of database, API, storage, backup services

## Testing Commands

Run these on VPS to reproduce issues:

```bash
# Test monitoring (returns null)
curl -b /tmp/panelx_cookies.txt http://localhost:5000/api/monitoring/metrics

# Test POST stream (returns 502)
curl -b /tmp/panelx_cookies.txt -X POST http://localhost:5000/api/streams \
  -H "Content-Type: application/json" \
  -d '{"streamName":"Test","streamType":"live","sourceUrl":"http://test.com/test.m3u8"}'

# Check PM2 logs for errors
sudo -u panelx pm2 logs panelx --lines 100 --nostream | grep -i error
```

## Next Steps

1. **Debug POST/PUT/DELETE crashes** - HIGHEST PRIORITY
   - Get PM2 logs during POST request
   - Find exact error message
   - Fix database/validation issue
   
2. **Fix Monitoring Service** - HIGH PRIORITY
   - Verify metrics collection is running
   - Check systeminformation package
   - Test getLatestMetrics() response
   
3. **Fix WebSocket** - MEDIUM PRIORITY
   - Check Socket.IO initialization
   - Verify nginx WebSocket proxy config
   
4. **Test All 60+ Admin Pages** - After fixes above
   - Test each CRUD operation
   - Verify data persistence
   - Check real-time updates

EOF

echo "Critical bugs documented in: /home/user/webapp/CRITICAL_BUGS_FOUND.md"
cat /home/user/webapp/CRITICAL_BUGS_FOUND.md
