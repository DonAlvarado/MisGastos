
import { Router } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middleware/auth';

export const dashboardRouter = Router();

dashboardRouter.get('/', requireAuth, requireRole('USUARIO'), async (req, res, next) => {
  try {
    const owner = req.currentUser!.id_usuario;
    const now = new Date();

    const mes = req.query.mes === undefined
      ? now.getUTCMonth() + 1
      : Number(req.query.mes);

    const anio = req.query.anio === undefined
      ? now.getUTCFullYear()
      : Number(req.query.anio);

    if (
      !Number.isInteger(mes) ||
      mes < 1 ||
      mes > 12 ||
      !Number.isInteger(anio) ||
      anio < 2000 ||
      anio > 2100
    ) {
      res.status(400).json({ error: 'Periodo inválido' });
      return;
    }

    const desde = new Date(Date.UTC(anio, mes - 1, 1));
    const hasta = new Date(Date.UTC(anio, mes, 1));

    const [all, groups, porCategoria] = await Promise.all([
      prisma.$queryRaw<Array<{
        total_ingresos: Prisma.Decimal;
        total_gastos: Prisma.Decimal;
        balance: Prisma.Decimal;
      }>>`
        SELECT total_ingresos, total_gastos, balance
        FROM v_balance_usuario
        WHERE id_usuario = ${owner}
      `,
      prisma.movimiento.groupBy({
        by: ['tipo'],
        where: {
          id_usuario: owner,
          fecha: { gte: desde, lt: hasta }
        },
        _sum: { monto: true }
      }),
      prisma.movimiento.groupBy({
        by: ['id_categoria'],
        where: {
          id_usuario: owner,
          tipo: 'GASTO',
          fecha: { gte: desde, lt: hasta }
        },
        _sum: { monto: true }
      })
    ]);

    const ingresos = groups.find(g => g.tipo === 'INGRESO')?._sum.monto
      ?? new Prisma.Decimal(0);

    const gastos = groups.find(g => g.tipo === 'GASTO')?._sum.monto
      ?? new Prisma.Decimal(0);

    const categorias = await prisma.categoria.findMany({
      where: {
        id_categoria: {
          in: porCategoria.map(p => p.id_categoria)
        }
      },
      select: {
        id_categoria: true,
        nombre: true
      }
    });

    res.json({
      resumen: all[0] ?? {
        total_ingresos: '0.00',
        total_gastos: '0.00',
        balance: '0.00'
      },
      periodo: {
        mes,
        anio,
        ingresos,
        gastos,
        balance: ingresos.minus(gastos),
        gastos_por_categoria: porCategoria.map(p => ({
          id_categoria: p.id_categoria,
          nombre: categorias.find(c => c.id_categoria === p.id_categoria)?.nombre
            ?? 'Sin categoría',
          monto: p._sum.monto ?? new Prisma.Decimal(0)
        }))
      }
    });
  } catch (e) {
    next(e);
  }
});
