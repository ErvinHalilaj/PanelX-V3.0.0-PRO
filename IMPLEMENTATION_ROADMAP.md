# PanelX Implementation Roadmap
## Achieving Full IPTV Panel Functionality

**Target:** 100% Feature Parity with XUIONE  
**Current:** 73% Feature Parity  
**Timeline:** 14 Weeks (3.5 Months)  
**Repository:** https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO

---

## 🎯 Executive Summary

This roadmap outlines the implementation plan to bring PanelX from **73% to 100% feature parity** with industry-leading IPTV panels like XUIONE, XtreamCodes, and OneStream.

**Current Status:**
- ✅ Core IPTV functionality working (95%)
- ✅ Xtream Codes API compatible (100%)
- ✅ Stream management complete (85%)
- ⚠️ Advanced features needed (60%)
- 🔴 Security enhancements critical (60%)

---

## 📅 Phase 1: Critical Security & Stability (Weeks 1-2)

**Goal:** Make PanelX production-grade secure  
**Priority:** 🔴 CRITICAL

### Week 1: Authentication & Security

#### Task 1.1: Two-Factor Authentication (2FA)
**Priority:** CRITICAL  
**Effort:** 3 days  
**Dependencies:** None

**Implementation:**
```typescript
// Install packages
npm install speakeasy qrcode

// New files to create:
// server/auth/twoFactor.ts - 2FA logic
// client/src/pages/Settings/TwoFactor.tsx - UI
```

**Features:**
- TOTP-based 2FA using speakeasy
- QR code generation for authenticator apps
- Backup codes generation (10 codes)
- 2FA enforcement for admin accounts
- Optional for resellers
- Recovery mechanism

**Database Schema:**
```sql
ALTER TABLE users ADD COLUMN twoFactorSecret TEXT;
ALTER TABLE users ADD COLUMN twoFactorEnabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN backupCodes TEXT[]; -- Array of hashed codes
ALTER TABLE users ADD COLUMN lastTwoFactorCheck TIMESTAMP;
```

**API Endpoints:**
- `POST /api/auth/2fa/setup` - Generate secret and QR
- `POST /api/auth/2fa/verify` - Verify code
- `POST /api/auth/2fa/enable` - Enable 2FA
- `POST /api/auth/2fa/disable` - Disable 2FA
- `POST /api/auth/2fa/backup-codes` - Generate new codes

---

#### Task 1.2: IP Whitelisting
**Priority:** HIGH  
**Effort:** 2 days  
**Dependencies:** None

**Implementation:**
```typescript
// New files:
// server/middleware/ipWhitelist.ts
// client/src/pages/Settings/IPWhitelist.tsx
```

**Features:**
- Global IP whitelist for admin panel
- Per-user IP restrictions
- IP range support (CIDR notation)
- Automatic IP detection
- Whitelist bypass for emergency
- Activity logging per IP

**Database Schema:**
```sql
CREATE TABLE ip_whitelist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  ipAddress TEXT NOT NULL,
  ipRange TEXT,
  description TEXT,
  isActive BOOLEAN DEFAULT true,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  lastUsed DATETIME,
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE INDEX idx_ip_whitelist_user ON ip_whitelist(userId);
CREATE INDEX idx_ip_whitelist_ip ON ip_whitelist(ipAddress);
```

**API Endpoints:**
- `GET /api/settings/ip-whitelist` - List whitelisted IPs
- `POST /api/settings/ip-whitelist` - Add IP
- `DELETE /api/settings/ip-whitelist/:id` - Remove IP
- `PUT /api/settings/ip-whitelist/:id` - Update IP

---

### Week 2: Audit & Backup

#### Task 1.3: Comprehensive Audit Logging
**Priority:** CRITICAL  
**Effort:** 3 days  
**Dependencies:** None

**Implementation:**
```typescript
// New files:
// server/audit/logger.ts
// server/audit/types.ts
// client/src/pages/Settings/AuditLogs.tsx
```

