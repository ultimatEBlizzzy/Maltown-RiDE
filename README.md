# MALTown RiDE

A local mobility / e-hailing platform for **Malamulele, Limpopo, South Africa**. Riders can use nearby villages such as Xigalo and Ka-Mhinga as map landmarks, request trips in South African rand (ZAR), and connect with verified local drivers.

> **Stack note.** This workspace's established architecture is a **Next.js 16 App Router fullstack app + PostgreSQL (Drizzle ORM)**. Per the project rule "use the existing architecture if it is established and working", the MVP is built on it: the requested backend modules (`auth`, `drivers`, `rides`, `routing`, `payments`, `notifications`, `admin`…) are implemented as API route modules + server libraries, and realtime push is delivered via Server-Sent Events (the server-push channel available in this runtime). Everything else follows the brief: provider abstractions, strict ride state machine, PostGIS-ready schema, mock providers with real-integration seams.

---

## Feature checklist

| Area | Status |
|---|---|
| Rider / Driver / Admin accounts, JWT auth, bcrypt hashing, role guards | ✅ |
| Driver availability (online/offline), location updates, nearby discovery | ✅ |
| Ride requests → matching (configurable radius) → notifications | ✅ |
| Atomic driver acceptance (duplicate acceptance prevented) | ✅ |
| Strict ride state machine + `RideStatusHistory` audit | ✅ |
| Configurable ZAR fare engine (backend-authoritative) | ✅ |
| RoutingProvider abstraction: OSRM + mock fallback | ✅ |
| PaymentProvider abstraction: Mock live, PayFast seam (never pretends live) | ✅ |
| OtpProvider + NotificationProvider abstractions (Twilio seam) | ✅ |
| Realtime: SSE stream + in-process bus (Redis/WS upgrade path) | ✅ |
| Live maps (Leaflet + OSM), custom markers, route lines, ETAs | ✅ |
| Ride history, ratings, driver earnings (today/week/total) | ✅ |
| Admin dashboard: stats, live map, rides/drivers/riders/payments tables | ✅ |
| Responsive dark UI, loading/error/empty states, reduced-motion support | ✅ |
| Unit tests (fare engine, state machine, geo) + E2E acceptance script | ✅ 26/26 |

---

## Architecture

```
Browser (React 19, Tailwind v4, Leaflet)
        │  fetch /api/*  +  SSE /api/realtime/stream
        ▼
Next.js route handlers (src/app/api/**)      ← REST surface
        │
Server domain libraries (src/lib/**)
  ├── security.ts      JWT (jose) + bcrypt + session cookie/bearer
  ├── http.ts          guards (requireUser/roles), ApiError, rate limit
  ├── ride-machine.ts  strict transition table (backend authoritative)
  ├── matching.ts      nearby driver discovery + ranking (bbox + haversine)
  ├── rides-service.ts ride lifecycle orchestration (atomic accept lock)
  ├── drivers-service.ts availability, locations, requests, earnings
  ├── fare.ts          configurable fare engine
  ├── routing.ts       RoutingProvider: OSRM ⇄ mock fallback
  ├── payments.ts      PaymentProvider: Mock / PayFast seam
  ├── otp.ts           OtpProvider: Mock / Twilio seam
  ├── notify.ts        NotificationProvider: in-app + bus push
  ├── realtime.ts      event bus (user:* / ride:* / admin channels)
  └── location-cache.ts Redis-swappable hot cache (in-memory here)
        │
        ▼
PostgreSQL (Drizzle ORM, src/db/schema.ts)
```

### Ride lifecycle

```
REQUESTED → SEARCHING → ACCEPTED → DRIVER_ARRIVING → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED
                ↘______________ CANCELLED (allowed until IN_PROGRESS) _____________↗
```
Every transition is validated server-side (`ride-machine.ts`), recorded in `ride_status_history`, and fanned out over notifications + SSE. The classic `COMPLETED → REQUESTED` hack is rejected with 409.

