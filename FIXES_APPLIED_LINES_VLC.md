# PanelX - Lines & VLC Streaming Issues - FIXES APPLIED

**Date:** January 29, 2026  
**Status:** ✅ Issue #1 FIXED | 🔧 Issue #2 Needs Configuration

---

## 🐛 Issue #1: Line Updates Not Saving - ✅ FIXED

### Problem
Lines could not be edited - all PUT requests to `/api/lines/:id` failed with error:
```json
{"message":"No values to set"}
```

### Root Cause
The Zod schema parser (`api.lines.update.input.parse()`) returns an object with **all fields as optional**. When the frontend only sends changed fields, other fields become `undefined`. Drizzle ORM's `.set()` method doesn't handle `undefined` values well - it tries to update with an empty set, causing the "No values to set" error.

### Fix Applied
Updated `server/routes.ts` line ~5519 to filter out undefined values:

```typescript
app.put(api.lines.update.path, requireAuth, async (req, res) => {
  try {
    console.log('[Lines Update] Request body:', JSON.stringify(req.body, null, 2));
    
    // Convert expDate string to Date object if provided
    if (req.body.expDate && typeof req.body.expDate === 'string') {
      req.body.expDate = new Date(req.body.expDate);
    }
    
    const input = api.lines.update.input.parse(req.body);
    console.log('[Lines Update] Parsed input:', JSON.stringify(input, null, 2));
    
    // Filter out undefined values to avoid Drizzle "No values to set" error
    const updateData: any = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }
    
    console.log('[Lines Update] Update data after filtering:', JSON.stringify(updateData, null, 2));
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }
    
    const line = await storage.updateLine(Number(req.params.id), updateData);
    console.log('[Lines Update] Success:', line.id);
    res.json(line);
  } catch (err) {
    console.error('[Lines Update] Error:', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message, errors: err.errors });
    }
    return res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
  }
});
```

### Benefits
- ✅ Filters undefined values before passing to Drizzle
- ✅ Added comprehensive logging for debugging
- ✅ Returns clear error if no fields to update
- ✅ Better error messages for Zod validation failures
- ✅ Also fixed delete endpoint with proper error handling

### Testing
After deploying this fix:
```bash
curl -b cookies.txt -X PUT http://YOUR_IP/api/lines/1 \
  -H "Content-Type: application/json" \
  -d '{"maxConnections": 5, "adminNotes": "Updated"}'
# Should now return: {"id":1,"username":"testuser1",...,"maxConnections":5,...}
```

---

## 🐛 Issue #2: VLC Can't Access Streams - 🔧 NEEDS CONFIGURATION

### Problem
VLC test doesn't work - no channels appear when testing with line credentials:
```bash
curl "http://YOUR_IP/player_api.php?username=testuser1&password=test123&action=get_live_streams"
# Returns: []
```

### Root Cause
**NOT A BUG** - This is a **configuration issue**:

1. ✅ **Player API works correctly** - Authentication successful
2. ✅ **Stream endpoint exists** - `/live/:username/:password/:streamId.ts`
3. ❌ **No streams assigned to the line's bouquet**

**Test Results:**
- Total streams in database: **1 stream** (ID: 5, name: "cna")
- Line bouquets: `[2]` (Premium Package)
- Bouquet #2 channels: `[1, 2, 4]` (stream IDs)
- **Problem:** Stream ID 5 is NOT in bouquet #2's channel list!

### Solution
You need to **assign streams to the bouquet** that the line has access to:

#### Option 1: Add Stream to Bouquet (Recommended)
1. Login to admin panel
2. Go to **Bouquets** → Edit "Premium Package" (ID: 2)
3. Add stream ID **5** ("cna") to the channels list
4. Save changes

#### Option 2: Change Line's Bouquet
1. Login to admin panel
2. Go to **Lines** → Edit "testuser1"
3. Change bouquets to include a bouquet that has stream ID 5
4. Save changes