**Features:**
- Log all admin/reseller actions
- Log all API calls (optional)
- Log authentication events
- Log configuration changes
- Log bulk operations
- Search and filter logs
- Export logs (CSV/JSON)
- Automatic log rotation
- Log retention policy

**Database Schema:**
```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resourceId INTEGER,
  method TEXT,
  path TEXT,
  ipAddress TEXT,
  userAgent TEXT,
  requestBody TEXT,
  responseStatus INTEGER,
  errorMessage TEXT,
  duration INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE INDEX idx_audit_user ON audit_logs(userId);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_resource ON audit_logs(resource, resourceId);
```

**Logged Actions:**
- `AUTH_LOGIN`, `AUTH_LOGOUT`, `AUTH_FAILED`
- `STREAM_CREATE`, `STREAM_UPDATE`, `STREAM_DELETE`, `STREAM_START`, `STREAM_STOP`
- `LINE_CREATE`, `LINE_UPDATE`, `LINE_DELETE`, `LINE_ENABLE`, `LINE_DISABLE`
- `USER_CREATE`, `USER_UPDATE`, `USER_DELETE`
- `CATEGORY_CREATE`, `CATEGORY_UPDATE`, `CATEGORY_DELETE`
- `SETTINGS_UPDATE`, `BACKUP_CREATE`, `BACKUP_RESTORE`
- `BULK_OPERATION`, `IMPORT_M3U`, `EXPORT_DATA`

**API Endpoints:**
- `GET /api/audit/logs` - List logs (pagination, filters)
- `GET /api/audit/logs/:id` - Get log details
- `POST /api/audit/logs/export` - Export logs
- `DELETE /api/audit/logs/cleanup` - Manual cleanup (admin only)

---

#### Task 1.4: Backup & Restore System
**Priority:** CRITICAL  
**Effort:** 2 days  
**Dependencies:** None

**Implementation:**
```typescript
// New files:
// server/backup/manager.ts
// client/src/pages/Settings/Backup.tsx
```

**Features:**
- One-click database backup
- Scheduled automatic backups (daily, weekly)
- Configuration backup
- Full system backup (DB + config + uploads)
- One-click restore from backup
- Backup encryption (optional)
- Remote backup storage (S3, FTP)
- Backup verification
- Retention policy (keep last N backups)

**Database Schema:**
```sql
CREATE TABLE backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, -- 'database', 'config', 'full'
  filename TEXT NOT NULL,
  filesize INTEGER,
  location TEXT, -- 'local', 's3', 'ftp'
  remotePath TEXT,
  isEncrypted BOOLEAN DEFAULT false,
  isAutomatic BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'completed', -- 'pending', 'running', 'completed', 'failed'
  createdBy INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (createdBy) REFERENCES users(id)
);

CREATE INDEX idx_backups_type ON backups(type);
CREATE INDEX idx_backups_created ON backups(createdAt);
```

**Implementation Steps:**
1. Create backup directory: `/var/panelx/backups`
2. Use `sqlite3` command for database dumps
3. Archive with `tar.gz` compression
4. Optional: Encrypt with `openssl`
5. Store metadata in database
6. Implement restore functionality
7. Add cron job for scheduled backups

**API Endpoints:**
- `GET /api/backups` - List backups
- `POST /api/backups/create` - Create manual backup
- `POST /api/backups/restore/:id` - Restore from backup
- `DELETE /api/backups/:id` - Delete backup
- `GET /api/backups/:id/download` - Download backup file
- `PUT /api/backups/schedule` - Update backup schedule

---

## 📅 Phase 2: Core Feature Enhancements (Weeks 3-5)

**Goal:** Advanced monitoring and multi-server support  
**Priority:** 🔴 HIGH

### Week 3: Advanced Dashboard

#### Task 2.1: Real-time Bandwidth Monitoring
**Priority:** HIGH  
**Effort:** 4 days

