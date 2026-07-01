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
- Orden de creación por módulo: schema → DTO → Service → Controller → Module

## Dominio

### Tipos de Voluntario
- **QUINCE**: correlativo 1–999, único para siempre aunque se vaya
- **CONFEDERADO**: correlativo 1000+, reutilizable si el voluntario queda inactivo
- Ambos tipos tienen la misma participación operativa
- El `id` interno es siempre cuid(), el correlativo es solo campo de negocio
- Constraints en SQL raw (Prisma no soporta unique parciales nativamente):
  - `CREATE UNIQUE INDEX vol_correlativo_quince ON "Voluntario"(correlativo) WHERE tipo = 'QUINCE'`
  - `CREATE UNIQUE INDEX vol_correlativo_confederado_activo ON "Voluntario"(correlativo) WHERE tipo = 'CONFEDERADO' AND activo = true`

### Roles del sistema
- `ADMIN` — acceso total
- `JEFE_GUARDIA` — gestiona citaciones, aprueba permisos, hace overrides, genera documentos
- `GUARDIAN` — solicita permisos, ve su información
- `CONDUCTOR` — ve calendario y pauta CBS
- `OFICIALIDAD` — cargo jerárquico interno

### Reglas de permisos
- `PERMISO` → llega tarde pero duerme → **cuenta** en estadísticas
- `PERMISO_ESPECIAL` → no llega → **no cuenta**
- `REEMPLAZO` → titular no llega, reemplazante duerme → **cuenta para el reemplazante, no para el titular**
- `LICENCIA` → no llega → **no cuenta**
- No se puede pedir permiso para mañana después de las 20:00
- Solo se puede pedir permiso si existe una citación para esa fecha

### Regla de conteo de noches (estadísticas)
### Overrides (Libro de Guardia)
- Modelo `CorreccionNoche(fecha, voluntarioId, durmio, autorId, creadoEn)`
- Solo JG y Admin pueden hacer overrides
- El JG puede agregar voluntarios no citados esa noche
- No requiere justificación, pero guarda quién hizo el cambio y cuándo
- El override pisa completamente el cálculo automático para ese par (fecha, voluntario)

## Matriz de acceso por endpoint

| Endpoint | Admin | JefeGuardia | Guardian | Conductor |
|----------|-------|-------------|----------|-----------|
| POST /citaciones | ✓ | ✓ | — | — |
| POST /permisos | ✓ | ✓ | ✓ | — |
| PATCH /permisos/:id/estado | ✓ | ✓ | — | — |
| POST /libro-guardia/override | ✓ | ✓ | — | — |
| GET /voluntarios/:id/historial | ✓ | ✓ | — | — |
| GET /estadisticas/noches | ✓ | ✓ | — | — |
| GET /documentos/libro-guardia | ✓ | ✓ | — | — |
| GET /pauta | ✓ | ✓ | — | ✓ |
| GET /conductores/calendario | ✓ | ✓ | — | ✓ |
| GET /voluntarios | ✓ | ✓ | ✓ | ✓ |
| POST /voluntarios | ✓ | — | — | — |

## Historias de Usuario

### SPRINT 2 — Auth (HU-01 a HU-06)

**HU-01 — Login con JWT**
Como usuario quiero iniciar sesión con mis credenciales y recibir access y refresh token.
- POST /auth/login con { username, password }
- Retorna { data: { accessToken, user: { id, nombre, roles, correlativo, tipo } } }
- Access token JWT firmado, expiración 15min
- Refresh token guardado en tabla RefreshToken, enviado en cookie HttpOnly Secure SameSite=Strict, expiración 7d
- Si credenciales inválidas → 401 "Credenciales incorrectas"

**HU-02 — Renovar access token**
Como cliente frontend quiero renovar el access token sin que el usuario vuelva a loguearse.
- POST /auth/refresh (la cookie se envía automáticamente)
- Valida que el refresh token exista, no esté revocado y no haya expirado
- Rota el token: marca el anterior como revocado, crea uno nuevo
- Retorna { data: { accessToken } } y Set-Cookie con nuevo refresh token
- Si token inválido → 401 "Sesión expirada"

**HU-03 — Logout seguro**
Como usuario quiero cerrar sesión y que mis tokens queden invalidados.
- POST /auth/logout
- Marca el refresh token como revocado en DB
- Limpia la cookie del cliente
- Retorna { data: { message: "Sesión cerrada correctamente" } }

