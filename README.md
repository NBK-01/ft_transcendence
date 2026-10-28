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
2. `cp backend/.env.example backend/.env` and set:
   - **Required:** `DB_USER`, `DB_NAME`, `JWT_SECRET`, `API_KEY_HMAC_SECRET` (32+ characters), `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `SWAGGER_USER`, `SWAGGER_PASSWORD`.
   - **Required for uploads** (photos, documents, avatars), an AWS S3 bucket: `AWS_REGION`, `AWS_S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. Leave `AWS_S3_ENDPOINT` empty for AWS. Without them, every upload fails.
   - **Optional:** SendGrid or SMTP (without them, emails and one-time codes are printed in the backend log: `docker compose logs -f backend`), Google OAuth (Google sign-in doesn't work without it), `CARRIER_WEBHOOK_SECRET` (the carrier webhook answers 503 without it).
3. `docker compose up --build`

| App | URL |
| --- | --- |
| Customers | https://localhost:8443/ |
| Staff | https://localhost:8443/admin/ |
| API docs | https://localhost:8443/api/docs |

The certificate is self-signed, so the browser warns the first time.

**Development:** `cd backend && npm install && npm run migration:run && npm run start:dev`, then `cd frontend && pnpm install && pnpm dev` (customers on :5173, staff on :5174/admin/). `VITE_API_MOCKS=true` in `.env` runs the frontend on mock data.

- **Design system:** `cd frontend && pnpm --filter @trans/ui storybook` (http://localhost:6006): Foundations (colours, typography, icons), then every component and block, in light and dark, LTR and RTL.
- **Carrier webhook:** with the stack running, copy nginx's certificate once (`docker compose cp nginx:/etc/nginx/certs/server.crt /tmp/shiptrack-localhost.crt`), then from `backend/`: `CARRIER_CA_CERT=/tmp/shiptrack-localhost.crt npm run webhook:carrier -- <trackingId> in_transit "Lyon hub"`. It signs the request and sends it over HTTPS.

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
| Real-time | Socket.IO (Redis adapter) | Chat, notifications pushed as they happen, contacts' online status |
| Jobs | BullMQ on Redis | Notifications and webhooks run in the background, with retries |
| Files | AWS S3 | Photos, documents and avatars behind signed URLs |
| Deployment | Docker Compose, nginx (HTTPS) | The whole stack with one command |

## Database Schema

PostgreSQL, through TypeORM entities and migrations (`backend/src/migrations`). Every table has a `uuid` id and `created_at` / `updated_at`.

```
user ─< refresh_token, otp_log, auth_provider_user
user ─< shipment >─ organization
shipment ─< shipment_event, shipment_offer, shipment_file;  shipment ─ shipment_payment
organization ─< internal_user >─ role >─< permission   (through role_permission)
internal_user ─< internal_refresh_token
internal_user ─< contact >─ internal_user                (requester, addressee)
conversation ─< message;  conversation ─< conversation_participant
organization ─< api_key
notification → user or internal_user                     (account_type)
webhook_log → webhook_log                                (a duplicate points at the first delivery)
```

| Table | Key fields |
| --- | --- |
| `user` | email (unique), password (bcrypt), name, first/last name, date of birth, phone, avatar_key, auth_provider, is_verified, is_active, force_logout_after |
| `auth_provider_user` | user_id, provider, provider_id (Google sign-in) |
| `refresh_token`, `internal_refresh_token` | user_id, token_hash, device_info, ip_address, expires_at (one row per session) |
| `otp_log` | user_id, purpose, channel, status, attempts, sent_at, verified_at |
| `internal_user` | email (unique), password (bcrypt), name, avatar_key, role_id, organization_id, is_active, force_logout_after |
| `role`, `permission`, `role_permission` | role and permission names; which role has which permission |
| `organization` | name (unique), description, contact_email, is_active |
| `shipment` | tracking_id (unique), client_id, organization_id, status (enum), product_url, origin, destination, sender / recipient (jsonb), weight_kg |
| `shipment_event` | shipment_id, status, location, actor_type, actor_id (the timeline) |
| `shipment_offer`, `shipment_payment`, `shipment_file` | supplier and unit price; quantity, total and card's last 4 digits; file kind, storage_key, mime_type, size |
| `contact` | requester_id, addressee_id, status (pending, accepted, blocked) |
| `conversation`, `conversation_participant`, `message` | type (staff DM or support), participants and when each last read; sender and content |
| `notification` | user_id, account_type, type, title, message, payload (jsonb), own_action, status, read_at, dismissed_at, dedupe_key (unique) |
| `api_key` | name, organization_id, key_hash (bcrypt), key_hmac (lookup), prefix and last 4, last_used_at, revoked_at |
| `webhook_log` | provider, event_type, resource_id, idempotency_key (unique), payload (jsonb), status, occurred_at, claimed_by, attempts, error_message |

## Features List

| Feature | Description | Who |
| --- | --- | --- |
| Customer accounts | Sign up with a one-time code, sign in (email or Google), reset password, profile and avatar | mhabbal, mabi-nak |
| Shipments (customers) | Request, accept or reject the offer, demo checkout, timeline, files | mabi-nak |
| Staff accounts and roles | Staff login, create/edit/deactivate/delete staff, a roles page, screens per role | mhabbal, nkanaan |
| Staff profiles | Edit your own name and photo, colleagues' profile pages, contacts' online status | nkanaan |
| Branches | Create, edit, deactivate, delete, members, branch filter; dispatchers work on their own branch's shipments | mhabbal, nkanaan |
| Shipments (staff) | Board with search and filters, offers, payment confirmation, tracking updates, files | mabi-nak, nkanaan |
| Overview | Today against yesterday, every status, who did what | nkanaan |
| Chat and contacts | Staff DMs, customer support, contact requests, live | mhabbal, nkanaan, mabi-nak |
| Notifications | One for every create, update and delete, pushed live; bell, toasts and page | nkanaan, mabi-nak |
| Public API | API keys per branch, rate limit, partner endpoints, Swagger, signed carrier webhook applied in order | nkanaan |
| Languages | English, French, Arabic (right to left) | nkanaan, mabi-nak |
| Privacy Policy and Terms | Linked from both apps | nkanaan |

## Modules

Major = 2 points, Minor = 1 point; 14 required.

| Module | Type | Pts | Who | Status |
| --- | --- | --- | --- | --- |
| Frameworks for frontend and backend | Major | 2 | All | Done |
| Real-time features (WebSockets) | Major | 2 | mhabbal, nkanaan, mabi-nak | Done |
| User interaction (chat, profile, friends) | Major | 2 | mhabbal, nkanaan, mabi-nak | Done |
| Public API | Major | 2 | nkanaan | Done |
| Standard user management | Major | 2 | mhabbal, mabi-nak, nkanaan | Done |
| Advanced permissions | Major | 2 | mhabbal, nkanaan | Done |
| Organization system | Major | 2 | mhabbal, nkanaan | Done |
| ORM | Minor | 1 | mhabbal | Done |
| Notification system | Minor | 1 | nkanaan, mabi-nak | Done |
| File upload and management | Minor | 1 | mhabbal, mabi-nak, nkanaan | Done |
| Multiple languages | Minor | 1 | nkanaan, mabi-nak, mhabbal | Done |
| Right-to-left support | Minor | 1 | nkanaan, mabi-nak | Done |
| OAuth 2.0 | Minor | 1 | mhabbal, mabi-nak | Done |
| Custom design system | Minor | 1 | nkanaan, mabi-nak | Done |
| **Total** | | **21** | | |

**Why we chose each module, and how it's built:**

- **Frameworks (React + NestJS).** Two apps and an API of this size need structure: NestJS gives modules, guards and DI on the backend; React with TanStack Query handles caching and live data on the front. *How:* two React apps in a pnpm monorepo sharing `packages/ui` and `packages/api`; NestJS 10 modules per domain.
- **Real-time.** A shipping company runs on messages that can't wait: support replies, staff coordination, a parcel that moved. *How:* Socket.IO with JWT auth on connect, automatic reconnection and a Redis adapter. Staff DMs and support chat; every notification is pushed to the recipient's open tabs as it's created (toast + badge); staff see their contacts come online and go offline (presence in Redis, kept alive by a 30-second heartbeat).
- **User interaction.** Dispatchers, drivers and support in different branches need to reach each other directly, and customers need a human to talk to. *How:* staff contacts work as friends (request, accept, decline, remove, block; a list per state), one-to-one DMs between accepted contacts, colleagues' profile pages, and a support chat for every customer.
- **Public API.** Partners (shops, carriers) must create and track shipments from their own systems, not through our screens. *How:* `/api/v1` with `X-API-Key` keys per branch (bcrypt-hashed, found by HMAC, revocable), 60 requests a minute per key, Swagger docs, and 6 endpoints (GET, POST, PUT, DELETE on shipments, plus `/me`). Carriers post signed tracking webhooks (HMAC, 5-minute replay window), stored once and applied in the order they happened.
- **Standard user management.** People recognise who they deal with by name and face. *How:* customers edit their profile and avatar (initials by default) and can deactivate their account; staff edit their own name and photo, open any colleague's profile page, and see their contacts' online status.
- **Advanced permissions.** Admin, dispatcher, driver and support do different jobs, and a dispatcher must not touch another branch's shipments. *How:* roles and permissions in the database, a global guard (`@RequirePermission`, `@RequireStaff`), full staff CRUD, a roles page, and screens and actions that follow the role.
- **Organization system.** The company is organised in branches, each with its own staff and shipments. *How:* create, edit, deactivate and delete branches (refused while still in use), add and remove members, hand a customer's order to a branch; a dispatcher sees and works on their branch's shipments only.
- **ORM.** Shipments have a strict history (events, offers, payments) that needs constraints and transactions. *How:* TypeORM entities with relations and constraints, migrations generated from the entities, and transactions wherever several writes must succeed together (a status change and its timeline step).
- **Notification system.** Every party needs to know when something changes without watching a screen. *How:* every create, update and delete emits a signal after commit; a BullMQ job picks the recipients, writes one row each (deduplicated) and pushes it live; a bell, a page, read and dismiss, in three languages.
- **File upload.** Customers send product photos; staff send offer photos, package photos and proofs of delivery. *How:* S3 behind short-lived signed URLs, type checked from the file's first bytes, size limits on both sides, previews, upload progress, and delete for whoever may.
- **Multiple languages and right-to-left.** Customers and staff work in English, French or Arabic, and Arabic reads right to left. *How:* react-i18next with English, French and Arabic in both apps, a language switcher, and backend errors and emails in all three languages; logical CSS properties so Arabic mirrors the whole layout.
- **OAuth 2.0.** Customers sign up faster with an account they already have. *How:* Google sign-in (Passport) creates the account on first use; an email already registered with a password keeps that sign-in method (no silent linking). Failures, like a cancelled sign-in, come back to the app as a translated error.
- **Custom design system.** Two apps must look and behave the same, and stay accessible. *How:* `packages/ui`: colour scales (light and dark), a type scale, one icon set, and 30+ components and blocks (forms, tables, dialogs, timeline, app shell), each documented in Storybook with Foundations pages for colours, typography and icons.

## Individual Contributions

**mhabbal:** the backend: authentication (JWT, one-time codes, Google OAuth, password reset), users and staff, roles and permissions, branches, chat and contacts over Socket.IO, file storage on S3, rate limiting, Docker and nginx. Challenges: working with frontend technologies and helping with the UI as a backend engineer.

**mabi-nak:** the customer app (sign-in screens, shipments, new shipment and checkout, profile, messages, notifications), the shipments feature end to end (backend flow and API, and the customer screens), the test suite, and the Timeline and CopyButton components. Challenges: learning new technologies and frameworks, and getting used to the folder structure, branches and pull requests.

**nkanaan:** the staff app (users, branches, shipments, overview, contacts, messages, profiles, API keys), the shared design system (with its Storybook) and API layer with mock data, and on the backend: the Notifications module (queues, a notification for every create/update/delete, live push over the socket), the Public API (API keys, partner endpoints, carrier webhook), staff profiles and online status, and branch scoping for dispatchers. Challenges: error codes that clashed between features after merges, sending notifications only once a change is saved, and applying carrier webhooks once and in order when they arrive out of order.
