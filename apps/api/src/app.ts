import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { authRouter } from './modules/auth/routes';
import { finanzasRouter } from './modules/movimientos/routes';

export const app = express();
app.set('trust proxy', 1); // Render y proxies conocidos: revisar antes de usar detrás de otro proxy.
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

// Política de origen para mutaciones con cookies (defensa adicional contra CSRF).
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.headers.origin;
  const sameOrigin = `${req.protocol}://${req.get('host')}`;
  const allow = [sameOrigin, process.env.CLIENT_ORIGIN].filter(Boolean);
  if (origin && !allow.includes(origin)) { res.status(403).json({ error: 'Origen no permitido' }); return; }
  next();
});

app.get('/api/health', (_req, res) => { res.json({ status: 'ok', project: 'MisGastos' }); });
app.use('/api/auth', authRouter);
app.use('/api', finanzasRouter);
app.use('/api', (_req, res) => { res.status(404).json({ error: 'Ruta API no encontrada' }); });

// En el contenedor de producción se sirve el build de React desde Express.
const frontendDist = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('Error interno:', err instanceof Error ? err.message : 'desconocido');
  if (res.headersSent) return;
  res.status(500).json({ error: 'Error interno del servidor' });
};
app.use(errorHandler);
