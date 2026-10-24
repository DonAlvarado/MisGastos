# Arquitectura técnica de Mis Gastos

## Monorepositorio modular

- `apps/web`: React + TS; formularios, componentes, páginas, hooks, clientes de API.
- `apps/api`: Express + TS; rutas, middlewares, lógica de negocio, validación, Prisma.
- `apps/api/prisma/migrations`: histórico de cambios de estructura (se ejecuta una vez cada migración).
- `database/seed`: datos ficticios para desarrollo únicamente.
- `docs`: decisiones, PR y manuales.

## Arquitectura propuesta para ampliar por funcionalidades

Al crecer, crear `apps/api/src/modules/{auth,usuarios,categorias,movimientos,presupuestos,dashboard}/` con `routes.ts`, `controller.ts`, `service.ts`, `schemas.ts`. Los controladores reciben HTTP; los servicios aplican lógica, propiedad y reglas; Prisma se usa solo en servicios/repositorios. Para el frontend usar `src/{pages,components,features,services,hooks,types}`. El starter tiene menos archivos para no complejizar el inicio.

## Flujo de ejemplo: POST /api/movimientos

1. React valida presentación e inicia POST JSON a `/api/movimientos` con cookies.
2. Express limita tamaño del JSON y valida origen en mutaciones.
3. `requireAuth` verifica JWT HS256, tiempo de caducidad, `token_version` y estado del usuario actual.
4. `requireRole('USUARIO')` impide que un administrador llame al endpoint de finanzas.
5. Zod valida tipo, monto y categoría. Se toma **id_usuario del usuario autenticado**, no del JSON recibido.
6. Prisma busca la categoría confirmando titularidad o que sea predeterminada.
7. Prisma inserta en PostgreSQL. Su trigger exige consistencia entre categoría, tipo y usuario.
8. El backend retorna JSON con HTTP 201; React actualiza datos mostrados.

## PostgreSQL / SQL recibido

Tablas: `usuario`, `categoria`, `movimiento`, `presupuesto`. ENUM: `rol_usuario`, `estado_usuario`, `tipo_movimiento`. Vistas: `v_balance_usuario`, `v_resumen_mensual`, `v_gastos_por_categoria`, `v_control_presupuesto`. Triggers: `tr_validar_movimiento`, `tr_validar_presupuesto`. La migración adicional implementa bloqueo y revocación de JWT.

`schema.prisma` no representa todos los CHECK, índices de expresiones, vistas y triggers. El historial **SQL** de migraciones es indispensable para reconstruir el esquema real. Revisar cualquier futura migración antes de aplicarla. Nunca ejecutar `prisma db push` como sustituto de migraciones.

## Dinero y privacidad

Importes NUMERIC(12,2) en PostgreSQL, `Prisma.Decimal` en API, cadenas decimales JSON en frontend. No usar floats como fuente de verdad para operaciones monetarias. Índices `id_usuario` ayudan a consultas por dueño. Consultas de reportes deben limitarse siempre por `id_usuario` autenticado.

## Decisiones pendientes de equipo

- ¿Se permite edición y eliminación permanente de movimientos? Según Fase I sí, deben implementarse.
- ¿Se permiten fechas futuras? SQL de Fase I lo prohíbe; mostrar validación coherente.
- Fecha / zona horaria de dashboard: definir zona de negocio para cierres mensuales (p. ej. Guatemala) y pruebas de bordes de mes.
- `usuario.estado INACTIVO`: renovar/invalidar JWT inmediatamente (middleware lo verifica).
- Categorías predeterminadas editadas/eliminadas: diseñar comportamiento frente a movimientos existentes y FK RESTRICT.
