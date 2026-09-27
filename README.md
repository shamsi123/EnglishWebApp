# EnglishPath

A mobile-first English learning platform (Pre-A1 → B2). It ships first as an installable PWA; Phase 3 wraps the same build as iOS/Android apps with Capacitor.
Scope, requirements and target architecture are in [docs/BRD.md](docs/BRD.md). This repository is currently building **Phase 1 (MVP)**.

## Repository layout

```
apps/web/            Learner PWA — React 18, Vite, TypeScript, Tailwind, TanStack Query, Zustand, vite-plugin-pwa
                     Includes the CMS under /admin (src/features/admin), code-split so learners never download it
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
docker compose up -d sqlserver rabbitmq redis azurite   # azurite is only needed for the media library (FR-81)
cd backend
dotnet test EnglishPath.sln
dotnet run --project src/Services/Identity/EnglishPath.Identity.Api   # :5103, migrates its DB and seeds roles/clients in Development
dotnet run --project src/Services/Learning/EnglishPath.Learning.Api   # :5101
dotnet run --project src/Services/Progress/EnglishPath.Progress.Api   # :5102
dotnet run --project src/Gateway/EnglishPath.Gateway                  # :5000
```

Or run everything in containers: `docker compose --profile services up --build`.

With the stack running, `python3 scripts/smoke_test.py` checks the main flows end to end through the gateway: sign-up, sign-in, refresh, onboarding, authoring, lesson completion, progress, and deletion with erasure. It publishes a "Smoke test" unit into your local database.

For a starter course to click through, run `python3 scripts/seed_dev_content.py` once on a fresh database. It adds two Pre-A1 units (the first ends with a checkpoint), one A1 and one A2 unit, and a placement item bank.

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
| `GET /api/v1/learning/course-map` | learner | Levels → units → lessons with locked/unlocked/completed, lesson kind and placement (FR-20) |
| `POST /api/v1/learning/placement`, `POST /placement/{id}/answers`, `POST /placement/skip` | learner | Adaptive placement test scored on the server, or skip to Pre-A1 (FR-10, FR-11) |
| `GET /api/v1/learning/vocabulary?ids=a,b` | learner | Word cards for review (FR-32) |
| `GET /api/v1/learning/lessons/{id}` | learner | Live lesson bundle, cacheable offline (FR-21, NFR-05) |
| `POST /api/v1/learning/lessons/{id}/completions` | learner | Idempotent sync of a finished lesson; server re-grades and publishes `LessonCompleted` |
| `POST /api/v1/learning/admin/units`, `POST/PUT /admin/lessons[/{id}]`, `POST /admin/lessons/{id}/submit` | author | Authoring (FR-80). Create a lesson with `"kind": "Checkpoint"` for a unit's checkpoint quiz (FR-12) |
| `GET/POST /api/v1/learning/admin/placement-items`, `DELETE /admin/placement-items/{id}` | content staff / author | Placement item bank (FR-10) |
| `GET /api/v1/learning/admin/lessons/{id}` | content staff | Draft, rule violations, version history |
| `POST /api/v1/learning/admin/lessons/{id}/{request-changes,publish,rollback}` | reviewer | Review, publish, and rollback (FR-82) |
| `GET /api/v1/learning/admin/outline` | content staff | Every unit and lesson, drafts included — the CMS course tree (FR-80) |
| `GET/POST /api/v1/learning/admin/media` | content staff / author | Upload (multipart, ≤ 10 MB) and list images/audio (FR-81) |
| `GET /api/v1/learning/admin/export`, `POST /admin/import` | content staff / author | Bulk content package as JSON (FR-85) |
| `GET /api/v1/learning/admin/audit` | content staff | Recent admin actions, optionally filtered to one record (FR-92) |
| `GET /api/v1/progress/dashboard?today=YYYY-MM-DD` | learner | Streak, XP, words, due reviews, skill radar (FR-60) |
| `PUT /api/v1/progress/daily-goal` | learner | 5/10/15/20-minute goal (FR-02) |
| `GET /api/v1/progress/reviews/due`, `POST /api/v1/progress/reviews/{vocabularyId}` | learner | SM-2 review (FR-31) |

In Development, each service serves Swagger UI at `/swagger`.

## The CMS (`/admin`)

Content-team screens live in the same PWA at `/admin`, code-split so learners never download them (NFR-02) and gated on a content-team role (FR-91: `ContentAuthor`, `Reviewer`, `SuperAdmin`, `Support`) fetched from `GET /identity/me`. Signed-in staff see a "Content management" link on their Profile page. Author-only actions (create, edit, submit) and reviewer-only actions (request changes, publish, rollback) are hidden client-side by role, but the server is what actually enforces them (`Policies.Author`/`Policies.Reviewer` in `EnglishPath.Learning.Api`).