**Implementation:**
```typescript
// New files:
// server/monitoring/bandwidth.ts
// client/src/components/Dashboard/BandwidthChart.tsx
```

**Features:**
- Track bandwidth per stream
- Track bandwidth per line
- Track bandwidth per server
- Real-time bandwidth graphs
- Historical bandwidth data (last 24h, 7d, 30d)
- Peak bandwidth detection
- Bandwidth alerts
- Cost estimation

**Database Schema:**
```sql
CREATE TABLE bandwidth_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  streamId INTEGER,
  lineId INTEGER,
  serverId INTEGER,
  bytesIn INTEGER DEFAULT 0,
  bytesOut INTEGER DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (streamId) REFERENCES streams(id),
  FOREIGN KEY (lineId) REFERENCES lines(id),
  FOREIGN KEY (serverId) REFERENCES servers(id)
);

CREATE INDEX idx_bandwidth_stream ON bandwidth_stats(streamId, timestamp);
CREATE INDEX idx_bandwidth_line ON bandwidth_stats(lineId, timestamp);
CREATE INDEX idx_bandwidth_timestamp ON bandwidth_stats(timestamp);

-- Aggregate view for quick stats
CREATE VIEW bandwidth_summary AS
SELECT
  DATE(timestamp) as date,
  SUM(bytesIn) as totalBytesIn,
  SUM(bytesOut) as totalBytesOut,
  COUNT(DISTINCT streamId) as activeStreams,
  COUNT(DISTINCT lineId) as activeLines
FROM bandwidth_stats
GROUP BY DATE(timestamp);
```

**API Endpoints:**
- `GET /api/monitoring/bandwidth/current` - Current bandwidth
- `GET /api/monitoring/bandwidth/history` - Historical data
- `GET /api/monitoring/bandwidth/stream/:id` - Per stream
- `GET /api/monitoring/bandwidth/line/:id` - Per line
- `GET /api/monitoring/bandwidth/server/:id` - Per server

---

#### Task 2.2: Geographic Connection Map
**Priority:** MEDIUM  
**Effort:** 3 days

**Implementation:**
```typescript
// Install packages
npm install geoip-lite

// New files:
// server/monitoring/geoip.ts
// client/src/components/Dashboard/ConnectionMap.tsx
```

**Features:**
- IP geolocation for all connections
- Real-time connection map (world map)
- Connection count per country
- Top countries list
- City-level detail
- ISP detection
- VPN/Proxy detection

**Database Schema:**
```sql
CREATE TABLE connection_geoip (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lineId INTEGER,
  ipAddress TEXT NOT NULL,
  country TEXT,
  countryCode TEXT,
  region TEXT,
  city TEXT,
  latitude REAL,
  longitude REAL,
  isp TEXT,
  isVPN BOOLEAN DEFAULT false,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lineId) REFERENCES lines(id)
);

CREATE INDEX idx_geoip_line ON connection_geoip(lineId);
CREATE INDEX idx_geoip_country ON connection_geoip(countryCode);
CREATE INDEX idx_geoip_timestamp ON connection_geoip(timestamp);
```

**API Endpoints:**
- `GET /api/monitoring/geoip/current` - Active connections
- `GET /api/monitoring/geoip/stats` - Country stats
- `GET /api/monitoring/geoip/map` - Map data points

---

### Week 4: Multi-Server Support

#### Task 2.3: Multi-Server Management
**Priority:** HIGH  
**Effort:** 5 days

**Implementation:**
```typescript
// New files:
// server/servers/manager.ts
// client/src/pages/Servers/ServerList.tsx
// client/src/pages/Servers/ServerForm.tsx
```

**Features:**
- Add/edit/delete streaming servers
- Server health monitoring
- Automatic failover
- Load balancing (round-robin, least-connections, weighted)
- Per-server stream assignments
- Per-server bandwidth limits
- Server groups
- SSH management (optional)

