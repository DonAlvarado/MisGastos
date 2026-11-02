import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

type AuthUser = { id_usuario: number; nombre: string; correo: string; rol: 'USUARIO' | 'ADMIN'; token_version: number };
declare global { namespace Express { interface Request { currentUser?: AuthUser } } }

export const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-mg_access' : 'mg_access';
export const COOKIE_MINUTES = 30;
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET necesita 32 caracteres aleatorios o más');
  return secret;
}
export function cookieOptions() {
  return { httpOnly: true as const, sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production', path: '/' };
}
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (typeof token !== 'string') { res.status(401).json({ error: 'No autenticado' }); return; }
  try {
    const payload = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] }) as JwtPayload;
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id) || id <= 0 || typeof payload.ver !== 'number') {
      res.status(401).json({ error: 'Sesión inválida' }); return;
    }
    const user = await prisma.usuario.findUnique({ where: { id_usuario: id }, select: {
      id_usuario:true, nombre:true, correo:true, rol:true, estado:true, token_version:true
    }});
    if (!user || user.estado !== 'ACTIVO' || user.token_version !== payload.ver) {
      res.status(401).json({ error: 'Sesión revocada o cuenta deshabilitada' }); return;
    }
    req.currentUser = { id_usuario:user.id_usuario, nombre:user.nombre, correo:user.correo,
      rol:user.rol, token_version:user.token_version };
    next();
  } catch { res.status(401).json({ error: 'Sesión expirada o inválida' }); }
}
export function requireRole(role: 'ADMIN' | 'USUARIO') {
  return (req: Request,res: Response,next: NextFunction) => {
    if (!req.currentUser || req.currentUser.rol !== role) {
      res.status(403).json({ error: 'Sin permisos para esta operación' }); return;
    }
    next();
  };
}