- **Course outline** (`/admin/outline`, FR-80) — every unit and lesson, including drafts, grouped by CEFR level; create units and lessons (as a regular lesson or a checkpoint) from here.
- **Lesson editor** (`/admin/lessons/:id`, FR-80/82) — a JSON editor for the lesson content schema shared with the client (`packages/core`'s `Lesson`/`Exercise` zod types mirror the C# model 1:1), with a toolbar to insert a starter template for each of the 7 exercise types. A **live preview** renders the draft through the actual learner lesson player (`LessonPlayer`, parsed with the same zod schema learners get), so what an author sees is what ships. Draft rule violations (8–15 exercises, ≤ 10 new words, one listening item, valid answer keys) come straight from the server. Workflow buttons (submit → request changes / publish → roll back to an earlier version) appear per the signed-in user's role, with inline version history and this lesson's audit trail.
- **Media library** (`/admin/media`, FR-81) — drag-free upload of one image or audio file at a time (≤ 10 MB); images are resized and converted to WebP server-side. Copy a file's CDN URL into a lesson's `audio`/`image` field.
- **Placement items** (`/admin/placement`, FR-10) — manage the question bank the placement test draws from, with the same template toolbar restricted to the 4 server-scorable exercise types.
- **Import / export** (`/admin/import-export`, FR-85) — export the whole course (units, lesson drafts, active placement items) as one JSON file; import a package (e.g. drafted offline or with AI help) as drafts, which still go through review.
- **Audit log** (`/admin/audit`, FR-92) — the most recent 200 content-management actions across the service (who, what, when).

## Key design points

- **Content is typed JSON** (BRD §8.3 #2). The zod schema in `packages/core` and the C# model in `Learning.Domain/Content` describe the same shape. Lesson design rules are enforced before review: 8–15 exercises, ≤ 10 new words, at least one listening item, valid answer keys.
- **Offline-first learning loop** (#3). The client scores answers locally for instant feedback. On sync, the server re-grades every attempt against the exact lesson version played; only first attempts count. Completion IDs are generated by the client, so retries are safe.
- **Event-driven progress** (#4). `LessonCompleted` goes through a transactional outbox to RabbitMQ; Progress consumes it with inbox de-duplication. Queues are named per service, so each service receives every event it subscribes to.
- **Placement and unlocking** (FR-10–12). The placement test works in blocks of 4 questions at one level: 3 or more correct moves up a level, otherwise it moves down or stops. It has at most 20 questions and expires after 30 minutes. Answer keys stay on the server, so only multiple choice, listen-and-select, image-word and fill-blank items are allowed. Learners start at the level after the highest one they passed. Lower levels stay open for revision. Each later unit opens when the previous unit's checkpoint is passed with 70% or more, or, for a unit without a checkpoint, when all its lessons are done.
- **Vocabulary** (FR-30–32). Publishing a lesson copies its words into a vocabulary table used by the Review screen. Vocabulary ids are global, so reuse an id only for the same word; the last lesson published wins.
- **Right to erasure** (NFR-08). Deleting an account publishes `UserDeleted`; Learning and Progress delete that learner's data.
- **Audit log** (FR-92). Any MediatR command implementing `IAuditedCommand` is recorded by a shared pipeline behavior after it succeeds (`AuditBehavior` in `BuildingBlocks.Application`) — a new admin command gets an audit trail for free by declaring the interface, no per-endpoint wiring.
- **Media is content-addressed** (FR-81). Uploads are named by the SHA-256 of their (processed) bytes, so the same file uploaded twice reuses one URL and a URL never needs to change; files are marked immutable for CDN caching.
- **Client/server parity.** XP, streak and SM-2 rules exist in both TS (`packages/core`) and C#. The tests on both sides use the same vectors.

## Status against the MVP plan

Done: monorepo, CI, PWA shell with sign-up, sign-in, onboarding, email-link pages, profile/dashboard and account deletion; placement test (FR-10, FR-11) and unit checkpoints (FR-12); Review flashcards with UK/US audio, IPA and example (FR-31, FR-32); lesson player with all 7 exercise types, whose completions are queued offline in IndexedDB and synced on reconnect; course map; Identity service (sign-up and sign-in, Google/Apple exchange, age and guardian consent, verification, reset, onboarding, deletion with erasure), Learning & Content service with the CMS workflow API, Progress service (XP, daily goal, streaks with freezes, skill radar, SRS), gateway, local infrastructure; the CMS itself (`/admin`): course outline, lesson editor with live preview and the full review/publish/rollback workflow, media library with image compression, placement item bank, bulk import/export, and an audit log (FR-80–82, FR-85, FR-91, FR-92).

Next, in rough order:
- Google/Apple SDK buttons on the web; SendGrid email sender; production signing certificates from the vault; token pruning
- Admin support tools: user search, view a learner's progress, reset streak, manage subscription, assign roles in-app (FR-90, FR-91 — roles exist and are enforced, but are currently only assignable via `RoleManager`/database)
- Resume a lesson mid-way across devices (FR-27); precache the current unit's lessons for offline use (NFR-05)
- Text-to-speech generation for exercise audio (FR-83); AI-assisted exercise drafting (FR-84)
- Badges (FR-51); daily due count on the Review tab
- Observability (OpenTelemetry, Serilog), infrastructure as code, analytics events
