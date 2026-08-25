-- =====================================================
-- PLATAFORMA LUJAV - Tablas de Autenticación y Roles
-- PostgreSQL
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA: roles
-- Catálogo de roles del sistema (admin, user)
-- Separada de users porque NO se muestra en login
-- =====================================================
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(30) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Datos iniciales
INSERT INTO roles (name, description) VALUES
    ('admin', 'Administrador con acceso total a la plataforma'),
    ('user',  'Usuario estándar con acceso limitado');

-- =====================================================
-- TABLA: users
-- Usuarios del sistema, ligada al auth
-- Esta tabla SÍ se usa en login/registro
-- =====================================================
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    name                VARCHAR(200) NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    email_verified      BOOLEAN NOT NULL DEFAULT false,
    email_verified_at   TIMESTAMPTZ,
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

-- =====================================================
-- TABLA: user_roles
-- Relación many-to-many: un usuario tiene UN o varios roles
-- Se consulta después del login, no en el formulario
-- =====================================================
CREATE TABLE user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, role_id)
);

-- =====================================================
-- ÍNDICES
-- =====================================================

-- Login por email
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;

-- Buscar roles de un usuario (consulta post-login)
CREATE INDEX idx_user_roles_user ON user_roles(user_id);

-- Verificar si un rol tiene usuarios asignados
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- =====================================================
-- TRIGGER: updated_at automático
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_roles_updated
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
