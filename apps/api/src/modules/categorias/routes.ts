import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middleware/auth';
import { idSchema, prismaError } from '../../lib/validation';

export const categoriasRouter = Router();

// Todas las rutas requieren sesión iniciada y rol USUARIO.
categoriasRouter.use(requireAuth, requireRole('USUARIO'));

const schema = z.object({
  nombre: z.string().trim().min(1).max(60),
  tipo: z.enum(['INGRESO', 'GASTO'])
});
const editSchema = schema.partial().refine(d => Object.keys(d).length > 0);

// Lista las categorías globales y las personales del usuario.
categoriasRouter.get('/', async (req, res, next) => {
  try {
    const id = req.currentUser!.id_usuario;
    const categorias = await prisma.categoria.findMany({
      where: { OR: [{ predeterminada: true, id_usuario: null }, { id_usuario: id }] },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
      select: { id_categoria: true, nombre: true, tipo: true, predeterminada: true }
    });
    res.json({ categorias });
  } catch (e) { next(e); }
});

// Crea una categoría personal. El dueño sale del token, nunca del body.
categoriasRouter.post('/', async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Categoría inválida' }); return; }
    const categoria = await prisma.categoria.create({
      data: { ...parsed.data, id_usuario: req.currentUser!.id_usuario, predeterminada: false }
    });
    res.status(201).json({ categoria });
  } catch (e) { prismaError(e, res, next); }
});

// Edita solo categorías personales del usuario. Las globales y las ajenas dan 404.
categoriasRouter.put('/:id', async (req, res, next) => {
  try {
    const id = idSchema.safeParse(req.params.id);
    const body = editSchema.safeParse(req.body);
    if (!id.success || !body.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }

    const existing = await prisma.categoria.findFirst({
      where: { id_categoria: id.data, id_usuario: req.currentUser!.id_usuario, predeterminada: false }
    });
    if (!existing) { res.status(404).json({ error: 'Categoría personal no encontrada' }); return; }

    // No se puede cambiar el tipo si la categoría ya tiene movimientos o presupuestos.
    if (body.data.tipo && body.data.tipo !== existing.tipo) {
      const [mov, pres] = await Promise.all([
        prisma.movimiento.count({ where: { id_categoria: id.data } }),
        prisma.presupuesto.count({ where: { id_categoria: id.data } })
      ]);
      if (mov + pres > 0) { res.status(409).json({ error: 'No puedes cambiar el tipo de una categoría utilizada' }); return; }
    }

    const categoria = await prisma.categoria.update({ where: { id_categoria: id.data }, data: body.data });
    res.json({ categoria });
  } catch (e) { prismaError(e, res, next); }
});

// Elimina una categoría personal si no tiene movimientos ni presupuestos.
categoriasRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) { res.status(400).json({ error: 'ID inválido' }); return; }

    const existing = await prisma.categoria.findFirst({
      where: { id_categoria: id.data, id_usuario: req.currentUser!.id_usuario, predeterminada: false }
    });
    if (!existing) { res.status(404).json({ error: 'Categoría personal no encontrada' }); return; }

    const [movimientos, presupuestos] = await Promise.all([
      prisma.movimiento.count({ where: { id_categoria: id.data } }),
      prisma.presupuesto.count({ where: { id_categoria: id.data } })
    ]);
    if (movimientos + presupuestos > 0) { res.status(409).json({ error: 'La categoría tiene movimientos o presupuestos asociados' }); return; }

    await prisma.categoria.delete({ where: { id_categoria: id.data } });
    res.status(204).end();
  } catch (e) { prismaError(e, res, next); }
});