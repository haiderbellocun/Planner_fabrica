# Plan de implementación – Planning v1 (Fábrica de Contenidos)

**Contexto:** SaaS interno React/Vite TS + Express + Postgres + JWT (roles: admin, project_leader, user). Existen `/api/reports/team-capacity` y `leader_cargo_scope` para foco del líder. Objetivo: capacity editable + forecast 8–12 semanas + asignaciones + time off + escenarios de headcount.

---

## 1. Estructura de backend propuesta

```
server/src/
├── config/
│   └── database.ts
├── domain/
│   ├── types.ts          # Entidades y enums (Profile, Capacity, TimeOff, etc.)
│   └── dtos.ts           # Request/Response DTOs (PayloadCapacity, ResponseTeamCapacity, etc.)
├── validators/
│   ├── capacityValidator.ts
│   ├── forecastValidator.ts
│   ├── timeOffValidator.ts
│   └── index.ts
├── repositories/
│   ├── profilesRepository.ts   # getById, updateCapacity
│   ├── capacityRepository.ts   # datos para team-capacity y forecast (queries pesadas)
│   ├── timeOffRepository.ts   # CRUD time_off
│   └── tasksRepository.ts     # list by assignee/status para forecast
├── services/
│   ├── capacityService.ts      # lógica PATCH capacity + validación negocio
│   ├── forecastService.ts      # cálculo semanas 1..N, agregar por profile
│   ├── timeOffService.ts       # crear/actualizar/eliminar ausencias
│   └── headcountService.ts     # simulación capacidad por cargo
├── controllers/
│   ├── profilesController.ts   # GET /, GET /:id, PATCH /:id/capacity (delgado)
│   ├── reportsController.ts    # existente; puede llamar forecastService para nuevo endpoint
│   ├── planningController.ts   # GET forecast, (Sprint 2) time_off, headcount
│   └── ...
├── middleware/
│   ├── auth.ts
│   └── permissions.ts          # requireAdmin, requireProjectLeaderOrAdmin, scopeByLeaderCargo
├── routes/
│   ├── profiles.ts
│   ├── reports.ts
│   ├── planning.ts             # nuevo: forecast, time_off, headcount
│   └── ...
└── index.ts
```

- **Controllers:** solo parsean `req`/`res`, llaman a **services** y devuelven status + body.
- **Services:** orquestan repos y reglas de negocio; no conocen Express.
- **Repositories:** ejecutan `query()` y mapean filas a tipos de dominio/DTOs.
- **Validators:** validan body/query (ej. con express-validator o Zod); se usan en routes antes del controller.

---

## 2. Contratos TypeScript (DTOs)

Definir en `server/src/domain/dtos.ts` (y opcionalmente espejo en `src/types/api.ts` en frontend para tipos de peticiones/respuestas).

```ts
// --- Capacity (Sprint 1) ---
export interface PatchCapacityBody {
  weekly_hours_capacity: number; // >= 0, <= 168
}

// --- Forecast (Sprint 1) ---
export interface ForecastWeekDto {
  week_start: string;       // YYYY-MM-DD (lunes)
  week_end: string;         // YYYY-MM-DD (domingo)
  profile_id: string;
  profile_name: string;
  cargo: string | null;
  capacity_hours: number;  // capacidad efectiva (descontando time_off en Sprint 2)
  pending_hours: number;   // horas pendientes asignadas a ese perfil (snapshot o proyección)
  utilization_pct: number; // 0..n
}
export interface ForecastResponseDto {
  weeks: { week_start: string; week_end: string }[];
  by_profile: ForecastWeekDto[];
}

// --- Time off (Sprint 2) ---
export interface TimeOffCreateBody {
  profile_id: string;
  start_date: string;  // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  reason?: string;    // opcional: vacation, sick, other
}
export interface TimeOffDto {
  id: string;
  profile_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
}

// --- Headcount scenario (Sprint 2) ---
export interface HeadcountScenarioBody {
  cargo: string;           // rol a simular
  additional_fte: number;  // número de personas (1 = 1 FTE)
  weekly_hours_per_fte?: number; // default 40.25
}
export interface HeadcountScenarioResultDto {
  cargo: string;
  current_capacity_hours: number;
  current_pending_hours: number;
  added_capacity_hours: number;
  new_total_capacity_hours: number;
  new_utilization_pct: number;
}
```

