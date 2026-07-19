# Guardianes — Project Overview

Sistema de gestión operativa para una Compañía de Bomberos: voluntarios, turnos de guardia, citaciones, permisos/licencias, panel de camas, roles nocturnos, y estadísticas de asistencia. This document is a human-oriented map of the three sub-projects in this monorepo — what each one is, how much of it exists, and how they fit together. For AI-agent operating instructions (commands, conventions), see `CLAUDE.md`. For the full domain spec and user stories, see `docs/CONTEXTO.md`.

```
nuevo-guardianes/
├── api/       NestJS + Prisma + PostgreSQL — the backend, source of truth
├── web/       Next.js — the staff-facing web app (built, in active use)
└── mobile/    Flutter — new mobile app (scaffold only, not started)
```

All three consume/will consume one backend: JWT-authenticated REST API returning `{ data: ... }`, with roles ADMIN / JEFE_GUARDIA / GUARDIAN / CONDUCTOR / OFICIALIDAD gating what each endpoint allows.

---

## `api/` — NestJS backend

**Status: the most complete piece.** 7 sprints' worth of history (see `docs/CONTEXTO.md` HU-01 through HU-47) are implemented as 13 domain modules plus a shared `noches` engine.

| Module | Owns |
|---|---|
| `auth` | Login, JWT access/refresh, `JwtAuthGuard`, `RolesGuard`, `@Roles()` |
| `voluntarios` | CRUD for QUINCE (correlativo 1–999, permanent) and CONFEDERADO (1000+, reusable) volunteers, role assignment, Excel import |
| `oficialidad` | Cargo jerárquico per voluntario |
| `cuarteleros` / `carros` | CBS staff and vehicles, vehicle↔crew habilitation |
| `turnos` | Named shift groups of voluntarios |
| `citaciones` | Weekly citaciones and daily asignaciones, bed (`cama`) assignment, the nightly "panel de camas" |
| `permisos` | Permiso / Permiso Especial / Reemplazo requests, approval workflow |
| `guardia` | Nightly roles: mensajero, conductor de guardia, JG subrogante |
| `licencias` | Multi-day license/leave, bulk-inserted per day |
| `libro-guardia` | Manual overrides (`CorreccionNoche`) on top of the automatic attendance calculation |
| `estadisticas` | Attendance stats over an arbitrary date range |
| `documentos` | In-memory `.docx` generation (libro de guardia, conteo) via the `docx` package |

**The one piece of logic that matters most**: `src/noches/noches.service.ts`. `resolverNoche()` is the single function that decides, for a voluntario + a night, whether they slept and why — checking manual override, then licencia, then permiso, then being someone's reemplazante, then being cited, in that priority order. Every stat/history/document endpoint is a thin consumer of this, not a re-implementation. This is the piece most worth reading before touching attendance logic anywhere in the codebase.

**Data model** (`prisma/schema.prisma`): ~20 models, PostgreSQL via Prisma 5. Notably, voluntario correlativo uniqueness can't be expressed as a normal Prisma constraint (QUINCE is permanently unique, CONFEDERADO only unique while active) so it's enforced via raw-SQL partial unique indexes in the migrations, not the schema file.

**Testing**: Jest unit tests (`*.spec.ts`) + a `test/` e2e suite. `auth` (login/refresh/logout, including the mobile header contract) and `noches` (the full `resolverNoche` priority chain, totals accumulation, error cases — 23 tests) are covered; 43/43 tests passing across the suite. Other domain modules (`voluntarios`, `citaciones`, `permisos`, etc.) still have no dedicated tests — lower risk than `noches` since they're mostly CRUD, but worth revisiting.

**Not yet built**: nothing obviously missing from the sprint plan in `docs/CONTEXTO.md` — sprints 2 through 7 (HU-01–HU-47) all appear implemented. Sprint 1 (monorepo/schema) is marked done in the doc; nothing past HU-47 is documented.

---

## `web/` — Next.js staff web app

