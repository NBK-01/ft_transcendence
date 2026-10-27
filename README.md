_This project has been created as part of the 42 curriculum by mhabbal, mabi-nak, nkanaan._

# ShipTrack

## Description

ShipTrack is a web platform for a shipping company:

- **Customers** request a shipment (a product link or photos), accept or reject the offer, pay (simulated), follow the timeline, chat with support and get notifications.
- **Staff** (admin, dispatcher, driver, support) manage shipments, branches, staff accounts and roles, chat with each other, and see an overview of the day.
- **Partners** create and update shipments through a public API with API keys; a carrier sends tracking updates through a signed webhook.

Key features: roles and permissions, branches, live chat, notifications, file uploads, a documented public API, and English, French and Arabic (right to left).

## Instructions

**Prerequisites:** Docker and Docker Compose. For development: Node.js 22+, pnpm 10, PostgreSQL 14+, Redis 7.

1. `cp .env.example .env`
2. `cp backend/.env.example backend/.env` and set at least `DB_USER`, `DB_NAME`, `JWT_SECRET`, `API_KEY_HMAC_SECRET` (32+ characters), `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `SWAGGER_USER`, `SWAGGER_PASSWORD`. Optional: AWS S3 (uploads), SMTP (emails), Google OAuth.
3. `docker compose up --build`

| App | URL |
| --- | --- |
| Customers | https://localhost/ |
| Staff | https://localhost/admin/ |
| API docs | https://localhost/api/docs |

The certificate is self-signed, so the browser warns the first time.

**Development:** `cd backend && npm install && npm run migration:run && npm run start:dev`, then `cd frontend && pnpm install && pnpm dev` (customers on :5173, staff on :5174/admin/). `VITE_API_MOCKS=true` in `.env` runs the frontend on mock data.

## Resources

- [NestJS](https://docs.nestjs.com/), [TypeORM](https://typeorm.io/), [PostgreSQL](https://www.postgresql.org/docs/), [Socket.IO](https://socket.io/docs/v4/), [BullMQ](https://docs.bullmq.io/)
- [React](https://react.dev/), [TanStack Query](https://tanstack.com/query/latest), [Tailwind CSS](https://tailwindcss.com/docs), [Radix UI](https://www.radix-ui.com/), [react-i18next](https://react.i18next.com/), [MSW](https://mswjs.io/docs/)
- [OWASP API Security](https://owasp.org/API-Security/), [Stripe webhook signatures](https://docs.stripe.com/webhooks#verify-events) (model for the carrier webhook)

**AI usage:**

- **mhabbal**, **mabi-nak** and **nkanaan** used AI to assist in research, planning, pull request reviews and writing tests.

## Team Information

| Login | Role | Responsibilities |
| --- | --- | --- |
| mhabbal | Product Owner, Project Manager, Developer | Backend: auth, users, staff, roles and permissions, branches, chat and contacts, file storage, Docker |
| mabi-nak | Developer | Customer app, shipments (backend and frontend), test suite |
| nkanaan | Tech Lead, Developer | Staff app, shared UI and API packages, backend Notifications and Public API modules |

## Project Management

- **Work split:** by area (backend, customer app, staff app), then by feature.
- **Process:** one branch and one pull request per feature; each is checked (typecheck, lint, build, browser) before merging.
- **Tools:** GitHub (pull requests and reviews), a shared to-do list and a manual test checklist.
- **Communication:** pull request review comments and Slack.
- **Challenge:** splitting the workload evenly between three people.

## Technical Stack

| Part | Technology | Why |
| --- | --- | --- |
| Frontend | React 19, TypeScript, Vite, TanStack Query, Tailwind CSS, Radix UI | Two apps (customers, staff) in one pnpm monorepo, sharing a design system and an API layer |
| Backend | NestJS 10, TypeScript | Modules, guards and gateways for auth, permissions, validation and WebSockets |
| Database | PostgreSQL 14 with TypeORM | Relational data (users, roles, branches, shipments and their history) with constraints, transactions and migrations |
| Real-time | Socket.IO (Redis adapter) | Chat, online status, live updates |
| Jobs | BullMQ on Redis | Notifications and webhooks run in the background, with retries |
| Files | AWS S3 | Photos, documents and avatars behind signed URLs |
| Deployment | Docker Compose, nginx (HTTPS) | The whole stack with one command |

## Database Schema

Every table has a `uuid` id and `created_at` / `updated_at`.

```
organization ─< internal_user >─ role >─< permission
organization ─< shipment >─ user
organization ─< api_key
shipment ─< shipment_event, shipment_offer, shipment_file; shipment ─ shipment_payment
conversation ─< message, conversation_participant
internal_user >─< internal_user (contact)
notification → user or internal_user
```

| Table | Key fields |
| --- | --- |
| `user` | email, name, password (hash), avatar_key, is_verified, is_active |
| `internal_user` | email, name, password (hash), role_id, organization_id, is_active |
| `organization` | name (unique), description, contact_email, is_active |
| `shipment` | tracking_id (unique), client_id, organization_id, status (enum), sender / recipient (jsonb), weight_kg |
| `shipment_event` | shipment_id, status, location, actor_type, actor_id |
| `shipment_offer`, `shipment_payment`, `shipment_file` | supplier and price; quantity and total; file kind, storage_key, mime_type, size |
| `conversation`, `message`, `contact` | conversation type, participants, content; contact status |
| `notification` | user_id, account_type, type, title, message, payload (jsonb), read_at |
| `api_key` | name, organization_id, key_hash (bcrypt), key_hmac, last_used_at, revoked_at |
| `webhook_log` | provider, idempotency_key (unique), payload (jsonb), status, attempts |

## Features List

| Feature | Description | Who |
| --- | --- | --- |
| Customer accounts | Sign up with a one-time code, sign in (email or Google), reset password, profile and avatar | mhabbal, mabi-nak |
| Shipments (customers) | Request, accept or reject the offer, demo checkout, timeline, files | mabi-nak |
| Staff accounts and roles | Staff login, create/edit/deactivate staff, screens per role | mhabbal, nkanaan |
| Branches | Create, edit, deactivate, members, branch filter | mhabbal, nkanaan |
| Shipments (staff) | Board with search and filters, offers, payment confirmation, tracking updates, files | mabi-nak, nkanaan |
| Overview | Today against yesterday, every status, who did what | nkanaan |
| Chat and contacts | Staff DMs, customer support, contact requests, live | mhabbal, nkanaan, mabi-nak |
| Notifications | One for every create, update and delete; bell and page | nkanaan, mabi-nak |
| Public API | API keys per branch, rate limit, partner endpoints, Swagger, carrier webhook | nkanaan |
| Languages | English, French, Arabic (right to left) | nkanaan, mabi-nak |
| Privacy Policy and Terms | Linked from both apps | nkanaan |

## Modules

Major = 2 points, Minor = 1 point; 14 required. [TODO: confirm the final list before the evaluation.]

| Module | Type | Pts | How | Who | Status |
| --- | --- | --- | --- | --- | --- |
| Frameworks for frontend and backend | Major | 2 | React + NestJS | All | Done |
| Real-time features (WebSockets) | Major | 2 | Socket.IO: chat, online status, live updates | mhabbal, nkanaan, mabi-nak | Live shipment updates in progress |
| User interaction (chat, profile, friends) | Major | 2 | Chat, profiles, contacts | mhabbal, nkanaan, mabi-nak | [TODO: friends for customers] |
| Public API | Major | 2 | `/api/v1`: GET, POST, PUT, DELETE on shipments; API keys, 60 requests/min, Swagger | nkanaan | Done |
| Standard user management | Major | 2 | Profile, avatar, profile page, friends and online status | mhabbal, mabi-nak | [TODO: friends and online status] |
| Advanced permissions | Major | 2 | Roles, staff CRUD, screens per role | mhabbal, nkanaan | Done |
| Organization system | Major | 2 | Branches and their members | mhabbal, nkanaan | Done |
| ORM | Minor | 1 | TypeORM with migrations | mhabbal | Done |
| Notification system | Minor | 1 | Background jobs after every create/update/delete | nkanaan | Done |
| File upload | Minor | 1 | Photos, documents, avatars: checks, preview, progress | mhabbal, mabi-nak, nkanaan | [TODO: check] |
| Multiple languages | Minor | 1 | English, French, Arabic | nkanaan, mabi-nak | Done |
| Right-to-left support | Minor | 1 | Arabic, mirrored layout | nkanaan, mabi-nak | Done |
| OAuth 2.0 | Minor | 1 | Google sign-in | mhabbal, mabi-nak | [TODO: test] |
| Custom design system | Minor | 1 | `packages/ui`: 10+ components with Storybook | nkanaan, mabi-nak | Done |
| **Total** | | **21** | | | |

## Individual Contributions

**mhabbal:** the backend: authentication (JWT, one-time codes, Google OAuth, password reset), users and staff, roles and permissions, branches, chat and contacts over Socket.IO, file storage on S3, rate limiting, Docker and nginx. Challenges: working with frontend technologies and helping with the UI as a backend engineer.

**mabi-nak:** the customer app (sign-in screens, shipments, new shipment and checkout, profile, messages, notifications), the shipments feature end to end (backend flow and API, and the customer screens), the test suite, and the Timeline and CopyButton components. Challenges: learning new technologies and frameworks, and getting used to the folder structure, branches and pull requests.

**nkanaan:** the staff app (users, branches, shipments, overview, contacts, messages, API keys), the shared design system and API layer with mock data, and the backend Notifications (with queues) and Public API (API keys, partner endpoints, carrier webhook) modules. Challenges: error codes that clashed between features after merges, sending notifications only once a change is saved, and processing each carrier webhook only once.
