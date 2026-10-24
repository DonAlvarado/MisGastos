# Organización de 6 integrantes

## Asignación sugerida (no rígida)

| Responsable | Entrega primaria | Revisor asociado |
| --- | --- | --- |
| 1 | Integración, configuración Docker, CI, cloud | 5 |
| 2 | Login, registro, JWT, roles, bloqueo | 6 |
| 3 | Categorías y movimientos: rutas/backend | 4 |
| 4 | Frontend: login, movimientos, categorías | 3 |
| 5 | Presupuestos y dashboard, vistas SQL | 1 |
| 6 | Admin, tests, OWASP, accesibilidad y documentación | 2 |

**Todos** deben entender el flujo completo y apoyar las pruebas; el docente evalúa dominio. La lista es organización, no exclusividad sobre archivos. Para no bloquear a una persona, los módulos de cada funcionalidad deben desarrollarse en conjunto entre UI y API.

## Estrategia de ramas y PR

- `main` estable; `develop` integración opcional. Si manejan solo `main`, usar PR obligatorios.
- Ramas cortas: `feat/auth-form`, `feat/categorias-api`, `fix/dashboard-fecha`, `docs/instalacion`.
- Un PR = un tema, vinculado con una Issue y acompañado de checklist de prueba.
- Revisar: seguridad/propiedad, migraciones, validaciones, respuesta API, UI responsiva, tests.
- Al menos 1 aprobación, CI verde, merge sin conflictos. No hacer `push --force` a `main`.

## Comandos para nuevos colaboradores

```powershell
git clone URL_DEL_REPO
cd MisGastos
git switch -c feat/mi-tarea
# editar y probar
npm run typecheck
npm test
git add .
git commit -m "feat: implementar modulo XYZ"
git push -u origin feat/mi-tarea
# abrir PR en GitHub
```

## GitHub y restricciones de planes

GitHub Free tiene opciones de protección de ramas que dependen de visibilidad/plan: en repositorios privados Free no asumir que todas las reglas de protección exigidas estén disponibles. Si una protección automática no está incluida, exigir revisiones/CI por acuerdo del equipo, con responsable de merges. No hacer público un repo únicamente para activar reglas sin revisar la política académica.

## CI

La Action instala dependencias (`npm ci`), genera Prisma, verifica TS, ejecuta tests y compila. Es esencial **commitear package-lock.json** tras el primer `npm install`; sin él, el CI fallará.

## Milestones

- Entregable 2 (29 octubre): autenticación, CRUD básico, categorías, presupuesto/visualización y conexión API-DB.
- Entregable final (19 noviembre): seguridad, pruebas frontend/backend/E2E, Docker CI/CD, despliegue, accesibilidad y rendimiento.
