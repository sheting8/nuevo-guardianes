# Guardianes — Contexto del Proyecto

Sistema de gestión operativa para una Compañía de Bomberos. Permite administrar
voluntarios, turnos de guardia, citaciones, permisos, licencias y estadísticas de asistencia.

## Stack

| Capa | Tecnología |
|------|-----------|
| API | NestJS + TypeScript + Prisma 5 + PostgreSQL |
| Web | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Auth | JWT access token (15min) + refresh token en cookie HttpOnly (7d) |
| Estado | Zustand (auth/UI) + TanStack Query (datos remotos) |
| Tests | Vitest + Supertest + Playwright |

## Estructura del monorepo
## Convenciones

- Rutas en kebab-case: `/auth/me`, `/voluntarios/:id/historial`
- Respuestas siempre envueltas: `{ data: ... }`
- Errores en español
- TypeScript estricto en todo
- DTOs con class-validator y @ApiProperty() para Swagger
- Un módulo NestJS por dominio

## Dominio

### Tipos de Voluntario
- **QUINCE**: correlativo 1–999, único para siempre aunque se vaya
- **CONFEDERADO**: correlativo 1000+, reutilizable si el voluntario queda inactivo
- Ambos tipos tienen la misma participación operativa (citaciones, permisos, estadísticas)
- El `id` interno es siempre un cuid(), el correlativo es solo campo de negocio

### Roles del sistema
- `ADMIN` — acceso total
- `JEFE_GUARDIA` — gestiona citaciones, aprueba permisos, hace overrides, genera documentos
- `GUARDIAN` — solicita permisos, ve su información
- `CONDUCTOR` — ve calendario y pauta CBS
- `OFICIALIDAD` — cargo jerárquico interno

### Módulos principales
1. **Auth** — login, refresh, logout, guards RBAC
2. **Voluntarios** — CRUD, roles, oficialidad, cuarteleros, carros
3. **Guardia** — turnos, citaciones, panel de camas, permisos, roles nocturnos, licencias
4. **Libro de Guardia** — página propia, overrides manuales del JG, generación .docx
5. **Estadísticas** — historial por voluntario, conteo por citación, rango libre
6. **Conductores** — pauta CBS, calendario de turnos
7. **Documentos** — generación .docx en memoria (libro de guardia, conteo)

## Modelo de datos clave

### Citaciones y Camas
- `Citacion` tiene `fechaInicio` y `fechaFin` (null = asignación diaria de una sola noche)
- Las camas NO son columnas (cama1..cama18), son filas en `CamaAsignacion(citacionId, numeroCama, voluntarioId)`

### Permisos
- `PERMISO` → llega tarde pero duerme → **cuenta** en estadísticas
- `PERMISO_ESPECIAL` → no llega → **no cuenta**
- `REEMPLAZO` → titular no llega, reemplazante duerme → **cuenta para el reemplazante**
- `LICENCIA` → no llega → **no cuenta**

### Overrides (Libro de Guardia)
- Modelo `CorreccionNoche(fecha, voluntarioId, durmio, autorId, creadoEn)`
- Lógica: `override ?? cálculo automático`
- El JG puede corregir cualquier noche y agregar voluntarios no citados
- No requiere justificación, pero guarda quién hizo el cambio y cuándo

### Regla de conteo de noches
## Sprints

| Sprint | HUs | Qué construir |
|--------|-----|---------------|
| 1 | HU-48 a HU-51 | ✅ Infra base (repo, schema, workspace) — COMPLETADO |
| 2 | HU-01 a HU-06 | Auth JWT end-to-end |
| 3 | HU-07 a HU-16 | CRUD Voluntarios (QUINCE + CONFEDERADO), roles, carros |
| 4 | HU-17 a HU-23 | Turnos, citaciones, panel de camas |
| 5 | HU-24 a HU-33 | Permisos, roles nocturnos, licencias |
| 6 | HU-34 a HU-41 | Libro de guardia, overrides, estadísticas, documentos |
| 7 | HU-42 a HU-47 | Pauta CBS, calendario conductores |

## Estado actual
- Sprint 1 completado: monorepo inicializado, schema Prisma validado
- Próximo: Sprint 2 — Auth