**HU-04 — Middleware de autenticación**
Como sistema quiero validar el JWT en cada request protegido.
- JwtAuthGuard verifica firma y expiración del access token
- Extrae { sub, roles } y los expone en el contexto de la request
- Si token inválido o expirado → 401 "No autorizado"
- Si token ausente → 401 "Token requerido"

**HU-05 — Control de acceso por rol (RBAC)**
Como sistema quiero restringir endpoints según el rol del usuario.
- Decorator @Roles(...RolSistema[]) aplicable a cualquier endpoint
- RolesGuard lee los roles del JWT y compara con los requeridos
- Si el rol no coincide → 403 "No tienes permisos para realizar esta acción"

**HU-06 — Contexto de usuario en frontend**
Como frontend quiero obtener los datos del usuario logueado para personalizar la UI.
- GET /auth/me (requiere JwtAuthGuard)
- Retorna { data: { id, nombres, apellidoP, roles, correlativo, tipo } }
- En el frontend: Zustand store con { user, accessToken, setAuth, clearAuth }
- Cliente HTTP en lib/api.ts adjunta Bearer token automáticamente
- Si recibe 401 intenta renovar con /auth/refresh antes de redirigir al login

---

### SPRINT 3 — Voluntarios (HU-07 a HU-16)

**HU-07 — Listar voluntarios**
- GET /voluntarios?page=1&limit=20&search=&tipo=QUINCE|CONFEDERADO&activo=true
- Retorna { data: Voluntario[], meta: { total, page, limit, totalPages } }
- Búsqueda por nombres, apellidos o correlativo
- Ordenado por correlativo ascendente

**HU-08 — Detalle de voluntario**
- GET /voluntarios/:id
- Retorna voluntario con roles, carrosHabilitados y oficialidad incluidos

**HU-09 — Crear voluntario de la 15a**
- POST /voluntarios con tipo=QUINCE
- Correlativo en rango 1-999, validado contra unique index permanente
- Al crear se genera User automáticamente con username=correlativo y passwordHash=bcrypt(rut+rutDigito)
- Retorna { data: Voluntario }
- Si correlativo ya existe → 409 "El correlativo ya está en uso"

**HU-10 — Crear voluntario confederado**
- POST /voluntarios con tipo=CONFEDERADO
- Correlativo >= 1000, validado contra unique parcial (solo activos)
- Mismo flujo de creación de User que HU-09
- Si correlativo ya está en uso por un confederado activo → 409

**HU-11 — Editar voluntario**
- PATCH /voluntarios/:id con campos opcionales
- El correlativo NO es editable post-creación
- El tipo NO es editable post-creación
- Retorna { data: Voluntario } actualizado

**HU-12 — Desactivar voluntario confederado**
- PATCH /voluntarios/:id/desactivar
- Solo aplicable a tipo=CONFEDERADO
- Setea activo=false, libera el correlativo para reasignación
- El id interno y todo el historial se conservan
- Si es tipo=QUINCE → 400 "Los voluntarios de la 15a no se pueden desactivar"

**HU-13 — Gestión de roles del sistema**
- PATCH /voluntarios/:id/roles con { roles: RolSistema[] }
- Reemplaza todos los roles actuales con los nuevos (upsert completo)
- Solo ADMIN puede ejecutar este endpoint
- Retorna { data: { roles: RolSistema[] } }

**HU-14 — Gestión de Oficialidad**
- POST /oficialidad con { voluntarioId, cargo }
- Un voluntario solo puede tener un cargo de oficialidad
- DELETE /oficialidad/:id elimina el cargo
- GET /oficialidad retorna todos los cargos con voluntario incluido

**HU-15 — Gestión de Cuarteleros CBS**
- CRUD /cuarteleros
- Campos: nombre, clave (C-1|C-2|C-3), nacimiento, fechaIngreso, vigente
- GET /cuarteleros?vigente=true filtra por vigencia

**HU-16 — Gestión de Carros**
- CRUD /carros
- POST /carros/:id/voluntarios con { voluntarioIds[] } asigna voluntarios habilitados
- POST /carros/:id/cuarteleros con { cuarteleroIds[] } asigna cuarteleros habilitados
- DELETE /carros/:id/voluntarios/:voluntarioId elimina habilitación

---

### SPRINT 4 — Citaciones y Panel de Camas (HU-17 a HU-23)

