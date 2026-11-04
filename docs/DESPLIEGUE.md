# Despliegue: Vercel + Render + Neon

## URLs de producción

| Qué | Dónde |
|---|---|
| Aplicación web | https://misgastos-ebon.vercel.app |
| API | https://misgastos-api-06um.onrender.com |
| Health check | https://misgastos-api-06um.onrender.com/api/health |
| Health check a través del proxy | https://misgastos-ebon.vercel.app/api/health |
| Base de datos | Proyecto `misgastos` en Neon (PostgreSQL 17) |

> El plan gratuito de Render apaga el servicio tras un rato sin tráfico y el primer
> acceso después tarda cerca de un minuto. **Antes de una demostración, abrir el
> health check y esperar a que responda.**

## Por qué tres servicios

El `Dockerfile` de la raíz construye **solo el API**: copia `apps/api`, genera el cliente
Prisma y compila a `dist`. Nunca compila el frontend. Por eso React se despliega aparte.

Para que la sesión funcione, el navegador nunca habla directo con Render. Vercel expone
una función proxy en `apps/web/api/[...path].ts` que atiende todo lo que cuelga de `/api/`
en el dominio de Vercel y lo reenvía al API. Así el navegador ve un solo origen y la
cookie `__Host-mg_access` queda atada al dominio de Vercel, sin cookies de terceros.

```
navegador ──► https://misgastos-ebon.vercel.app/api/...   (función proxy en Vercel)
                        │
                        └──► https://misgastos-api-06um.onrender.com/api/...   (Express en Render)
                                      │
                                      └──► PostgreSQL en Neon
```

## 1. Neon (base de datos)

1. Crear un proyecto en https://console.neon.tech.
2. Copiar **dos** cadenas de conexión de la misma base:
   - la **pooled** (el host lleva `-pooler`) → va en `DATABASE_URL`
   - la **directa** (sin `-pooler`) → va en `DIRECT_URL`

   > **Ojo:** Neon llama `DATABASE_URL` a la directa y `DATABASE_URL_POOLED` a la pooled.
   > En este repo los nombres van al revés de como los entrega Neon. Si se copian tal cual,
   > las migraciones corren por el pooler y pueden fallar: `apps/api/prisma.config.ts`
   > apunta las migraciones a `DIRECT_URL` porque el pooler no soporta las sentencias que
   > Prisma usa para migrar.

3. Aplicar las migraciones una sola vez, desde un equipo autorizado. Respaldar antes el
   `.env` local, poner temporalmente las cadenas de Neon en `apps/api/.env` y ejecutar:

   ```powershell
   npm run prisma:generate
   npm run db:migrate
   ```

   Se aplican `20261024000100_inicial` y `20261024000200_seguridad_sesiones`.

4. Verificar en Neon que existan `usuario`, `categoria`, `movimiento` y `presupuesto`.

5. **No ejecutar `npm run db:seed` contra Neon.** Ese script crea usuarios de demostración
   con contraseñas conocidas.

## 2. Render (API)

New → Web Service → conectar el repositorio.

| Campo | Valor |
|---|---|
| Branch | `main` |
| Runtime | **Docker** |
| Root Directory | *vacío* |
| Dockerfile Path | `./Dockerfile` |
| Instance Type | Free |
| Health Check Path | `/api/health` |

El Root Directory tiene que quedar vacío: el `Dockerfile` está en la raíz y necesita el
contexto completo del monorepo para copiar los `package.json` de los dos workspaces.

Variables de entorno (en el panel, nunca en Git):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | cadena **pooled** de Neon |
| `DIRECT_URL` | cadena **directa** de Neon |
| `JWT_SECRET` | aleatorio de 32+ caracteres, distinto del local |
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | el dominio de Vercel (se llena en el paso 4) |

**No configurar `PORT`:** Render lo inyecta y `server.ts` lo lee de `process.env.PORT`.

`NODE_ENV=production` no es opcional. Sin él la cookie de sesión sale sin el flag `Secure`
ni el prefijo `__Host-`, y el login por HTTPS queda roto o inseguro.

## 3. Vercel (frontend y proxy)

Se desplegó con el CLI desde `apps/web`, sin conectar el repositorio a Git. Así el
despliegue no depende de permisos sobre el repositorio compartido ni interfiere con otras
integraciones.

```powershell
cd apps\web
npx vercel login
npx vercel link          # crear proyecto nuevo, sin conectar Git
npx vercel env add BACKEND_ORIGIN production
npx vercel --prod
```

