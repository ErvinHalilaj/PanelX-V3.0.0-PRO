# PanelX - IPTV Management Panel

## Overview

PanelX is a full-stack IPTV management panel built for managing streaming content, user subscriptions (lines), and reseller operations. It provides Xtream Codes v2.9 compatible APIs for IPTV player applications (Smarters, TiviMate, etc.), along with a comprehensive administrative dashboard.

The application follows a monorepo structure with a React frontend, Express backend, and PostgreSQL database using Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark theme configuration
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for dashboard analytics
- **Animations**: Framer Motion for UI transitions

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful JSON API at `/api/*` routes
- **Player APIs**: Multiple player API formats:
  - Xtream Codes API (`/player_api.php`, `/get.php`)
  - XMLTV EPG (`/xmltv.php`)
  - Stalker Portal API (`/stalker_portal/*`)
  - Enigma2 API (via `/get.php?type=enigma2`)
  - Device-specific playlists (`/playlist/:deviceKey/:username/:password`)
- **Build Tool**: Vite for development, esbuild for production server bundling

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Managed via `drizzle-kit push` command

### Core Data Models (22 Tables)
- **Users**: Admin and reseller accounts with credit-based system
- **Categories**: Content organization (live, movie, series types)
- **Streams**: Live channels and VOD content with source URLs
- **Bouquets**: Content packages grouping streams for subscription tiers
- **Lines**: End-user subscriptions with credentials, expiration, connection limits, device locking, and GeoIP
- **Active Connections**: Real-time tracking of user sessions
- **Activity Log**: Audit trail for user actions
- **Credit Transactions**: Financial tracking for reseller operations
- **Servers**: Multi-server load balancing configuration
- **EPG Sources**: XMLTV sources for program guides
- **EPG Data**: Electronic program guide entries
- **Series**: TV series with metadata (TMDB-style)
- **Episodes**: Series episodes with streaming sources
- **VOD Info**: Movie metadata (plot, cast, etc.)
- **TV Archive**: Catchup/timeshift recordings
- **Blocked IPs**: IP-based access restrictions
- **Blocked User Agents**: User agent blocking
- **Device Templates**: 20+ device playlist formats
- **Transcode Profiles**: FFmpeg transcoding configurations
- **Stream Errors**: Error logging for streams
- **Client Logs**: Client activity logging
- **Cron Jobs**: Scheduled task management

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/   # UI components including shadcn/ui
│       ├── hooks/        # React Query hooks for data fetching
│       ├── pages/        # Route components
│       └── lib/          # Utilities and query client
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route registration
│   ├── storage.ts    # Database operations interface (22 tables)
│   ├── playerApi.ts  # Xtream Codes, Stalker Portal, Enigma2 APIs
│   └── db.ts         # Database connection
├── shared/           # Shared code between client/server
│   ├── schema.ts     # Drizzle table definitions (22 tables)
│   └── routes.ts     # API contract definitions with Zod schemas
└── migrations/       # Database migration files
```

### API Endpoints

#### Admin API (`/api/*`)
- `/api/users` - Admin/Reseller management
- `/api/categories` - Content categories
- `/api/streams` - Live/VOD streams
- `/api/bouquets` - Content packages
- `/api/lines` - User subscriptions
- `/api/connections` - Active connections
- `/api/servers` - Server management
- `/api/epg-sources` - EPG sources
- `/api/series` - TV series
- `/api/episodes` - Series episodes
- `/api/blocked-ips` - IP blocking
- `/api/blocked-user-agents` - UA blocking
- `/api/device-templates` - Playlist templates
- `/api/transcode-profiles` - FFmpeg profiles

#### Player API (Xtream Codes Compatible)
- `/player_api.php` - Main authentication and content listing
- `/get.php` - M3U/M3U8 playlist generation
- `/live/:user/:pass/:id.:ext` - Live stream proxy
- `/movie/:user/:pass/:id.:ext` - VOD stream proxy
- `/series/:user/:pass/:id.:ext` - Series episode proxy
- `/xmltv.php` - XMLTV EPG guide
- `/timeshift/:user/:pass/:dur/:start/:id.:ext` - TV Archive
- `/streaming/timeshift.php` - Alternative catchup format

#### Stalker Portal API (MAG Devices)
- `/stalker_portal/c/` - Portal entry
- `/stalker_portal/server/load.php` - Portal API

#### Device Playlist Generator
- `/playlist/:deviceKey/:username/:password` - Device-specific playlists

### Security Features
- IP blocking with expiration and attempt counting
- User agent blocking (exact and partial match)
- GeoIP country restrictions per line
- Device locking (device ID and MAC address)
- IP whitelist per line
- Connection limit enforcement
- Rate limiting support

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit`: Database ORM and migrations
- `express`: HTTP server framework
- `@tanstack/react-query`: Server state management
- `react-hook-form` / `@hookform/resolvers`: Form handling with Zod integration
- `zod`: Schema validation for API contracts
- `date-fns`: Date formatting and manipulation
- `recharts`: Dashboard charting
- `framer-motion`: Animation library

### UI Component Dependencies
- Full shadcn/ui component set via Radix UI primitives
- Tailwind CSS with custom theme configuration
- Lucide React for icons

### Development Tools
- Vite with React plugin for frontend development
- tsx for TypeScript execution
- Replit-specific plugins for development experience

## Recent Changes

- Added 14 new database tables for full Xtream Codes v2.9 feature parity
- Implemented Stalker Portal API for MAG device support
- Added XMLTV EPG endpoint for program guide
- Created TV Archive/Catchup streaming endpoints
- Added Series and Episodes management with full metadata
- Added VOD Info for movie metadata (TMDB-style)
- Implemented IP and User Agent blocking
- Added device locking and GeoIP restrictions for lines
- Created 20+ device templates for playlist generation
- Added transcode profile management for FFmpeg
- Implemented multi-server load balancing support
- Added HLS.js video player with volume slider
- Fixed stream proxy for VLC/player compatibility
- **Added Packages management page** - Full CRUD for subscription packages with trial/enabled flags, duration, credits
- **Added Reseller Groups management page** - Granular permissions (add/edit/delete/view), max lines limits, color coding
- **Added M3U import wizard** - Parse EXTINF metadata, tvg-logo, tvg-id and bulk create streams
- **Added Xtream API import** - Import streams from another Xtream Codes panel with SSRF protection
- **Added advanced stream options UI** - on-demand, auto-restart, delay minutes, RTMP output, read native, stream all, remove subtitles, generate timestamps, allow recording, custom FFmpeg
- **Added Lines advanced options** - ISP lock, forced server routing, allowed user agents whitelist, package assignment
- **Added bulk operations** - Multi-select checkboxes and batch delete for streams
- Added use-servers hook for server data fetching

## Feature Roadmap (Xtream Codes v2.9 Parity)

### CRITICAL Priority
1. **Stream Options**
   - [ ] Multiple source URLs (backup/failover)
   - [x] On-demand mode (sleep/wake)
   - [x] Stream import from M3U
   - [x] Stream import from Xtream API
   - [x] Auto-restart timer
   - [x] Delay minutes (timeshift)
   - [x] RTMP output
   - [ ] External push to CDN
   - [x] Custom FFmpeg mapping

2. **Restreaming/Encoding**
   - [ ] Live transcoding pipeline
   - [ ] HLS segment generation
   - [ ] Created live channels (RTMP→HLS)
   - [ ] Encoding queue management
   - [ ] Stream health monitoring

### HIGH Priority
3. **Lines Advanced Options**
   - [x] ISP locking
   - [x] Forced server routing
   - [x] Allowed user agents whitelist
   - [x] Package assignment
   - [ ] Play token security
   - [ ] Parent reseller hierarchy

4. **Reseller System**
   - [x] Reseller groups with permissions
   - [x] Package management (pricing, duration)
   - [ ] Ticket system
   - [ ] Reseller dashboard

### MEDIUM Priority
5. **Admin Panel Enhancements**
   - [x] Mass operations (bulk edit/delete)
   - [x] M3U import wizard
   - [x] Xtream panel import
   - [ ] Backup/restore system
   - [ ] MAG device management
   - [ ] Enigma2 plugin management
   - [ ] Real-time stats graphs

6. **Security**
   - [ ] Rate limiting
   - [ ] Auto-block after failed attempts
   - [ ] Connection speed monitor
   - [ ] Flood protection

### LOW Priority
7. **Additional APIs**
   - [x] get_vod_info full implementation
   - [x] get_simple_data_table (EPG)
   - [x] Panel management API
   - [x] Webhooks for events (schema ready)

## Recent Changes (January 2026)

### Type System Fixes
- Fixed 49 LSP type errors across storage.ts, routes.ts, and playerApi.ts
- Aligned playerApi.ts with actual schema field names (lastModified, lang, archiveFile, etc.)
- Fixed ticket creation to properly store messages in ticketReplies table
- Added type assertions for Drizzle jsonb array fields

### API Improvements
- Fixed Xtream Codes API responses to use correct schema fields
- Fixed XMLTV EPG generation with proper language field
- Fixed TV archive/timeshift endpoints
- Fixed device template playlist generation
