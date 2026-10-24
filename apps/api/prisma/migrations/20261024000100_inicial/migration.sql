-- ============================================================
-- Proyecto: Mis Gastos - Control de finanzas personales
-- Curso: Programacion Web - Seccion 01
-- Universidad Rafael Landivar - Facultad de Ingenieria
--
-- Archivo: 01_mis_gastos_schema.sql   (estructura de la base)
-- Motor:   PostgreSQL

-- ============================================================
-- 1. Tipos enumerados
-- ============================================================

CREATE TYPE rol_usuario     AS ENUM ('USUARIO', 'ADMIN');
CREATE TYPE estado_usuario  AS ENUM ('ACTIVO', 'INACTIVO');
CREATE TYPE tipo_movimiento AS ENUM ('INGRESO', 'GASTO');


-- ============================================================
-- 2. Entidad: Usuario
-- ============================================================
-- Representa tanto a los usuarios normales como a los
-- administradores. El rol es lo que los diferencia.

CREATE TABLE usuario (
    id_usuario     SERIAL          PRIMARY KEY,
    nombre         VARCHAR(100)    NOT NULL,
    correo         VARCHAR(150)    NOT NULL,
    password       VARCHAR(255)    NOT NULL,
    rol            rol_usuario     NOT NULL DEFAULT 'USUARIO',
    estado         estado_usuario  NOT NULL DEFAULT 'ACTIVO',
    fecha_registro TIMESTAMP       NOT NULL DEFAULT NOW(),

    -- El correo identifica la cuenta al iniciar sesion, por eso es unico.
    CONSTRAINT uq_usuario_correo UNIQUE (correo),

    -- Se guarda en minusculas para que "Ana@x.com" y "ana@x.com"
    -- no se registren como dos cuentas distintas.
    CONSTRAINT ck_usuario_correo_minuscula CHECK (correo = LOWER(correo)),
    CONSTRAINT ck_usuario_correo_formato   CHECK (correo LIKE '%_@_%._%'),
    CONSTRAINT ck_usuario_nombre_no_vacio  CHECK (LENGTH(TRIM(nombre)) > 0)
);

COMMENT ON TABLE  usuario          IS 'Usuarios registrados y administradores del sistema';
COMMENT ON COLUMN usuario.password IS 'Hash bcrypt de la contrasena. Nunca se guarda en texto plano';
COMMENT ON COLUMN usuario.estado   IS 'ACTIVO / INACTIVO. El administrador deshabilita cuentas cambiando este valor';


-- ============================================================
-- 3. Entidad: Categoria
-- ============================================================
-- Hay dos clases de categoria:
--   a) Predeterminada del sistema -> predeterminada = TRUE  e id_usuario = NULL
--   b) Personal de un usuario     -> predeterminada = FALSE e id_usuario = <dueno>
--
-- Por eso id_usuario es nullable, tal como quedo en el analisis.
-- El CHECK ck_categoria_dueno es el que impide combinaciones
-- incoherentes (una personal sin dueno, o una del sistema con dueno).

CREATE TABLE categoria (
    id_categoria   SERIAL           PRIMARY KEY,
    nombre         VARCHAR(60)      NOT NULL,
    tipo           tipo_movimiento  NOT NULL,
    predeterminada BOOLEAN          NOT NULL DEFAULT FALSE,
    id_usuario     INTEGER          NULL,

    CONSTRAINT fk_categoria_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
        ON UPDATE CASCADE
        ON DELETE CASCADE,   -- si se elimina el usuario, se eliminan sus categorias

    CONSTRAINT ck_categoria_nombre_no_vacio CHECK (LENGTH(TRIM(nombre)) > 0),

    CONSTRAINT ck_categoria_dueno CHECK (
        (predeterminada = TRUE  AND id_usuario IS NULL) OR
        (predeterminada = FALSE AND id_usuario IS NOT NULL)
    )
);

-- Un usuario no puede tener dos categorias con el mismo nombre y tipo.
CREATE UNIQUE INDEX uq_categoria_usuario_nombre
    ON categoria (id_usuario, LOWER(nombre), tipo)
    WHERE id_usuario IS NOT NULL;

-- Y tampoco se pueden repetir las del sistema.
-- Va en un indice aparte porque en SQL dos NULL no se consideran iguales,
-- entonces el indice de arriba no las cubre.
CREATE UNIQUE INDEX uq_categoria_sistema_nombre
    ON categoria (LOWER(nombre), tipo)
    WHERE id_usuario IS NULL;

COMMENT ON TABLE  categoria            IS 'Categorias del sistema y personales de cada usuario';
COMMENT ON COLUMN categoria.id_usuario IS 'NULL cuando la categoria es predeterminada del sistema';


-- ============================================================
-- 4. Entidad: Movimiento
-- ============================================================
-- Aqui se almacenan todos los ingresos y gastos.

