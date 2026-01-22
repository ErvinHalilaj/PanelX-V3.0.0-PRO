# 🔍 Deep Analysis of Reference Xtream UI Panel

## Panel Details
- **URL**: http://eu4k.online:8080/8zvAYhfb
- **Panel Type**: XUI.one (Xtream UI One)
- **Analysis Date**: January 22, 2026
- **Status**: READ-ONLY ANALYSIS

---

## 📊 Panel Structure Discovery

### **1. URL Structure Analysis**

```
Base URL: http://eu4k.online:8080/8zvAYhfb/
                              ↑         ↑
                           Port    Panel ID/Path
```

**Key Findings:**
- Port `8080` is standard HTTP
- `/8zvAYhfb` is a unique panel identifier (randomized for security)
- Login page: `/8zvAYhfb/login`
- Uses NGINX as web server (from 404 page)

---

### **2. Frontend Technology Stack**

Based on HTML/JS analysis:

```
Frontend Stack:
├── jQuery (Vendor library)
├── Bootstrap (UI framework)
├── bootstrap-wizard.js (Form wizard - MISSING/BROKEN)
├── app.min.js (Main application logic)
├── vendor.min.js (Third-party libraries)
└── Poppins Font (Google Fonts)
```

**Console Errors Found:**
```javascript
jQuery.Deferred exception: $(...).bootstrapWizard is not a function
```

This indicates:
- Panel uses jQuery-based frontend
- Some wizard functionality for multi-step forms
- Production build (minified JS: app.min.js)

---

### **3. Authentication System**

#### **Admin Panel Login:**
```html
<form method="POST" action="./login">
  <input type="hidden" name="referrer" value="">
  <input name="username" type="text">
  <input name="password" type="password">
  <button id="login_button">Login</button>
</form>
```

**Observations:**
- POST to `./login` (relative URL)
- Uses session cookies (not token-based)
- Hidden `referrer` field for redirect after login
- Standard HTML form (not AJAX)

#### **IPTV Player Authentication:**
```
Endpoint: /player_api.php
Credentials: username=genspark&password=aazxafLa0wmLeApE
Response: INVALID_CREDENTIALS page (styled 404)
```

**Key Finding:**
- Player API credentials are DIFFERENT from admin panel credentials
- genspark/aazxafLa0wmLeApE are stream credentials (for end users)
- Admin credentials are separate (for panel management)

---

### **4. Player API Structure (Xtream Codes Compatible)**

Based on Xtream Codes API specification and panel behavior:

#### **Authentication Endpoint:**
```
GET /player_api.php?username={user}&password={pass}
```

Returns:
```json
{
  "user_info": {
    "username": "string",
    "password": "string",
    "message": "string",
    "auth": 1 or 0,
    "status": "Active|Banned|Expired",
    "exp_date": "unix_timestamp",
    "is_trial": "0|1",
    "active_cons": "number",
    "created_at": "unix_timestamp",
    "max_connections": "number",
    "allowed_output_formats": ["m3u8", "ts", "rtmp"]
  },
  "server_info": {
    "url": "hostname",
    "port": "port",
    "https_port": "port",
    "server_protocol": "http|https",
    "rtmp_port": "1935",
    "timezone": "UTC",
    "timestamp_now": unix_timestamp,
    "time_now": "YYYY-MM-DD HH:MM:SS"
  }
}
```

#### **Get Live Streams:**
```
GET /player_api.php?username={user}&password={pass}&action=get_live_streams
GET /player_api.php?username={user}&password={pass}&action=get_live_streams&category_id={id}
```

#### **Get Categories:**
```
GET /player_api.php?username={user}&password={pass}&action=get_live_categories
GET /player_api.php?username={user}&password={pass}&action=get_vod_categories
GET /player_api.php?username={user}&password={pass}&action=get_series_categories
```

#### **Stream Playback:**
```
GET /live/{username}/{password}/{stream_id}.{ext}
GET /movie/{username}/{password}/{vod_id}.{ext}
GET /series/{username}/{password}/{episode_id}.{ext}
```

