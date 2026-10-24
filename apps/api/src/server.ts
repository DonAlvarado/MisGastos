import 'dotenv/config';
import { app } from './app';
import { prisma } from './lib/prisma';
import { jwtSecret } from './middleware/auth';

// Falla rápido si la configuración de seguridad es insuficiente.
jwtSecret();
const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, '0.0.0.0', () => console.log(`MisGastos escuchando en :${port}`));
async function stop() { server.close(); await prisma.$disconnect(); }
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