Los DTOs de **team-capacity** ya existen de facto en el frontend (`CapacityMember`, `TeamCapacity` en `useReports.ts`); documentarlos en `domain/dtos.ts` como `TeamCapacityMemberDto` y `TeamCapacityResponseDto` para alinear backend al mismo contrato.

---

## 3. Sprint 1 (1–2 semanas): Capacity editable + Forecast v0

### Ticket S1.1 – PATCH /api/profiles/:id/capacity (solo admin)

**Objetivo:** Permitir a un admin actualizar la capacidad semanal de un perfil. El frontend (Settings) ya llama a este endpoint; actualmente no existe en backend.

**Criterios de aceptación:**
- Solo usuario con rol `admin` puede llamar al endpoint.
- Body válido: `{ weekly_hours_capacity: number }` con valor >= 0 y <= 168.
- Si el perfil no existe → 404.
- Tras actualizar, la respuesta es 200 con el perfil actualizado (incluyendo `weekly_hours_capacity`).
- GET /api/reports/team-capacity sigue devolviendo el nuevo valor en cada miembro.

**DB:**
- Sin migración nueva; se usa la columna existente `public.profiles.weekly_hours_capacity` (NUMERIC(5,2)).

**Endpoint:**
- **Método:** PATCH  
- **Ruta:** `/api/profiles/:id/capacity`  
- **Headers:** `Authorization: Bearer <token>`  
- **Body:** `{ "weekly_hours_capacity": 38.5 }`  
- **Response 200:** `{ "id": "uuid", "full_name": "...", "cargo": "...", "weekly_hours_capacity": 38.5, ... }` (mismos campos que GET /api/profiles/:id más `weekly_hours_capacity`).  
- **Response 400:** `{ "error": "weekly_hours_capacity debe ser un número entre 0 y 168" }`  
- **Response 403:** `{ "error": "Solo administradores pueden editar la capacidad" }`  
- **Response 404:** `{ "error": "Profile not found" }`

**Permisos:**
- `admin`: permitido.  
- `project_leader` y `user`: 403.

**Backend:**
- **Validators:** `validators/capacityValidator.ts`: validar body (number, min 0, max 168).  
- **Repositories:** `profilesRepository.updateCapacity(id, value)` → `UPDATE profiles SET weekly_hours_capacity = $1, updated_at = now() WHERE id = $2 RETURNING *`.  
- **Services:** `capacityService.updateCapacity(profileId, value)` comprueba que value esté en rango (delegar a validator), llama a `profilesRepository.updateCapacity`.  
- **Controllers:** `profilesController.patchCapacity` (auth + requireAdmin), lee body, llama `capacityService.updateCapacity`, devuelve perfil.  
- **Routes:** en `profiles.ts` añadir `router.patch('/:id/capacity', requireAdmin, validatePatchCapacity, patchCapacity)`.

**Frontend:**
- Sin cambios; Settings ya envía PATCH y usa `useReportTeamCapacity` con invalidate después de guardar.

**Validaciones y errores:**
- Body vacío o no JSON → 400.  
- `weekly_hours_capacity` ausente, no número, NaN, < 0 o > 168 → 400 con mensaje claro.  
- id no UUID o inválido → 400.

**Tests mínimos:**
- Unit: `capacityService.updateCapacity` con valor válido devuelve perfil; con valor inválido lanza o devuelve error.  
- Unit: `profilesRepository.updateCapacity` actualiza fila y retorna fila.  
- Integration: PATCH con token admin y body válido → 200 y valor persistido; PATCH con token project_leader → 403; PATCH con body inválido → 400.

---

### Ticket S1.2 – GET /api/planning/forecast (forecast v0, 8–12 semanas)

**Objetivo:** Exponer un forecast de capacidad vs carga por perfil y por semana durante las próximas 8–12 semanas, sin time off ni asignaciones dinámicas (v0 = snapshot de pendientes actuales repartido por semanas).

