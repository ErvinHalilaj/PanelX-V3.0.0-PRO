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