Where `{ext}` can be:
- `ts` - MPEG-TS (direct stream)
- `m3u8` - HLS (transcoded)
- `m3u` - M3U playlist

---

## 🏗️ Backend Architecture (Inferred)

### **Technology Stack:**

Based on file structure and API responses:

```
Backend:
├── PHP (player_api.php, get.php)
├── NGINX (web server)
├── MySQL/MariaDB (database)
├── FFmpeg (stream transcoding)
├── Linux (Ubuntu/CentOS)
└── Systemd (service management)
```

---

### **Directory Structure (Typical XUI):**

```
/home/xui/
├── admin/              # Admin panel PHP files
│   ├── login.php
│   ├── dashboard.php
│   ├── streams.php
│   ├── lines.php
│   ├── servers.php
│   └── ...
├── player_api.php      # Xtream Codes API
├── get.php            # M3U playlist generator
├── xmltv.php          # EPG data
├── assets/            # Frontend assets
│   ├── js/
│   │   ├── app.min.js
│   │   └── vendor.min.js
│   ├── css/
│   └── fonts/
├── bin/               # Binary executables
│   └── ffmpeg
├── streams/           # HLS output directory
│   ├── stream_123.m3u8
│   ├── stream_123_0.ts
│   └── ...
└── logs/              # Application logs
```

---

## 🎬 Stream Processing Flow (Critical Discovery)

### **How Streams Are Actually Served:**

#### **Scenario 1: Direct Stream (No Transcoding)**
```
Client Request: /live/user/pass/123.ts
          ↓
Panel: Check auth, check connection limit
          ↓
Panel: HTTP 302 Redirect to source URL
          ↓
Source Server: http://source.com/stream.ts
          ↓
Client: Receives stream directly
```

**Used When:**
- Stream is already in correct format
- `is_direct = true` flag set
- No transcoding profile assigned

#### **Scenario 2: Transcoded Stream (FFmpeg)**
```
Client Request: /live/user/pass/123.m3u8
          ↓
Panel: Check auth, check connection limit
          ↓
Panel: Check if FFmpeg process running
          ↓
If NOT running:
  1. Start FFmpeg process
  2. Read source URL from database
  3. Apply transcode profile settings
  4. Output to /streams/stream_123.m3u8
          ↓
Panel: Serve /streams/stream_123.m3u8
          ↓
Client: Receives HLS stream
          ↓
Client requests segments: /streams/stream_123_0.ts
                         /streams/stream_123_1.ts
                         /streams/stream_123_2.ts
```

**FFmpeg Command Example:**
```bash
ffmpeg -i "http://source.com/live.ts" \
  -c:v libx264 -preset fast -b:v 4000k \
  -c:a aac -b:a 128k \
  -f hls \
  -hls_time 10 \
  -hls_list_size 6 \
  -hls_flags delete_segments \
  -hls_segment_filename "/home/xui/streams/stream_123_%03d.ts" \
  "/home/xui/streams/stream_123.m3u8"
```

---

## 🔄 Load Balancer Architecture

### **Multi-Server Setup:**

```
                    ┌──────────────────┐
                    │   Main Server    │
                    │   (Panel + DB)   │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │ Load Balancer│ │Load Balancer│ │Load Balancer│
    │  Server #1   │ │  Server #2  │ │  Server #3  │
    │   (FFmpeg)   │ │  (FFmpeg)   │ │  (FFmpeg)   │
    └──────────────┘ └─────────────┘ └─────────────┘
```

### **Load Balancer Server Configuration:**

In the admin panel, servers are configured with:
```json
{
  "id": 1,
  "server_name": "LB-US-East",
  "server_url": "http://lb1.example.com",
  "server_port": 80,
  "rtmp_port": 1935,
  "http_broadcast_port": 25461,
  "ssh_host": "lb1.example.com",
  "ssh_port": 22,
  "ssh_username": "root",
  "ssh_password": "encrypted_password",
  "status": "online",
  "max_clients": 1000,
  "current_clients": 245,
  "cpu_usage": 45.5,
  "memory_usage": 60.2,
  "bandwidth": 8500.0,
  "geo_zone": "US-East"
}
```

