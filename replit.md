# PanelX - IPTV Management Panel

## Overview
PanelX is a comprehensive IPTV management panel designed for managing streaming content, user subscriptions (lines), and reseller operations. It features Xtream Codes v2.9 compatible APIs for IPTV player applications (Smarters, TiviMate, etc.) and a robust administrative dashboard. The project aims to provide a full-stack solution for IPTV service providers, offering extensive features for content delivery, user management, and operational control, mirroring and expanding upon features found in leading competitor panels like 1-Stream.com.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure
The application uses a monorepo structure, housing a React frontend, an Express backend, and a PostgreSQL database.

### Frontend
- **Framework**: React 18 with TypeScript.
- **Routing**: Wouter for client-side routing.
- **State Management**: TanStack React Query for server state.
- **UI Components**: shadcn/ui built on Radix UI, styled with Tailwind CSS (including a custom dark theme).
- **Forms**: React Hook Form with Zod validation.
- **Data Visualization**: Recharts for dashboard analytics.
- **Animations**: Framer Motion for UI transitions.

### Backend
- **Runtime**: Node.js with Express, written in TypeScript with ESM modules.
- **API**: RESTful JSON API at `/api/*` routes.
- **Player APIs**: Supports multiple player API formats including Xtream Codes API (`/player_api.php`, `/get.php`), XMLTV EPG (`/xmltv.php`), Stalker Portal API (`/stalker_portal/*`), and Enigma2 API.
- **Build Tool**: Vite for development, esbuild for production.

### Data Storage
- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM with `drizzle-zod` for schema validation.
- **Schema**: All table definitions are located in `shared/schema.ts`.
- **Migrations**: Managed using `drizzle-kit push`.

### Core Data Models
The system includes 22 core data models covering:
- User management (admin/reseller accounts with credit system).
- Content organization (categories, streams, bouquets, series, episodes, VOD info).
- Subscription management (lines, active connections, credit transactions).
- System operations (servers, EPG sources/data, device templates, transcode profiles, cron jobs).
- Logging and security (activity log, stream errors, client logs, blocked IPs, blocked user agents).
- Advanced features like activation codes, connection history, most watched analytics, 2FA, fingerprint watermarking, watch folders, 24/7 looping channels, autoblock rules, statistics snapshots, and admin impersonation logs.

### Security Features
- IP blocking (with expiration and attempt counting).
- User agent blocking.
- GeoIP country restrictions per line.
- Device locking (device ID and MAC address).
- IP whitelist per line.
- Connection limit enforcement.
- Rate limiting support.
- Two-Factor Authentication (2FA) for admin/reseller accounts.
- Fingerprint watermarking for streams.
- Autoblock rules for automated security actions.
- **VPN/Proxy Detection** (Batch 1): Blocks VPN, proxy, datacenter, and Tor connections. Supports local IP range database, ip-api.com, and proxycheck.io providers with caching.

### Shop Plugin (Batch 1)
Complete e-commerce system for selling subscriptions:
- Products: Subscription packages with duration, connections, and bouquet configuration.
- Payment Methods: Stripe, PayPal, crypto, bank transfer support.
- Orders: Automatic fulfillment generates lines when orders are paid.
- API: Public storefront endpoints and admin management.

### Embedded Lines (Batch 1)
Token-based authentication for embedding players without exposing credentials:
- Secure embed tokens for each line.
- Domain restrictions to limit where embeds can be used.
- IP whitelisting for embedded access.
- View tracking and statistics.

### SSL Certificates (Batch 1)
Let's Encrypt integration for automatic SSL:
- Certificate request and renewal automation.
- Nginx configuration generation.
- Expiration monitoring with auto-renewal.

### API Endpoints
- **Admin API**: `/api/*` for managing users, content, subscriptions, servers, EPG, series, and security features.
- **Player API (Xtream Codes Compatible)**: `/player_api.php`, `/get.php`, `/live/*`, `/movie/*`, `/series/*`, `/xmltv.php`, `/timeshift/*`, `/streaming/timeshift.php`.
- **Stalker Portal API**: `/stalker_portal/c/`, `/stalker_portal/server/load.php`.
- **Device Playlist Generator**: `/playlist/:deviceKey/:username/:password`.
- **New APIs**: Activation codes, connection history, most watched, 2FA, fingerprint settings, watch folders, looping channels, autoblock rules, statistics snapshots, and impersonation logs.
- **Batch 1 APIs**: VPN detection (`/api/vpn-detection/*`), Shop (`/api/shop/*`), Embedded lines (`/api/embedded-lines/*`, `/api/embed/*`), SSL certificates (`/api/ssl-certificates/*`).

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.

### Key NPM Packages
- `drizzle-orm`, `drizzle-kit`: ORM and migrations.
- `express`: HTTP server.
- `@tanstack/react-query`: Server state management.
- `react-hook-form`, `@hookform/resolvers`: Form handling.
- `zod`: Schema validation.
- `date-fns`: Date utilities.
- `recharts`: Charting library.
- `framer-motion`: Animation library.
- `shadcn/ui`, `Radix UI`: UI component libraries.
- `Tailwind CSS`: Styling framework.
- `Lucide React`: Icons.
- `otpauth`: TOTP/HOTP generation for 2FA.

### Development Tools
- Vite with React plugin.
- `tsx` for TypeScript execution.
- Replit-specific plugins.

