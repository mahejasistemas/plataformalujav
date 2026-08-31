import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { verifyPassword } from "@/lib/password";
import { supabase } from "@/lib/supabase";
import { ensurePlatformSeed, formatDbError } from "@/lib/seed";

// ============================
// Login · POST /api/auth/login
//
// Body JSON: { name?: string, email: string, password: string, terms?: boolean }
//
// 1. Valida email + password (obligatorios).
// 2. Verifica dominio permitido (3 whitelist).
// 3. Verifica que el usuario EXISTA y esté ACTIVO.
// 4. Compara password con scrypt via verifyPassword.
// 5. Si el correo NO está verificado → devuelve 403 pide confirmar +
//    vuelve a disparar correo de confirmación (opcional, por ahora warning).
// 6. Genera token de sesión aleatorio, guarda HASH en user_sessions
//    y SET cookie HttpOnly `__Host-session` (Secure en producción,
//    SameSite=Lax, Path=/).
// 7. Actualiza users.last_login_at y resetea failed_login_attempts.
//
// ⚠  Todo el bloque de consultas reales a PostgreSQL está marcado como
//    "TODO" para que lo descomentes cuando tengas el driver conectado
//    (pg / kysely / drizzle / prisma). Todo el resto de la lógica ya
//    está implementada y alineada a las tablas de db/001_auth.sql
//    y db/002_signup_login.sql.
// ============================

const ALLOWED_DOMAINS: ReadonlyArray<string> = [
  "transporteslujav.com",
  "dlnforwarding.com",
  "plataformalujav.space",
] as const;

const SESSION_TOKEN_BYTES = 32; // 256 bits de entropía
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días
const SESSION_COOKIE = "__Host-session";

function domainOf(email: string): string | null {
  const idx = email.lastIndexOf("@");
  if (idx === -1) return null;
  return email.slice(idx + 1).toLowerCase();
}

function emailIsAllowed(email: string): boolean {
  const domain = domainOf(email);
  if (!domain) return false;
  return ALLOWED_DOMAINS.includes(domain);
}

function tokenB64u(bytesLen: number): string {
  return randomBytes(bytesLen)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sha256hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  is_active: boolean;
  email_verified: boolean;
  email_verified_at: Date | null;
  agreed_terms_at: Date | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  roles: string[];
};

async function lookupUserByEmail(
  email: string
): Promise<UserRow | null> {
  // 1) Buscamos el usuario base
  const { data: userData, error: userErr } = await supabase
    .from("users")
    .select(
      "id, email, name, password_hash, is_active, email_verified, email_verified_at, agreed_terms_at, failed_login_attempts, locked_until"
    )
    .eq("email", email)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (userErr) {
    console.error("[lookupUser] error buscando usuario:", userErr);
    return null;
  }
  if (!userData) return null;

  // 2) Buscamos sus roles
  const { data: rolesData, error: rolesErr } = await supabase
    .from("user_roles")
    .select("roles:roles(name)")
    .eq("user_id", userData.id);

  const roles: string[] = [];
  if (!rolesErr && rolesData) {
    for (const r of rolesData as unknown as Array<{ roles?: { name?: string } | null }>) {
      const n = r?.roles?.name;
      if (typeof n === "string" && n) roles.push(n);
    }
  }

  function toDateOrNull(v: unknown): Date | null {
    if (v == null) return null;
    const d = v instanceof Date ? v : new Date(String(v));
    return isNaN(d.getTime()) ? null : d;
  }

  return {
    id: String(userData.id),
    email: String(userData.email),
    name: String(userData.name),
    password_hash: String(userData.password_hash),
    is_active: Boolean(userData.is_active),
    email_verified: Boolean(userData.email_verified),
    email_verified_at: toDateOrNull(
      (userData as { email_verified_at?: unknown }).email_verified_at
    ),
    agreed_terms_at: toDateOrNull(userData.agreed_terms_at),
    failed_login_attempts: Number(userData.failed_login_attempts) || 0,
    locked_until: toDateOrNull(userData.locked_until),
    roles,
  };
}

