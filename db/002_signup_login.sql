-- =====================================================
-- PLATAFORMA LUJAV · Migración 002
-- Ajustes a las tablas de autenticación para ALINEARSE
-- EXACTAMENTE con los formularios de Signup y Login actuales
-- PostgreSQL (sign-up-form.tsx + login-form.tsx)
-- =====================================================

-- =====================================================
-- 1. AJUSTES A LA TABLA users (campos del SIGNUP)
--    Campos que faltaban para coincidir con el formulario:
--    - Nombre completo (ya existía name VARCHAR(200))
--    - Email empresarial (ya existía email UNIQUE)
--    - Dominio de correo RESTRINGIDO a 3 dominios autorizados:
--        @transporteslujav.com
--        @dlnforwarding.com
--        @plataformalujav.space
--    - Contraseña (ya existía password_hash)
--    - Confirmación "Acepto Términos & Políticas → agreed_terms_at
-- =====================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS agreed_terms_at TIMESTAMPTZ;

COMMENT ON COLUMN users.agreed_terms_at
    IS 'Fecha-hora en que el usuario aceptó los Términos & Políticas al hacer clic en el checkbox del Signup. NULL significa que NO aceptó (no podrá iniciar sesión hasta que acepte).';

-- Función helper para extraer el dominio de un email (case-insensitive)
CREATE OR REPLACE FUNCTION email_domain(email TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(split_part(trim(email), '@', 2));
END;
$$ LANGUAGE plpgsql IMMUTABLE RETURNS NULL ON NULL INPUT;

COMMENT ON FUNCTION email_domain(TEXT)
    IS 'Devuelve la parte de la derecha de la @ en un correo, en minúsculas. Usado para la restricción WHITELIST de dominios permitidos en Signup.';

-- =====================================================
-- RESTICCIÓN WHITELIST de DOMINIOS PERMITIDOS
-- Impide INSERT o UPDATEar un email que NO pertenezca
-- a los 3 dominios autorizados por el formulario de Signup
-- =====================================================
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_email_domain_whitelist;

ALTER TABLE users
    ADD CONSTRAINT users_email_domain_whitelist
    CHECK (
        email_domain(email) IN (
            'transporteslujav.com',
            'dlnforwarding.com',
            'plataformalujav.space'
        )
    );

COMMENT ON CONSTRAINT users_email_domain_whitelist ON users
    IS 'Solo se permiten correos empresariales de @transporteslujav.com, @dlnforwarding.com o @plataformalujav.space. Coincide con la validación frontend de SignupForm.';

-- =====================================================
-- TRIGGER: Normaliza el email (minúsculas + trim) ANTES de INSERT/UPDATE
-- Así nadie se escapa de la whitelist por Mayúsculas / espacios
-- =====================================================
CREATE OR REPLACE FUNCTION normalize_user_email_before_write()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email = lower(btrim(NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_normalize_email ON users;
CREATE TRIGGER trg_users_normalize_email
    BEFORE INSERT OR UPDATE OF email ON users
    FOR EACH ROW EXECUTE FUNCTION normalize_user_email_before_write();

-- =====================================================
-- 2. TABLA: user_sessions  (soporta el LOGIN)
-- Almacena las sesiones iniciadas por cada usuario tras un login exitoso.
-- Relacion 1:N con users. Es "sesiones en navegadores.
-- Se usa para mantener iniciada sin guardar contraseña en el browser
-- en el cliente (junto a una cookie HttpOnly)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL
                            REFERENCES users(id) ON DELETE CASCADE,
    token_hash          TEXT NOT NULL UNIQUE,
    user_agent          TEXT,
    ip_address          INET,
    expires_at        TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at   TIMESTAMPTZ,
    revoked_at         TIMESTAMPTZ
);

COMMENT ON TABLE user_sessions
    IS 'Sesiones de usuario creadas tras un LOGIN exitoso. Cada fila = un navegador / dispositivo conectado.';

COMMENT ON COLUMN user_sessions.token_hash
    IS 'Hash SHA-256 del token de sesión (no del token en claro). Comparte el mismo patrón de seguridad que password_hash: NUNCA guardamos el token real en DB.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id_active ON user_sessions(user_id) WHERE revoked_at IS NULL AND expires_at > now();
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions(expires_at) WHERE revoked_at IS NULL;

-- =====================================================
-- 3. VISTA: v_active_users
-- Ayuda a debuggear rápido que los usuarios registrados y su última vez que iniciaron sesión
-- (no es obligatoria, pero útil para el backend/
-- =====================================================
CREATE OR REPLACE VIEW v_active_users AS
SELECT
    u.id                       AS user_id,
    u.name                     AS nombre_completo,
    u.email                    AS correo,
    email_domain(u.email)       AS dominio_correo,
    CASE WHEN u.email_verified
        THEN 'Sí'
        ELSE 'No'
    END                                 AS correo_verificado,
    u.email_verified_at                AS correo_verificado_el,
    CASE WHEN u.agreed_terms_at IS NOT NULL
        THEN 'Sí'
        ELSE 'No'
    END                                 AS terminos_aceptados,
    u.agreed_terms_at                   AS terminos_aceptados_el,
    u.last_login_at                     AS ultimo_login_el,
    u.created_at                      AS registrado_el
FROM users u
WHERE u.deleted_at IS NULL
  AND u.is_active = TRUE;

COMMENT ON VIEW v_active_users
    IS 'Vista rápida de usuarios activos con campos útiles para admins.';

-- =====================================================
-- 4. DATOS INICIALES (OPCIONAL): usuario ADMIN
-- Usuario administrador inicial (cambiar password_hash EN PRODUCCIÓN !!!!
-- El hash NO lo insertamos CON salt = 'admin@plataformalujav.space)
-- La contraseña "Admin123** es SÓLO para TESTEO LOCAL.
-- Cámbiala en el primer login inicial.
-- =====================================================
--
-- DESCOMENTA para generar usuario admin inicial:
--
-- INSERT INTO users (email, password_hash, name, email_verified, email_verified_at, agreed_terms_at, is_active) VALUES (
--     'admin@plataformalujav.space',
--    -- ⚠ Sustituye por el hash REAL de scrypt de tu librería /password.ts
--     -- Puedes generar el hash ejecutando: node -e "const {hash} = require('./.next /\nconst cryptoS = require('crypto');\nconst crypto.scrypt('Admin1234!!  etc)"
--     -- Y PEGAR AQUÍ el salt:'
--     '$scrypt$N=16384$r=8$p=1$... hash_aqui',
--     'Administrador Plataforma',
--     TRUE,
--     now(),
--     now(),
--     TRUE
-- )
-- ON CONFLICT (email) DO NOTHING;
--
-- -- Añade rol admin al admin
-- INSERT INTO user_roles (user_id, role_id)
-- SELECT u.id, r.id FROM users u
-- JOIN roles r ON r.name = 'admin'
-- WHERE u.email = 'admin@plataformalujav.space'
-- ON CONFLICT DO NOTHING;