### Batch 2 Features - Transcoding & Archives
Advanced media processing and archive management:
- **Transcode Profiles**: CRUD API for managing FFmpeg transcode settings (codec, bitrate, resolution).
- **Catchup Settings**: Configurable TV archive retention, max storage, auto-record categories, cleanup schedule.
- **On-Demand Settings**: VOD path configuration, auto-scan, TMDB integration, thumbnail generation.
- **TV Archive Status Tracking**: Enhanced schema with status field (recording, completed, error).

### Batch 3 Features - Multi-Server & Reseller Management
Advanced infrastructure and business management:
- **Load Balancing**: Server health monitoring, load balancing rules, sync jobs, failover history.
- **GeoIP Restrictions**: Country-based access control with IP lookup validation.
- **Bandwidth Monitoring**: Real-time bandwidth stats, alerts, and usage analytics.
- **Reseller Management**: Full reseller hierarchy, credit management, permissions, and analytics.

### Batch 4 Features - Monitoring, Analytics & Notifications
Advanced monitoring, analytics, and notification systems:
- **Stream Monitoring**: Real-time stream health metrics, auto-restart rules, quality monitoring (bitrate, FPS, resolution), error tracking.
- **Enhanced EPG Management**: Channel mapping with auto-map, EPG preview, import/export, source management.
- **Scheduled Backups**: Cron-based backup scheduling, retention policies, one-click restore, storage location options.
- **Advanced Analytics**: Viewing analytics, popular content reports, geographic distribution, device/player analytics, timeline trends.
- **Multi-Channel Notifications**: Email/Telegram/Discord/Slack notifications, configurable triggers, cooldown management, notification logs.

## Recent Changes

### January 28, 2026 - UI Polish Complete
Completed comprehensive UI refresh with modern design system:
- **Color Scheme**: Migrated from purple to cyan/teal (#06b6d4) for a professional IPTV panel appearance
- **Typography**: Inter + Plus Jakarta Sans fonts for clean, modern look
- **Components**: Glass morphism panels, gradient buttons with glow effects, refined cards with backdrop blur
- **Dashboard**: Updated stats cards, charts with cyan gradients, improved layout and spacing
- **Login Page**: Branded design with gradient effects, animated "X" in logo, professional appearance
- **CSS Enhancements**: Custom animations (fadeIn, slideIn), status indicators with pulse effects, custom scrollbar styling, improved hover states

### January 28, 2026 - Batch 4 Complete
Added Batch 4 backend and frontend features for monitoring, analytics, and notifications:
- **Schema**: Added `streamHealthMetrics`, `streamAutoRestartRules`, `epgMappings`, `scheduledBackups`, `viewingAnalytics`, `popularContentReports`, `notificationSettings`, `notificationTriggers`, `notificationLog` tables
- **Backend**: Stream Monitoring API (`/api/stream-monitoring/*`), Enhanced EPG API (`/api/epg/*`), Scheduled Backups API (`/api/scheduled-backups/*`), Viewing Analytics API (`/api/viewing-analytics/*`), Notifications API (`/api/notifications/*`)
- **Frontend**: StreamMonitoring.tsx (health metrics, auto-restart rules, error logs), EpgManager.tsx (channel mapping, auto-map, preview), BackupRestore.tsx (scheduled backups, retention, restore), AdvancedAnalytics.tsx (viewing stats, popular content, geo/device distribution), NotificationSettings.tsx (multi-channel config, triggers, logs)

### January 28, 2026 - Batch 3 Complete
Added Batch 3 backend and frontend features:
- **Schema**: Added `serverHealthLogs`, `loadBalancingRules`, `serverSyncJobs`, `serverFailoverHistory` tables
- **Schema**: Enhanced `users` table with `email`, `maxCredits`, `parentId`, `isActive`, `createdBy` fields
- **Backend**: Load Balancing API (`/api/load-balancing/*`), GeoIP API (`/api/geoip/*`), Bandwidth API (`/api/bandwidth/*`), Reseller API (`/api/reseller/*`)
- **Frontend**: LoadBalancing.tsx (server health, rules, sync, failover), GeoipRestrictions.tsx (country restrictions, IP lookup), BandwidthMonitoring.tsx (usage stats, alerts), ResellerManagement.tsx (reseller CRUD, credits, permissions)
- **Services**: loadBalancerManager.ts (SSH-based server management), resellerService.ts (credit management, permissions), multiServer.ts (health checks)

### January 28, 2026 - Batch 2 Complete
Added Batch 2 backend and frontend features:
- **Backend**: Catchup Settings API (`/api/catchup/settings`, `/api/catchup/storage`), On-Demand Settings API (`/api/on-demand/settings`, `/api/on-demand/stats`), Transcode Profiles CRUD API
- **Frontend**: CatchupSettings.tsx (TV archive settings, storage monitoring, auto-record), OnDemandSettings.tsx (VOD settings, auto-scan, TMDB, thumbnails)
- **Schema**: Added `catchupSettings` and `onDemandSettings` tables, enhanced `tvArchives` with status field

### January 28, 2026 - Batch 1 Frontend Complete
Added 5 new admin pages for Batch 1 features:
- **VpnDetection.tsx**: VPN detection settings, detection logs, IP ranges, and IP lookup tool
- **ShopProducts.tsx**: Product management with bouquet selection, pricing, and descriptions
- **ShopOrders.tsx**: Order management with tabs for orders and payment methods, order fulfillment
- **SslCertificates.tsx**: SSL certificate management with Let's Encrypt integration and install script
- **EmbeddedLines.tsx**: Embed token management with domain/IP restrictions and stats

All pages follow existing patterns with shadcn/ui components, TanStack Query for data fetching, and proper cache invalidation.