async function recordLoginSuccess(
  _userId: string,
  _ip: string | undefined,
  _userAgent: string | undefined
): Promise<{ sessionToken: string; expiresAt: Date }> {
  const token = tokenB64u(SESSION_TOKEN_BYTES);
  const tokenHash = sha256hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const isoNow = new Date().toISOString();

  // 1) Actualizar last_login_at, resetear contador y bloqueo
  const { error: updErr } = await supabase
    .from("users")
    .update({
      last_login_at: isoNow,
      failed_login_attempts: 0,
      locked_until: null,
      updated_at: isoNow,
    })
    .eq("id", _userId);

  if (updErr) {
    console.error("[recordLoginSuccess] update users error:", updErr);
    throw updErr;
  }

  // 2) Insertar en user_sessions
  const sessionRow: Record<string, unknown> = {
    user_id: _userId,
    token_hash: tokenHash,
    user_agent: _userAgent ?? null,
    expires_at: expiresAt.toISOString(),
    created_at: isoNow,
  };
  if (_ip) sessionRow.ip_address = _ip;

  const { error: sessErr } = await supabase
    .from("user_sessions")
    .insert(sessionRow);

  if (sessErr) {
    console.error("[recordLoginSuccess] insert user_sessions error:", sessErr);
    throw sessErr;
  }

  return { sessionToken: token, expiresAt };
}

