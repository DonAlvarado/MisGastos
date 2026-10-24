import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { COOKIE_MINUTES, COOKIE_NAME, cookieOptions, jwtSecret, requireAuth } from '../../middleware/auth';

export const authRouter = Router();
const schema = z.object({ correo: z.string().email().max(150).transform(s => s.trim().toLowerCase()), password: z.string().min(8).max(128) });
const registerSchema = schema.extend({ nombre: z.string().trim().min(1).max(100) });
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Demasiados intentos, intenta nuevamente más tarde' } });

function setSession(res: import('express').Response, id: number, ver: number) {
  const token = jwt.sign({ ver }, jwtSecret(), { subject: String(id), expiresIn: COOKIE_MINUTES * 60, algorithm: 'HS256' });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: COOKIE_MINUTES * 60_000 });
}

// Las cuentas nuevas siempre son USUARIO/ACTIVO; jamás aceptar rol ni id_usuario desde el cliente.
authRouter.post('/register', limiter, async (req, res, next) => {
  try {
    const body = registerSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: 'Revisa nombre, correo y contraseña' }); return; }
    const { nombre, correo, password } = body.data;
    const existe = await prisma.usuario.findUnique({ where: { correo }, select: { id_usuario: true } });
    if (existe) { res.status(409).json({ error: 'No es posible registrar ese correo' }); return; }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.usuario.create({ data: { nombre, correo, password: passwordHash } });
    setSession(res, user.id_usuario, user.token_version);
    res.status(201).json({ usuario: { id_usuario: user.id_usuario, nombre: user.nombre, correo: user.correo, rol: user.rol } });
  } catch (err) { next(err); }
});

authRouter.post('/login', limiter, async (req, res, next) => {
  try {
    const body = schema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: 'Credenciales inválidas' }); return; }
    const { correo, password } = body.data;
    const user = await prisma.usuario.findUnique({ where: { correo } });
    if (!user || user.estado !== 'ACTIVO') { res.status(401).json({ error: 'Credenciales inválidas o cuenta no disponible' }); return; }
    const ahora = new Date();
    if (user.bloqueado_hasta && user.bloqueado_hasta > ahora) {
      res.status(429).json({ error: 'Cuenta bloqueada temporalmente' }); return;
    }
    const valido = await bcrypt.compare(password, user.password);
    if (!valido) {
      const intentos = user.bloqueado_hasta && user.bloqueado_hasta <= ahora ? 1 : user.intentos_fallidos + 1;
      await prisma.usuario.update({ where: { id_usuario: user.id_usuario }, data: {
        intentos_fallidos: intentos >= 5 ? 0 : intentos,
        bloqueado_hasta: intentos >= 5 ? new Date(Date.now() + 15 * 60_000) : null
      }});
      res.status(401).json({ error: 'Credenciales inválidas o cuenta no disponible' }); return;
    }
    await prisma.usuario.update({ where: { id_usuario: user.id_usuario }, data: { intentos_fallidos: 0, bloqueado_hasta: null } });
    setSession(res, user.id_usuario, user.token_version);
    res.json({ usuario: { id_usuario: user.id_usuario, nombre: user.nombre, correo: user.correo, rol: user.rol } });
  } catch (err) { next(err); }
});

authRouter.get('/me', requireAuth, (req, res) => {
  const { id_usuario, nombre, correo, rol } = req.currentUser!;
  res.json({ usuario: { id_usuario, nombre, correo, rol } });
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    // Revoca también otros tokens vigentes de este usuario (logout global).
    await prisma.usuario.update({ where: { id_usuario: req.currentUser!.id_usuario }, data: { token_version: { increment: 1 } } });
    res.clearCookie(COOKIE_NAME, cookieOptions());
    res.status(204).end();
  } catch (err) { next(err); }
});