**Criterios de aceptación:**
- Parámetro `weeks` (opcional, default 8): número de semanas a proyectar (entre 8 y 12).
- Para cada semana (lunes a domingo) y cada perfil con tareas pendientes (o todos los del equipo según scope): capacidad semanal del perfil (`weekly_hours_capacity`), horas pendientes “asignadas” a esa semana (v0: reparto simple por `estimated_work_days` desde hoy, o proporcional).
- Respuesta incluye lista de semanas (week_start, week_end) y por perfil/semana: capacity_hours, pending_hours, utilization_pct.
- Admin ve todos los perfiles con tareas; project_leader solo perfiles cuyo `cargo` está en su `leader_cargo_scope`; user 403.

**DB:**
- Sin migraciones nuevas. Se usan `profiles`, `tasks`, `task_statuses`, `task_material_assignees` (horas_estimadas), `leader_cargo_scope`.

**Endpoint:**
- **Método:** GET  
- **Ruta:** `/api/planning/forecast`  
- **Query:** `?weeks=8` (opcional; 8–12, default 8).  
- **Response 200:**  
  ```json
  {
    "weeks": [
      { "week_start": "2025-02-24", "week_end": "2025-03-02" },
      ...
    ],
    "by_profile": [
      {
        "week_start": "2025-02-24",
        "week_end": "2025-03-02",
        "profile_id": "uuid",
        "profile_name": "Nombre",
        "cargo": "Rol",
        "capacity_hours": 40.25,
        "pending_hours": 20.5,
        "utilization_pct": 51
      },
      ...
    ]
  }
  ```
- **Response 403:** `{ "error": "Solo admin o project leader pueden ver el forecast" }`

**Permisos:**
- `admin`: todos los perfiles que tengan tareas pendientes (o todos los perfiles del equipo, según definición de “equipo”: p. ej. perfiles con al menos una tarea asignada).  
- `project_leader`: mismos perfiles pero filtrados por `leader_cargo_scope` (assignee.cargo IN scope).  
- `user`: 403.

**Backend:**
- **Validators:** `forecastValidator`: query `weeks` opcional, number, 8–12.  
- **Repositories:** `capacityRepository` o `forecastRepository`:  
  - Obtener perfiles en scope (admin: todos con tareas; leader: cargo IN leader_cargo_scope).  
  - Por perfil: `weekly_hours_capacity`, suma de `pending_horas` (desde lógica tipo team-capacity).  
  - Para v0: reparto de esas horas pendientes por semana de forma simple (ej. lineal por estimated_work_days desde hoy, o todo en la primera semana). Documentar en ticket: “v0 = reparto proporcional por semana según estimated_work_days”.  
- **Services:** `forecastService.getForecast(weeks)` genera lista de semanas (lunes a domingo), para cada (semana, perfil) calcula capacity_hours = weekly_hours_capacity, pending_hours = por reparto v0, utilization_pct = round(pending/capacity*100).  
- **Controllers:** `planningController.getForecast` (auth + requireProjectLeaderOrAdmin), lee query, llama service, devuelve DTO.  
- **Routes:** crear `planning.ts` con `router.get('/forecast', requireProjectLeaderOrAdmin, validateForecastQuery, getForecast)`. Montar en index: `app.use('/api/planning', planningRoutes)`.

**Frontend:**
- Nuevo hook: `usePlanningForecast(weeks?: number)` → `useQuery(['planning-forecast', weeks], () => api.get<ForecastResponseDto>(\`/api/planning/forecast?weeks=${weeks}\`)`.  
- Nueva sección en **Reportes → Equipo** (o nueva pestaña “Forecast”): tabla o cards por semana mostrando por perfil capacity_hours, pending_hours, utilization_pct; selector de “semanas” (8/10/12).  
- Tipos: definir `ForecastWeek`, `ForecastByProfile` en `src/types/api.ts` o en useReports según convención del proyecto.

**Validaciones y errores:**
- `weeks` no número o fuera de 8–12 → 400.  
- Sin token → 401; rol no autorizado → 403.