**Database Schema:**
```sql
CREATE TABLE servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER DEFAULT 8080,
  apiUrl TEXT,
  apiKey TEXT,
  isActive BOOLEAN DEFAULT true,
  isPrimary BOOLEAN DEFAULT false,
  weight INTEGER DEFAULT 100,
  maxConnections INTEGER DEFAULT 1000,
  currentConnections INTEGER DEFAULT 0,
  status TEXT DEFAULT 'unknown', -- 'online', 'offline', 'degraded'
  cpuUsage REAL DEFAULT 0,
  ramUsage REAL DEFAULT 0,
  diskUsage REAL DEFAULT 0,
  bandwidthIn INTEGER DEFAULT 0,
  bandwidthOut INTEGER DEFAULT 0,
  lastCheck DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE server_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  loadBalancingMethod TEXT DEFAULT 'round-robin',
  isActive BOOLEAN DEFAULT true
);

CREATE TABLE server_group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  groupId INTEGER NOT NULL,
  serverId INTEGER NOT NULL,
  priority INTEGER DEFAULT 0,
  FOREIGN KEY (groupId) REFERENCES server_groups(id),
  FOREIGN KEY (serverId) REFERENCES servers(id)
);

-- Update streams table
ALTER TABLE streams ADD COLUMN serverId INTEGER;
ALTER TABLE streams ADD COLUMN serverGroupId INTEGER;
```

**API Endpoints:**
- `GET /api/servers` - List servers
- `POST /api/servers` - Add server
- `PUT /api/servers/:id` - Update server
- `DELETE /api/servers/:id` - Delete server
- `GET /api/servers/:id/stats` - Server stats
- `POST /api/servers/:id/check` - Health check
- `GET /api/server-groups` - List groups
- `POST /api/server-groups` - Create group

---

### Week 5: VOD Enhancements

#### Task 2.4: TMDB Integration
**Priority:** MEDIUM  
**Effort:** 4 days

**Implementation:**
```typescript
// Install packages
npm install axios

// New files:
// server/integrations/tmdb.ts
// client/src/pages/VOD/TMDBSearch.tsx
```

**Features:**
- Search movies/series on TMDB
- Auto-fetch metadata (title, plot, cast, director, etc.)
- Download posters and backdrops
- Fetch trailers (YouTube links)
- Get ratings and genres
- Episode metadata for series
- Batch import
- Auto-update metadata

**Environment Variables:**
```bash
TMDB_API_KEY=your_tmdb_api_key_here
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p
```

**Database Schema:**
```sql
ALTER TABLE streams ADD COLUMN tmdbId INTEGER;
ALTER TABLE streams ADD COLUMN tmdbType TEXT; -- 'movie', 'tv'
ALTER TABLE streams ADD COLUMN posterPath TEXT;
ALTER TABLE streams ADD COLUMN backdropPath TEXT;
ALTER TABLE streams ADD COLUMN voteAverage REAL;
ALTER TABLE streams ADD COLUMN voteCount INTEGER;
ALTER TABLE streams ADD COLUMN originalLanguage TEXT;
```

**API Endpoints:**
- `GET /api/tmdb/search/movie` - Search movies
- `GET /api/tmdb/search/tv` - Search TV shows
- `GET /api/tmdb/movie/:id` - Get movie details
- `GET /api/tmdb/tv/:id` - Get TV show details
- `POST /api/streams/:id/tmdb/fetch` - Fetch and apply metadata
- `POST /api/streams/tmdb/batch` - Batch metadata update

---

#### Task 2.5: Subtitle Management
**Priority:** LOW  
**Effort:** 3 days

**Implementation:**
```typescript
// New files:
// server/subtitles/manager.ts
// client/src/pages/VOD/Subtitles.tsx
```

