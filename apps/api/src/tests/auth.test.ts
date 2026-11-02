import {describe,it,expect} from 'vitest';
import request from 'supertest';
import {app} from '../app';
describe('Validación de autenticación',()=>{
 it('rechaza registro con contraseña muy corta antes de consultar BD',async()=>{
  const r = await request(app)
  .post('/api/auth/register')
  .send({
    nombre: 'Test',
    correo: 'test@example.com',
    password: '123'
  });
  expect(r.status).toBe(400);
 });
 it('no muestra sesión si no hay cookie',async()=>{
  const r=await request(app).get('/api/auth/me');expect(r.status).toBe(401);
 });
});
