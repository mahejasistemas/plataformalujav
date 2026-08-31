-- =====================================================
-- PLATAFORMA LUJAV - MASTER SQL
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(30) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO roles (name, description)
VALUES
    ('admin', 'Administrador con acceso total a la plataforma'),
    ('user',  'Usuario estandar con acceso limitado')
ON CONFLICT (name) DO NOTHING;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = CURRENT_SCHEMA
          AND table_name = 'users'
    ) THEN
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS agreed_terms_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS two_factor_secret  TEXT,
            ADD COLUMN IF NOT EXISTS last_login_at      TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS failed_login_attempts SMALLINT NOT NULL DEFAULT 0
                CHECK (failed_login_attempts >= 0),
            ADD COLUMN IF NOT EXISTS locked_until       TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS reset_token        TEXT,
            ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS deleted_at         TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS is_active          BOOLEAN NOT NULL DEFAULT true,
            ADD COLUMN IF NOT EXISTS email_verified     BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS email_verified_at  TIMESTAMPTZ;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    name                VARCHAR(200) NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    email_verified      BOOLEAN NOT NULL DEFAULT false,
    email_verified_at   TIMESTAMPTZ,
    agreed_terms_at     TIMESTAMPTZ,
    two_factor_enabled  BOOLEAN NOT NULL DEFAULT false,
    two_factor_secret   TEXT,
    last_login_at       TIMESTAMPTZ,
    failed_login_attempts SMALLINT NOT NULL DEFAULT 0
                            CHECK (failed_login_attempts >= 0),
    locked_until        TIMESTAMPTZ,
    reset_token         TEXT,
    reset_token_expires_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL
                            REFERENCES users(id) ON DELETE CASCADE,
    token_hash          TEXT NOT NULL UNIQUE,
    user_agent          TEXT,
    ip_address          INET,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at        TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION email_domain(email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
    at_pos INT;
BEGIN
    at_pos := STRPOS(BTRIM(email), '@');
    IF at_pos = 0 OR at_pos IS NULL THEN RETURN NULL; END IF;
    RETURN LOWER(SUBSTR(BTRIM(email), at_pos + 1));
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = CURRENT_SCHEMA
          AND table_name = 'users'
          AND column_name = 'email_domain'
    ) THEN
        ALTER TABLE users
            ADD COLUMN email_domain TEXT
            GENERATED ALWAYS AS (email_domain(email)) STORED;
    END IF;
END $$;

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

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_roles_updated ON roles;
CREATE TRIGGER trg_roles_updated
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP INDEX IF EXISTS idx_users_email;
CREATE INDEX idx_users_email ON users(email);

DROP INDEX IF EXISTS idx_users_email_domain;
CREATE INDEX idx_users_email_domain ON users(email_domain);

DROP INDEX IF EXISTS idx_users_active_deleted;
CREATE INDEX idx_users_active_deleted ON users(is_active, deleted_at);

DROP INDEX IF EXISTS idx_user_roles_user;
CREATE INDEX idx_user_roles_user ON user_roles(user_id);

DROP INDEX IF EXISTS idx_user_roles_role;
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

DROP INDEX IF EXISTS idx_user_sessions_token;
CREATE INDEX idx_user_sessions_token ON user_sessions(token_hash);

DROP INDEX IF EXISTS idx_user_sessions_user_active;
CREATE INDEX idx_user_sessions_user_active
    ON user_sessions(user_id)
    WHERE revoked_at IS NULL;

DROP INDEX IF EXISTS idx_user_sessions_expire;
CREATE INDEX idx_user_sessions_expire
    ON user_sessions(expires_at)
    WHERE revoked_at IS NULL;

CREATE OR REPLACE VIEW v_active_users AS
SELECT
    u.id                AS user_id,
    u.name              AS nombre_completo,
    u.email             AS correo,
    u.email_domain      AS dominio_correo,
    CASE WHEN u.email_verified THEN 'Si' ELSE 'No' END
                        AS correo_verificado,
    u.email_verified_at AS correo_verificado_el,
    CASE WHEN u.agreed_terms_at IS NOT NULL THEN 'Si' ELSE 'No' END
                        AS terminos_aceptados,
    u.agreed_terms_at   AS terminos_aceptados_el,
    u.last_login_at     AS ultimo_login_el,
    u.created_at        AS registrado_el
FROM users u
WHERE u.deleted_at IS NULL
  AND u.is_active = TRUE;

INSERT INTO users (
    email,
    password_hash,
    name,
    email_verified,
    email_verified_at,
    agreed_terms_at,
    is_active
) VALUES (
    'admin@plataformalujav.space',
    '$scrypt$N=16384$r=8$p=1$quOBtrxf1YzPnb_dNTASGw$iGhdkd0y4ey61VfuRxtMR2EwqtHujmI5iQkpubzs4uE',
    'Administrador Plataforma Lujav',
    TRUE,
    now(),
    now(),
    TRUE
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'admin'
WHERE u.email = 'admin@plataformalujav.space'
ON CONFLICT DO NOTHING;
