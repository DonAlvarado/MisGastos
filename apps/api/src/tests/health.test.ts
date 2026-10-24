import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app';

describe('API de MisGastos', () => {
  it('responde al endpoint health sin consultar PostgreSQL', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
  it('rechaza una ruta API desconocida', async () => {
    const response = await request(app).get('/api/esto-no-existe');
    expect(response.status).toBe(404);
  });
});
