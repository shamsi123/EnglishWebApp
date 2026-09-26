# CLAUDE.md — KidsLang

Guidance for Claude Code when working in this repository. Read this first; the full product spec is the KidsLang BRD
(requirement IDs FR-xx). The screen guide is in `docs/SCREENS.md`.

## Project summary

KidsLang is an interactive language-learning app for children aged 4–10, teaching Arabic and Hindi from the first letter upward.

- Now: a mobile-look, responsive PWA (portrait-first).
- Later: iOS/Android apps built by wrapping the same web app with Capacitor. Do not introduce anything that blocks this path.
- Database: SQLite in development and MVP, PostgreSQL in production. All data access goes through EF Core.

Every lesson follows Learn → Play → Check. The next lesson unlocks only when the mastery rules are met (see "Domain rules").

## Tech stack

Frontend (`apps/web`): React, TypeScript (strict), Vite, Tailwind CSS (logical `ms-/me-/start/end`, `rtl:`/`ltr:`),
dnd-kit, Canvas tracing, Zustand, React Router, i18next, vite-plugin-pwa, Zod, self-hosted fonts via @fontsource.
Tests: Vitest, React Testing Library, Playwright (iPhone and Pixel profiles).

Backend (`services/api`): ASP.NET Core 8, modular monolith with Clean Architecture layers, EF Core (SQLite + Npgsql),
JWT with rotating refresh tokens, Identity password hasher, FluentValidation, Serilog, OpenAPI. Tests: xUnit.

## Repository layout

```
apps/web/src/
  app/          routing, providers, phone-frame layout, child session hooks
  features/     auth, profiles, courses, journey, lesson, activities/<type>, rewards, review, parent, welcome
  engine/       mastery rules, Leitner scheduler, tracing scorer, audio manager, seeded RNG (pure TS, unit-tested)
  offline/      attempt sync queue
  content/      Zod schemas + course loader (reads /content)
  i18n/         locales (en, ar) + direction helpers
  lib/          store, progress/journey rules, Arabic script helpers
  ui/           design-system components
apps/web/scripts/   Playwright driver + screenshot walkthrough
apps/web/e2e/       Playwright E2E specs
services/api/src/
  KidsLang.Api/            endpoints, auth, DI, middleware
  KidsLang.Application/    use cases, DTOs, validators
  KidsLang.Domain/         entities, mastery/Leitner/progression logic (no EF refs)
  KidsLang.Infrastructure/ DbContext, JSON converters, content catalog, security
services/api/tests/
content/<lang>/level-N/*.json   lesson content (source of truth)
content/fixtures/               shared engine test cases (TS + C#)
docs/
```

## Common commands

```bash
# Frontend
cd apps/web
npm install
npm run dev            # dev server
npm run build          # production build (must pass before commit)
npm run lint
npm run test           # Vitest (includes content validation)
npm run test:e2e       # Playwright, mobile viewports
npm run screenshots    # regenerate docs/screens (needs `npx vite preview --port 4173`)

# Backend
cd services/api
dotnet restore
dotnet run --project src/KidsLang.Api
dotnet test
KIDSLANG_TEST_POSTGRES="Host=localhost;Username=postgres;Password=postgres" dotnet test   # same tests on PostgreSQL

# Full stack
docker compose up --build
```

Select the database provider with `Database__Provider=Sqlite|Postgres`. The dev JWT key lives in
`appsettings.Development.json`; any other environment must set `Jwt__SigningKey` from a secret store.

## Domain rules (do not break)

Mastery gate. A lesson is mastered only when all of these hold:
- the quiz score is ≥ `mastery.minScore` (default 0.8);
- every new item in the lesson was answered correctly at least once in the quiz;
- tracing accuracy is ≥ `mastery.minTraceAccuracy` (default 0.7), where tracing applies.

Stars. 80–89% earns 1★, 90–99% earns 2★, and 100% earns 3★.

Failing a check. Route the child to the Help Loop: re-teach the missed items, run targeted practice, then retry with a
regenerated quiz. Never show "failed" wording to children.

