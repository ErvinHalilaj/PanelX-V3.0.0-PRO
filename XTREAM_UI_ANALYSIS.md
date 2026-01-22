# 🎯 Xtream UI Architecture Analysis

## Date: January 22, 2026
## Reference Panel: http://eu4k.online:8080/8zvAYhfb

---

## 📊 Architecture Overview

### **How Xtream UI/XUI IPTV Panels Actually Work**

Based on studying Xtream Codes architecture and industry documentation, here's how professional IPTV panels handle streams:

```
┌─────────────────────────────────────────────────────────────────┐
│                      IPTV PANEL ARCHITECTURE                     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐           ┌──────────────┐           ┌──────────────┐
│   Source     │──────────▶│ Load Balancer│──────────▶│    Client    │
│   Stream     │           │    Server    │           │ IPTV Player  │
│              │           │   (FFmpeg)   │           │              │
│ http://...   │           │  Transcode   │           │ VLC/Smarters │
│ 280169.ts    │           │  + Serve     │           │   TiviMate   │
└──────────────┘           └──────────────┘           └──────────────┘
      ▲                            │
      │                            │
      │         ┌──────────────────┘
      │         │
      │         ▼
      │    ┌─────────────────┐
      └────│  Main Server    │
           │  (Panel + DB)   │
           │  Orchestration  │
           └─────────────────┘
```

---

## 🔑 Key Differences from Current PanelX Implementation

### **Current PanelX (Simplified):**
```
Client → PanelX API → HTTP 302 Redirect → Source Stream
```

### **Professional Xtream UI (Full Featured):**
```
Client → PanelX API → Load Balancer Server → FFmpeg Transcode → Client
                  ↓
            Analytics & Monitoring
```

---

## 🎭 Critical Missing Features

### **1. Load Balancer Server System**

**Purpose:**
- Distribute load across multiple servers
- Handle stream transcoding server-side
- Provide geo-routing for better performance
- Isolate streaming from main panel server

**How It Works:**
1. Admin assigns a **Load Balancer server** to a stream (via `serverId` field)
2. When client requests `/live/user/pass/123.ts`, panel checks `serverId`
3. If `serverId` is set, panel proxies/routes through that specific server
4. Load balancer server uses FFmpeg to transcode and serve the stream
5. Analytics and connection tracking happen on main server

**Current Status in PanelX:**
- ✅ Database field `serverId` exists in `streams` table (line 408)
- ✅ Database field `serverId` exists in `servers` table  
- ✅ Servers CRUD exists in admin panel
- ❌ **No routing logic** - streams always redirect directly to source
- ❌ **No load balancer integration** - server selection is ignored

---

### **2. FFmpeg Transcoding System**

**Purpose:**
- Convert source streams to different formats (HLS, MPEG-TS, etc.)
- Adjust bitrate, resolution for bandwidth optimization
- Handle different video/audio codecs
- Enable "On-Demand" mode (start/stop as needed)

**How It Works:**
1. Admin creates **Transcode Profiles** (h264/h265, bitrate, resolution)
2. Admin assigns profile to stream via `transcodeProfileId` field
3. When client connects, FFmpeg process starts with profile settings:
   ```bash
   ffmpeg -i http://source/stream.ts \
     -c:v libx264 -b:v 4000k \
     -c:a aac -b:a 128k \
     -f mpegts http://localhost:8080/output
   ```
4. Panel serves transcoded output to client
5. Process continues until all clients disconnect (On-Demand mode)

**Current Status in PanelX:**
- ✅ Database table `transcodeProfiles` exists (line 165)
- ✅ Database field `transcodeProfileId` in `streams` table (line 407)
- ❌ **No FFmpeg integration** - transcoding not implemented
- ❌ **No process management** - can't start/stop FFmpeg
- ❌ **No transcode profiles UI** - can't configure profiles

---

### **3. On-Demand Streaming Mode**

**Purpose:**
- Save server resources by only transcoding when clients are watching
- Automatically start FFmpeg when first client connects
- Stop FFmpeg when last client disconnects
- Track "sleeping" vs "active" streams

**How It Works:**
1. Admin enables **On-Demand mode** on stream (check `onDemand` flag)
2. Stream "sleeps" when no one is watching (no FFmpeg process)
3. When client requests stream:
   - Panel starts FFmpeg process with source URL
   - Creates HLS/TS output endpoint
   - Serves stream to client
4. Panel tracks active connections
5. When last client disconnects, FFmpeg process stops