CREATE TABLE movimiento (
    id_movimiento SERIAL           PRIMARY KEY,
    descripcion   VARCHAR(255)     NULL,
    monto         NUMERIC(12,2)    NOT NULL,
    fecha         TIMESTAMP        NOT NULL DEFAULT NOW(),
    tipo          tipo_movimiento  NOT NULL,
    id_usuario    INTEGER          NOT NULL,
    id_categoria  INTEGER          NOT NULL,

    CONSTRAINT fk_movimiento_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_movimiento_categoria
        FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,  -- no se puede borrar una categoria que ya tiene movimientos

    -- NUMERIC y no FLOAT: con dinero los decimales aproximados
    -- terminan dando diferencias de centavos en los totales.
    CONSTRAINT ck_movimiento_monto_positivo CHECK (monto > 0),
    CONSTRAINT ck_movimiento_fecha          CHECK (fecha <= NOW())
);

-- Indices para las consultas que realmente hace la app:
-- listar los movimientos de un usuario por fecha, y filtrar
-- por categoria o por tipo en el resumen financiero.
CREATE INDEX ix_movimiento_usuario_fecha ON movimiento (id_usuario, fecha DESC);
CREATE INDEX ix_movimiento_categoria     ON movimiento (id_categoria);
CREATE INDEX ix_movimiento_usuario_tipo  ON movimiento (id_usuario, tipo);

COMMENT ON TABLE  movimiento       IS 'Ingresos y gastos registrados por los usuarios';
COMMENT ON COLUMN movimiento.monto IS 'Monto en quetzales. NUMERIC(12,2) para no perder centavos';


-- ============================================================
-- 5. Entidad: Presupuesto
-- ============================================================
-- Cuanto quiere gastar el usuario en una categoria durante un periodo.

CREATE TABLE presupuesto (
    id_presupuesto SERIAL        PRIMARY KEY,
    monto_limite   NUMERIC(12,2) NOT NULL,
    mes            INTEGER       NOT NULL,
    anio           INTEGER       NOT NULL,
    id_usuario     INTEGER       NOT NULL,
    id_categoria   INTEGER       NOT NULL,

    CONSTRAINT fk_presupuesto_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_presupuesto_categoria
        FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT ck_presupuesto_monto CHECK (monto_limite > 0),
    CONSTRAINT ck_presupuesto_mes   CHECK (mes  BETWEEN 1 AND 12),
    CONSTRAINT ck_presupuesto_anio  CHECK (anio BETWEEN 2000 AND 2100),

    -- Un usuario solo puede tener un presupuesto por categoria en el mismo periodo.
    CONSTRAINT uq_presupuesto_periodo UNIQUE (id_usuario, id_categoria, mes, anio)
);

CREATE INDEX ix_presupuesto_usuario_periodo ON presupuesto (id_usuario, anio, mes);

COMMENT ON TABLE presupuesto IS 'Limite de gasto por categoria, mes y anio definido por el usuario';


-- ============================================================
-- 6. Reglas que un CHECK no puede resolver
-- ============================================================
-- Un CHECK solo ve columnas de su propia fila. Estas dos reglas
-- necesitan consultar la tabla categoria, por eso van en triggers.


-- 6.1 Un movimiento debe usar una categoria propia del usuario o una
--     predeterminada, y el tipo del movimiento tiene que coincidir con
--     el de la categoria (no se puede meter un INGRESO en "Transporte").
CREATE OR REPLACE FUNCTION fn_validar_movimiento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_dueno INTEGER;
    v_tipo  tipo_movimiento;
BEGIN
    SELECT id_usuario, tipo
      INTO v_dueno, v_tipo
      FROM categoria
     WHERE id_categoria = NEW.id_categoria;

    IF v_dueno IS NOT NULL AND v_dueno <> NEW.id_usuario THEN
        RAISE EXCEPTION 'La categoria % no pertenece al usuario %',
                        NEW.id_categoria, NEW.id_usuario;
    END IF;

    IF v_tipo <> NEW.tipo THEN
        RAISE EXCEPTION 'El movimiento es % pero la categoria % es de tipo %',
                        NEW.tipo, NEW.id_categoria, v_tipo;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_validar_movimiento
    BEFORE INSERT OR UPDATE ON movimiento
    FOR EACH ROW EXECUTE FUNCTION fn_validar_movimiento();


-- 6.2 Un presupuesto solo tiene sentido sobre una categoria de GASTO
--     que sea del usuario o predeterminada.
CREATE OR REPLACE FUNCTION fn_validar_presupuesto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_dueno INTEGER;
    v_tipo  tipo_movimiento;
