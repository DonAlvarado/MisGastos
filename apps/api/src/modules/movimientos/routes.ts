import { Router } from 'express';
import { Prisma, type tipo_movimiento } from '../../generated/prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middleware/auth';
import { moneySchema, dateSchema, fechaSQL, idSchema, prismaError } from '../../lib/validation';

export const movimientosRouter = Router();

// Todas las rutas requieren sesión iniciada y rol USUARIO.
movimientosRouter.use(requireAuth, requireRole('USUARIO'));

const schema = z.object({
  descripcion: z.string().trim().max(255).nullable().optional(),
  monto: moneySchema,
  tipo: z.enum(['INGRESO', 'GASTO']),
  id_categoria: z.number().int().positive(),
  fecha: dateSchema.optional()
});
const editSchema = schema.partial().refine(d => Object.keys(d).length > 0);

// La categoría debe existir, ser del mismo tipo y ser global o del propio usuario.
async function validCategory(idUser: number, idCategory: number, tipo: 'INGRESO' | 'GASTO') {
  return prisma.categoria.findFirst({
    where: {
      id_categoria: idCategory,
      tipo: tipo as tipo_movimiento,
      OR: [{ predeterminada: true, id_usuario: null }, { id_usuario: idUser }]
    },
    select: { id_categoria: true }
  });
}

// Lista solo los movimientos del usuario. Permite filtrar por tipo y máximo 200.
movimientosRouter.get('/', async (req, res, next) => {
  try {
    const id = req.currentUser!.id_usuario;
    const take = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const where: Prisma.movimientoWhereInput = { id_usuario: id };
    const tipo = z.enum(['INGRESO', 'GASTO']).safeParse(req.query.tipo);
    if (tipo.success) where.tipo = tipo.data as tipo_movimiento;

    const movimientos = await prisma.movimiento.findMany({
      where,
      orderBy: [{ fecha: 'desc' }, { id_movimiento: 'desc' }],
      take,
      select: {
        id_movimiento: true, descripcion: true, monto: true, fecha: true, tipo: true,
        id_categoria: true, categoria: { select: { nombre: true } }
      }
    });
    res.json({ movimientos });
  } catch (e) { next(e); }
});

// Crea un movimiento. El monto se guarda como Decimal para no perder centavos.
movimientosRouter.post('/', async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Movimiento inválido' }); return; }

    const id = req.currentUser!.id_usuario;
    const { id_categoria, tipo, monto, descripcion, fecha } = parsed.data;
    if (!await validCategory(id, id_categoria, tipo)) { res.status(400).json({ error: 'Categoría inválida o ajena' }); return; }

    const movimiento = await prisma.movimiento.create({
      data: {
        id_usuario: id, id_categoria, tipo, descripcion,
        monto: new Prisma.Decimal(monto),
        ...(fecha ? { fecha: fechaSQL(fecha) } : {})
      }
    });
    res.status(201).json({ movimiento });
  } catch (e) { prismaError(e, res, next); }
});

// Edita un movimiento solo si es del usuario. Si es ajeno responde 404.
movimientosRouter.put('/:id', async (req, res, next) => {
  try {
    const id = idSchema.safeParse(req.params.id);
    const body = editSchema.safeParse(req.body);
    if (!id.success || !body.success) { res.status(400).json({ error: 'Datos de movimiento inválidos' }); return; }

    const owner = req.currentUser!.id_usuario;
    const old = await prisma.movimiento.findFirst({ where: { id_movimiento: id.data, id_usuario: owner } });
    if (!old) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

    const categoriaId = body.data.id_categoria ?? old.id_categoria;
    const tipo = body.data.tipo ?? old.tipo;
    if (!await validCategory(owner, categoriaId, tipo)) { res.status(400).json({ error: 'Categoría inválida o ajena' }); return; }

    const { fecha, monto, ...rest } = body.data;
    const result = await prisma.movimiento.updateMany({
      where: { id_movimiento: id.data, id_usuario: owner },
      data: {
        ...rest,
        ...(monto ? { monto: new Prisma.Decimal(monto) } : {}),
        ...(fecha ? { fecha: fechaSQL(fecha) } : {})
      }
    });
    if (!result.count) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }

    const movimiento = await prisma.movimiento.findUnique({ where: { id_movimiento: id.data } });
    res.json({ movimiento });
  } catch (e) { prismaError(e, res, next); }
});

// Elimina un movimiento filtrando por id y dueño a la vez. Si es ajeno responde 404.
movimientosRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) { res.status(400).json({ error: 'ID inválido' }); return; }

    const result = await prisma.movimiento.deleteMany({
      where: { id_movimiento: id.data, id_usuario: req.currentUser!.id_usuario }
    });
    if (!result.count) { res.status(404).json({ error: 'Movimiento no encontrado' }); return; }
    res.status(204).end();
  } catch (e) { next(e); }
});