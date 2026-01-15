# PanelX - IPTV Management Panel

## Overview

PanelX is a full-stack IPTV management panel built for managing streaming content, user subscriptions (lines), and reseller operations. It provides an Xtream Codes compatible API for IPTV player applications, along with an administrative dashboard for content and user management.

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
- **Player API**: Xtream Codes compatible endpoints (`/player_api.php`, `/get.php`) for IPTV player compatibility
- **Build Tool**: Vite for development, esbuild for production server bundling

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Managed via `drizzle-kit push` command

### Core Data Models
- **Users**: Admin and reseller accounts with credit-based system
- **Categories**: Content organization (live, movie, series types)
- **Streams**: Live channels and VOD content with source URLs
- **Bouquets**: Content packages grouping streams for subscription tiers
- **Lines**: End-user subscriptions with credentials, expiration, and connection limits
- **Active Connections**: Real-time tracking of user sessions
- **Activity Log**: Audit trail for user actions
- **Credit Transactions**: Financial tracking for reseller operations

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
│   ├── storage.ts    # Database operations interface
│   ├── playerApi.ts  # Xtream Codes compatible API
│   └── db.ts         # Database connection
├── shared/           # Shared code between client/server
│   ├── schema.ts     # Drizzle table definitions
│   └── routes.ts     # API contract definitions with Zod schemas
└── migrations/       # Database migration files
```

### API Design
- Type-safe API contracts defined in `shared/routes.ts`
- Zod schemas for request/response validation
- RESTful endpoints for CRUD operations on all entities
- Xtream Codes API compatibility layer for player applications

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