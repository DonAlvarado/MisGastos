import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';

describe('Validaciones HTTP de seguridad', () => {
  it('rechaza una mutación que viene de otro origen', async () => {
    const response = await request(app)
      .delete('/api/movimientos/1')
      .set('Origin', 'https://sitio-ajeno.example');
    expect(response.status).toBe(403);
  });

  it('rechaza un login que viene de otro origen', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://sitio-ajeno.example')
      .send({ correo: 'alguien@example.com', password: 'loquesea' });
    expect(response.status).toBe(403);
  });

  it('corta los cuerpos JSON que superan el límite', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'a'.repeat(60000), password: 'abcdef' });
    expect(response.status).toBe(413);
  });
});