**Tests mínimos:**
- Unit: `forecastService.getForecast(8)` devuelve 8 semanas y by_profile con campos correctos.  
- Integration: GET con admin → 200 y estructura correcta; GET con user → 403.

---

### Ticket S1.3 – Refactor: estructura services/repositories para capacity y reports

**Objetivo:** Introducir capa service/repository para capacidad y reportes sin cambiar comportamiento actual, para que S1.1 y S1.2 queden integrados en la misma arquitectura.

**Criterios de aceptación:**
- Existen `profilesRepository`, `capacityRepository` (o `reportsRepository`) con funciones usadas por team-capacity y por forecast.  
- `reportsController.getTeamCapacity` delega en un `capacityService.getTeamCapacity()` que a su vez usa repository para la query actual.  
- Respuesta de GET /api/reports/team-capacity sigue siendo idéntica (misma forma de members, schedule, risk_level, etc.).  
- PATCH capacity usa `capacityService` + `profilesRepository` como en S1.1.

**DB / Endpoints:**
- Sin cambios de contrato.

**Permisos:**
- Sin cambios.

**Backend:**
- Extraer la query SQL de `getTeamCapacity` a `capacityRepository.getTeamCapacityRaw()` o similar; mapear rows a DTO en repository o en service.  
- `capacityService.getTeamCapacity()` llama al repository y aplica la lógica de risk_level, capacity_gap_hours, etc. (la que hoy está en el controller).  
- Controller solo llama `capacityService.getTeamCapacity()` y envía el resultado.  
- Opcional: mover DTOs de team-capacity a `domain/dtos.ts`.

**Frontend:**
- Ninguno.

**Tests mínimos:**
- Integration: GET /api/reports/team-capacity antes y después del refactor devuelve el mismo JSON para los mismos datos.

---

### Ticket S1.4 – Middleware requireAdmin y requireProjectLeaderOrAdmin

**Objetivo:** Centralizar comprobación de roles para reutilizar en PATCH capacity, GET forecast y futuros endpoints de planning.

**Criterios de aceptación:**
- `requireAdmin(req, res, next)`: si `req.user.role !== 'admin'` → 403, si no next().  
- `requireProjectLeaderOrAdmin(req, res, next)`: si rol es `project_leader` o `admin` → next(), si no 403.  
- Se usan en `profiles.ts` (PATCH capacity) y en `planning.ts` (GET forecast).

**Implementación:**
- Añadir en `middleware/permissions.ts`: `requireAdmin`, `requireProjectLeaderOrAdmin`.  
- Asegurar que `authMiddleware` ya haya poblado `req.user` (incluyendo `role`).

**Tests mínimos:**
- Unit o integration: request con role admin pasa requireAdmin; con project_leader falla requireAdmin pero pasa requireProjectLeaderOrAdmin; con user falla ambos.

---

## 4. Sprint 2 (2–4 semanas): Assignments + time off + headcount scenarios

### Ticket S2.1 – Tabla y CRUD de time off (ausencias)

**Objetivo:** Registrar ausencias por perfil y rango de fechas para que el forecast y la capacidad efectiva por semana puedan descontar horas.

**Criterios de aceptación:**
- Un admin o project_leader puede crear/editar/eliminar registros de ausencia para un perfil.  
- project_leader solo puede para perfiles bajo su scope (assignee.cargo IN leader_cargo_scope).  
- Campos: profile_id, start_date, end_date, reason (opcional).  
- No solapamiento: no se permiten dos registros que se solapen para el mismo profile_id (validación en service).  
- GET lista time offs (filtro por profile_id o por rango de fechas).

**DB – Migración:**
```sql
-- database/add_time_off.sql
CREATE TABLE IF NOT EXISTS public.time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT time_off_end_after_start CHECK (end_date >= start_date)
);
CREATE INDEX idx_time_off_profile_id ON public.time_off (profile_id);
CREATE INDEX idx_time_off_dates ON public.time_off (start_date, end_date);
COMMENT ON TABLE public.time_off IS 'Ausencias por perfil para ajustar capacidad efectiva en forecast';
```

