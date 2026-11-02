import { Router } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middleware/auth';

export const dashboardRouter = Router();

// Resumen de ingresos, gastos y balance del usuario (vista v_balance_usuario).
dashboardRouter.get('/', requireAuth, requireRole('USUARIO'), async (req, res, next) => {
  try {
    const id = req.currentUser!.id_usuario;
    const rows = await prisma.$queryRaw<Array<{ total_ingresos: Prisma.Decimal; total_gastos: Prisma.Decimal; balance: Prisma.Decimal }>>`
      SELECT total_ingresos, total_gastos, balance FROM v_balance_usuario WHERE id_usuario = ${id}`;
    res.json({ resumen: rows[0] ?? { total_ingresos: '0.00', total_gastos: '0.00', balance: '0.00' } });
  } catch (e) { next(e); }
});