**Features:**
- Upload subtitle files (SRT, VTT, ASS)
- Multiple subtitles per stream
- Language selection
- Subtitle conversion (SRT ↔ VTT)
- Subtitle sync/offset adjustment
- Auto-subtitle download (OpenSubtitles API)
- Subtitle preview

**Database Schema:**
```sql
CREATE TABLE subtitles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  streamId INTEGER NOT NULL,
  language TEXT NOT NULL,
  languageCode TEXT NOT NULL,
  label TEXT,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  format TEXT DEFAULT 'srt',
  isDefault BOOLEAN DEFAULT false,
  syncOffset INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (streamId) REFERENCES streams(id)
);

CREATE INDEX idx_subtitles_stream ON subtitles(streamId);
```

**API Endpoints:**
- `GET /api/subtitles/:streamId` - List subtitles for stream
- `POST /api/subtitles/:streamId/upload` - Upload subtitle
- `DELETE /api/subtitles/:id` - Delete subtitle
- `PUT /api/subtitles/:id` - Update subtitle
- `GET /api/subtitles/:id/download` - Download subtitle file

---

## 📅 Phase 3: Business Features (Weeks 6-8)

**Goal:** Reseller features and monetization  
**Priority:** ⚠️ MEDIUM

### Week 6: Reseller Enhancements

#### Task 3.1: Commission System
**Priority:** MEDIUM  
**Effort:** 3 days

**Features:**
- Commission tracking per reseller
- Percentage or fixed amount
- Commission on line creation
- Commission on renewals
- Commission reports
- Automatic commission calculation
- Commission payout tracking

**Database Schema:**
```sql
ALTER TABLE users ADD COLUMN commissionRate REAL DEFAULT 0; -- Percentage
ALTER TABLE users ADD COLUMN commissionFixed REAL DEFAULT 0; -- Fixed amount
ALTER TABLE users ADD COLUMN totalCommissionEarned REAL DEFAULT 0;
ALTER TABLE users ADD COLUMN totalCommissionPaid REAL DEFAULT 0;
ALTER TABLE users ADD COLUMN lastCommissionDate DATETIME;

CREATE TABLE commission_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resellerId INTEGER NOT NULL,
  lineId INTEGER,
  type TEXT NOT NULL, -- 'creation', 'renewal', 'manual'
  amount REAL NOT NULL,
  creditCost REAL NOT NULL,
  commissionRate REAL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'paid'
  paidAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resellerId) REFERENCES users(id),
  FOREIGN KEY (lineId) REFERENCES lines(id)
);

CREATE INDEX idx_commission_reseller ON commission_transactions(resellerId);
CREATE INDEX idx_commission_status ON commission_transactions(status);
```

**API Endpoints:**
- `GET /api/reseller/commission/stats` - Commission summary
- `GET /api/reseller/commission/transactions` - Transaction history
- `POST /api/admin/commission/payout` - Mark as paid (admin)
- `PUT /api/admin/commission/rate/:id` - Update rate (admin)

---

#### Task 3.2: Auto-Renewal System
**Priority:** MEDIUM  
**Effort:** 4 days

**Features:**
- Automatic line renewal before expiration
- Renewal grace period
- Auto-deduct from reseller credits
- Email reminders (7 days, 3 days, 1 day before expiration)
- Renewal history
- Manual renewal override
- Renewal failure handling

**Database Schema:**
```sql
ALTER TABLE lines ADD COLUMN autoRenew BOOLEAN DEFAULT false;
ALTER TABLE lines ADD COLUMN renewalDays INTEGER DEFAULT 30;
ALTER TABLE lines ADD COLUMN renewalCreditCost INTEGER;
ALTER TABLE lines ADD COLUMN lastRenewalDate DATETIME;
ALTER TABLE lines ADD COLUMN nextRenewalDate DATETIME;

CREATE TABLE renewal_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lineId INTEGER NOT NULL,
  resellerId INTEGER NOT NULL,
  creditCost INTEGER NOT NULL,
  renewalDays INTEGER NOT NULL,
  oldExpDate DATETIME NOT NULL,
  newExpDate DATETIME NOT NULL,
  status TEXT DEFAULT 'completed', -- 'completed', 'failed'
  errorMessage TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lineId) REFERENCES lines(id),
  FOREIGN KEY (resellerId) REFERENCES users(id)
);

CREATE INDEX idx_renewal_line ON renewal_history(lineId);
CREATE INDEX idx_renewal_date ON renewal_history(createdAt);
```

