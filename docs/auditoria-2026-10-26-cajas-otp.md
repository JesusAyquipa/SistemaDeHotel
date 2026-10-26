# Auditoría — ronda 4 (SHE-014, 015, 017, 018, 026) — 2026-10-26

**Revisor:** agente `rol-auditor` (Claude Fable), solo lectura, distinto de los autores (backend: Sonnet 5.5; frontend: Opus 5.5).
**Qué revisó:** diff de `feat/backlog-pendientes-backend` y `feat/backlog-pendientes-frontend` contra su base, y el conflicto con el
commit de Jesús `a38781b` (historial de cierres). Tres lentes: seguridad/datos, corrección, UX.

## Hallazgos y resolución
| # | Severidad | Hallazgo | Corrección | Commit |
|---|---|---|---|---|
| 1 | Alta | Los pagos se asignaban a cualquier caja abierta por ventana de tiempo: dos cajas simultáneas compartían cobros | `payments.cash_register_session_id`; los cobros del personal exigen caja abierta y se atribuyen a ella | bc83977 |
| 2 | Alta | Conflicto de merge con `a38781b` en `ReportController` | Resuelto conservando ambos bloques `use` | 2b64b3b |
| 3 | Media | Cobros hechos sin caja abierta nunca se concilian | 422 "Debes abrir caja antes de registrar cobros" | bc83977, 1c94c0f |
| 4 | Media | Total esperado distinto entre pantalla y servidor (otros medios) | Total a declarar = efectivo + tarjeta + otros | 1c94c0f |
| 5 | Media | Reenviar OTP invalidaba un token ya verificado | Solo se borran códigos pendientes (`token_hash IS NULL`) | bc83977 |
| 6 | Media | Usuario con token vencido quedaba bloqueado en el checkout | Ante 422 `requires_verification` se fuerza el paso de verificación | 3f992c0 |
| 7 | Baja | Paginación "Mostrando 0–0" | `meta.from/to` en backend y respaldo en frontend | bc83977, 1c94c0f |
| 8 | Baja | Filtro de empleados listaba clientes | `?role=admin,recepcionista` + filtro en cliente | bc83977, 1c94c0f |
| 9 | Baja (sospecha) | Zona horaria UTC por defecto en filtros de fecha | Sin cambio: `.env.example` define `APP_TIMEZONE=America/Lima`; verificar en Render | — |
| 10 | Baja | `/staff/reports/closures` visible para recepcionista | Movido al grupo solo admin | bc83977 |
| 11 | Baja | Botón de pago habilitado con token consumido | Deshabilitado hasta reverificar | 3f992c0 |

## Verificación posterior (ejecutada en la rama integrada `7ad11ba`)
- Backend: 255 tests, 1437 aserciones (SQLite en memoria, PHP 8.3).
- Frontend: lint sin errores, 99 tests Vitest, build correcto, 8 tests E2E Playwright (API simulada).

## Sin registro / no verificado
- Migraciones en MySQL/TiDB y su `down()`.
- Concurrencia real de `lockForUpdate` (SQLite no la ejerce).
- Flujo completo en navegador contra el backend real.
- Los pagos históricos del personal quedan sin sesión de caja (no hay backfill).