BEGIN
    SELECT id_usuario, tipo
      INTO v_dueno, v_tipo
      FROM categoria
     WHERE id_categoria = NEW.id_categoria;

    IF v_dueno IS NOT NULL AND v_dueno <> NEW.id_usuario THEN
        RAISE EXCEPTION 'La categoria % no pertenece al usuario %',
                        NEW.id_categoria, NEW.id_usuario;
    END IF;

    IF v_tipo <> 'GASTO' THEN
        RAISE EXCEPTION 'Solo se pueden presupuestar categorias de tipo GASTO';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_validar_presupuesto
    BEFORE INSERT OR UPDATE ON presupuesto
    FOR EACH ROW EXECUTE FUNCTION fn_validar_presupuesto();


-- ============================================================
-- 7. Vistas para el resumen financiero
-- ============================================================
-- El backend consulta estas vistas en lugar de rehacer los
-- calculos en cada endpoint.


-- 7.1 Balance general del usuario (ingresos - gastos)
CREATE OR REPLACE VIEW v_balance_usuario AS
SELECT
    u.id_usuario,
    u.nombre,
    COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'INGRESO'), 0) AS total_ingresos,
    COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'GASTO'),   0) AS total_gastos,
    COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'INGRESO'), 0)
  - COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'GASTO'),   0) AS balance
FROM usuario u
LEFT JOIN movimiento m ON m.id_usuario = u.id_usuario
WHERE u.rol = 'USUARIO'
GROUP BY u.id_usuario, u.nombre;


-- 7.2 Resumen mes por mes
CREATE OR REPLACE VIEW v_resumen_mensual AS
SELECT
    m.id_usuario,
    EXTRACT(YEAR  FROM m.fecha)::INTEGER AS anio,
    EXTRACT(MONTH FROM m.fecha)::INTEGER AS mes,
    COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'INGRESO'), 0) AS ingresos,
    COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'GASTO'),   0) AS gastos,
    COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'INGRESO'), 0)
  - COALESCE(SUM(m.monto) FILTER (WHERE m.tipo = 'GASTO'),   0) AS balance
FROM movimiento m
GROUP BY m.id_usuario,
         EXTRACT(YEAR FROM m.fecha),
         EXTRACT(MONTH FROM m.fecha);


-- 7.3 Distribucion de gastos por categoria (para la grafica del dashboard)
CREATE OR REPLACE VIEW v_gastos_por_categoria AS
SELECT
    m.id_usuario,
    EXTRACT(YEAR  FROM m.fecha)::INTEGER AS anio,
    EXTRACT(MONTH FROM m.fecha)::INTEGER AS mes,
    c.id_categoria,
    c.nombre     AS categoria,
    SUM(m.monto) AS total,
    ROUND(
        100.0 * SUM(m.monto) / NULLIF(SUM(SUM(m.monto)) OVER (
            PARTITION BY m.id_usuario,
                         EXTRACT(YEAR  FROM m.fecha),
                         EXTRACT(MONTH FROM m.fecha)
        ), 0), 2
    ) AS porcentaje
FROM movimiento m
JOIN categoria c ON c.id_categoria = m.id_categoria
WHERE m.tipo = 'GASTO'
GROUP BY m.id_usuario,
         EXTRACT(YEAR  FROM m.fecha),
         EXTRACT(MONTH FROM m.fecha),
         c.id_categoria, c.nombre;


-- 7.4 Presupuesto contra lo realmente gastado
CREATE OR REPLACE VIEW v_control_presupuesto AS
SELECT
    p.id_presupuesto,
    p.id_usuario,
    c.nombre               AS categoria,
    p.mes,
    p.anio,
    p.monto_limite,
    COALESCE(g.gastado, 0) AS gastado,
    p.monto_limite - COALESCE(g.gastado, 0)                   AS disponible,
    ROUND(100.0 * COALESCE(g.gastado, 0) / p.monto_limite, 2) AS porcentaje_usado,
    (COALESCE(g.gastado, 0) > p.monto_limite)                 AS excedido
FROM presupuesto p
JOIN categoria c ON c.id_categoria = p.id_categoria
LEFT JOIN (
    SELECT id_usuario,
           id_categoria,
           EXTRACT(YEAR  FROM fecha)::INTEGER AS anio,
           EXTRACT(MONTH FROM fecha)::INTEGER AS mes,
           SUM(monto) AS gastado
    FROM movimiento
    WHERE tipo = 'GASTO'
    GROUP BY id_usuario, id_categoria,
             EXTRACT(YEAR FROM fecha), EXTRACT(MONTH FROM fecha)
) g ON g.id_usuario   = p.id_usuario
   AND g.id_categoria = p.id_categoria
   AND g.mes          = p.mes
   AND g.anio         = p.anio;


-- ============================================================
-- Fin del script de estructura.
-- Siguiente paso: ejecutar 02_mis_gastos_datos.sql
-- ============================================================