### **Stream-Server Assignment:**

When admin edits a stream, they can:
1. **Leave server empty** → Main server handles it
2. **Assign specific server** → Always use that server
3. **Auto-select** → Panel chooses based on load

```javascript
// Server selection logic (pseudocode)
function selectBestServer(stream, userLocation) {
  if (stream.serverId) {
    // Force specific server
    return servers.find(s => s.id === stream.serverId);
  }
  
  // Auto-select based on:
  const candidates = servers.filter(s => 
    s.status === 'online' &&
    s.currentClients < s.maxClients &&
    s.cpuUsage < 80 &&
    s.memoryUsage < 90
  );
  
  // Prefer servers in same geo zone
  const local = candidates.filter(s => 
    s.geoZone === userLocation.geoZone
  );
  
  if (local.length > 0) {
    // Pick least loaded local server
    return local.sort((a, b) => 
      a.currentClients - b.currentClients
    )[0];
  }
  
  // Fallback to any available server
  return candidates.sort((a, b) => 
    a.currentClients - b.currentClients
  )[0];
}
```

---

## 🎯 On-Demand Mode Implementation

### **Stream Lifecycle:**

```
Stream States:
├── SLEEPING (no FFmpeg process, no viewers)
├── STARTING (FFmpeg starting, waiting for output)
├── RUNNING (FFmpeg active, serving viewers)
└── STOPPING (Last viewer disconnected, cleanup)
```

### **Process Flow:**

```python
# Simplified Python pseudocode
class OnDemandStream:
    def __init__(self, stream_id):
        self.stream_id = stream_id
        self.ffmpeg_pid = None
        self.viewer_count = 0
        self.state = "SLEEPING"
    
    def on_viewer_connect(self):
        self.viewer_count += 1
        
        if self.state == "SLEEPING":
            self.state = "STARTING"
            self.start_ffmpeg()
            self.wait_for_output()
            self.state = "RUNNING"
    
    def on_viewer_disconnect(self):
        self.viewer_count -= 1
        
        if self.viewer_count == 0:
            self.state = "STOPPING"
            self.stop_ffmpeg()
            self.cleanup_files()
            self.state = "SLEEPING"
    
    def start_ffmpeg(self):
        cmd = [
            'ffmpeg',
            '-i', self.stream.source_url,
            '-c:v', 'copy',
            '-c:a', 'copy',
            '-f', 'hls',
            '-hls_time', '10',
            '-hls_list_size', '6',
            '-hls_flags', 'delete_segments',
            f'/streams/stream_{self.stream_id}.m3u8'
        ]
        self.ffmpeg_pid = subprocess.Popen(cmd).pid
        
        # Store PID in database for monitoring
        db.update_stream(self.stream_id, {'pid': self.ffmpeg_pid})
    
    def stop_ffmpeg(self):
        if self.ffmpeg_pid:
            os.kill(self.ffmpeg_pid, signal.SIGTERM)
            self.ffmpeg_pid = None
            db.update_stream(self.stream_id, {'pid': 0})
```

---

## 📡 Remote Server Execution (SSH)

### **How Main Panel Controls Load Balancers:**