**Status: functional, in active use.** Next.js 16 App Router, React 19, Tailwind v4, TanStack Query + Zustand.

Route structure:
- `app/(auth)/login` — unauthenticated login screen
- `app/(app)/` — authenticated shell (sidebar + bottom nav) wrapping:
  - `/` (home) — small landing/dashboard (90 lines, likely minimal)
  - `/citaciones` (286 lines) — citaciones and panel de camas UI
  - `/permisos` (345 lines) — permiso/reemplazo request + approval flow
  - `/voluntarios` (744 lines, by far the largest page) — volunteer CRUD, roles, likely the most feature-dense screen
  - `/libro-de-guardia` (279 lines) — JEFE_GUARDIA/ADMIN-only nightly ledger view with overrides, gated in `lib/nav-items.ts` by role
  - `/estadisticas` — JEFE_GUARDIA/ADMIN-only attendance stats by date range, optional voluntario filter, table sorted by noches desc
  - `/documentos` — JEFE_GUARDIA/ADMIN-only Word export: libro de guardia by date, conteo by citación

All server communication funnels through the single client in `lib/api.ts`, which centralizes bearer-token attachment and silent 401→refresh→retry→redirect-to-login — including binary downloads, via `api.download()`, so the `.docx` export buttons get the same session handling as every JSON request instead of a one-off fetch. Session state lives in a Zustand store (`lib/store/auth-store.ts`); everything server-derived goes through TanStack Query.

**Not yet built**: there's still no test suite under `web/` at all.

---

## `mobile/` — Flutter app

**Status: bare scaffold, not started.** Created this session via `flutter create`; `flutter analyze` passes clean but there is no real functionality yet — `lib/main.dart` is still the default Flutter counter demo.

What exists beyond the stock scaffold:
- `lib/core/api_client.dart` — a hand-written HTTP client mirroring `web/lib/api.ts`'s contract (bearer token, unwraps `{ data }`, throws `ApiException` on non-2xx).
- `lib/core/token_store.dart` — secure token persistence via `flutter_secure_storage` (platform keystore/keychain).

**Auth is solved**: `lib/core/auth_repository.dart` handles login/logout, and `api_client.dart` does silent 401→refresh→retry. The API's `/auth/login`/`/auth/refresh`/`/auth/logout` are shared with web, gated by an `X-Client-Platform: mobile` header — the refresh token only appears in the JSON body for requests carrying that header, so web's HttpOnly-cookie behavior is untouched.

**Everything else — every screen, every data flow — is unbuilt.** This is a from-scratch mobile client for the same domain the web app already covers; expect to port UI/UX decisions from `web/` rather than design them independently, but the two won't necessarily map 1:1 (e.g. mobile may want a lighter-weight subset of `/voluntarios` for read-mostly roles like GUARDIAN/CONDUCTOR).

---

## Cross-cutting gaps — status

- ~~Backend test coverage on `NochesService`~~ — resolved: 23 new tests cover the full `resolverNoche` priority chain, totals accumulation, and error cases. 43/43 tests passing across the API.
- ~~Web missing UI for `estadisticas`/`documentos`~~ — resolved: both pages built, gated the same way as `/libro-de-guardia`, sharing `lib/api.ts`'s session handling (including a new `api.download()` for the `.docx` exports, so 401→refresh→retry works there too).
- ~~Mobile auth can't reach parity with web~~ — resolved: shared `/auth/*` endpoints now serve mobile via an `X-Client-Platform` header, with no change to web's cookie-based flow.
- Remaining known gap: no test suite under `web/`, and most `api/` domain modules besides `auth`/`noches` are still untested (lower risk, since they're mostly CRUD, but not zero).
- Parallel work across `api/`, `web/`, and `mobile/` is supported by the subagents in `.claude/agents/` (`api-builder`, `web-builder`, `flutter-builder`, plus `qa-verifier` and `security-reviewer` as cross-cutting review passes).
