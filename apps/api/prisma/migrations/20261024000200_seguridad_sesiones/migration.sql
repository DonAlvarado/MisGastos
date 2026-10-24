-- Control de intentos fallidos y revocación global de JWT en logout.
ALTER TABLE usuario
 ADD COLUMN intentos_fallidos INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN bloqueado_hasta TIMESTAMP NULL,
 ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuario ADD CONSTRAINT ck_intentos_fallidos CHECK (intentos_fallidos >= 0);