Unit Checkpoints and Level Tests also gate progression.

The server is the source of truth for unlocks. The client may unlock provisionally while offline, and the server
re-evaluates on sync.

Spaced review uses Leitner boxes 1–5 with intervals of 1, 2, 4, 7, and 14 days. A correct answer moves an item up one
box (at most once per UTC day); a wrong answer sends it back to box 1. A quiz updates each item once: up only if every
answer for it was correct.

Code placement. Mastery and Leitner logic lives in `KidsLang.Domain`, mirrored in `apps/web/src/engine`. Keep the two
implementations in sync and cover both with tests that use the same fixtures (`content/fixtures`).

## Coding conventions

- TypeScript strict. Avoid `any`; if one is unavoidable, add a comment explaining why.
- Organize code by feature folder. Put shared code in `ui/`, `engine/`, or `lib/` only when it is used in two or more places.
- Keep changes small and focused, and don't refactor unrelated code in the same change.

Frontend:
- Design mobile-first: 360–430 px portrait, safe-area insets, and a centered phone frame on desktop.
- Make tap targets ≥ 56 px. Nothing may depend on hover, double-tap, or typing by the child.
- Every activity is data-driven: one renderer per type in `features/activities/<type>/`, configured from JSON and
  validated with a Zod schema (`content/schema.ts`), lazy-loaded via `features/activities/registry.ts`.
- Keep the initial bundle under 250 KB gzipped.
- Audio: start playback only after a user gesture, route all playback through `engine/audio.ts`, respect mute.
- Respect `prefers-reduced-motion`.
- UI text: i18next keys only; every instruction shown to a child also has spoken audio and a visible caption.

RTL and scripts:
- Arabic content renders with `dir="rtl"`. Use logical CSS properties, never left/right.
- Never render isolated Arabic glyphs where joined forms are expected (`lib/arabic.ts` adds zero-width joiners).
- Approved fonts only: Arabic — Noto Naskh Arabic or Baloo Bhaijaan 2; Hindi — Noto Sans Devanagari or Baloo 2.

Backend:
- Endpoints stay thin; logic belongs in Application or Domain. Validate every request with FluentValidation.
- GUID primary keys. Clients generate `ActivityAttempt.Id`, and the batch endpoint is idempotent on it.
- Keep the database portable: no provider-specific SQL, UTC `DateTime` (no `DateTimeOffset` in queries), JSON columns
  via value converters (TEXT on SQLite, jsonb on PostgreSQL), lower-case emails.

## Child privacy & safety (mandatory)

- No third-party analytics, advertising, or tracking SDK.
- Children have a nickname and avatar only: no email, no real name required, no location.
- The parent gate protects settings, the parent dashboard, purchases, and any external link.
- Deleting a child profile removes all of its data, including attempts, rewards, and logs.
- Never log PII (request logging records method, path, status and timing only).
- Target compliance: COPPA, GDPR-K, UAE PDPL, Apple Kids Category, Google Play Families Policy.

## Content

- `content/**/*.json` is the source of truth, validated by `src/content/content.test.ts` (runs with `npm run test`).
- IDs follow `<lang>-l<level>-u<unit>-l<lesson>[-a<activity>]`, for example `ar-l1-u2-l1-a3`.
- Each learning item declares an audio file path. Recordings are not in the repo yet; the app falls back to device
  text-to-speech.
- Arabic content is Modern Standard Arabic.

## Workflow notes

- Reference BRD requirement IDs (FR-xx) in commits and PR descriptions.
- Before adding a dependency, check whether the existing stack already covers the need; prefer Capacitor-friendly libraries.
- When adding an activity type: Zod schema → renderer → registry → sample content/builder → tests → update the BRD table.
- Ask before changing mastery thresholds, the reward rules, the database schema direction, or anything related to privacy.
- Before saying a task is done, run `npm run build`, `npm run lint`, `npm run test`, and `dotnet test`.
