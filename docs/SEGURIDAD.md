# Seguridad: diseño, implementación inicial y pendientes

## Modelo de amenazas

Se protegen cuentas y movimientos personales. Amenazas: fuga de credenciales, robo/reutilización de JWT, fuerza bruta de login, autorización horizontal (IDOR entre usuarios), ataques CSRF/XSS, SQL injection, manipulación de montos, escalación a ADMIN y fuga de secretos de CI/cloud.

## Ya contemplado en la estructura inicial

1. `bcryptjs` 12 rondas para registros nuevos. No se guarda contraseña en texto plano.
2. JWT HS256 de 30 min como cookie HttpOnly, SameSite=Lax, Secure cuando NODE_ENV=production.
3. Cada solicitud autenticada verifica JWT y vuelve a consultar cuenta ACTIVA + versión del token en PostgreSQL.
4. Al cerrar sesión incrementa `token_version`: revoca JWT previos de ese usuario en **todos** sus dispositivos.
5. Limitador in-memory por IP y contador en BD: 5 contraseñas erróneas activan bloqueo 15 min. La lógica actual necesita pruebas de simultaneidad/race conditions.
6. Roles: todos los registrados son USUARIO; nunca se permite rol ADMIN desde el body.
7. IDOR: GET/POST de movimientos siempre toma `id_usuario` de req.currentUser; la categoría debe ser pública o propia. Administrador no tiene acceso a módulo de finanzas.
8. Validación Zod, consultas parametrizadas Prisma (`$queryRaw` tagged), Helmet, límite JSON de 50KB y comprobación de Origin para mutaciones.

## Por hacer antes de exponer información real

- Pruebas automáticas de accesos cruzados usuario A/usuario B, administración, token revocado, deshabilitación y expiración.
- Reforzar defensa CSRF con token cuando se permita cualquier frontend externo o se modifiquen los atributos de las cookies; revisar encabezados proxy y CORS con el dominio real.
- Establecer rate limiter persistente si se ejecutan varias instancias; registrar actividad anómala sin datos sensibles.
- Cifrado TLS obligatorio, secretos aleatorios únicos de producción, rotación de tokens/secretos, protección del panel de DB y backups.
- Tests E2E de flujo login -> registro de gasto -> balance -> logout.
- Manejo de errores auditado para no mostrar stacktraces ni datos internos; monitoreo, revisión dependencias, prevención XSS.
- Proteger cuenta administrador con credenciales únicas (idealmente MFA) y limitar capacidad a gestión de usuarios/categorías.
- Revisar zona horaria, fecha futura y negocio antes de almacenar.

## Recordatorios

`VITE_*` acaba dentro de archivos públicos: nunca colocar `JWT_SECRET`, `DATABASE_URL`, contraseñas o claves de proveedor allí.

Los datos de desarrollo (`database/seed/dev.sql`) contienen claves públicas deliberadamente conocidas: **no** ejecutar ese seed en una base accesible por internet. El SQL original se conserva como referencia en `database/originales/`.
