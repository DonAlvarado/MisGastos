import { Prisma } from '../generated/prisma/client';
import { z } from 'zod';

export const moneySchema = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Monto inválido')
  .refine(v => new Prisma.Decimal(v).gt(0), 'El monto debe ser mayor a cero');
export const idSchema = z.coerce.number().int().positive();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d=new Date(`${v}T12:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===v; }, 'Fecha inválida');
export function fechaSQL(date: string): Date { return new Date(`${date}T12:00:00Z`); }
export function failed(res: import('express').Response, status = 400, message = 'Datos inválidos') {
  res.status(status).json({ error: message });
}
export function prismaError(err: unknown, res: import('express').Response, next: import('express').NextFunction) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2003'].includes(err.code)) {
    failed(res, 409, err.code === 'P2002' ? 'Ya existe un registro con esos datos' : 'Este registro está siendo utilizado');
    return;
  }
  next(err);
}
