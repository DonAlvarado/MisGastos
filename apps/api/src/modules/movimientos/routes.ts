import { Router } from 'express';
import { Prisma, type tipo_movimiento } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middleware/auth';

export const finanzasRouter = Router();


finanzasRouter.get('/categorias', requireAuth, requireRole('USUARIO'), async (req, res, next) => {
  try {
    const id = req.currentUser!.id_usuario;
    const categorias = await prisma.categoria.findMany({ where: {
      OR: [{ predeterminada: true, id_usuario: null }, { id_usuario: id }]
    }, orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }], select: { id_categoria: true, nombre: true, tipo: true, predeterminada: true } });
    res.json({ categorias });
  } catch (err) { next(err); }
});

finanzasRouter.get('/movimientos', requireAuth, requireRole('USUARIO'), async (req, res, next) => {
  try {
    const id = req.currentUser!.id_usuario;
    const movimientos = await prisma.movimiento.findMany({
      where: { id_usuario: id }, orderBy: { fecha: 'desc' }, take: 50,
      select: { id_movimiento: true, descripcion: true, monto: true, fecha: true, tipo: true,
        categoria: { select: { nombre: true } } }
    });
    res.json({ movimientos });
  } catch (err) { next(err); }
});

const nuevo = z.object({
  descripcion: z.string().trim().max(255).optional(),
  monto: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
  tipo: z.enum(['INGRESO', 'GASTO']),
  id_categoria: z.number().int().positive()
});

finanzasRouter.post('/movimientos', requireAuth, requireRole('USUARIO'), async (req, res, next) => {
  try {
    const body = nuevo.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: 'Datos de movimiento inválidos' }); return; }
    const id = req.currentUser!.id_usuario;
    const { tipo, id_categoria, descripcion, monto } = body.data;
    const cantidad = new Prisma.Decimal(monto);
    if (cantidad.lte(0)) { res.status(400).json({ error: 'El monto debe ser positivo' }); return; }
    const categoria = await prisma.categoria.findFirst({ where: {
      id_categoria, tipo: tipo as tipo_movimiento,
      OR: [{ predeterminada: true, id_usuario: null }, { id_usuario: id }]
    }, select: { id_categoria: true } });
    if (!categoria) { res.status(400).json({ error: 'Categoría inválida o sin permiso' }); return; }
    const movimiento = await prisma.movimiento.create({ data: { descripcion, monto: cantidad, tipo, id_usuario: id, id_categoria } });
    res.status(201).json({ movimiento });
  } catch (err) { next(err); }
});

finanzasRouter.get('/dashboard', requireAuth, requireRole('USUARIO'), async (req, res, next) => {
  try {
    const id = req.currentUser!.id_usuario;
    const filas = await prisma.$queryRaw<Array<{ total_ingresos: Prisma.Decimal; total_gastos: Prisma.Decimal; balance: Prisma.Decimal }>>`
      SELECT total_ingresos, total_gastos, balance FROM v_balance_usuario WHERE id_usuario = ${id}`;
    res.json({ resumen: filas[0] ?? { total_ingresos: '0.00', total_gastos: '0.00', balance: '0.00' } });
  } catch (err) { next(err); }
});