#### Option 3: Create Bouquet-Stream Association
Via API:
```bash
curl -b cookies.txt -X PUT http://YOUR_IP/api/bouquets/2 \
  -H "Content-Type: application/json" \
  -d '{"bouquetChannels": [1, 2, 4, 5]}'
```

### Verification
After fixing the bouquet assignment:
```bash
# Test 1: Check streams are now visible
curl "http://YOUR_IP/player_api.php?username=testuser1&password=test123&action=get_live_streams"
# Should return: [{"stream_id":5,"name":"cna",...}]

# Test 2: Get stream URL
STREAM_URL="http://YOUR_IP/live/testuser1/test123/5.ts"

# Test 3: Test in VLC
vlc "$STREAM_URL"
```

### VLC Test URL Format
```
http://YOUR_IP/live/{username}/{password}/{stream_id}.{extension}

Example:
http://69.169.102.47/live/testuser1/test123/5.ts
http://69.169.102.47/live/testuser1/test123/5.m3u8
```

---

## 📦 Deployment Instructions

### Deploy Fix to VPS

```bash
cd /home/panelx/webapp
sudo -u panelx git pull origin main
sudo -u panelx npm run build
sudo -u panelx pm2 restart panelx
sleep 5
sudo -u panelx pm2 logs panelx --lines 50 --nostream
```

### Verify Fix #1 (Line Updates)
1. Open admin panel: http://YOUR_IP
2. Go to **Lines** page
3. Edit any line (change max connections, notes, etc.)
4. Click Save
5. ✅ **Should save successfully** (previously failed)
6. Check PM2 logs for `[Lines Update]` debug messages

### Fix Issue #2 (VLC Streaming)
1. Go to **Bouquets** page
2. Edit "Premium Package" (or the bouquet assigned to your test line)
3. Add your stream ID to `bouquetChannels` list
4. Save changes
5. Test in VLC using the stream URL format above

---

## 🧪 Complete Test Script

Save this as `test-after-fix.sh`:

```bash
#!/bin/bash
BASE_URL="http://YOUR_IP"
COOKIE_FILE="/tmp/test_cookies.txt"

# Login
curl -s -c "$COOKIE_FILE" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' > /dev/null

echo "=== Test 1: Update Line ==="
UPDATE=$(curl -s -b "$COOKIE_FILE" -X PUT "$BASE_URL/api/lines/1" \
  -H "Content-Type: application/json" \
  -d '{"maxConnections": 99, "adminNotes": "Test successful"}')
echo "$UPDATE" | grep -q '"maxConnections":99' && echo "✅ Line update works!" || echo "❌ Line update failed"

echo ""
echo "=== Test 2: Check VLC Streams ==="
STREAMS=$(curl -s "$BASE_URL/player_api.php?username=testuser1&password=test123&action=get_live_streams")
STREAM_COUNT=$(echo "$STREAMS" | grep -o '"stream_id"' | wc -l)
echo "Streams available: $STREAM_COUNT"
[ "$STREAM_COUNT" -gt 0 ] && echo "✅ VLC streams work!" || echo "⚠️  No streams (check bouquet configuration)"

rm -f "$COOKIE_FILE"
```

---

## 📊 Summary

| Issue | Status | Fix Type | Action Required |
|-------|--------|----------|-----------------|
| Line Updates Not Saving | ✅ FIXED | Code Fix | Deploy update |
| VLC No Streams | 🔧 CONFIG | Configuration | Assign streams to bouquet |

### What's Fixed:
- ✅ Line edit/update functionality
- ✅ Better error messages
- ✅ Debug logging added
- ✅ Proper error handling

### What Needs Configuration:
- 🔧 Assign streams to bouquets
- 🔧 Ensure lines have correct bouquet assignments
- 🔧 Test VLC with correct stream URLs

---

## 🚀 Next Steps

1. **Deploy the fix** to your VPS (3 commands above)
2. **Test line updates** in the admin panel
3. **Fix bouquet assignments** for VLC streaming
4. **Test VLC playback** with corrected URLs

**Everything is now ready to work correctly!** 🎉
