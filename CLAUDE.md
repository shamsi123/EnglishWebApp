# EnglishPath

Requirements: see docs/BRD.md (source of truth for scope, requirements and architecture).

## Stack
- Web: React 18 + Vite + TypeScript, Tailwind, TanStack Query, Zustand, vite-plugin-pwa
- Mobile (Phase 3): Capacitor wrapping the same web build
- Backend: ASP.NET Core 8/9, Clean Architecture + CQRS (MediatR), YARP gateway
- Messaging: RabbitMQ + MassTransit (outbox); SQL Server + EF Core; Redis
- Monorepo: pnpm workspaces + Turborepo; shared code in packages/core

## Rules
- Build Phase 1 (MVP) only unless told otherwise.
- Reference FR/NFR IDs from the BRD in commit messages and PRs.
- Keep APIs versioned (/api/v1) and mobile-ready.

## Layout
- `apps/web` — learner PWA (React + Vite)
- `packages/core` — shared TS: content schema, SRS, gamification rules, API client
- `backend/` — .NET solution: `Gateway` (YARP), `Services/*` (Clean Architecture per bounded context), `BuildingBlocks`
- `docs/` — BRD and architecture notes

## Commands
- JS: `pnpm install`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm --filter @englishpath/web dev`
- .NET: `dotnet build backend/EnglishPath.sln`, `dotnet test backend/EnglishPath.sln`
- Local infra: `docker compose up -d` (SQL Server, RabbitMQ, Redis)
