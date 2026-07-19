# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Guardianes — sistema de gestión operativa para una Compañía de Bomberos: voluntarios, turnos de guardia, citaciones, permisos, licencias, panel de camas y estadísticas de asistencia. Full domain spec (data model, business rules, endpoint access matrix, and per-sprint user stories HU-01..HU-47) lives in `docs/CONTEXTO.md` — read it before making product/business-logic decisions, it is the source of truth for *why*, not just *what*.

## Monorepo layout

`api/` and `web/` form a pnpm workspace (each with its own lockfile/node_modules — always run package-scoped commands from inside them, not just via the root scripts). `mobile/` is a separate Flutter/Dart project, not part of the pnpm workspace, but talks to the same API.

- `api/` — NestJS 11 + TypeScript + Prisma 5 + PostgreSQL
- `web/` — Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui-style components
- `mobile/` — Flutter app (`guardianes_mobile`), Dart SDK ^3.11.5, consumes the same NestJS API

## Commands

Root (`package.json`):
```
pnpm run dev:api    # pnpm --filter api dev
pnpm run dev:web    # pnpm --filter web dev
pnpm run dev        # both concurrently
```

Postgres for local dev: `docker-compose up -d` (db `guardianes_dev`, user/pass `guardianes`/`guardianes123`, port 5432).

API (run from `api/`):
```
pnpm dev                              # nest start --watch (port 4000 by default)
pnpm build                            # nest build
pnpm lint                             # eslint --fix
pnpm test                             # jest unit tests (*.spec.ts, rootDir=src)
pnpm test -- noches.service.spec      # single test file (jest name filter)
pnpm test:watch
pnpm test:cov
pnpm test:e2e                         # jest --config ./test/jest-e2e.json
npx prisma migrate dev                # apply/create a migration
npx prisma studio                     # inspect DB
npx prisma db seed                    # runs prisma/seed.ts (ts-node)
```

Web (run from `web/`):
```
pnpm dev      # next dev
pnpm build
pnpm lint
```

There is currently no test suite under `web/`.

Mobile (run from `mobile/`):
```
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:4000   # Android emulator -> host's localhost
flutter analyze
flutter test
```

## API architecture

- **One NestJS module per domain**, registered in `src/app.module.ts`: `auth`, `voluntarios`, `oficialidad`, `cuarteleros`, `carros`, `turnos`, `citaciones`, `permisos`, `guardia`, `licencias`, `libro-guardia`, `estadisticas`, `documentos`, plus `noches` (not a module — a plain service) and `prisma` (global).
- Module build order convention (also enforced by review): schema → DTO → Service → Controller → Module.
- **`NochesService` (`src/noches/noches.service.ts`) is the core business-logic engine.** `resolverNoche()` decides, for a given voluntario + night, whether they slept and why, in strict priority order: `CorreccionNoche` (manual override) > `Licencia` > `Permiso` (PERMISO/PERMISO_ESPECIAL/REEMPLAZO) > being someone else's reemplazante > being cited (`CamaAsignacion`) > `SIN_CITAR`. Every endpoint that reports attendance/history/stats (`/voluntarios/:id/historial`, `/estadisticas/noches`, `/citaciones/:id/conteo`, the Word document generators) is a thin wrapper that loads a date-range context via `cargarContextoRango()` and calls `resolverNoche()` per day. When touching attendance/stats logic, change it here, not per-endpoint.
- **Auth**: JWT access token (15min, Bearer) + refresh token in an HttpOnly/Secure/SameSite=Strict cookie (7d, rotated on use, tracked in `RefreshToken` table for revocation). `JwtAuthGuard` + `@Roles(...)` decorator + `RolesGuard` implement RBAC against `RolSistema` (ADMIN, JEFE_GUARDIA, GUARDIAN, CONDUCTOR, OFICIALIDAD) baked into the JWT payload. See the access matrix in `docs/CONTEXTO.md`.
  - **Mobile clients** (no browser cookie jar) send `X-Client-Platform: mobile` on every request; `login`/`refresh` only include `refreshToken` in the JSON body when that header is present, and `refresh`/`logout` fall back to reading it from the request body when the cookie is absent (`auth.controller.ts` — `esClienteMobile()`). A request without the header (any browser) behaves exactly as before — this doesn't weaken web's cookie-only model.
