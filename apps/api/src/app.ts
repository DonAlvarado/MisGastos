import express, { type ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { authRouter } from './modules/auth/routes';
import { categoriasRouter } from './modules/categorias/routes';
import { movimientosRouter } from './modules/movimientos/routes';
import { dashboardRouter } from './modules/dashboard/routes';
import { presupuestosRouter } from './modules/presupuestos/routes';
import { adminRouter } from './modules/admin/routes';

export const app = express();
app.set('trust proxy', 1); // Render y proxies conocidos: revisar antes de usar detrás de otro proxy.
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

// Política de origen para mutaciones con cookies (defensa adicional contra CSRF).
// Con el proxy de Vercel el navegador manda Origin del dominio Vercel, por eso
// CLIENT_ORIGIN debe apuntar exactamente a ese dominio en Render.
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.headers.origin;
  const sameOrigin = `${req.protocol}://${req.get('host')}`;
  const allow = [sameOrigin, process.env.CLIENT_ORIGIN].filter(Boolean);
  if (origin && !allow.includes(origin)) { res.status(403).json({ error: 'Origen no permitido' }); return; }
  next();
});

// Las respuestas del API traen datos financieros por sesión: no deben quedar
// en caché del navegador ni de los proxies intermedios.
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.get('/api/health', (_req, res) => { res.json({ status: 'ok', project: 'MisGastos' }); });
app.use('/api/auth', authRouter);
app.use('/api/categorias', categoriasRouter);
app.use('/api/movimientos', movimientosRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/presupuestos', presupuestosRouter);
app.use('/api/admin', adminRouter);
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Ruta API no encontrada' }); });

// Este servicio publica solo el API. El frontend se despliega en Vercel y llega
// aquí a través de la función proxy apps/web/api/[...path].ts.
app.use((_req, res) => { res.status(404).json({ error: 'No encontrado' }); });

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('Error interno:', err instanceof Error ? err.message : 'desconocido');
  if (res.headersSent) return;
  // express.json lanza un error con status 413 cuando el cuerpo supera el límite.
  // Sin esto se respondía 500 y el cliente no distinguía el motivo real.
  const raw = (err as { status?: unknown }).status;
  const status = typeof raw === 'number' && raw >= 400 && raw < 500 ? raw : 500;
  res.status(status).json({
    error: status === 413 ? 'La solicitud supera el tamaño permitido' : 'Error interno del servidor',
  });
};
app.use(errorHandler);
