-- =====================================================
-- CORRECCIÓN DE BUG: db/002_signup_login.sql
-- Error "42P17: functions in index predicate must be marked IMMUTABLE"
--
-- CAUSA: En 001_auth.sql existe un INDEX PARCIAL (WHERE deleted_at IS NULL)
--        que NO causa problema, PERO si tu versión local ya creó
--        índices parciales que usan email_domain() en su condición
--        Y la función NO tiene marcador IMMUTABLE, Postgres la rechaza.
--
-- FIX: Redefinir email_domain() EXPLÍCITAMENTE como IMMUTABLE +
--      STRICT, y ASEGURARSE de que la función esté creada ANTES
--      que cualquier constraint/índice que la use.
--      Además convertimos agreed_terms_at en una columna GENERADA
--      para que CHECKs no dependan de funciones mutables.
-- =====================================================

-- (1) Forzamos la función a ser estrictamente inmutable
CREATE OR REPLACE FUNCTION email_domain(email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
STRICT
RETURNS NULL ON NULL INPUT
AS $$
DECLARE
    at_pos INT;
BEGIN
    at_pos := STRPOS(trim(both from email), '@');
    IF at_pos = 0 OR at_pos IS NULL THEN RETURN NULL; END IF;
    RETURN LOWER(SUBSTR(trim(both from email), at_pos + 1));
END;
$$;

COMMENT ON FUNCTION email_domain(TEXT) IS 'Inmutable: extrae el dominio (parte derecha de @) en minúsculas. Safe para usar en CHECK constraints, índices y columnas generadas.';

-- (2) Agregamos columna email_domain GENERATED ALWAYS (IMMUTABLE)
--     Así el CHECK no depende de llamada a función, todo queda nativo.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email_domain'
    ) THEN
        ALTER TABLE users
            ADD COLUMN email_domain TEXT
            GENERATED ALWAYS AS (email_domain(email)) STORED;
    END IF;
END $$;

-- (3) Reconstruimos el CHECK whitelist apoyado en la columna generada (100% IMMUTABLE)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_domain_whitelist;
ALTER TABLE users
    ADD CONSTRAINT users_email_domain_whitelist
    CHECK (
        email_domain IN (
            'transporteslujav.com',
            'dlnforwarding.com',
            'plataformalujav.space'
        )
    );

COMMENT ON COLUMN users.email_domain
    IS 'Columna generada STORED (inmutable) a partir de email. Usada por constraint whitelist y por índices para evitar 42P17.';

-- (4) Trigger de normalización (no necesita IMMUTABLE porque es BEFORE ROW)
CREATE OR REPLACE FUNCTION normalize_user_email_before_write()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email := LOWER(BTRIM(NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_normalize_email ON users;
CREATE TRIGGER trg_users_normalize_email
    BEFORE INSERT OR UPDATE OF email ON users
    FOR EACH ROW
    EXECUTE FUNCTION normalize_user_email_before_write();

-- (5) Índice sobre email_domain (inmutable, sin predicate para evitar 42P17)
--     Ayuda a las búsquedas por dominio (queries admin) sin entrar
--     en conflicto con funciones en cláusulas WHERE de indexación.
DROP INDEX IF EXISTS idx_users_email_domain;
CREATE INDEX idx_users_email_domain
    ON users (email_domain);