**HU-17 — CRUD Turnos de Guardia**
- POST /turnos con { nombre, voluntarioIds[] }
- GET /turnos retorna lista con voluntarios incluidos
- PATCH /turnos/:id actualiza nombre e integrantes
- DELETE /turnos/:id

**HU-18 — Listar turnos con integrantes**
- GET /turnos retorna [{ id, nombre, voluntarios: [{ id, nombres, apellidoP, correlativo, tipo }] }]

**HU-19 — Crear citación semanal**
- POST /citaciones con { turnoId?, fechaInicio, fechaFin, camas: [{ numero, voluntarioId }] }
- fechaFin requerido para citación semanal
- Valida: sin solapamiento de fechas, sin duplicado de fechaInicio con fechaFin
- Crea registros en CamaAsignacion para cada cama
- Solo JEFE_GUARDIA y ADMIN

**HU-20 — Crear asignación diaria**
- POST /citaciones con { fechaInicio, camas: [...] } sin fechaFin
- Valida unicidad: solo una asignación por fechaInicio sin fechaFin

**HU-21 — Listar citaciones y asignaciones**
- GET /citaciones?tipo=citacion retorna las que tienen fechaFin
- GET /citaciones?tipo=asignacion retorna las que no tienen fechaFin
- Paginado, ordenado por fechaInicio desc

**HU-22 — Editar camas de una citación**
- PATCH /citaciones/:id/camas con [{ numero, voluntarioId }]
- Upsert en CamaAsignacion por (citacionId, numeroCama)
- Reemplaza solo las camas enviadas, no toca las demás

**HU-23 — Panel de camas para una noche**
- GET /citaciones/panel?fecha=YYYY-MM-DD
- Busca la citación que cubre esa fecha (fechaInicio <= fecha <= fechaFin, o fechaInicio = fecha si es asignación)
- Para cada cama retorna: { numeroCama, voluntarioTitular, voluntarioEfectivo, estado }
- Estado puede ser: NORMAL | PERMISO | PERMISO_ESPECIAL | REEMPLAZO | LICENCIA | OVERRIDE
- Aplica encadenamiento de reemplazos y overrides

---

### SPRINT 5 — Permisos, Roles Nocturnos y Licencias (HU-24 a HU-33)

**HU-24 — Solicitar permiso**
- POST /permisos con { tipo: PERMISO|PERMISO_ESPECIAL, fechaGuardia }
- Validaciones: fecha >= mañana, si es para mañana debe ser antes de las 20:00, debe existir citación para esa fecha, sin permiso duplicado pendiente
- El solicitante es el usuario autenticado

**HU-25 — Solicitar reemplazo**
- POST /permisos con { tipo: REEMPLAZO, fechaGuardia, reemplazanteId }
- Mismas validaciones que HU-24
- El reemplazante debe existir y estar activo

**HU-26 — Listar permisos**
- GET /permisos/mis → permisos del usuario autenticado
- GET /permisos → todos (solo JEFE_GUARDIA y ADMIN)
- Filtros: ?estado=PENDIENTE|APROBADO|RECHAZADO&desde=&hasta=

**HU-27 — Aprobar o rechazar permiso**
- PATCH /permisos/:id con { estado: APROBADO|RECHAZADO, comentarios? }
- Registra fechaCierre = now()
- Solo JEFE_GUARDIA y ADMIN

**HU-28 — Eliminar permiso**
- DELETE /permisos/:id
- Guardian solo puede eliminar los suyos si están PENDIENTES
- JEFE_GUARDIA y ADMIN pueden eliminar cualquiera

**HU-29 — Asignar Mensajero**
- PUT /guardia/mensajero con { fecha, voluntarioId }
- Upsert por fecha (único mensajero por noche)
- Solo JEFE_GUARDIA y ADMIN

**HU-30 — Asignar Conductor de guardia**
- PUT /guardia/conductores con { fecha, voluntarioIds[] }
- Diff: agrega y elimina según la lista enviada para esa fecha
- Solo JEFE_GUARDIA y ADMIN

**HU-31 — Asignar JG Subrogante**
- PUT /guardia/jgs con { fecha, voluntarioId }
- Upsert por fecha
- Solo JEFE_GUARDIA y ADMIN

**HU-32 — Registrar licencia por rango**
- POST /licencias con { voluntarioId, fechaInicio, fechaFin }
- Bulk insert: un registro por día en el rango
- Valida solapamiento con licencias existentes del mismo voluntario
- Solo JEFE_GUARDIA y ADMIN