**Implementation:**
- Cron job runs daily
- Check lines expiring in next 7 days
- Send reminder emails
- Auto-renew if enabled and credits available
- Log all renewal attempts

**API Endpoints:**
- `POST /api/lines/:id/auto-renew/enable` - Enable auto-renewal
- `POST /api/lines/:id/auto-renew/disable` - Disable auto-renewal
- `GET /api/renewal/upcoming` - Lines expiring soon
- `GET /api/renewal/history` - Renewal history
- `POST /api/renewal/:id/retry` - Retry failed renewal

---

### Week 7-8: Notification System

#### Task 3.3: Email & SMS Notifications
**Priority:** MEDIUM  
**Effort:** 5 days

**Implementation:**
```typescript
// Install packages
npm install nodemailer twilio

// New files:
// server/notifications/email.ts
// server/notifications/sms.ts
// server/notifications/templates.ts
// client/src/pages/Settings/Notifications.tsx
```

**Features:**
- Email notifications (SMTP)
- SMS notifications (Twilio)
- Template management
- Notification triggers
- User preferences
- Notification history
- Batch notifications
- Scheduled notifications

**Environment Variables:**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password
SMTP_FROM=noreply@panelx.com

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890
```

**Database Schema:**
```sql
CREATE TABLE notification_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'email', 'sms'
  trigger TEXT NOT NULL, -- 'line_expiring', 'line_expired', 'renewal_failed', etc.
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT, -- JSON array of available variables
  isActive BOOLEAN DEFAULT true,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  lineId INTEGER,
  type TEXT NOT NULL,
  trigger TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  errorMessage TEXT,
  sentAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (lineId) REFERENCES lines(id)
);

CREATE INDEX idx_notification_user ON notification_log(userId);
CREATE INDEX idx_notification_status ON notification_log(status);
CREATE INDEX idx_notification_created ON notification_log(createdAt);
```

**Notification Triggers:**
- `line_expiring_7d` - Line expiring in 7 days
- `line_expiring_3d` - Line expiring in 3 days
- `line_expiring_1d` - Line expiring in 1 day
- `line_expired` - Line has expired
- `line_renewed` - Line renewed successfully
- `renewal_failed` - Auto-renewal failed
- `credits_low` - Reseller credits low
- `line_disabled` - Line disabled by admin
- `password_changed` - Password changed
- `new_device` - New device detected

**API Endpoints:**
- `GET /api/notifications/templates` - List templates
- `POST /api/notifications/templates` - Create template
- `PUT /api/notifications/templates/:id` - Update template
- `GET /api/notifications/log` - Notification history
- `POST /api/notifications/send` - Send manual notification
- `POST /api/notifications/test` - Test notification

---

## 📅 Phase 4: Advanced Features (Weeks 9-12)

**Goal:** EPG, recording, and advanced media features  
**Priority:** 🟡 MEDIUM-LOW

### Week 9-10: EPG Enhancements

#### Task 4.1: EPG Editor & Auto-Import
**Priority:** MEDIUM  
**Effort:** 5 days

**Features:**
- Manual EPG entry/editing
- Auto-import from XMLTV URLs
- EPG import scheduler (daily, weekly)
- Channel mapping tool
- EPG validation
- EPG preview
- Multi-source EPG merging

**Database Schema:**
```sql
CREATE TABLE epg_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT DEFAULT 'xmltv', -- 'xmltv', 'json'
  isActive BOOLEAN DEFAULT true,
  autoImport BOOLEAN DEFAULT true,
  importSchedule TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'manual'
  lastImport DATETIME,
  nextImport DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Channel mapping for EPG
