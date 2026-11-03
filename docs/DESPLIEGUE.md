# Despliegue: Vercel (frontend) + Render (API) + Neon (PostgreSQL)

## Por qué esta separación

El `Dockerfile` de la raíz construye **solo el API**: copia `apps/api`, genera el cliente Prisma y compila a `dist`. No compila ni copia el frontend. Por eso React se despliega aparte en Vercel.

Para que la cookie de sesión funcione, el navegador nunca habla directo con Render. Vercel expone una función proxy en `apps/web/api/[...path].ts` que atiende todo lo que cuelga de `/api/` en el dominio de Vercel y lo reenvía al API. El navegador ve un solo origen, así que la cookie `__Host-mg_access` queda atada al dominio de Vercel y no hay cookies de terceros.

```
navegador ──► https://TUAPP.vercel.app/api/...  (función proxy en Vercel)
                        │
                        └──► https://TUAPI.onrender.com/api/...  (Express en Render)
                                      │
                                      └──► PostgreSQL en Neon
```

## Paso 0. Antes de empezar

- Todos los PR deben estar fusionados en `main` y `npm run build` debe pasar localmente.
- `package-lock.json` debe estar en el repositorio y al día: Render usa `npm ci`.
- No se cargan datos de prueba en Neon. No se suben `.env`, secretos ni volúmenes de Docker.

## 1. Neon (PostgreSQL)

1. Crear un proyecto en https://console.neon.tech.
2. Copiar **dos** cadenas de conexión de la misma base:
   - la **pooled** (el host suele llevar `-pooler`) para `DATABASE_URL`
   - la **directa** para `DIRECT_URL`

   Las dos con `sslmode=require`. La distinción importa: `apps/api/prisma.config.ts` apunta las migraciones a `DIRECT_URL`, porque el pooler no soporta las sentencias que Prisma necesita para migrar. El runtime, en cambio, usa `DATABASE_URL` a través del adaptador `PrismaPg`.

3. Aplicar las migraciones **una sola vez**, desde un equipo autorizado. Respaldar antes el `.env` local, poner temporalmente las cadenas de Neon en `apps/api/.env` y ejecutar:

   ```powershell
   npm run prisma:generate
   npm run db:migrate
   ```

   Eso aplica `20261024000100_inicial` y `20261024000200_seguridad_sesiones`.

4. Verificar en Neon que existan las tablas `usuario`, `categoria`, `movimiento` y `presupuesto`. Restaurar el `.env` local al PostgreSQL de Docker.

5. **No ejecutar `npm run db:seed` contra Neon.** Ese script crea usuarios de demostración con contraseñas conocidas. Las categorías iniciales se crean después desde el panel de administración.

## 2. Render (API)

1. https://dashboard.render.com → New → Web Service → conectar el repositorio.
2. Configuración:
   - Branch: `main`
   - Runtime: **Docker**
   - Root Directory: **vacío** (el `Dockerfile` está en la raíz y necesita el contexto completo del monorepo)
   - Dockerfile Path: `./Dockerfile`
   - Health Check Path: `/api/health`
3. Variables de entorno (en el panel, nunca en Git):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | cadena **pooled** de Neon |
   | `DIRECT_URL` | cadena **directa** de Neon |
   | `JWT_SECRET` | aleatorio de 32+ caracteres, distinto del local |
   | `NODE_ENV` | `production` |
   | `CLIENT_ORIGIN` | se llena en el paso 4, cuando exista el dominio de Vercel |

   `PORT` no hace falta: Render lo inyecta y `server.ts` lo lee.

4. Desplegar y guardar la URL real, del tipo `https://TUAPI.onrender.com`.
5. Comprobar `GET https://TUAPI.onrender.com/api/health` → debe responder `{"status":"ok","project":"MisGastos"}`.

> El plan gratuito duerme el servicio por inactividad. El primer acceso tras el reposo puede tardar cerca de un minuto. Antes de una demostración conviene abrir `/api/health` y esperar a que despierte.

## 3. Vercel (frontend + proxy)

1. https://vercel.com → Add New → Project → importar el mismo repositorio.
2. Configuración:
   - **Root Directory:** `apps/web`
   - **Framework:** Vite
   - Build y Output los toma de `apps/web/vercel.json`
3. Variable de entorno: `BACKEND_ORIGIN = https://TUAPI.onrender.com`

   **Sin `/api` al final y sin barra final.** Y sin prefijo `VITE_`: las variables `VITE_*` se incrustan en el bundle y quedan visibles para cualquiera que abra el inspector. `BACKEND_ORIGIN` solo debe existir del lado del servidor, que es donde corre la función proxy.

4. Desplegar y copiar el dominio final.

## 4. Cerrar el círculo

1. Volver a Render y poner `CLIENT_ORIGIN = https://TUAPP.vercel.app` (el dominio exacto, sin barra final).
2. Redesplegar el servicio de Render para que tome la variable.

Este paso no es opcional. El middleware de origen en `apps/api/src/app.ts` rechaza con 403 cualquier POST, PUT, PATCH o DELETE cuyo `Origin` no esté en la lista permitida. Si `CLIENT_ORIGIN` no coincide con el dominio de Vercel, la aplicación carga pero no deja iniciar sesión ni guardar nada.

## 5. Crear la cuenta de administrador

No existe un endpoint público para otorgar el rol ADMIN; se hace a mano desde un equipo autorizado.

Con las credenciales de Neon temporalmente en `apps/api/.env`, agregar:

```
ADMIN_NAME=Administrador
ADMIN_EMAIL=admin@ejemplo.com
ADMIN_PASSWORD=una_clave_de_12_o_mas_caracteres
```

Ejecutar:

```powershell
npm run admin:create -w apps/api
```

Borrar esas tres variables del `.env` enseguida. El script no imprime la contraseña y se niega a cambiarle el rol a una cuenta que ya exista.

## 6. Verificación

| Qué | Cómo | Resultado esperado |
|---|---|---|
| API viva | `https://TUAPI.onrender.com/api/health` | JSON con `status: ok` |
| Proxy | `https://TUAPP.vercel.app/api/health` | el mismo JSON |
| Sesión | iniciar sesión en el dominio de Vercel | cookie `__Host-mg_access`, marcada HttpOnly y Secure |
| Permisos | usuario común entra a `/api/admin/usuarios` | 403 |
| Revocación | el admin desactiva una cuenta conectada | esa sesión pasa a 401 en su siguiente acción |
| Aislamiento | un usuario intenta tocar un movimiento ajeno | 403 o 404, nunca el dato |

Si `https://TUAPP.vercel.app/api/health` devuelve HTML en lugar de JSON, Vercel no está reconociendo la función: revisar que el archivo se llame exactamente `apps/web/api/[...path].ts` (con corchetes), que el Root Directory sea `apps/web` y los logs de Functions.

Si devuelve 503, falta `BACKEND_ORIGIN` o no empieza con `https://`. Si devuelve 502, el API de Render no respondió dentro de los 25 segundos que espera el proxy: lo más probable es que estuviera dormido, reintentar.

## 7. Nota sobre permisos de despliegue

En un repositorio privado con plan Vercel Hobby, un commit de un colaborador que no es el propietario del proyecto puede no disparar el build automático. Si pasa, el propietario despliega desde su equipo después de fusionar el PR:

```powershell
cd apps/web
npx vercel login
npx vercel link
npx vercel --prod
```

No se modifica la autoría de los commits para sortear esta limitación.