```typescript
// TypeScript/Node.js example
import { Client as SSHClient } from 'ssh2';

async function startStreamOnLoadBalancer(
  server: Server, 
  stream: Stream
): Promise<number> {
  return new Promise((resolve, reject) => {
    const ssh = new SSHClient();
    
    ssh.on('ready', () => {
      // Build FFmpeg command
      const cmd = buildFfmpegCommand(stream);
      
      // Execute remotely
      ssh.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        
        let output = '';
        stream.on('data', (data) => {
          output += data.toString();
          
          // Extract PID from output
          const pidMatch = output.match(/PID: (\d+)/);
          if (pidMatch) {
            const pid = parseInt(pidMatch[1]);
            resolve(pid);
          }
        });
        
        stream.on('close', () => {
          ssh.end();
        });
      });
    });
    
    ssh.connect({
      host: server.sshHost,
      port: server.sshPort,
      username: server.sshUsername,
      password: server.sshPassword,
    });
  });
}

function buildFfmpegCommand(stream: Stream): string {
  const outputPath = `/streams/stream_${stream.id}.m3u8`;
  
  let cmd = `nohup ffmpeg -i "${stream.sourceUrl}" `;
  
  // Apply transcode profile if set
  if (stream.transcodeProfileId) {
    const profile = db.getTranscodeProfile(stream.transcodeProfileId);
    cmd += `-c:v ${profile.videoCodec} `;
    cmd += `-b:v ${profile.videoBitrate} `;
    cmd += `-c:a ${profile.audioCodec} `;
    cmd += `-b:a ${profile.audioBitrate} `;
  } else {
    cmd += `-c:v copy -c:a copy `;
  }
  
  cmd += `-f hls `;
  cmd += `-hls_time 10 `;
  cmd += `-hls_list_size 6 `;
  cmd += `-hls_flags delete_segments `;
  cmd += `${outputPath} `;
  cmd += `> /tmp/ffmpeg_${stream.id}.log 2>&1 & echo "PID: $!"`;
  
  return cmd;
}
```

---

## 🔍 Admin Panel Features (Observed)

### **Main Menu Structure:**

Based on typical XUI panels and URL patterns:

```
Dashboard
├── Dashboard              # Overview stats
│
├── Streams Management
│   ├── Live Streams       # Manage live TV
│   ├── Movies (VOD)       # Video on demand
│   ├── Series             # TV shows/episodes
│   ├── Radio Streams      # Audio streams
│   └── Created Channels   # RTMP to HLS
│
├── Lines Management
│   ├── Lines              # User accounts
│   ├── Packages           # Subscription packages
│   ├── Bouquets           # Channel groups
│   ├── MAG Devices        # STB devices
│   └── Enigma2 Devices    # Satellite receivers
│
├── Servers
│   ├── Load Balancers     # Streaming servers
│   ├── Main Settings      # Server config
│   └── Server Stats       # Monitoring
│
├── EPG Management
│   ├── EPG Sources        # Guide sources
│   ├── EPG Channels       # Channel mapping
│   └── Update EPG         # Manual update
│
├── Categories
│   ├── Live Categories    # Organize channels
│   ├── VOD Categories     # Movie genres
│   └── Series Categories  # Show categories
│
├── Resellers
│   ├── Reseller Accounts  # Sub-admins
│   ├── Reseller Groups    # Permissions
│   └── Credit System      # Billing
│
├── Reports & Analytics
│   ├── Connection Logs    # Who's watching
│   ├── Activity Logs      # Actions audit
│   ├── Failed Auth        # Security
│   └── Most Watched       # Popular content
│
├── Tools
│   ├── Database Backup    # Backup/restore
│   ├── Mass Import        # Bulk operations
│   ├── M3U Import         # Import playlists
│   ├── TMDB Scraper       # Movie metadata
│   └── Watch Folders      # Auto-import
│
└── Settings
    ├── General Settings   # Panel config
    ├── Security           # Firewall, blocks
    ├── Transcode Profiles # Quality presets
    ├── API Settings       # External access
    └── Theme/Branding     # Customization
```

---

## 🎨 Frontend Features to Study

### **1. Dashboard Components:**

- **Real-time Stats Cards:**
  - Total streams (live/VOD/series)
  - Active connections (current viewers)
  - Online streams vs offline
  - Total lines (active/expired/trial)
  - Total credits (reseller system)

- **Charts/Graphs:**
  - Connections over time (line chart)
  - Top watched streams (bar chart)
  - Geographic distribution (map)
  - Server load distribution (donut chart)