- **Response envelope**: a global `TransformInterceptor` (`src/common/interceptors/transform.interceptor.ts`) wraps every response as `{ data: ... }`; list endpoints add `meta: { total, page, limit, totalPages }`. A global `ValidationPipe` (whitelist + transform) is enabled in `main.ts`. Don't bypass the envelope shape when adding endpoints.
- **Voluntario correlativo uniqueness is enforced with partial unique indexes via raw SQL migrations** (Prisma has no native partial-unique support), not in `schema.prisma` alone — see `prisma/migrations/*_voluntario_correlativo_partial_unique/`. QUINCE correlativos (1–999) are permanently unique; CONFEDERADO correlativos (1000+) are only unique among `activo = true` rows, so they get reused after deactivation.
- **Documents** (`documentos` module) generate `.docx` in-memory (via `docx`) for the libro de guardia and conteo, streamed back with `Content-Disposition: attachment`. `xlsx` is also a dependency (voluntario import).
- Routes are kebab-case, errors are in Spanish, DTOs use `class-validator` + `@ApiProperty()` for Swagger.

## Web architecture

- Next.js App Router with route groups: `app/(auth)/` (login, unauthenticated layout) and `app/(app)/` (authenticated shell: sidebar/bottom-nav layout, pages for citaciones, libro-de-guardia, permisos, voluntarios).
- `lib/api.ts` is the single HTTP client. It attaches the Bearer access token from the Zustand auth store, and on a 401 transparently calls `/auth/refresh` (de-duped via a shared in-flight promise), updates the store, retries once, and redirects to `/login` if refresh also fails. Always go through `api.get/getPaginated/post/patch/delete` rather than calling `fetch` directly, so this refresh/redirect behavior stays centralized.
- State split: Zustand (`lib/store/auth-store.ts`) for auth/session/UI state, TanStack Query for all server data.
- `components/ui/` are small shadcn-style primitives (button, card, input, badge, label); `components/layout/` holds app chrome and domain widgets (`panel-camas.tsx`, `cama-card.tsx` render the citaciones/panel de camas view described by HU-23).
- `web/AGENTS.md` / `web/CLAUDE.md` only point at Next.js's own bundled docs (`node_modules/next/dist/docs/`) — check those if a Next.js API looks unfamiliar, since this Next major version may differ from training data.

## Mobile architecture

- Standard `flutter create` scaffold (`lib/main.dart` still has the default counter demo — replace it as real screens are built).
- `lib/core/api_client.dart` mirrors `web/lib/api.ts`: attaches the bearer access token, unwraps the `{ data }` envelope, and silently retries once via `/auth/refresh` on a 401. `lib/core/token_store.dart` persists tokens via `flutter_secure_storage` (platform keystore/keychain). `lib/core/auth_repository.dart` wraps login/logout.
- **Mobile auth contract**: the API's `/auth/login`, `/auth/refresh`, `/auth/logout` are shared with web, gated by one header — `ApiClient` sends `X-Client-Platform: mobile` on every request, and the API only includes the refresh token in the JSON response body when that header is present (see `api/src/auth/auth.controller.ts`). A browser request never sends that header, so web's HttpOnly-cookie-only behavior is completely unchanged. `/auth/refresh` and `/auth/logout` read the refresh token from the cookie first, falling back to the request body's `refreshToken` field — mobile always uses the body path.
- Base API URL is set via `--dart-define=API_URL=...` (`String.fromEnvironment` in `api_client.dart`), not hardcoded — defaults to `http://localhost:4000`, use `http://10.0.2.2:4000` on the Android emulator to reach the host machine.