CREATE TABLE epg_channel_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  streamId INTEGER NOT NULL,
  epgSourceId INTEGER NOT NULL,
  channelId TEXT NOT NULL,
  FOREIGN KEY (streamId) REFERENCES streams(id),
  FOREIGN KEY (epgSourceId) REFERENCES epg_sources(id)
);

CREATE INDEX idx_epg_mapping_stream ON epg_channel_mapping(streamId);
```

**API Endpoints:**
- `GET /api/epg/sources` - List EPG sources
- `POST /api/epg/sources` - Add EPG source
- `POST /api/epg/sources/:id/import` - Manual import
- `GET /api/epg/mapping/:streamId` - Get channel mapping
- `POST /api/epg/mapping` - Map channel to stream
- `POST /api/epg/entries/create` - Manual EPG entry
- `PUT /api/epg/entries/:id` - Edit EPG entry
- `DELETE /api/epg/entries/:id` - Delete EPG entry

---

#### Task 4.2: TV Archive & Timeshift
**Priority:** LOW  
**Effort:** 5 days

**Features:**
- TV archive/catchup for live streams
- Timeshift buffer
- Seek backward in live stream
- Recording from archive
- Archive retention policy
- Archive per stream configuration

**Database Schema:**
```sql
-- Already exists in schema, just need implementation
-- streams.tvArchiveEnabled
-- streams.tvArchiveDuration

CREATE TABLE archive_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  streamId INTEGER NOT NULL,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  startTime DATETIME NOT NULL,
  endTime DATETIME NOT NULL,
  duration INTEGER NOT NULL,
  filesize INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (streamId) REFERENCES streams(id)
);

CREATE INDEX idx_archive_stream ON archive_segments(streamId);
CREATE INDEX idx_archive_time ON archive_segments(streamId, startTime, endTime);
```

**Implementation:**
- Use FFmpeg to segment live streams
- Store segments for X hours (configurable)
- Serve segments via HLS playlist
- Cleanup old segments automatically

---

### Week 11-12: Advanced Recording

#### Task 4.3: Scheduled Recording System
**Priority:** LOW  
**Effort:** 4 days

**Features:**
- Schedule recordings from EPG
- Manual recording schedule
- Recording library
- Recording playback
- Recording download
- Recording retention
- Recording quality selection

**Database Schema:**
```sql
CREATE TABLE recording_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  streamId INTEGER NOT NULL,
  lineId INTEGER,
  epgEntryId INTEGER,
  title TEXT NOT NULL,
  startTime DATETIME NOT NULL,
  endTime DATETIME NOT NULL,
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'recording', 'completed', 'failed'
  recordingPath TEXT,
  filesize INTEGER,
  errorMessage TEXT,
  createdBy INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (streamId) REFERENCES streams(id),
  FOREIGN KEY (lineId) REFERENCES lines(id),
  FOREIGN KEY (createdBy) REFERENCES users(id)
);

CREATE INDEX idx_recording_stream ON recording_schedules(streamId);
CREATE INDEX idx_recording_time ON recording_schedules(startTime);
CREATE INDEX idx_recording_status ON recording_schedules(status);
```

**API Endpoints:**
- `POST /api/recordings/schedule` - Schedule recording
- `GET /api/recordings` - List recordings
- `DELETE /api/recordings/:id` - Delete recording
- `GET /api/recordings/:id/download` - Download recording
- `POST /api/recordings/:id/play` - Play recording

---

## 📅 Phase 5: UI/UX Polish (Weeks 13-14)

**Goal:** Perfect user experience  
**Priority:** 🟡 LOW

### Week 13: Theme & Localization

#### Task 5.1: Complete Dark Mode
**Priority:** LOW  
**Effort:** 2 days

- Audit all pages for dark mode issues
- Ensure consistent theme across all components
- Add theme toggle in header
- Persist theme preference

---

#### Task 5.2: Internationalization (i18n)
**Priority:** LOW  
**Effort:** 3 days

**Implementation:**
```typescript
// Install packages
npm install i18next react-i18next