- **Recent Activity Feed:**
  - New connections
  - Failed auth attempts
  - Expired lines
  - Stream offline alerts

### **2. Streams Management:**

**Add/Edit Stream Form Fields:**
```
Basic Info:
├── Stream Name
├── Source URL
├── Backup URLs (array)
├── Category
├── Stream Icon URL
├── EPG Channel ID
└── Notes

Server Settings:
├── Server Selection (dropdown)
├── Is Direct Stream (checkbox)
├── On-Demand Mode (checkbox)
├── Auto-Restart Hours
└── Transcode Profile

Advanced Options:
├── Read Native
├── Stream All
├── Remove Subtitles
├── Generate Timestamps
├── Custom FFmpeg Parameters
├── RTMP Output URL
├── External Push URL
├── Delay Minutes
└── Allow Recording

TV Archive:
├── Enable Archive (checkbox)
├── Archive Duration (days)
└── Archive Server
```

### **3. Lines Management:**

**Add/Edit Line Form:**
```
Credentials:
├── Username
├── Password (auto-generate option)
└── Owner (reseller)

Subscription:
├── Package Selection
├── Expiration Date (date picker)
├── Max Connections
├── Is Trial (checkbox)
└── Bouquets (multi-select)

Advanced:
├── Allowed Output Formats (m3u8, ts, rtmp)
├── Forced Country (geo-restriction)
├── Allowed IPs (whitelist)
├── ISP Lock
├── Forced Server
├── Device Locking (MAC address)
└── Allowed User Agents

Notes:
├── Admin Notes (internal)
└── Reseller Notes (visible to reseller)
```

---

## 🔧 Technical Implementation Details

### **Database Schema (Inferred):**

```sql
-- Streams table
CREATE TABLE streams (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  stream_type ENUM('live', 'movie', 'series', 'radio', 'created_live'),
  source_url TEXT NOT NULL,
  backup_urls JSON,
  category_id INT,
  server_id INT REFERENCES servers(id),
  transcode_profile_id INT REFERENCES transcode_profiles(id),
  stream_icon TEXT,
  epg_channel_id VARCHAR(255),
  notes TEXT,
  is_direct BOOLEAN DEFAULT false,
  on_demand BOOLEAN DEFAULT false,
  auto_restart_hours INT DEFAULT 0,
  custom_ffmpeg TEXT,
  rtmp_output TEXT,
  external_push TEXT,
  delay_minutes INT DEFAULT 0,
  allow_record BOOLEAN DEFAULT true,
  tv_archive_enabled BOOLEAN DEFAULT false,
  tv_archive_duration INT DEFAULT 0,
  tv_archive_server_id INT,
  pid INT DEFAULT 0,
  status ENUM('offline', 'online', 'starting', 'error') DEFAULT 'offline',
  monitor_status ENUM('unknown', 'online', 'offline') DEFAULT 'unknown',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category_id),
  INDEX idx_server (server_id),
  INDEX idx_status (status)
);

-- Load Balancer servers table
CREATE TABLE servers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  server_name VARCHAR(255) NOT NULL,
  server_url VARCHAR(255) NOT NULL,
  server_port INT DEFAULT 80,
  rtmp_port INT DEFAULT 1935,
  http_broadcast_port INT DEFAULT 25461,
  ssh_host VARCHAR(255),
  ssh_port INT DEFAULT 22,
  ssh_username VARCHAR(255) DEFAULT 'root',
  ssh_password TEXT,
  ssh_private_key TEXT,
  is_main_server BOOLEAN DEFAULT false,
  status ENUM('offline', 'online') DEFAULT 'offline',
  max_clients INT DEFAULT 1000,
  current_clients INT DEFAULT 0,
  cpu_usage DECIMAL(5,2) DEFAULT 0,
  memory_usage DECIMAL(5,2) DEFAULT 0,
  bandwidth DECIMAL(10,2) DEFAULT 0,
  geo_zone VARCHAR(50),
  enabled BOOLEAN DEFAULT true,
  last_checked TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transcode profiles
CREATE TABLE transcode_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  profile_name VARCHAR(255) NOT NULL,
  video_codec VARCHAR(50) DEFAULT 'copy',
  audio_codec VARCHAR(50) DEFAULT 'copy',
  video_bitrate VARCHAR(20),
  audio_bitrate VARCHAR(20),
  resolution VARCHAR(20),
  preset VARCHAR(20) DEFAULT 'fast',
  custom_params TEXT,
  enabled BOOLEAN DEFAULT true
);

-- Active FFmpeg processes
CREATE TABLE stream_processes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stream_id INT REFERENCES streams(id),
  server_id INT REFERENCES servers(id),
  pid INT NOT NULL,
  status ENUM('starting', 'running', 'stopping', 'crashed'),
  viewer_count INT DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_stream (stream_id),
  INDEX idx_status (status)
);
```

