# KidsLang

A playful, ad-free app where children aged 4–10 learn **Arabic** (and later **Hindi**) from the very first letter.
Each lesson runs **Learn → Play → Check**, and the next lesson unlocks only when the child has mastered this one.

📱 **See every screen:** [docs/SCREENS.md](docs/SCREENS.md)

## What's here

| Path | What it is |
|---|---|
| `apps/web` | React + TypeScript + Vite PWA: mobile-first, installable, works offline |
| `services/api` | ASP.NET Core 8 API (Clean Architecture, EF Core on SQLite or PostgreSQL) |
| `content/arabic/level-1` | Lesson content as JSON (the source of truth): 28 letters, 8 units |
| `content/fixtures` | Shared test cases that keep the web engine and the C# domain in sync |
| `docs/` | Screen guide and screenshots |

## Run it

```bash
# Web app (http://localhost:5173) — works fully offline on its own (progress lives on the device)
cd apps/web
npm install
npm run dev

# API (http://localhost:5080/swagger)
cd services/api
dotnet run --project src/KidsLang.Api --urls http://localhost:5080

# Everything with PostgreSQL (web on :3000, API on :8080)
docker compose up --build
```

The web app runs standalone with progress kept on the device (localStorage) — no API needed. Point it at a
running API by setting `VITE_API_URL` (see `apps/web/.env.example`), and it will *also* register/log the
parent in on the real backend, mirror child profiles there, and sync quiz results and queued attempts once
online — while still working the same way if the API is unreachable.

## Checks

```bash
cd apps/web && npm run build && npm run lint && npm run test && npm run test:e2e
cd services/api && dotnet test
# Same API tests against PostgreSQL:
KIDSLANG_TEST_POSTGRES="Host=localhost;Username=postgres;Password=postgres" dotnet test
```

See [CLAUDE.md](CLAUDE.md) for conventions and domain rules.