// New files:
// client/src/i18n/config.ts
// client/src/i18n/locales/en.json
// client/src/i18n/locales/es.json
// client/src/i18n/locales/ar.json
```

**Languages to Support:**
- English (en)
- Spanish (es)
- Arabic (ar)
- French (fr)
- Portuguese (pt)
- Russian (ru)

**Features:**
- Language selector in header
- Persist language preference
- RTL support for Arabic
- Date/time localization
- Number formatting

---

### Week 14: Final Polish

#### Task 5.3: Setup Wizard
**Priority:** LOW  
**Effort:** 2 days

**Features:**
- First-time setup flow
- Database setup
- Admin account creation
- SMTP configuration
- License activation
- Quick start guide

---

#### Task 5.4: Keyboard Shortcuts
**Priority:** LOW  
**Effort:** 2 days

**Implementation:**
```typescript
// Install packages
npm install react-hotkeys-hook

// Shortcuts:
// Ctrl+K - Quick search
// Ctrl+N - New stream
// Ctrl+Shift+N - New line
// Ctrl+S - Save
// Ctrl+E - Edit
// Delete - Delete selected
// Escape - Cancel/Close
// Ctrl+B - Bulk actions
// Ctrl+/ - Show shortcuts
```

---

## ✅ Completion Checklist

### Security & Stability
- [ ] Two-Factor Authentication (2FA)
- [ ] IP Whitelisting
- [ ] Comprehensive Audit Logging
- [ ] Backup & Restore System

### Monitoring & Infrastructure
- [ ] Real-time Bandwidth Monitoring
- [ ] Geographic Connection Map
- [ ] Server Resource Monitoring
- [ ] Multi-Server Management
- [ ] Load Balancing

### VOD & Media
- [ ] TMDB Integration
- [ ] Subtitle Management
- [ ] Multi-Quality Support
- [ ] Trailer Links UI

### Business Features
- [ ] Commission System
- [ ] Auto-Renewal System
- [ ] Email Notifications
- [ ] SMS Notifications
- [ ] White-Label Support (Future)

### EPG & Recording
- [ ] EPG Auto-Import
- [ ] EPG Editor
- [ ] TV Archive/Catchup
- [ ] Timeshift
- [ ] Scheduled Recordings

### UI/UX
- [ ] Complete Dark Mode
- [ ] Internationalization (i18n)
- [ ] Setup Wizard
- [ ] Keyboard Shortcuts
- [ ] Theme System

---

## 📊 Progress Tracking

**Current Feature Parity:** 73%  
**Target Feature Parity:** 100%  
**Estimated Completion:** 14 weeks

**Priority Breakdown:**
- 🔴 Critical: 4 tasks (Weeks 1-2)
- 🔴 High: 4 tasks (Weeks 3-5)
- ⚠️ Medium: 6 tasks (Weeks 6-10)
- 🟡 Low: 6 tasks (Weeks 11-14)

---

## 🚀 Quick Start

To begin implementation:

1. **Review this roadmap** with your team
2. **Start with Phase 1** (Security & Stability)
3. **Create feature branches** for each task
4. **Follow the database schema** provided
5. **Test thoroughly** before moving to next phase
6. **Update this document** as you progress

---

## 📞 Support

**Repository:** https://github.com/ErvinHalilaj/PanelX-V3.0.0-PRO  
**Production:** http://69.169.102.47:5000/  
**Documentation:** See `/docs` folder  

---

*Roadmap created on January 24, 2026*  
*Target completion: ~May 2026*  
*Current version: v3.0.0*