**HU-33 — Listar y eliminar licencias**
- GET /licencias?voluntarioId= retorna licencias ordenadas desc
- DELETE /licencias/:id elimina un registro individual

---

### SPRINT 6 — Libro de Guardia, Overrides, Estadísticas y Documentos (HU-34 a HU-41)

**HU-34 — Vista propia del libro de guardia**
- Ruta web: /libro-de-guardia con selector de fecha
- Muestra panel de camas, roles nocturnos (mensajero, conductor, JGS) y overrides existentes
- Solo accesible para JEFE_GUARDIA y ADMIN
- Usa GET /citaciones/panel?fecha= como fuente de datos

**HU-35 — Override manual de cama**
- POST /libro-guardia/override con { fecha, voluntarioId, durmio: boolean }
- Crea o actualiza CorreccionNoche (@@unique fecha+voluntarioId)
- Guarda autorId = usuario autenticado y creadoEn = now()
- Puede aplicarse a voluntarios no citados esa noche
- Solo JEFE_GUARDIA y ADMIN

**HU-36 — Override de rol nocturno**
- Los endpoints PUT /guardia/mensajero, /guardia/conductores y /guardia/jgs
- No tienen restricción de fecha para JEFE_GUARDIA (pueden corregir fechas pasadas)

**HU-37 — Generar documento Word del libro**
- GET /documentos/libro-guardia?fecha=YYYY-MM-DD
- Genera .docx en memoria con: panel de camas con overrides aplicados, mensajero, conductores, JGS de esa noche
- Retorna stream descargable con Content-Disposition: attachment
- Solo JEFE_GUARDIA y ADMIN

**HU-38 — Historial de noches de un voluntario**
- GET /voluntarios/:id/historial?desde=&hasta=
- Aplica resolverNoche() para cada fecha en el rango
- Retorna { data: { detalle: [{ fecha, durmio, estado, fuente }], totales: { noches, permiso, permisoEspecial, reemplazoRecibido, licencia, override } } }
- Solo JEFE_GUARDIA y ADMIN

**HU-39 — Conteo de noches por citación**
- GET /citaciones/:id/conteo
- Para cada noche de la citación aplica resolverNoche() para cada voluntario citado
- Retorna [{ voluntario, nochesEfectivas }] ordenado desc

**HU-40 — Estadísticas por rango de fechas**
- GET /estadisticas/noches?desde=&hasta=&voluntarioId?=
- Rango libre para consultas de premios y beneficios
- Aplica resolverNoche() y reglas de conteo completas

**HU-41 — Generar Conteo (.docx)**
- GET /documentos/conteo?citacionId=
- Genera .docx en memoria con tabla de voluntarios y noches efectivas
- Retorna stream descargable

---

### SPRINT 7 — Pauta CBS y Calendario Conductores (HU-42 a HU-47)

**HU-42 — Cargar días libres CBS**
- POST /pauta con { cuarteleroId, fecha }
- Opcional: { cuarteleroId, fechaInicio, fechaFin } para bulk por rango

**HU-43 — Ver pauta del mes con estado diario**
- GET /pauta?mes=YYYY-MM&cuartelero=C-1
- Retorna array de días del mes con { fecha, libre: boolean }
- Incluye mesMin y mesMax disponibles en la BD

**HU-44 — Navegar entre meses en la pauta**
- El mes seleccionado se persiste en URL (?mes=YYYY-MM)
- Frontend: botones prev/next actualizan el query param

**HU-45 — Crear turno en calendario**
- POST /conductores/calendario con { voluntarioId, fechaInicio, fechaFin, carroIds[], observaciones? }
- Solo JEFE_GUARDIA y ADMIN

**HU-46 — Ver calendario de conductores**
- GET /conductores/calendario?mes=YYYY-MM&voluntarioId?=
- Retorna eventos del mes con carros incluidos
- CONDUCTOR solo puede ver los suyos, JEFE_GUARDIA ve todos

**HU-47 — Editar y eliminar turno**
- PATCH /conductores/calendario/:id
- DELETE /conductores/calendario/:id
- Solo JEFE_GUARDIA y ADMIN

---

## Estado actual
- Sprint 1 completado: monorepo inicializado, schema Prisma validado ✅
- Próximo: Sprint 2 — Auth (HU-01 a HU-06)
