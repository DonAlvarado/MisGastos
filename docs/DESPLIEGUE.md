# Despliegue Render (Docker) + Neon (PostgreSQL)

## Por qué un dominio

React compilado se sirve con `express.static` y API Express por `/api` en un **mismo servicio web Render**. Evita lidiar con cookies de terceros entre dominios Vercel y Render. Docker solo contiene la app; Neon persiste datos independientemente de reinicios.

## Paso 1: Neon

1. Crear proyecto PostgreSQL gratuito en Neon.
2. Copiar dos URLs de conexión: con pool para `DATABASE_URL`, **directa** para `DIRECT_URL` (Prisma CLI y migraciones). Usar SSL.
3. Guardarlas únicamente en el panel de entorno seguro y, para aplicar migraciones desde un equipo autorizado, temporalmente en `apps/api/.env` local. No subirlas al repo ni enviarlas por chat.
4. Aplicar el historial a Neon desde `apps/api` usando `npm run db:migrate` (o `npx prisma migrate deploy`).
5. **No ejecutar `database/seed/dev.sql` en Neon**. Registrar un usuario nuevo; definir un proceso seguro separado para alta inicial de ADMIN.

## Paso 2: Render

1. New -> Web Service -> conectar el repositorio GitHub (evaluar acceso de equipo y privacidad).
2. Runtime: **Docker**; Dockerfile Path: `./Dockerfile`; Docker build context: repo root.
3. Plan Free si está disponible en la cuenta. Configurar variables **secretas**: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` aleatorio de al menos 32 caracteres, `NODE_ENV=production`. No se requiere URL del frontend, ya que API/React están bajo el mismo dominio. Render define `PORT`.
4. Deploy; probar `https://TU-SERVICIO.onrender.com/api/health` y abrir `/`.
5. Registrar usuario nuevo; validar login, movimientos y balance. Verificar que datos de un usuario no aparezcan en otra cuenta.

## Paso 3: cada cambio en GitHub

- Abrir PR, exigir CI, revisar migraciones.
- Merge a main; Render autodespliega el contenedor nuevo.
- Si hay una migración de DB, ejecutar `prisma migrate deploy` de forma controlada **antes de activar un cambio incompatible**. El Dockerfile no ejecuta migraciones automáticamente para evitar efectos inesperados durante arranque.

## Límites y advertencias (verificar plan al crear cuenta)

- Render Free detiene instancias inactivas después de 15 min. El reinicio puede tardar cerca de un minuto. No ofrece alta disponibilidad para una app financiera real.
- Neon Free tiene cupos de almacenamiento y cómputo. Free database persistente **no** es equivalente a sincronizar la DB entre Docker y GitHub.
- Se necesitan respaldos periódicos y un plan de recuperación si se trabaja con datos importantes. Para la evaluación usar exclusivamente información ficticia.

## Alternativa local completamente contenerizada

Una vez `npm install` y migraciones iniciales:

```powershell
docker compose --profile full build
docker compose --profile full run --rm app npm run db:migrate
docker compose --profile full up -d
```

Entrar a `http://localhost:3001` (React + Express en el mismo servicio) con PostgreSQL local del compose. Para seed, usar `npm run db:seed` **solo si la BD está vacía**.
