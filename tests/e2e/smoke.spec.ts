import {test,expect} from '@playwright/test';
test('página de acceso y registro',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Bienvenido a Mis Gastos'})).toBeVisible();
 await expect(page.getByLabel('Correo electrónico')).toBeVisible();
 await page.getByRole('button',{name:/Regístrate/}).click();
 await expect(page.getByRole('heading',{name:'Crea tu cuenta'})).toBeVisible();
});
// Prueba E2E completa con usuario de demostración: se ejecuta únicamente con BD local sembrada.
test('sesión local y registro de un movimiento',async({page})=>{
 test.skip(!process.env.LOCAL_DEMO_PASSWORD,'Se requiere LOCAL_DEMO_PASSWORD para esta prueba');
 await page.goto('/');
 await page.getByLabel('Correo electrónico').fill('demo@misgastos.local');
 await page.getByLabel('Contraseña').fill(process.env.LOCAL_DEMO_PASSWORD!);
 await page.getByRole('button',{name:'Ingresar'}).click();
 await expect(page.getByRole('button',{name:'Movimientos'})).toBeVisible();
 await page.getByRole('button',{name:'Movimientos'}).click();
 await page.getByLabel('Monto en quetzales').fill('19.50');
 await page.getByLabel('Descripción').fill('Prueba automática Playwright');
 await page.getByLabel('Categoría').selectOption({label:'Alimentacion'});
 await page.getByRole('button',{name:'Agregar movimiento'}).click();
 await expect(page.getByText('Prueba automática Playwright')).toBeVisible();
});
