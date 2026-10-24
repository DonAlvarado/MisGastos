-- SOLO DESARROLLO. NO ejecutar en producción.
-- Credenciales corregidas y verificadas con bcrypt.
-- admin@misgastos.com / Admin123!
-- ana.lopez@correo.com / Usuario123!
-- carlos.mendez@correo.com / Usuario123!

-- ============================================================
-- Proyecto: Mis Gastos
-- Archivo: 02_mis_gastos_datos.sql   (datos iniciales y de prueba)
--
-- Ejecutar DESPUES de 01_mis_gastos_schema.sql,
-- conectado a la base "mis_gastos".
-- ============================================================


-- ------------------------------------------------------------
-- 1. Categorias predeterminadas del sistema
-- ------------------------------------------------------------
-- Las administra el administrador. Van con id_usuario = NULL
-- y predeterminada = TRUE, y estan disponibles para todos.

INSERT INTO categoria (nombre, tipo, predeterminada, id_usuario) VALUES
    ('Salario',         'INGRESO', TRUE, NULL),
    ('Negocio propio',  'INGRESO', TRUE, NULL),
    ('Otros ingresos',  'INGRESO', TRUE, NULL),
    ('Alimentacion',    'GASTO',   TRUE, NULL),
    ('Transporte',      'GASTO',   TRUE, NULL),
    ('Vivienda',        'GASTO',   TRUE, NULL),
    ('Servicios',       'GASTO',   TRUE, NULL),
    ('Salud',           'GASTO',   TRUE, NULL),
    ('Universidad',     'GASTO',   TRUE, NULL),
    ('Entretenimiento', 'GASTO',   TRUE, NULL),
    ('Otros gastos',    'GASTO',   TRUE, NULL);


-- ------------------------------------------------------------
-- 2. Usuarios
-- ------------------------------------------------------------
-- El valor de password es un hash bcrypt de ejemplo. En la app real
-- el hash lo genera el backend con bcrypt antes de insertar;
-- aqui va fijo solo para poder probar.
--
--   admin@misgastos.com  ->  Admin123!
--   ana.lopez@correo.com ->  Usuario123!

INSERT INTO usuario (nombre, correo, password, rol) VALUES
    ('Administrador del sistema', 'admin@misgastos.com',
     '$2b$12$3dNqmNCV2vHZf1gEDYHIa.8N7cmDsroJCieFKOltOUX3WpaPLxEgm', 'ADMIN'),
    ('Ana Lopez', 'ana.lopez@correo.com',
     '$2b$12$qtlNF9TPBwkxcYcd9DRLEeTcqlvvmM8qHGLssUSaMwe.jrDywmCTC', 'USUARIO'),
    ('Carlos Mendez', 'carlos.mendez@correo.com',
     '$2b$12$qtlNF9TPBwkxcYcd9DRLEeTcqlvvmM8qHGLssUSaMwe.jrDywmCTC', 'USUARIO');


-- ------------------------------------------------------------
-- 3. Categorias personales de Ana
-- ------------------------------------------------------------

INSERT INTO categoria (nombre, tipo, predeterminada, id_usuario)
SELECT v.nombre, v.tipo::tipo_movimiento, FALSE, u.id_usuario
FROM usuario u
CROSS JOIN (VALUES
        ('Freelance', 'INGRESO'),
        ('Gimnasio',  'GASTO'),
        ('Mascotas',  'GASTO')
    ) AS v(nombre, tipo)
WHERE u.correo = 'ana.lopez@correo.com';


-- ------------------------------------------------------------
-- 4. Movimientos de prueba
-- ------------------------------------------------------------
-- Las fechas se calculan hacia atras desde hoy, para que el
-- resumen del mes actual siempre tenga datos.

INSERT INTO movimiento (descripcion, monto, fecha, tipo, id_usuario, id_categoria)
SELECT d.descripcion, d.monto,
       NOW() - (d.dias_atras || ' days')::INTERVAL,
       d.tipo::tipo_movimiento, u.id_usuario, c.id_categoria
FROM (VALUES
        -- Ingresos
        ('Salario',         'INGRESO', 8500.00, 'Sueldo del mes',            20),
        ('Freelance',       'INGRESO', 1200.00, 'Pagina web para cliente',   12),
        ('Otros ingresos',  'INGRESO',  350.00, 'Venta de articulos usados',  5),
        -- Gastos
        ('Vivienda',        'GASTO',   2500.00, 'Alquiler',                  20),
        ('Alimentacion',    'GASTO',    850.75, 'Compra del supermercado',   18),
        ('Alimentacion',    'GASTO',    145.50, 'Almuerzos de la semana',    11),
        ('Transporte',      'GASTO',    400.00, 'Combustible',               15),
        ('Transporte',      'GASTO',     60.00, 'Bus y parqueo',              3),
        ('Servicios',       'GASTO',    320.40, 'Luz, agua e internet',      14),
        ('Entretenimiento', 'GASTO',    180.00, 'Cine y streaming',           8),
        ('Gimnasio',        'GASTO',    250.00, 'Mensualidad',                7),
        ('Salud',           'GASTO',    475.00, 'Consulta y medicamentos',    4),
        ('Universidad',     'GASTO',    600.00, 'Pago de laboratorio',        2),
        ('Mascotas',        'GASTO',    130.90, 'Alimento para el perro',     1)
    ) AS d(categoria, tipo, monto, descripcion, dias_atras)
JOIN usuario   u ON u.correo = 'ana.lopez@correo.com'
JOIN categoria c
     ON  LOWER(c.nombre) = LOWER(d.categoria)
     AND c.tipo = d.tipo::tipo_movimiento
     AND (c.id_usuario = u.id_usuario OR c.id_usuario IS NULL);


-- ------------------------------------------------------------
-- 5. Presupuestos del mes actual
-- ------------------------------------------------------------

INSERT INTO presupuesto (monto_limite, mes, anio, id_usuario, id_categoria)
SELECT d.limite,
       EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
       EXTRACT(YEAR  FROM CURRENT_DATE)::INTEGER,
       u.id_usuario, c.id_categoria
FROM (VALUES
        ('Alimentacion',    1200.00),
        ('Transporte',       500.00),
        ('Entretenimiento',  150.00),   -- a proposito menor al gasto, para ver "excedido"
        ('Servicios',        400.00)
    ) AS d(categoria, limite)
JOIN usuario   u ON u.correo = 'ana.lopez@correo.com'
JOIN categoria c
     ON  LOWER(c.nombre) = LOWER(d.categoria)
     AND c.tipo = 'GASTO'
     AND (c.id_usuario = u.id_usuario OR c.id_usuario IS NULL);


-- ------------------------------------------------------------
-- 6. Comprobacion
-- ------------------------------------------------------------

SELECT 'usuarios'     AS tabla, COUNT(*) FROM usuario
UNION ALL SELECT 'categorias',   COUNT(*) FROM categoria
UNION ALL SELECT 'movimientos',  COUNT(*) FROM movimiento
UNION ALL SELECT 'presupuestos', COUNT(*) FROM presupuesto;

SELECT * FROM v_balance_usuario;

SELECT * FROM v_control_presupuesto ORDER BY categoria;