---

## 🚀 Critical Features for PanelX Implementation

### **Priority 1: FFmpeg Integration (MUST HAVE)**

1. **Process Manager Service:**
   ```typescript
   class FFmpegProcessManager {
     private processes: Map<number, ChildProcess> = new Map();
     
     async startStream(streamId: number): Promise<void>
     async stopStream(streamId: number): Promise<void>
     async restartStream(streamId: number): Promise<void>
     async getStreamStatus(streamId: number): StreamStatus
     async killAllProcesses(): Promise<void>
     
     private buildFfmpegCommand(stream: Stream): string[]
     private monitorProcess(streamId: number, process: ChildProcess): void
     private handleProcessExit(streamId: number, code: number): void
   }
   ```

2. **Stream Serving Logic:**
   ```typescript
   app.get('/live/:username/:password/:streamId.m3u8', async (req, res) => {
     // Auth
     const line = await authenticateLine(username, password);
     if (!line) return res.status(401).send('Unauthorized');
     
     // Get stream
     const stream = await db.getStream(streamId);
     if (!stream) return res.status(404).send('Not found');
     
     // Check if On-Demand
     if (stream.onDemand) {
       const isRunning = await ffmpegManager.isRunning(streamId);
       if (!isRunning) {
         await ffmpegManager.startStream(streamId);
         await waitForHLSOutput(streamId, 10000); // 10s timeout
       }
     }
     
     // Serve HLS playlist
     const hlsPath = `/streams/stream_${streamId}.m3u8`;
     res.sendFile(hlsPath);
     
     // Track viewer
     await trackConnection(line.id, streamId);
   });
   ```

### **Priority 2: Load Balancer Routing**

```typescript
async function routeStreamThroughServer(
  stream: Stream,
  line: Line,
  req: Request,
  res: Response
): Promise<void> {
  // Select server
  const server = await selectServer(stream, req.ip);
  
  if (!server || server.id === MAIN_SERVER_ID) {
    // Use local FFmpeg
    return await serveLocalStream(stream, line, req, res);
  }
  
  // Check if FFmpeg running on remote server
  const isRunning = await checkRemoteProcess(server, stream.id);
  
  if (!isRunning && stream.onDemand) {
    // Start FFmpeg on remote server via SSH
    await startRemoteFFmpeg(server, stream);
  }
  
  // Proxy to load balancer
  const proxyUrl = `${server.serverUrl}:${server.serverPort}/stream/${stream.id}.m3u8`;
  res.redirect(proxyUrl);
}
```

### **Priority 3: On-Demand Mode**

```typescript
class OnDemandManager {
  private viewerCounts: Map<number, number> = new Map();
  
  async onViewerConnect(streamId: number): Promise<void> {
    const count = this.viewerCounts.get(streamId) || 0;
    this.viewerCounts.set(streamId, count + 1);
    
    if (count === 0) {
      // First viewer, start stream
      await ffmpegManager.startStream(streamId);
    }
  }
  
  async onViewerDisconnect(streamId: number): Promise<void> {
    const count = this.viewerCounts.get(streamId) || 0;
    const newCount = Math.max(0, count - 1);
    this.viewerCounts.set(streamId, newCount);
    
    if (newCount === 0) {
      // Last viewer disconnected, stop stream
      await ffmpegManager.stopStream(streamId);
    }
  }
}
```

