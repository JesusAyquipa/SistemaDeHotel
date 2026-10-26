# PLAN — Sistema de Gestión de Reservas de Hotel

## Alcance actual
Backlog del equipo (Excel "Sprint Backlog", historias SHE-001 a SHE-026) más mejoras SHE-027 a SHE-039
(seguridad, operación de recepción, portal del cliente, calidad). Detalle por historia en el Excel
`HOTEL EXCEL - FINAL.xlsx` (fuera del repo).

Fuera de alcance (requieren cuentas o acceso del equipo): pasarela de pago real (Culqi/Mercado Pago),
envío a SUNAT (Nubefact), WhatsApp, almacenamiento S3/Cloudinary, Sentry, backups de TiDB, staging,
cambio de servidor web en Render.

## Estado (2026-10-26)
| Bloque | Estado | Verificación |
|---|---|---|
| Auditoría de seguridad y correcciones | Hecho | Tests backend |
| SHE-017, 020, 021, 023, 024, 025 | Hecho | Tests backend + frontend |
| SHE-027 a SHE-040 (numeración interna de la ronda 3) | Hecho | Tests backend, Vitest, Playwright |
| SHE-014 apertura/cierre de caja, SHE-015 historial, SHE-017 check-in en limpieza, SHE-018 días de semana, SHE-026 OTP | Hecho | 255 tests backend, 99 Vitest, 8 E2E |
| Correcciones de la auditoría de cajas/OTP | Hecho | Idem |
| Prueba manual en navegador contra backend real | **Pendiente (usuario)** | — |
| Migraciones en MySQL/TiDB | **Pendiente (usuario)** | Solo probadas en SQLite |

Decisiones tomadas (2026-10-26):
- Historial de cajas: se usa `/admin/cajas` (sesiones con apertura/cierre). Se quitó el historial duplicado de Reportes
  (el endpoint `/staff/reports/closures` sigue disponible solo para admin, sin pantalla).
- Se permite reservar como invitado: sin sesión, el checkout exige verificar el correo con un código de 6 dígitos (SHE-026).
  Requiere configurar `MAIL_*` en producción para que los códigos lleguen por correo.

## Ramas
- `fix/auditoria-seguridad`: rama de trabajo publicada (incluye todo lo anterior).
- `integ/backlog-pendientes`: integración local de la ronda 4 (se publica sobre `fix/auditoria-seguridad`).
- `feat/backlog-pendientes-backend|frontend`, `fix/auditoria-cajas-backend|frontend`: ramas de los agentes, unidas con `--no-ff`.

## Registro de modelos
| Tarea | Modelo | Cómo se sabe |
|---|---|---|
| Orquestación, integración, merges, corrección de test de montos (c4fcb61), Excel del sprint | Claude Opus 5.5 | Modelo de esta sesión |
| Rondas 1–3 (auditoría, correcciones, SHE-017..040) — subagentes `general-purpose` | Claude Opus 5.5 | Los subagentes heredan el modelo de la sesión (no se fijó otro) |
| SHE-014/015/017/018/026 backend (a89f00e, 90202d4, 3a1642e) | Claude Sonnet 5.5 | Agente `rol-backend`; firma de sus commits |
| SHE-014/015/018/026 frontend (ba68957, 35d824a, 0316378) | Claude Opus 5.5 | Agente `rol-frontend`; firma de sus commits |
| Auditoría ronda 4 | Claude Fable | Agente `rol-auditor` lanzado con `model: fable` |
| Correcciones backend de la auditoría (bc83977) | Claude Sonnet 5.5 | Agente `rol-backend`; firma del commit |
| Correcciones frontend de la auditoría (3f992c0, 1c94c0f) | Claude Opus 5.5 | Agente `rol-frontend`; firma de sus commits |