**Endpoints:**
- **GET** `/api/planning/time-off?profile_id=uuid` o `?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  - Response 200: `{ "items": [ TimeOffDto, ... ] }`.  
  - Permisos: admin ve todo; project_leader solo items cuyo profile_id tiene cargo en su scope.  
- **POST** `/api/planning/time-off`  
  - Body: `TimeOffCreateBody`.  
  - Response 201: `TimeOffDto`.  
  - Validación: end_date >= start_date; no solapamiento con otros time_off del mismo profile_id.  
  - Permisos: admin para cualquier profile_id; project_leader solo si profile en scope.  
- **PATCH** `/api/planning/time-off/:id`  
  - Body: `{ start_date?, end_date?, reason? }`.  
  - Misma validación de fechas y solapamiento.  
  - Permisos: mismo que POST.  
- **DELETE** `/api/planning/time-off/:id`  
  - Response 204.  
  - Permisos: mismo que POST.

**Backend:**
- `timeOffRepository`: create, update, delete, listByProfile, listByDateRange; checkOverlap(profileId, start, end, excludeId?).  
- `timeOffService`: reglas de negocio (solapamiento, scope leader).  
- `timeOffValidator`: body con fechas YYYY-MM-DD, end >= start.  
- `planningController`: getTimeOff, createTimeOff, updateTimeOff, deleteTimeOff.  
- Scope leader: en service, si role === project_leader, obtener lista de profile_ids con cargo en leader_cargo_scope y filtrar que time_off.profile_id IN esa lista (para GET) y que body.profile_id esté en esa lista (para POST/PATCH).

**Frontend:**
- Hook `useTimeOff(profileId?: string, from?: string, to?: string)` y `useTimeOffMutation()` (create/update/delete con invalidateQueries).  
- En **Settings** o **Reportes → Equipo**: sección “Ausencias” (por perfil o global según UX): tabla con start_date, end_date, reason y botones editar/eliminar; formulario para crear. Solo visible para admin y project_leader.

**Tests mínimos:**
- Unit: timeOffService rechaza creación con fechas solapadas.  
- Integration: POST con admin → 201; POST con project_leader para profile fuera de scope → 403; GET con project_leader solo devuelve items en scope.

---

### Ticket S2.2 – Forecast v1: descontar capacidad por time off

**Objetivo:** En GET /api/planning/forecast, la capacidad por semana y perfil debe ser la capacidad semanal del perfil menos las horas de ausencia en esa semana (según time_off).

**Criterios de aceptación:**
- Para cada (perfil, semana): capacity_hours = weekly_hours_capacity * (días laborables no ausentes / 5) o equivalente en horas (ej. descontar días completos de time_off en esa semana).  
- Si un time_off cubre parcialmente una semana, descontar solo las horas/días afectados.  
- Respuesta mantiene la misma estructura; solo cambia el valor de capacity_hours (y por tanto utilization_pct).

**DB:**
- Sin migración nueva; se usa tabla `time_off` de S2.1.

**Endpoint:**
- Mismo GET /api/planning/forecast; respuesta con capacity_hours ya descontando ausencias.

**Backend:**
- `forecastService.getForecast(weeks)`: al calcular capacity_hours por (profile, week), llamar a `timeOffRepository.getHoursOffInWeek(profileId, weekStart, weekEnd)` o similar y restar de weekly_hours_capacity (proporcional a días laborables).  
- Definir regla: “días laborables” = lunes a viernes; si un time_off cubre 2 días de esa semana, capacity_hours = weekly_hours_capacity * (3/5) para esa semana.

**Frontend:**
- Sin cambios de contrato; puede mostrarse un indicador “con ausencias” si se desea (opcional).

**Tests mínimos:**
- Unit: con un time_off de 2 días en una semana, capacity_hours de ese perfil esa semana es (3/5)*weekly_hours_capacity.  
- Integration: GET forecast con time_off creado devuelve capacity_hours reducido en las semanas afectadas.

---

### Ticket S2.3 – Reasignación masiva de tareas (assignments)

**Objetivo:** Permitir a un project_leader o admin reasignar tareas pendientes de un perfil a otro (bulk), para balancear carga sin editar tarea a tarea.

**Criterios de aceptación:**
- Endpoint: POST /api/planning/reassign con body `{ from_profile_id: string, to_profile_id: string, task_ids: string[] }`.  
- Solo tareas no completadas; solo tareas que actualmente tienen assignee_id = from_profile_id (o que están en task_material_assignees con from_profile_id).  
- project_leader solo puede reasignar tareas de perfiles en su leader_cargo_scope y hacia perfiles en su scope.  
- Respuesta indica cuántas tareas se reasignaron y eventualmente las que se ignoraron (no encontradas o ya completadas).

**DB:**
- Sin migración nueva. Se actualizan `tasks.assignee_id` y/o `task_material_assignees.assignee_id` según modelo actual (si una tarea tiene solo assignee en tasks, actualizar tasks; si usa material assignees, actualizar task_material_assignees para esas tareas).

**Endpoint:**
- **POST** `/api/planning/reassign`  
  - Body: `{ "from_profile_id": "uuid", "to_profile_id": "uuid", "task_ids": ["uuid", ...] }`  
  - Response 200: `{ "reassigned": 5, "skipped": 2, "skipped_reasons": { "task_id": "not_found" | "not_assignee" | "completed" } }` (o similar).  
  - 403 si rol no autorizado o scope no permite from/to.  
  - 400 si from_profile_id === to_profile_id o task_ids vacío.

**Permisos:**
- admin: cualquier from/to (perfiles existentes).  
- project_leader: from y to deben tener cargo en leader_cargo_scope.  
- user: 403.

**Backend:**
- `tasksRepository`: getTasksByIds, updateAssignee(taskId, newAssigneeId); o actualizar también task_material_assignees según reglas del dominio.  
- `planningService.reassign(from, to, taskIds)`: filtrar tareas que pertenecen a from y no están completadas; aplicar update; devolver conteos.  
- Validator: from_profile_id, to_profile_id UUIDs, task_ids array no vacío.  
- Scope: en service, si project_leader, validar que from y to estén en scope (consulta leader_cargo_scope y perfiles).

**Frontend:**
- En **Reportes → Equipo** o en **Mis Tareas / Detalle de proyecto**: modal o sección “Reasignar tareas”: selector “De (perfil)” / “A (perfil)” y lista de task_ids (o selección por checklist). Botón “Reasignar”.  
- Hook `useReassignMutation()` con invalidateQueries para tasks, team-capacity, forecast.  
- Toast éxito/error según response.

**Tests mínimos:**
- Unit: planningService.reassign filtra tareas completadas y no asignadas a from.  
- Integration: POST con admin reasigna y devuelve reassigned correcto; POST con project_leader y to fuera de scope → 403.

---

### Ticket S2.4 – Headcount scenarios (simulación de capacidad por cargo)

**Objetivo:** Endpoint que simula “si agrego N FTE de cargo X, ¿cómo cambia la utilización?” usando la capacidad actual del cargo y la pendiente actual.

**Criterios de aceptación:**
- POST /api/planning/headcount-scenario con body `{ cargo: string, additional_fte: number, weekly_hours_per_fte?: number }`.  
- Cálculo: capacidad actual del cargo = suma de weekly_hours_capacity de perfiles con ese cargo; pending actual del cargo = suma de pending_horas de esos perfiles (misma lógica que workload-by-cargo o team-capacity por cargo).  
- Añadir additional_fte * (weekly_hours_per_fte ?? 40.25) a la capacidad.  
- Response: current_capacity_hours, current_pending_hours, added_capacity_hours, new_total_capacity_hours, new_utilization_pct.  
- Solo admin o project_leader; project_leader solo para cargos en su leader_cargo_scope.

**DB:**
- Sin migración; se usan profiles (cargo, weekly_hours_capacity) y la misma fuente de pending_horas que team-capacity (tasks + task_material_assignees).

**Endpoint:**
- **POST** `/api/planning/headcount-scenario`  
  - Body: `HeadcountScenarioBody`  
  - Response 200: `HeadcountScenarioResultDto`  
  - 403 si project_leader y cargo no está en su scope.  
  - 400 si additional_fte < 0 o cargo vacío.

**Backend:**
- `headcountService.runScenario(cargo, additionalFte, hoursPerFte)`: obtener por cargo suma de capacity y suma de pending (reutilizar lógica de reports o repository); calcular new capacity y new utilization.  
- `planningController.postHeadcountScenario` con validación de scope para project_leader.

**Frontend:**
- En **Reportes → Equipo** o nueva pestaña “Headcount”: formulario cargo + número de FTE + opcional horas/semana; botón “Simular”. Mostrar resultado (capacidad actual vs nueva, utilización actual vs nueva).  
- Hook `useHeadcountScenario()` como mutation con body.

**Tests mínimos:**
- Unit: headcountService con additional_fte=1 y hoursPerFte=40.25 incrementa capacidad en 40.25 y utilization_pct baja.  
- Integration: POST con cargo existente → 200 y números coherentes; POST con project_leader y cargo fuera de scope → 403.

---

### Ticket S2.5 – Documentar DTOs y alinear frontend/backend

**Objetivo:** Tener un único lugar de verdad para los contratos de planning (forecast, time_off, headcount, capacity) y que el frontend use tipos compatibles.

**Criterios de aceptación:**
- `server/src/domain/dtos.ts` contiene todos los DTOs de planning y capacity.  
- Frontend importa tipos desde un archivo compartido (ej. `src/types/planning.ts`) o se documentan en un README los payloads/response para que los tipos de React Query coincidan.  
- No hay cambios de comportamiento; solo tipos y documentación.

**Entregable:**
- Actualizar `domain/dtos.ts` con todos los DTOs usados en S1 y S2.  
- Añadir en frontend `src/types/planning.ts` (o similar) con interfaces que reflejen esos DTOs para usePlanningForecast, useTimeOff, useReassignMutation, useHeadcountScenario.

---

## 5. Resumen de migraciones SQL

| Ticket | Archivo migración | Descripción |
|--------|-------------------|-------------|
| S1.1   | (ninguna)         | Usa `profiles.weekly_hours_capacity` existente. |
| S1.2   | (ninguna)         | Solo lecturas. |
| S2.1   | `database/add_time_off.sql` | Tabla `time_off` (profile_id, start_date, end_date, reason). |

---

## 6. Resumen de endpoints nuevos/modificados

| Método | Ruta | Sprint | Permisos |
|--------|------|--------|----------|
| PATCH  | /api/profiles/:id/capacity | S1 | admin |
| GET    | /api/planning/forecast?weeks=8 | S1 | admin, project_leader (scope) |
| GET    | /api/planning/time-off?profile_id=&from=&to= | S2 | admin, project_leader (scope) |
| POST   | /api/planning/time-off | S2 | admin, project_leader (scope) |
| PATCH  | /api/planning/time-off/:id | S2 | admin, project_leader (scope) |
| DELETE | /api/planning/time-off/:id | S2 | admin, project_leader (scope) |
| POST   | /api/planning/reassign | S2 | admin, project_leader (scope) |
| POST   | /api/planning/headcount-scenario | S2 | admin, project_leader (scope) |

---

## 7. Orden sugerido de implementación

**Sprint 1:**  
1. S1.4 (middleware)  
2. S1.1 (PATCH capacity)  
3. S1.3 (refactor services/repos para capacity/reports)  
4. S1.2 (GET forecast v0)

**Sprint 2:**  
1. S2.1 (time_off CRUD)  
2. S2.2 (forecast v1 con time off)  
3. S2.3 (reassign)  
4. S2.4 (headcount scenario)  
5. S2.5 (DTOs y tipos frontend)

Este documento sirve como backlog priorizado y como especificación por ticket para desarrollar Planning v1 (capacity editable + forecast 8–12 semanas + assignments + time off + headcount) sin inventar features no descritas y manteniendo arquitectura limpia (services puros, controllers delgados, validators y repositorios separados).