---

## 📋 Complete Feature Checklist

### **Stream Management:**
- [x] Add/Edit/Delete streams
- [x] Categories
- [x] Stream icons
- [x] EPG channel mapping
- [ ] Server selection per stream
- [ ] Transcode profile selection
- [ ] On-Demand mode toggle
- [ ] Direct stream flag
- [ ] Auto-restart configuration
- [ ] Custom FFmpeg parameters
- [ ] Backup URLs
- [ ] TV Archive settings
- [ ] RTMP output
- [ ] External push
- [ ] Delay/timeshift
- [ ] Recording permissions

### **Process Management:**
- [ ] Start/stop FFmpeg locally
- [ ] Start/stop FFmpeg remotely (SSH)
- [ ] Monitor process status
- [ ] Auto-restart on crash
- [ ] Process health checks
- [ ] Kill stuck processes
- [ ] View FFmpeg logs
- [ ] Resource usage tracking

### **Server Management:**
- [x] Add/Edit/Delete servers
- [x] SSH credentials
- [ ] Health monitoring (CPU/RAM/BW)
- [ ] Server status checks
- [ ] Connection counting
- [ ] Auto-selection algorithm
- [ ] Geo-routing
- [ ] Server load balancing
- [ ] Remote command execution

### **Streaming Features:**
- [x] Direct URL redirect
- [ ] HLS transcoding
- [ ] MPEG-TS transcoding
- [ ] RTMP output
- [ ] Multiple quality profiles
- [ ] On-Demand start/stop
- [ ] Auto-restart on failure
- [ ] Segment serving
- [ ] Archive/timeshift
- [ ] Recording

---

## 🎯 Implementation Roadmap Summary

### **Phase 1: Local FFmpeg (2-3 hours)**
- Install FFmpeg
- Create process manager class
- Implement HLS transcoding
- Route `/live/*/m3u8` through FFmpeg
- Test with one stream

### **Phase 2: On-Demand Mode (2-3 hours)**
- Viewer connection tracking
- Start on first viewer
- Stop when empty
- Update stream status in DB
- Test lifecycle

### **Phase 3: Transcode Profiles (1-2 hours)**
- CRUD UI for profiles
- Apply profile to FFmpeg command
- Test multiple qualities

### **Phase 4: Load Balancer Routing (4-5 hours)**
- Server selection logic
- SSH client integration
- Remote FFmpeg execution
- Stream proxying
- Health monitoring

### **Phase 5: Advanced Features (5-6 hours)**
- Server health monitoring
- Auto-selection algorithm
- Process crash recovery
- Resource usage tracking
- Admin monitoring UI

**Total: ~15-19 hours for full implementation**

---

## 📚 Key Takeaways

1. **XUI panels are FFmpeg-powered** - All transcoding happens server-side
2. **On-Demand is critical** - Saves huge resources by sleeping when idle
3. **Load Balancing is powerful** - Scales horizontally with multiple servers
4. **SSH is the bridge** - Main panel controls remote servers via SSH
5. **HLS is the standard** - Browser compatibility requires HLS output
6. **Process management is key** - Must track PIDs, monitor health, handle crashes

---

## ✅ Next Steps

**Ready to implement?** Tell me which phase to start with:

1. **Phase 1** - Local FFmpeg transcoding (browser playback)
2. **Phase 2** - On-Demand mode (resource optimization)
3. **Phase 3** - Transcode profiles (quality options)
4. **Phase 4** - Load balancer routing (scalability)
5. **Full stack** - All phases in sequence

---

**Analysis completed:** January 22, 2026  
**Panel reference:** http://eu4k.online:8080/8zvAYhfb  
**Status:** ✅ READ-ONLY ANALYSIS COMPLETE - NO CHANGES MADE