### Driver matching
1. Validate rider, pickup/destination.
2. Route via RoutingProvider → distance, ETA, geometry.
3. Fare via fare engine (base + per-km + per-min, class multiplier + booking fee).
4. `findNearbyDrivers`: online + VERIFIED drivers, no active ride, inside `MATCH_RADIUS_KM` (bounding-box prefilter + exact haversine).
5. Notify candidates (DB notification + SSE push) — ride stays `SEARCHING`.
6. First driver to accept wins via an **atomic conditional UPDATE** (`WHERE status='SEARCHING' AND driver_id IS NULL`); losers get `409 RIDE_TAKEN`.

### Spatial strategy
The sandbox PostgreSQL has **no PostGIS extension**, so locations are `lat/lng double precision` with bounding-box prefiltering + exact haversine — the schema is PostGIS-ready (add a generated `geography` column + GIST index when the extension is available; `docker-compose.yml` already uses the `postgis/postgis` image). Hot, high-frequency location state goes through `location-cache.ts` (in-memory TTL today, Redis GEO behind the same interface when `REDIS_URL` is set).

---

## Malamulele pilot defaults

- Map fallback: Malamulele town centre.
- Rider landmarks: Malamulele town centre, Xigalo Village, and Ka-Mhinga Village.
- Display currency: South African rand (ZAR).
- Starter fare settings are editable in `.env`: R15 base, R6/km, R0.80/min, R5 booking fee, and R25 minimum.
- Driver discovery defaults to a 15 km radius for the surrounding rural service area.

## Quick start

```bash
npm install

# 1. environment
cp .env.example .env          # set JWT_SECRET for anything beyond local dev

# 2. database (platform-managed here, or: docker compose up -d)
npm run db:push               # apply schema for local development
npx tsx src/db/seed.ts        # development seed data

# 3. run
npm run dev                   # or: npm run build && npm start

# 4. verify
curl localhost:3000/api/health
bash scripts/e2e-acceptance.sh   # full 26-step acceptance flow
```

## Deploy to Render

1. Push this project to a Git provider connected to Render.
2. In the Render Dashboard, choose **New → Blueprint**, select the repository, and deploy `render.yaml`.
3. Render creates the Node web service and PostgreSQL database, generates `JWT_SECRET`, applies the checked-in Drizzle migration, and builds the app.

The included Blueprint is a **free preview**: the web service may sleep when idle, and Render deletes free PostgreSQL databases 30 days after creation (after a further 14-day upgrade grace period). Upgrade the database to a paid plan before storing important or long-lived user data. Free web services do not support Render pre-deploy commands, so this preview applies migrations during its build; for a paid production web service, move `npm run db:migrate` from `buildCommand` to `preDeployCommand` in `render.yaml`.

### Seeded development credentials (DEV ONLY — never reuse)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@maltown.dev` | `Admin123!` |
| Rider | `rider@maltown.dev` | `Rider123!` |
| Driver (online, Corolla) | `driver1@maltown.dev` | `Driver123!` |
| Driver (online, RAV4) | `driver2@maltown.dev` | `Driver123!` |
| Driver (online, moto boda) | `driver3@maltown.dev` | `Driver123!` |
| Drivers 4–6 | `driver4..6@maltown.dev` | `Driver123!` |

The login page offers one-click demo login for these accounts. The rider UI includes an **auto-drive demo toggle** on the driver console that simulates GPS movement so the live-tracking flow can be exercised on a desktop.

---

## API overview

