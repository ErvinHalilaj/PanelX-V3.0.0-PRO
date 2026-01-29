# 🏗️ Professional IPTV Architecture - FFmpeg + Real-Time Stats

## Current Problem

Your PanelX has **TWO separate streaming systems** that don't communicate:

1. **StreamProxy** (Direct proxy, tracks stats) ✅
2. **FFmpeg** (Transcoding, DOESN'T integrate with stats) ❌

---

## Professional IPTV Solution

### Architecture Overview

```
CLIENT REQUEST
      ↓
┌─────────────────────────────────────┐
│  Backend Route Handler              │
│  /live/:user/:pass/:stream.ts       │
│                                     │
│  1. Authenticate                    │
│  2. Check stream.transcoding flag   │
│  3. Route to appropriate handler    │
└─────────┬───────────────────────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌─────────┐ ┌────────────┐
│ Direct  │ │  FFmpeg    │
│ Proxy   │ │  Transcode │
│         │ │            │
│ ✅ Stats│ │ ❌ No Stats│ ← PROBLEM!
└─────────┘ └────────────┘
```

---

## Solution: Unified Connection Tracking

### What Needs to Happen

**For BOTH Direct Proxy AND FFmpeg streams:**

1. **Create connection record** in database
2. **Track bandwidth** in real-time
3. **Broadcast to WebSocket** every 2 seconds
4. **Update dashboard** with live stats

---

## Implementation Options

### Option 1: Fix FFmpeg Integration (Recommended)

**Modify FFmpeg to report stats to StreamProxy:**

```typescript
// server/ffmpegManager.ts

import { getStreamProxyManager } from './streamProxy';
import { getWebSocketManager } from './websocket';

class FFmpegProcessManager {
  async onViewerConnect(streamId: number): Promise<void> {
    const proc = this.processes.get(streamId);
    if (proc) {
      proc.viewerCount++;
      
      // ✅ NEW: Notify StreamProxy
      const proxyManager = getStreamProxyManager();
      if (proxyManager) {
        proxyManager.trackFFmpegConnection(streamId, proc.viewerCount);
      }
      
      // ✅ NEW: Broadcast to WebSocket
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.broadcastConnectionUpdate(streamId, proc.viewerCount);
      }
    }
  }
  
  async onViewerDisconnect(streamId: number): Promise<void> {
    const proc = this.processes.get(streamId);
    if (proc) {
      proc.viewerCount = Math.max(0, proc.viewerCount - 1);
      
      // ✅ NEW: Notify StreamProxy
      const proxyManager = getStreamProxyManager();
      if (proxyManager) {
        proxyManager.trackFFmpegConnection(streamId, proc.viewerCount);
      }
      
      // ✅ NEW: Broadcast to WebSocket
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.broadcastConnectionUpdate(streamId, proc.viewerCount);
      }
    }
  }
}
```

### Option 2: Disable FFmpeg, Use Only Direct Proxy

**Simpler, but less flexible:**

1. Remove FFmpeg transcoding
2. All streams use direct proxy
3. Real-time stats work immediately

**Pros:**
- ✅ Real-time stats work
- ✅ Lower CPU usage
- ✅ Lower latency

**Cons:**
- ❌ Can't transcode RTMP streams
- ❌ Can't change resolution
- ❌ Can't change formats

### Option 3: Hybrid (Best for Professional Panel)

**Use the right tool for each stream:**

| Stream Type | Method | Tracking |
|-------------|--------|----------|
| M3U8/HLS (already compatible) | Direct Proxy | ✅ Real-time |
| RTMP/RTSP (need conversion) | FFmpeg | ✅ Real-time |
| Multi-bitrate ABR | FFmpeg | ✅ Real-time |
| Simple restream | Direct Proxy | ✅ Real-time |

---

## What Professional IPTV Panels Do

### Examples:

**1. Xtream Codes:**
- Uses FFmpeg for transcoding
- Tracks connections in MySQL database
- Updates stats every 5 seconds
- Dashboard shows real-time viewer count

**2. XtreamUI:**
- Nginx-RTMP module for RTMP
- FFmpeg for HLS conversion
- Custom connection tracking
- WebSocket for real-time updates

**3. Flussonic:**
- C++ backend for performance
- FFmpeg for transcoding
- Real-time stats via API
- Dashboard with live graphs

---

## Your Decision

### Do you want:

**A) Full Professional Setup (Hybrid)**
- Keep FFmpeg for transcoding
- Fix connection tracking
- Both methods work with real-time stats
- **Time:** 1-2 hours of development

**B) Simple Setup (Direct Proxy Only)**
- Disable FFmpeg completely
- Only direct proxy streaming
- Real-time stats work immediately
- **Time:** 5 minutes

**C) Current Setup (Direct Proxy + Broken FFmpeg)**
- FFmpeg works but no stats
- Direct proxy has stats
- Confusing for users
- **Not recommended**

---

## My Recommendation

**For now:** Use **Option B** (Direct Proxy Only)

**Why:**
1. Your streams are already M3U8/HLS (no transcoding needed)
2. Real-time stats will work immediately
3. Lower CPU usage = lower cost
4. Most IPTV streams are already HLS format

**Later:** Add FFmpeg integration (Option A) when you need:
- RTMP stream support
- Format conversion
- Resolution changes
- Multi-bitrate (ABR)

---

## Quick Fix (5 Minutes)

**Disable FFmpeg, use only Direct Proxy:**

1. Set all streams to `transcoding: false`
2. Stop any running FFmpeg processes
3. Test with direct proxy URL
4. Real-time stats work immediately

**Want me to implement this?**

---

## Questions for You

1. **Do you have RTMP streams** that need transcoding?
2. **Do you need to change resolutions** (1080p → 720p)?
3. **Do you need multi-bitrate** (ABR) streaming?
4. **Are most of your streams already M3U8/HLS?**

Based on your answers, I'll implement the right solution.

---

## Current Status

- ✅ StreamProxy works (real-time stats)
- ✅ FFmpeg works (but no stats)
- ❌ FFmpeg not integrated with dashboard
- ❌ Real-time stats only work for direct proxy

**Next step:** Choose Option A, B, or C above.