**Current Status in PanelX:**
- ✅ Database field `onDemand` exists in `streams` table (line 426)
- ✅ Database field `autoRestartHours` exists (line 427)
- ❌ **No on-demand logic** - all streams redirect immediately
- ❌ **No process lifecycle management**

---

### **4. Server Management & Orchestration**

**Purpose:**
- Manage multiple streaming servers
- Monitor server health (CPU, memory, bandwidth)
- SSH access for remote FFmpeg execution
- Geo-routing based on client location

**How It Works:**
1. Admin adds **Server** with SSH credentials
2. Panel SSHs into server to:
   - Start FFmpeg processes remotely
   - Monitor server resources
   - Check server status
   - Manage server configuration
3. Panel selects best server based on:
   - Server load (CPU/memory/bandwidth)
   - Geographic location (`geoZone`)
   - Per-stream server assignment (`forcedServerId`)

**Current Status in PanelX:**
- ✅ Database table `servers` with SSH fields exists (line 21)
- ✅ SSH credentials fields added (sshHost, sshPort, sshUsername, sshPassword)
- ✅ Server health metrics fields (cpuUsage, memoryUsage, bandwidth, status)
- ❌ **No SSH integration** - can't execute remote commands
- ❌ **No health monitoring** - metrics not collected
- ❌ **No load balancing** - server selection logic missing

---

## 🏗️ Implementation Roadmap

### **Phase 1: Basic FFmpeg Integration (High Priority)**

**Goal:** Get streams transcoding locally on the main server

**Tasks:**
1. ✅ Install FFmpeg on server
2. ❌ Create FFmpeg process manager service
3. ❌ Implement basic transcoding (HLS output)
4. ❌ Route `/live/user/pass/id.ts` through FFmpeg instead of redirect
5. ❌ Test with one stream

**Estimated Time:** 2-3 hours  
**User Impact:** Streams will play in browsers via HLS

---

### **Phase 2: Transcode Profiles (Medium Priority)**

**Goal:** Allow admin to configure different quality options

**Tasks:**
1. ❌ Create Transcode Profiles CRUD UI
2. ❌ Implement profile selection in stream edit
3. ❌ Apply profile settings to FFmpeg command
4. ❌ Test multiple profiles (720p, 1080p, low bitrate)

**Estimated Time:** 1-2 hours  
**User Impact:** Multiple quality options per stream

---

### **Phase 3: On-Demand Mode (High Priority)**

**Goal:** Start/stop FFmpeg based on viewer count

**Tasks:**
1. ❌ Implement connection counter per stream
2. ❌ Start FFmpeg on first connection
3. ❌ Stop FFmpeg when counter reaches 0
4. ❌ Add "sleeping" vs "active" stream status
5. ❌ Test On-Demand flag behavior

**Estimated Time:** 2-3 hours  
**User Impact:** Huge resource savings, faster startup

---

### **Phase 4: Load Balancer Routing (High Priority)**

**Goal:** Route streams through specific servers

**Tasks:**
1. ❌ Implement server selection logic
2. ❌ SSH to load balancer server
3. ❌ Start remote FFmpeg process
4. ❌ Proxy stream back to client
5. ❌ Test with external load balancer

**Estimated Time:** 4-5 hours  
**User Impact:** Scalability, geo-routing, isolation

---

### **Phase 5: Server Health Monitoring (Medium Priority)**

**Goal:** Track server resources and auto-select best server

**Tasks:**
1. ❌ SSH health checks (CPU, memory, bandwidth)
2. ❌ Update server metrics in database
3. ❌ Implement auto-selection algorithm
4. ❌ Show server status in admin panel

**Estimated Time:** 2-3 hours  
**User Impact:** Automatic failover, load distribution

---

## 🚀 Quick Win: Basic Transcoding Implementation

**What can be done NOW to improve stream playback:**

### **Option 1: Local FFmpeg Transcoding (Recommended)**

Create a simple FFmpeg transcoding service that:
1. Receives source stream URL
2. Transcodes to HLS (`.m3u8`)
3. Serves HLS segments
4. Works without load balancer setup

**Pros:**
- ✅ Browser playback works immediately
- ✅ No additional server needed
- ✅ Simple to implement
- ✅ Can be done in ~2 hours

**Cons:**
- ❌ Main server handles transcoding load
- ❌ Not scalable to 100s of streams
- ❌ No load distribution

### **Option 2: Keep Direct Redirect + Add HLS Sources**

Keep current architecture but:
1. Admin adds **HLS (.m3u8)** source URLs instead of `.ts`
2. Direct redirect to HLS source
3. Browser playback works

