import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app';

describe('API de MisGastos (sin requerir BD)', () => {
  it('responde al endpoint health sin consultar PostgreSQL', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('rechaza una ruta API desconocida', async () => {
    const response = await request(app).get('/api/esto-no-existe');
    expect(response.status).toBe(404);
  });

  it('exige sesión para consultar movimientos', async () => {
    const response = await request(app).get('/api/movimientos');
    expect(response.status).toBe(401);
  });

  it('exige sesión para entrar a administración', async () => {
    const response = await request(app).get('/api/admin/usuarios');
    expect(response.status).toBe(401);
  });

  it('no deja en caché las respuestas del API', async () => {
    const response = await request(app).get('/api/health');
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
