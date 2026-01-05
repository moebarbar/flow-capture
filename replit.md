# FlowCapture - Workflow Documentation Platform

## Overview

FlowCapture is a SaaS platform for automated workflow documentation, similar to Tango.ai. It enables users to capture browser interactions via a Chrome extension, automatically generate step-by-step guides with screenshots and AI-generated descriptions, and organize documentation in team workspaces.

**Core Capabilities:**
- Chrome extension for recording browser workflows (clicks, inputs, navigation)
- Automatic screenshot capture and CSS selector generation
- AI-powered step description generation using OpenAI
- Multi-workspace collaboration with role-based access
- Guide editor with drag-and-drop step reordering
- File uploads via presigned URLs to Google Cloud Storage

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side navigation
- **State Management**: TanStack React Query for server state, with custom hooks per resource
- **Styling**: Tailwind CSS with shadcn/ui components (New York style), Framer Motion for animations
- **Component Structure**: 
  - `client/src/pages/` - Route-level page components
  - `client/src/components/` - Reusable components including shadcn/ui primitives
  - `client/src/hooks/` - Custom React hooks for data fetching and auth

### Backend Architecture
- **Framework**: Express.js with TypeScript on Node.js
- **API Design**: REST endpoints defined in `shared/routes.ts` with Zod schemas for type-safe contracts
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` imports from `shared/models/` for modular organization
- **Authentication**: Replit Auth (OpenID Connect) with Passport.js, session storage in PostgreSQL
- **File Structure**:
  - `server/routes.ts` - Main API route registration
  - `server/storage.ts` - Database access layer implementing storage interface
  - `server/replit_integrations/` - Modular integrations (auth, chat, image, object_storage)

### Chrome Extension
- **Manifest**: V3 with service worker background script
- **Components**:
  - `popup/` - Extension UI for controlling recording
  - `src/content.js` - Injected script for capturing interactions
  - `src/background.js` - Service worker for coordination and backend sync
- **Captures**: Click events, input events, screenshots, CSS selectors, auto-generated descriptions

### Data Model
Key entities in `shared/schema.ts`:
- **users** - Replit Auth user profiles
- **workspaces** - Team containers with branding options
- **workspaceMembers** - User-workspace relationships with roles (owner/admin/editor/viewer)
- **guides** - Documentation items with status (draft/published/archived)
- **steps** - Individual steps within guides, ordered and typed
- **folders** - Hierarchical organization within workspaces

### Build System
- **Development**: `tsx` for TypeScript execution with Vite dev server
- **Production**: esbuild bundles server, Vite builds client to `dist/`
- **Database Migrations**: Drizzle Kit with `db:push` command

## External Dependencies

### Email Service (SendGrid)
- SendGrid integration is needed for email notifications (sign-ups, assignments, approvals, workflow updates)
- User needs to provide `SENDGRID_API_KEY` secret to enable email functionality
- Email service is stubbed in `server/services/emailService.ts` - ready to be activated when API key is provided

### Database
- **PostgreSQL**: Primary database via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries with schema defined in `shared/schema.ts`

### Authentication
- **Replit Auth**: OpenID Connect provider at `ISSUER_URL`
- **Session Secret**: `SESSION_SECRET` for cookie signing
- Sessions stored in PostgreSQL `sessions` table

### AI Services
- **OpenAI API**: Via Replit AI Integrations
  - `AI_INTEGRATIONS_OPENAI_API_KEY` - API key
  - `AI_INTEGRATIONS_OPENAI_BASE_URL` - Custom base URL for Replit proxy
  - Used for step description generation and image generation (gpt-image-1)

### File Storage
- **Google Cloud Storage**: Object storage via Replit's sidecar proxy (127.0.0.1:1106)
- Presigned URL flow for direct client uploads
- `PUBLIC_OBJECT_SEARCH_PATHS` for public file access paths

### Frontend Libraries
- **@tanstack/react-query**: Server state management
- **@hello-pangea/dnd**: Drag-and-drop for step reordering
- **@uppy/core, @uppy/dashboard, @uppy/aws-s3**: File upload widget with S3-compatible presigned URLs
- **framer-motion**: Page transitions and animations
- **recharts**: Analytics dashboards
- **date-fns**: Date formatting