**Pros:**
- ✅ Zero code changes
- ✅ Works immediately
- ✅ No server load

**Cons:**
- ❌ Requires HLS sources (not all providers have them)
- ❌ No quality options
- ❌ No On-Demand capability

---

## 💡 Recommendation

**For Production Deployment:**
1. **Start with Option 1** - Local FFmpeg transcoding for browser support
2. **Add Phase 3** - On-Demand mode to save resources
3. **Later add Phase 4** - Load balancer routing when scaling

**Timeline:**
- **Today**: Local FFmpeg transcoding (~2 hrs)
- **Tomorrow**: On-Demand mode (~3 hrs)
- **Next Week**: Load balancer routing (~5 hrs)
- **Total**: ~10 hours to full Xtream UI parity

---

## 📝 Technical Notes

### **FFmpeg Command Example (HLS Output):**
```bash
ffmpeg -i "http://eu4k.online:8080/live/panelx/panelx/280169.ts" \
  -c:v copy -c:a copy \
  -f hls \
  -hls_time 10 \
  -hls_list_size 6 \
  -hls_flags delete_segments \
  -hls_segment_filename "/tmp/stream_123_%03d.ts" \
  "/tmp/stream_123.m3u8"
```

Then serve `/tmp/stream_123.m3u8` to clients.

### **Process Management:**
- Use `child_process.spawn()` in Node.js
- Track PIDs in database or memory
- Kill process when no clients connected
- Handle FFmpeg crashes/restarts

### **Load Balancer SSH Example:**
```typescript
import { Client } from 'ssh2';

const ssh = new Client();
ssh.connect({
  host: server.sshHost,
  port: server.sshPort,
  username: server.sshUsername,
  password: server.sshPassword,
});

ssh.exec('ffmpeg -i source.ts -f hls output.m3u8', (err, stream) => {
  // Handle FFmpeg output
});
```

---

## ✅ What PanelX Already Has Right

1. ✅ **Database schema** - All tables/fields for load balancing exist
2. ✅ **Player API** - Fully Xtream Codes compatible
3. ✅ **Authentication** - Line validation, connection limits work
4. ✅ **Analytics** - Connection history, most watched tracking
5. ✅ **M3U generation** - Playlists work perfectly
6. ✅ **Admin panel** - UI for servers, streams, lines
7. ✅ **SSH credentials** - Fields added to servers table

---

## ❌ What PanelX is Missing (Critical)

1. ❌ **FFmpeg integration** - No transcoding at all
2. ❌ **Process management** - Can't start/stop FFmpeg
3. ❌ **Server routing** - `serverId` is ignored
4. ❌ **On-Demand mode** - Streams are always "on"
5. ❌ **Health monitoring** - Server metrics not collected
6. ❌ **Load balancing** - No distribution algorithm

---

## 🎯 Bottom Line

**Your panel is 80% complete structurally but missing the core streaming engine.**

Think of it like having a beautiful car with engine, transmission, wheels - but no fuel system. The database, API, UI are all perfect. What's missing is the **FFmpeg transcoding layer** that powers the actual stream delivery.

**Good news:** This is fixable! We just need to:
1. Add FFmpeg process management
2. Route streams through FFmpeg instead of direct redirect
3. Implement On-Demand lifecycle
4. Add load balancer routing

**Would you like me to start implementing these features?**

---

## 📊 Priority Matrix

| Feature | Priority | Complexity | User Impact | Time |
|---------|----------|------------|-------------|------|
| Local FFmpeg Transcoding | 🔴 HIGH | 🟡 Medium | ⭐⭐⭐⭐⭐ | 2h |
| On-Demand Mode | 🔴 HIGH | 🟡 Medium | ⭐⭐⭐⭐ | 3h |
| Load Balancer Routing | 🔴 HIGH | 🔴 High | ⭐⭐⭐⭐ | 5h |
| Transcode Profiles | 🟡 MEDIUM | 🟢 Low | ⭐⭐⭐ | 2h |
| Health Monitoring | 🟡 MEDIUM | 🟡 Medium | ⭐⭐ | 3h |
| HLS Segment Serving | 🟢 LOW | 🟡 Medium | ⭐⭐ | 2h |

**Total for Full Implementation: ~17 hours**  
**MVP (Transcoding + On-Demand): ~5 hours**

---

Generated: January 22, 2026  
Reference: http://eu4k.online:8080/8zvAYhfb  
Credentials: genspark / [password]
