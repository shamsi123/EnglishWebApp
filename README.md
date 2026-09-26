# EnglishPath

A mobile-first English learning platform (Pre-A1 → B2). It ships first as an installable PWA; Phase 3 wraps the same build as iOS/Android apps with Capacitor.
Scope, requirements and target architecture are in [docs/BRD.md](docs/BRD.md). This repository is currently building **Phase 1 (MVP)**.

## Repository layout

```
apps/web/            Learner PWA — React 18, Vite, TypeScript, Tailwind, TanStack Query, Zustand, vite-plugin-pwa
packages/core/       Shared TS used by web (and later Capacitor): content schema, answer checking, SM-2, XP/streak rules, /api/v1 client
backend/
  src/Gateway/                   YARP gateway: /connect/*, /api/v1/{service}/** routing, CORS, rate limiting
  src/Services/Identity/         Identity: accounts, OpenIddict token server, age/guardian consent, onboarding, deletion
  src/Services/Learning/         Learning & Content: course map, lesson bundles, completions, CMS workflow
  src/Services/Progress/         Progress & Gamification: XP, daily goal, streaks, skill radar, SRS review cards
  src/BuildingBlocks/            Domain primitives, MediatR validation pipeline, web defaults (JWT, problem details, health, OpenAPI),
                                 MassTransit + EF outbox messaging, integration event contracts
  tests/                         xUnit domain tests
docker-compose.yml   SQL Server, RabbitMQ, Redis (+ service containers under the `services` profile)
```

Each service follows Clean Architecture (`Domain` → `Application` (CQRS with MediatR) → `Infrastructure` (EF Core, SQL Server, MassTransit) → `Api` (minimal APIs)), with a database schema per service.

## Getting started

Prerequisites: Node 22 + pnpm 10, .NET 8 SDK, Docker.

```bash
# Web + shared packages
pnpm install
pnpm build && pnpm test
pnpm --filter @englishpath/web dev          # http://localhost:5173 (proxies /api to the gateway on :5000)

# Backend
docker compose up -d sqlserver rabbitmq redis
cd backend
dotnet test EnglishPath.sln
dotnet run --project src/Services/Identity/EnglishPath.Identity.Api   # :5103, migrates its DB and seeds roles/clients in Development
dotnet run --project src/Services/Learning/EnglishPath.Learning.Api   # :5101
dotnet run --project src/Services/Progress/EnglishPath.Progress.Api   # :5102
dotnet run --project src/Gateway/EnglishPath.Gateway                  # :5000
```

Or run everything in containers: `docker compose --profile services up --build`.

With the stack running, `python3 scripts/smoke_test.py` checks the main flows end to end through the gateway: sign-up, sign-in, refresh, onboarding, authoring, lesson completion, progress, and deletion with erasure. It publishes a "Smoke test" unit into your local database.

Anyone can play a **demo lesson** (Pre-A1 greetings) from the welcome screen (`/try`, FR-03). It runs entirely in the browser.

### Authentication

The Identity service is an OAuth 2.0 / OIDC token server (OpenIddict). It issues 15-minute JWT access tokens and rotating refresh tokens (NFR-06). Learning and Progress validate tokens against its published keys (`Auth:Authority`).

- **Email + password:** `POST /connect/token` with `grant_type=password`, `client_id=englishpath-web`, `username`, `password`, `scope=openid email roles offline_access api`.
- **Google / Apple (FR-01):** the app signs in with the provider's SDK and exchanges the ID token with `grant_type=urn:englishpath:params:oauth:grant-type:external_id_token`, `provider=google|apple` and `id_token`. On first sign-in the server asks for `date_of_birth` (and `guardian_email` for minors) through `error_uri …/registration_required`. Configure the provider client ids under `Identity:ExternalProviders`.
- **Refresh:** `grant_type=refresh_token`. Password resets and account deletion invalidate refresh tokens.
- **Rules:** passwords need at least 12 characters, with no composition rules (ASVS 2.1). Five failed sign-ins lock the account for 15 minutes. Under 13 is refused (configurable via `Identity:MinimumAge`). Ages 13–17 can't sign in until a guardian approves the emailed link; declining deletes the account (FR-05).
- **Development:** a super admin `admin@englishpath.local` / `local-admin-password` is seeded, and emails (verification, reset and consent links) are written to the Identity service log instead of being sent.