| Endpoint | Method | Who | Purpose |
|---|---|---|---|
| `/api/auth/register` | POST | public | Create RIDER/DRIVER account (+vehicle), mock OTP |
| `/api/auth/login` · `/logout` | POST | public/authed | Session cookie + bearer token |
| `/api/users/me` | GET | authed | Current user (+ driver profile/vehicle) |
| `/api/drivers/online` · `/offline` | POST | driver | Availability (location required to go online) |
| `/api/drivers/location` | POST | driver | Live position update (fanned out to ride + admin channels) |
| `/api/drivers/nearby` | GET | rider/admin | Nearby available drivers for the map |
| `/api/drivers/requests` | GET | driver | Incoming SEARCHING rides ranked by proximity |
| `/api/drivers/me` · `/me/earnings` | GET | driver | Profile / today·week·total earnings |
| `/api/rides` | POST | rider | Request ride (route → fare → matching → notify) |
| `/api/rides?scope=active\|history\|all` | GET | rider/driver | Own rides with driver/vehicle/location/payment |
| `/api/rides/estimate` | POST | authed | Backend-authoritative fare + ETA for all classes |
| `/api/rides/:id` | GET | owner/driver/admin | Full ride state |
| `/api/rides/:id/accept\|decline\|arrive\|start\|complete\|cancel\|rate` | POST | role-guarded | Lifecycle transitions (validated state machine) |
| `/api/notifications` | GET/POST | authed | Latest notifications / mark read |
| `/api/realtime/stream?token=` | GET | authed | SSE push: notifications, ride status, driver locations |
| `/api/admin/dashboard\|rides\|drivers\|riders\|payments` | GET | ADMIN | Operations data with search/filters |
| `/api/health` | GET | public | DB/routing/uptime probe |

Error shape is uniform: `{ "error": { "message", "code" } }` with correct status codes (400 validation, 401 auth, 403 role/ownership, 404, 409 state conflict, 429 rate limit).

## Realtime overview

Events flow through an in-process bus to an SSE endpoint:

- `user:{id}` — notifications, new ride requests for drivers
- `ride:{id}` — `ride_status`, `driver_location`
- `admin` — ops feed (online/offline, ride created/accepted/completed)

Clients additionally poll short-interval endpoints (2.5–5 s) which keeps the UI correct even across horizontal instances; upgrading the bus to Redis pub/sub + WebSockets requires no changes in calling code.

---

## Testing

```bash
npx vitest run                    # unit tests: fare engine, state machine, geo
npx tsc --noEmit                  # strict type-check
BASE=http://localhost:3000 bash scripts/e2e-acceptance.sh   # 26-step E2E
```

Covered: registration, login, role authorization, ride creation, fare calculation, every valid/invalid state transition, driver matching, nearby queries, acceptance, duplicate-acceptance prevention, cancellation, completion, payments, earnings, ratings, admin reflection, ownership checks.

## Security notes

- Passwords hashed with bcrypt; sessions are HS256 JWTs in **httpOnly, SameSite=Lax, Secure-in-prod** cookies (bearer supported for programmatic clients).
- Role guards + ownership checks on every resource: riders cannot touch other riders' rides, drivers only their own profile/assigned rides, admin endpoints ADMIN-only.
- Atomic conditional updates prevent ride double-booking races.
- Rate limiting on auth endpoints; zod validation on every input; uniform error responses that never leak stack traces or environment.
- No secrets in client bundles; `DATABASE_URL`, merchant and SMS keys are server-side only; `.env` is git-ignored.

## Adding real credentials later

| Credential | Env var(s) | Effect |
|---|---|---|
| JWT signing | `JWT_SECRET` | **Required in production** |
| OSRM routing | `OSRM_BASE_URL` | Real road routing (auto-falls back to mock) |
| PayFast payments | `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE` | Activate `PayFastPaymentProvider` (currently returns FAILED by design until verified) |
| Twilio SMS/OTP | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Real OTP delivery |
| Redis | `REDIS_URL` | Swap location cache / bus to Redis |
| Map tiles | `MAP_TILE_URL`, `MAP_ATTRIBUTION` | Alternative OSM-compatible provider |

Put them in `.env` (never in source). Nothing changes in application code.
