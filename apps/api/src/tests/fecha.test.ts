import { describe, it, expect } from 'vitest';
import { dateSchema, fechaSQL } from '../lib/validation';

describe('Manejo de fechas de movimientos', () => {
  it('ancla una fecha pasada al mediodía UTC', () => {
    expect(fechaSQL('2020-01-15').toISOString()).toBe('2020-01-15T12:00:00.000Z');
  });

  it('nunca devuelve un instante futuro', () => {
    // La tabla movimiento tiene CHECK (fecha <= NOW()). Si esta invariante se
    // rompe, PostgreSQL rechaza el registro y el usuario recibe un error 500.
    const hoy = new Date().toISOString().slice(0, 10);
    expect(fechaSQL(hoy).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('recorta al instante actual una fecha que todavía no ocurrió', () => {
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(fechaSQL(manana).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('acepta la fecha de hoy', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    expect(dateSchema.safeParse(hoy).success).toBe(true);
  });

  it('rechaza una fecha futura con mensaje propio', () => {
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const resultado = dateSchema.safeParse(manana);
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toBe('La fecha no puede ser futura');
    }
  });

  it('rechaza una fecha que no existe en el calendario', () => {
    expect(dateSchema.safeParse('2026-02-30').success).toBe(false);
  });
});