async function recordLoginFailure(_userIdOrEmail: string): Promise<void> {
  try {
    // Buscamos el usuario UNA SOLA VEZ y traemos failed_login_attempts.
    // Acepta tanto un UUID (id) como un email.
    const looksLikeUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        _userIdOrEmail
      );

    let row: { id: unknown; failed_login_attempts?: unknown } | null = null;
    if (looksLikeUuid) {
      const { data, error } = await supabase
        .from("users")
        .select("id, failed_login_attempts")
        .eq("id", _userIdOrEmail)
        .maybeSingle();
      if (error) throw error;
      row = data as { id: unknown; failed_login_attempts?: unknown } | null;
    }
    if (!row) {
      const { data, error } = await supabase
        .from("users")
        .select("id, failed_login_attempts")
        .eq("email", _userIdOrEmail)
        .maybeSingle();
      if (error) throw error;
      row = data as { id: unknown; failed_login_attempts?: unknown } | null;
    }
    if (!row) return;

    const userId = String(row.id);
    const currentFails = Number(row.failed_login_attempts ?? 0);

    const nextFails = currentFails + 1;
    const lockedUntil =
      nextFails >= 5
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null;

    const { error: updErr } = await supabase
      .from("users")
      .update({
        failed_login_attempts: nextFails,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (updErr) throw updErr;
  } catch (e) {
    console.warn("[recordLoginFailure] error (ignorado, 401 de salida):", e);
  }
}

export async function POST(req: Request) {
  try {
    // ===== Seed auto (roles + admin demo): evita dependencia de la migración SQL
    const seed = await ensurePlatformSeed();
    if (seed.error) {
      console.error("[login] ensurePlatformSeed falló:", seed.error);
    }

    let body: {
      name?: unknown;
      email?: unknown;
      password?: unknown;
      terms?: unknown;
    } | null = null;
    try {
      body = (await req.json()) as {
        name?: unknown;
        email?: unknown;
        password?: unknown;
        terms?: unknown;
      } | null;
    } catch {
      return NextResponse.json(
        { ok: false as const, error: "Cuerpo JSON inválido." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false as const, error: "Cuerpo inválido." },
        { status: 400 }
      );
    }

    const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
    const rawPassword =
      typeof body.password === "string" ? body.password : "";

    if (!rawEmail || !rawPassword) {
      return NextResponse.json(
        {
          ok: false as const,
          error:
            "Correo y contraseña son obligatorios para iniciar sesión.",
        },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      return NextResponse.json(
        { ok: false as const, error: "Formato de correo inválido." },
        { status: 400 }
      );
    }

    if (!emailIsAllowed(email)) {
      return NextResponse.json(
        {
          ok: false as const,
          error:
            "Dominio de correo no autorizado. Solo se permiten @transporteslujav.com, @dlnforwarding.com o @plataformalujav.space.",
        },
        { status: 403 }
      );
    }

    // Intenta leer IP y UA (para user_sessions)
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip: string | undefined = forwardedFor
      ? forwardedFor.split(",")[0]?.trim()
      : undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const user = await lookupUserByEmail(email);

    if (!user) {
      // Same response structure to avoid enumeration
      await recordLoginFailure(email);
      return NextResponse.json(
        {
          ok: false as const,
          error: "Credenciales incorrectas.",
        },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        {
          ok: false as const,
          error:
            "Tu cuenta está inactiva. Contacta al administrador de Plataforma Lujav.",
        },
        { status: 403 }
      );
    }

    if (user.locked_until && user.locked_until.getTime() > Date.now()) {
      return NextResponse.json(
        {
          ok: false as const,
          error: `Cuenta bloqueada temporalmente por intentos fallidos. Intenta nuevamente después de ${user.locked_until.toLocaleString(
            "es-CO"
          )}.`,
        },
        { status: 429 }
      );
    }

    const passwordOk = verifyPassword(rawPassword, user.password_hash);
    if (!passwordOk) {
      await recordLoginFailure(user.id);
      return NextResponse.json(
        { ok: false as const, error: "Credenciales incorrectas." },
        { status: 401 }
      );
    }

    // Casos legacy / usuarios creados manualmente: si agreed_terms_at es null
    // pero el usuario ya existe (está activo y password correcto),
    // lo damos por aceptado implícitamente y lo guardamos en la DB para futuras.
    if (!user.agreed_terms_at) {
      const now = new Date().toISOString();
      try {
        const { error: toupErr } = await supabase
          .from("users")
          .update({ agreed_terms_at: now, updated_at: now })
          .eq("id", user.id);
        if (toupErr) {
          console.warn(
            "[login] update agreed_terms_at falló (seguimos):",
            toupErr
          );
        }
      } catch (e) {
        console.warn(
          "[login] update agreed_terms_at lanzó excepción (seguimos):",
          e
        );
      }
      // Siempre damos el visto bueno en memoria para no bloquear al usuario.
      user.agreed_terms_at = new Date();
    }

    const isDev = (process.env.NODE_ENV ?? "production") !== "production";
    if (!user.email_verified && isDev) {
      // En DEVELOPMENT: marcamos el correo como verificado on-the-fly
      // y dejamos pasar el login (no necesitas Resend para probar localmente).
      const now = new Date().toISOString();
      try {
        const { error: verr } = await supabase
          .from("users")
          .update({
            email_verified: true,
            email_verified_at: now,
            updated_at: now,
          })
          .eq("id", user.id);
        // Ya sea que el update OK o falle, en DEV damos el visto bueno en memoria.
        if (verr) console.warn("[login] update email_verified falló en dev (seguimos):", verr);
      } catch (e) {
        console.warn("[login] update email_verified lanzó excepción en dev:", e);
      }
      user.email_verified = true;
      user.email_verified_at = new Date();
    }

    if (!user.email_verified) {
      return NextResponse.json(
        {
          ok: false as const,
          error:
            "Debes confirmar tu correo antes de iniciar sesión. Usa el enlace que enviamos a tu bandeja de entrada, o solicita uno nuevo en la pantalla de login.",
          code: "EMAIL_NOT_VERIFIED" as const,
        },
        { status: 403 }
      );
    }

    // Todo OK → creamos sesión y seteamos cookie HttpOnly
    const { sessionToken, expiresAt } = await recordLoginSuccess(
      user.id,
      ip,
      userAgent
    );

    const isSecure = (process.env.NODE_ENV ?? "production") === "production";

    const cookieStore = await cookies();
    await cookieStore.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return NextResponse.json({
      ok: true as const,
      message: "Sesión iniciada correctamente.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
      redirectTo: "/platform",
    });
  } catch (err) {
    console.error("[login] POST inesperado:", err);
    const real = formatDbError(err);
    return NextResponse.json(
      {
        ok: false as const,
        error:
          real?.message ||
          "No se pudo iniciar sesión. Inténtalo nuevamente en unos segundos.",
        debug: real,
      },
      { status: 500 }
    );
  }
}

// ============= Logout (misma URL, método DELETE) ============
export async function DELETE(_req: Request) {
  try {
    const isSecure =
      (process.env.NODE_ENV ?? "production") === "production";
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

    if (sessionToken) {
      const tokenHash = sha256hex(sessionToken);
      try {
        const { error: revErr } = await supabase
          .from("user_sessions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("token_hash", tokenHash)
          .is("revoked_at", null);
        if (revErr) {
          console.error("[logout] UPDATE user_sessions falló:", revErr);
        }
      } catch (err) {
        console.error(
          "[logout] UPDATE user_sessions falló (catch):",
          err
        );
      }
    }

    await cookieStore.delete({
      name: SESSION_COOKIE,
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
    });
    return NextResponse.json({
      ok: true as const,
      message: "Sesión cerrada.",
      redirectTo: "/",
    });
  } catch (err) {
    console.error("[logout] DELETE inesperado:", err);
    const real = formatDbError(err);
    return NextResponse.json(
      {
        ok: false as const,
        error:
          real?.message ||
          "No se pudo cerrar la sesión correctamente. Inténtalo nuevamente.",
        debug: real,
      },
      { status: 500 }
    );
  }
}
