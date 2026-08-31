import { supabase } from "./supabase";
import { hashPassword, verifyPassword } from "./password";

/**
 * Helper para extraer info utilizable de un error Supabase/DB genérico.
 * Devuelve el tipo estructurado que se envía en campo `debug` en los 500,
 * para que el error real se vea en Network tab sin depender del server log.
 */
export type DbErrorInfo = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  name?: string;
};
function toStr(v: unknown): string | undefined {
  if (typeof v === "string") return v.length ? v : undefined;
  if (v == null) return undefined;
  try {
    const s = String(v);
    return s.length ? s : undefined;
  } catch {
    return undefined;
  }
}
export function formatDbError(err: unknown): DbErrorInfo | null {
  if (typeof err === "object" && err != null) {
    const e = err as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      name?: unknown;
    };
    const info: DbErrorInfo = {};
    const code = toStr(e.code); if (code) info.code = code;
    const message = toStr(e.message); if (message) info.message = message;
    const details = toStr(e.details); if (details) info.details = details;
    const hint = toStr(e.hint); if (hint) info.hint = hint;
    const name = toStr(e.name); if (name) info.name = name;
    if (Object.keys(info).length > 0) return info;
    const fallback = toStr(err);
    return fallback ? { message: fallback } : null;
  }
  const fallback = toStr(err);
  return fallback ? { message: fallback } : null;
}

/**
 * Seed de arranque server-side. Garantiza EN CUALQUIER LLAMADA (signup/login)
 * que existan los roles básicos y el usuario admin demo, SIN DEPENDER de
 * ejecutar la migración SQL manualmente. Se usa "upsert" así es idempotente
 * (no da errores si ya existen).
 */
export async function ensurePlatformSeed(): Promise<{
  rolesReady: boolean;
  adminCreated: boolean;
  error?: DbErrorInfo | unknown;
}> {
  type ExistingAdminRow = {
    id: unknown;
    password_hash?: unknown;
    email_verified_at?: unknown;
    agreed_terms_at?: unknown;
  };

  try {
    // 1) Garantizar roles básicos — 1 sola bulk query upsert en vez de 4 redondeos.
    const roleNames: ReadonlyArray<
      "admin" | "manager" | "user" | "viewer"
    > = ["admin", "manager", "user", "viewer"] as const;
    const roleRows = roleNames.map((name) => ({
      name,
      description: getRoleDescription(name),
    }));
    const { error: roleBulkErr } = await supabase
      .from("roles")
      .upsert(roleRows, {
        onConflict: "name",
        ignoreDuplicates: true,
      });
    if (roleBulkErr) throw roleBulkErr;

    // 2) Garantizar usuario admin demo — SELECT de los campos que luego
    //    realmente leemos (password_hash, email_verified_at, agreed_terms_at)
    //    para evitar lecturas undefined que disparaban UPDATE siempre.
    const adminEmail = "admin@plataformalujav.space";
    const { data: existAdminRaw, error: lookupErr } = await supabase
      .from("users")
      .select("id, password_hash, email_verified_at, agreed_terms_at")
      .eq("email", adminEmail)
      .limit(1)
      .maybeSingle();
    if (lookupErr) throw lookupErr;
    const existAdmin = existAdminRaw as ExistingAdminRow | null;

    let adminId: string | null =
      existAdmin?.id != null ? String(existAdmin.id) : null;
    let justCreated = false;

    if (!adminId) {
      const adminHash = hashPassword("Admin1234!!");
      const now = new Date().toISOString();
      const { data: inserted, error: adminInsertErr } = await supabase
        .from("users")
        .insert({
          email: adminEmail,
          name: "Administrador Plataforma",
          password_hash: adminHash,
          agreed_terms_at: now,
          is_active: true,
          email_verified: true,
          email_verified_at: now,
        })
        .select("id")
        .maybeSingle();
      if (adminInsertErr) throw adminInsertErr;
      const newId = (inserted as { id?: unknown } | null)?.id;
      adminId = newId != null ? String(newId) : null;
      justCreated = !!adminId;
    } else if (
      existAdmin &&
      typeof (existAdmin as ExistingAdminRow).password_hash === "string"
    ) {
      // Si admin ya existía PERO tiene el hash inválido viejo (generado a mano),
      // lo actualizamos a un hash válido de Admin1234!! para que el login funcione.
      const pwHash = String(
        (existAdmin as ExistingAdminRow).password_hash ?? ""
      );
      if (pwHash && !verifyPassword("Admin1234!!", pwHash)) {
        const newHash = hashPassword("Admin1234!!");
        const now = new Date().toISOString();
        const origVerified =
          (existAdmin as ExistingAdminRow).email_verified_at != null
            ? String((existAdmin as ExistingAdminRow).email_verified_at)
            : undefined;
        const origTerms =
          (existAdmin as ExistingAdminRow).agreed_terms_at != null
            ? String((existAdmin as ExistingAdminRow).agreed_terms_at)
            : undefined;
        const { error: fixErr } = await supabase
          .from("users")
          .update({
            password_hash: newHash,
            email_verified: true,
            email_verified_at: origVerified ?? now,
            agreed_terms_at: origTerms ?? now,
            is_active: true,
          })
          .eq("id", adminId);
        if (fixErr) throw fixErr;
      }
    }

    // 3) Asignar rol admin al usuario admin (solo si NO lo tiene ya)
    if (adminId) {
      const { data: adminRoleRow, error: roleFindErr } = await supabase
        .from("roles")
        .select("id")
        .eq("name", "admin")
        .limit(1)
        .maybeSingle();
      if (roleFindErr) throw roleFindErr;
      const roleId =
        adminRoleRow != null
          ? String((adminRoleRow as { id: unknown }).id)
          : null;
      if (roleId) {
        const { data: exists, error: existsErr } = await supabase
          .from("user_roles")
          .select("user_id, role_id")
          .eq("user_id", adminId)
          .eq("role_id", roleId)
          .limit(1)
          .maybeSingle();
        if (existsErr) throw existsErr;
        if (!exists) {
          const { error: assignErr } = await supabase
            .from("user_roles")
            .insert({ user_id: adminId, role_id: roleId });
          if (assignErr) {
            const info = formatDbError(assignErr);
            const isDup =
              /duplicate|23505|unique_violation/i.test(
                `${info?.code ?? ""} ${info?.message ?? ""}`.trim()
              );
            if (!isDup) throw assignErr;
          }
        }
      }
    }

    return { rolesReady: true, adminCreated: justCreated };
  } catch (err) {
    return {
      rolesReady: false,
      adminCreated: false,
      error: formatDbError(err) ?? err,
    };
  }
}

function getRoleDescription(
  name: "admin" | "manager" | "user" | "viewer"
): string {
  switch (name) {
    case "admin":
      return "Acceso total a la plataforma.";
    case "manager":
      return "Gestión operativa y de equipos.";
    case "user":
      return "Usuario estándar con acceso a dashboards asignados.";
    case "viewer":
      return "Vista de solo lectura.";
    default:
      // Unreachable bajo tipos, pero por robustez:
      return `Rol ${String(name)}.`;
  }
}