## API (v1)

| Method & path | Who | Purpose |
| --- | --- | --- |
| `POST /api/v1/identity/accounts` | anyone | Register (email, password, date of birth, guardian email for minors, terms) |
| `POST /api/v1/identity/accounts/{verify-email,forgot-password,reset-password,guardian-consent}` | anyone (link token) | FR-04, FR-05 |
| `GET /api/v1/identity/me`, `PUT /me/onboarding`, `POST /me/delete` | learner | Profile, onboarding (FR-02), self-service deletion with re-authentication (FR-04) |
| `GET /api/v1/learning/course-map` | learner | Levels → units → lessons with locked/unlocked/completed (FR-20) |
| `GET /api/v1/learning/lessons/{id}` | learner | Live lesson bundle, cacheable offline (FR-21, NFR-05) |
| `POST /api/v1/learning/lessons/{id}/completions` | learner | Idempotent sync of a finished lesson; server re-grades and publishes `LessonCompleted` |
| `POST /api/v1/learning/admin/units`, `POST/PUT /admin/lessons[/{id}]`, `POST /admin/lessons/{id}/submit` | author | Authoring (FR-80) |
| `GET /api/v1/learning/admin/lessons/{id}` | content staff | Draft, rule violations, version history |
| `POST /api/v1/learning/admin/lessons/{id}/{request-changes,publish,rollback}` | reviewer | Review, publish, and rollback (FR-82) |
| `GET /api/v1/progress/dashboard?today=YYYY-MM-DD` | learner | Streak, XP, words, due reviews, skill radar (FR-60) |
| `PUT /api/v1/progress/daily-goal` | learner | 5/10/15/20-minute goal (FR-02) |
| `GET /api/v1/progress/reviews/due`, `POST /api/v1/progress/reviews/{vocabularyId}` | learner | SM-2 review (FR-31) |

In Development, each service serves Swagger UI at `/swagger`.

## Key design points

- **Content is typed JSON** (BRD §8.3 #2). The zod schema in `packages/core` and the C# model in `Learning.Domain/Content` describe the same shape. Lesson design rules are enforced before review: 8–15 exercises, ≤ 10 new words, at least one listening item, valid answer keys.
- **Offline-first learning loop** (#3). The client scores answers locally for instant feedback. On sync, the server re-grades every attempt against the exact lesson version played; only first attempts count. Completion IDs are generated by the client, so retries are safe.
- **Event-driven progress** (#4). `LessonCompleted` goes through a transactional outbox to RabbitMQ; Progress consumes it with inbox de-duplication. Queues are named per service, so each service receives every event it subscribes to.
- **Right to erasure** (NFR-08). Deleting an account publishes `UserDeleted`; Learning and Progress delete that learner's data.
- **Client/server parity.** XP, streak and SM-2 rules exist in both TS (`packages/core`) and C#. The tests on both sides use the same vectors.

## Status against the MVP plan

Done: monorepo, CI, PWA shell with sign-up, sign-in, onboarding, email-link pages, profile/dashboard and account deletion; lesson player with all 7 exercise types, whose completions are queued offline in IndexedDB and synced on reconnect; course map; Identity service (sign-up and sign-in, Google/Apple exchange, age and guardian consent, verification, reset, onboarding, deletion with erasure), Learning & Content service with the CMS workflow API, Progress service (XP, daily goal, streaks with freezes, skill radar, SRS), gateway, local infrastructure.

Next, in rough order:
- Google/Apple SDK buttons on the web; SendGrid email sender; production signing certificates from the vault; token pruning; admin role management (FR-91) with audit log (FR-92)
- Resume a lesson mid-way across devices (FR-27); precache the current unit's lessons for offline use (NFR-05)
- Review screen: needs a vocabulary lookup API in Learning so due cards can show the word, audio and example (FR-31, FR-32)
- Placement test (FR-10/11) and unit checkpoints (FR-12) driving unlocks
- Admin CMS app with live preview, media upload/CDN, TTS, bulk import (FR-80/81/83/85), audit log (FR-92), support tools (FR-90)
- Review and Profile screens backed by the Progress API; badges (FR-51)
- Observability (OpenTelemetry, Serilog), infrastructure as code, analytics events