`BACKEND_ORIGIN` es la URL de Render **sin `/api` al final y sin barra final**. El proxy
construye la ruta solo; con `/api` incluido las peticiones terminarían en `/api/api/...`.

Y sin prefijo `VITE_`: las variables `VITE_*` se incrustan en el bundle y quedan visibles
para cualquiera que abra el inspector del navegador. `BACKEND_ORIGIN` solo debe existir del
lado del servidor, que es donde corre la función proxy.

### Dos URLs, usar siempre la misma

Cada `vercel --prod` genera una URL propia de ese despliegue
(`misgastos-xxxxx-andry23.vercel.app`) y actualiza el alias estable
(`misgastos-ebon.vercel.app`).

**Usar siempre el alias.** Es el que está en `CLIENT_ORIGIN`; si se entra por la URL del
despliegue puntual, el `Origin` no coincide y toda operación de escritura responde 403.

### `@types/node` en `apps/web`

`apps/web/tsconfig.json` declara `"types": ["node"]` e incluye `api/**/*.ts`, y el proxy
importa `node:http`. En local eso funciona porque npm deja `@types/node` en el
`node_modules` de la raíz gracias a `apps/api`.

Al construir `apps/web` por separado —que es exactamente lo que hace Vercel— el paquete no
está y el build falla con `error TS2688: Cannot find type definition file for 'node'`.

Se corrigió declarando `@types/node` como dependencia de `apps/web` (PR #12).

## 4. Cerrar el círculo

1. En Render, poner `CLIENT_ORIGIN` con el dominio exacto de Vercel, sin barra final.
2. Guardar y esperar a que el servicio vuelva a estar **Live**.

**Este paso no es opcional y es el que más se olvida.** El middleware de origen en
`apps/api/src/app.ts` rechaza con 403 todo POST, PUT, PATCH o DELETE cuyo `Origin` no esté
en la lista permitida. Si falta o no coincide, la aplicación carga bien pero no deja
registrarse, iniciar sesión ni guardar nada, y el único síntoma es un escueto
*"Origen no permitido"*.

El redespliegue tarda varios minutos: hasta que no termine sigue corriendo el contenedor
anterior, sin la variable.

## 5. Cuenta de administrador

No existe endpoint público para otorgar el rol ADMIN. Se crea a mano desde un equipo
autorizado, con las credenciales de Neon temporalmente en `apps/api/.env`:

```
ADMIN_NAME=Administrador
ADMIN_EMAIL=admin@misgastos.gt
ADMIN_PASSWORD=<12 caracteres o más>
```

```powershell
npm run admin:create -w apps/api
```

Borrar esas tres variables del `.env` enseguida. El script no imprime la contraseña y se
niega a cambiarle el rol a una cuenta que ya exista, así que para corregir una contraseña
olvidada hay que borrar la fila en Neon y volver a crearla: bcrypt es irreversible.

## 6. Verificación

| Qué | Cómo | Resultado |
|---|---|---|
| API viva | `/api/health` en Render | `{"status":"ok","project":"MisGastos"}` |
| Proxy | `/api/health` en Vercel | el mismo JSON |
| Registro y sesión | crear cuenta en el dominio de Vercel | cookie `__Host-mg_access`, HttpOnly y Secure |
| Permisos por rol | usuario común entra a `/api/admin/usuarios` | 403 |
| Panel admin | entrar como ADMIN | lista usuarios, sin exponer contraseñas |
| Aislamiento | el admin no ve movimientos ajenos | el panel no expone finanzas de otros |
| Revocación | el admin deshabilita una cuenta conectada | esa sesión pasa a 401 en su siguiente acción |

### Diagnóstico rápido

| Síntoma | Causa |
|---|---|
| `/api/health` en Vercel devuelve HTML o 404 | Vercel no reconoció la función: revisar que el archivo se llame `apps/web/api/[...path].ts` con corchetes y que el Root Directory sea `apps/web` |
| 503 | Falta `BACKEND_ORIGIN` o no empieza con `https://` |
| 502 | El API de Render no respondió dentro de los 25 s del proxy; lo más probable es que estuviera dormido |
| "Origen no permitido" al registrarse o iniciar sesión | `CLIENT_ORIGIN` ausente, con barra final, o distinto al dominio por el que se entró |
| 500 al registrar un movimiento con la fecha de hoy | Bug corregido en el PR #13: `fechaSQL()` anclaba al mediodía UTC, que en Guatemala son las 6 AM, y antes de esa hora la fecha quedaba en el futuro para el `CHECK (fecha <= NOW())` |
