import { Prisma } from '../generated/prisma/client';
import { z } from 'zod';

export const moneySchema = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Monto inválido')
  .refine(v => new Prisma.Decimal(v).gt(0), 'El monto debe ser mayor a cero');
export const idSchema = z.coerce.number().int().positive();

// La fecha llega como YYYY-MM-DD. Se valida que exista en el calendario y que no
// sea futura: la tabla movimiento tiene CHECK (fecha <= NOW()), así que una fecha
// posterior a hoy reventaría en la base con un error 500 en vez de un 400 claro.
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(v => { const d=new Date(`${v}T12:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===v; }, 'Fecha inválida')
  .refine(v => v <= new Date().toISOString().slice(0, 10), 'La fecha no puede ser futura');

// Se ancla al mediodía UTC para que la fecha se vea igual en cualquier zona horaria
// del continente: a las 00:00 UTC, un usuario en Guatemala (UTC-6) vería el día
// anterior.
//
// Pero ese mediodía UTC son las 6:00 AM en Guatemala, y la base compara contra su
// propio NOW() en UTC. Registrar con la fecha de hoy antes de esa hora guardaba un
// instante que todavía no había ocurrido, y el CHECK lo rechazaba. Por eso, si el
// mediodía UTC aún no llegó, se guarda el instante actual: el día sigue siendo el
// correcto y la restricción se cumple siempre.
export function fechaSQL(date: string): Date {
  const mediodiaUTC = new Date(`${date}T12:00:00Z`);
  const ahora = new Date();
  return mediodiaUTC > ahora ? ahora : mediodiaUTC;
}

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