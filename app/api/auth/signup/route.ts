import { NextResponse } from "next/server";
import { Resend } from "resend";
import { hashPassword } from "@/lib/password";
import {
  createSignedToken,
  buildVerificationUrl,
} from "@/lib/auth-tokens";
import { supabase } from "@/lib/supabase";
import { ensurePlatformSeed, formatDbError } from "@/lib/seed";

// ============================
// Signup · POST /api/auth/signup
//
// Body JSON: { name: string, email: string, password: string }
//
// Procesa el registro tal cual lo envía SignupForm.tsx:
//   1. Valida campos obligatorios
//   2. Valida WHITELIST de 3 dominios permitidos (igual que el CHECK constraint)
//   3. Valida longitud mínima de password (>= 8)
//   4. Hashea password con scrypt (hashPassword de lib/password.ts)
//   5. Genera token de verificación por email (firmado con HMAC)
//   6. Envía correo de confirmación por Resend
//   7. Devuelve 200 OK
//
// ⚠  El paso 4 (INSERT en users y user_roles) está marcado como TODO
//    porque NO hemos configurado aún el cliente de PostgreSQL
//    (pg / postgres / kysely / drizzle). Cuando conectes la DB
//    descomenta la sección y listo. El hash ya es compatible 1:1
//    con el formato esperado por users.password_hash (texto MCf
//    $scrypt$N=...$r=...$p=...$salt$hash)
// ============================

const ALLOWED_DOMAINS: ReadonlyArray<string> = [
  "transporteslujav.com",
  "dlnforwarding.com",
  "plataformalujav.space",
] as const;

function domainOf(email: string): string | null {
  const idx = email.lastIndexOf("@");
  if (idx === -1) return null;
  return email.slice(idx + 1).toLowerCase();
}

function emailIsAllowed(email: string): boolean {
  const domain = domainOf(email);
  if (!domain) return false;
  return (ALLOWED_DOMAINS as readonly string[]).includes(domain);
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function confirmationEmailHtml(
  userName: string,
  verificationUrl: string,
  brandName = "Plataforma Lujav",
  supportEmail = process.env.RESEND_SUPPORT_EMAIL || "support@plataformalujav.space"
): string {
  const safeName = escapeHtml(userName);
  const safeUrl = escapeHtml(verificationUrl);
  const safeBrand = escapeHtml(brandName);
  const safeSupport = escapeHtml(supportEmail);
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="es" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <title>Confirma tu correo · ${safeBrand}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif; color: #111827; }
    .wrap { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 28px 32px; color: #fff; }
    .header .brand { font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85; margin: 0 0 10px 0; }
    .header h1 { font-size: 26px; line-height: 1.2; margin: 0; font-weight: 700; }
    .body { padding: 28px 32px; }
    .body p { font-size: 15px; line-height: 1.7; margin: 0 0 16px 0; color: #374151; }
    .body p.lead { font-size: 16px; color: #111827; }
    .btn-wrap { margin: 22px 0 10px 0; text-align: center; }
    .btn { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #fff !important; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px; box-shadow: 0 8px 20px rgba(220, 38, 38, 0.25); }
    .alt-link { word-break: break-all; font-size: 13px; color: #6b7280; }
    .alt-link a { color: #991b1b; }
    .note { font-size: 13px; color: #6b7280; margin-top: 24px; line-height: 1.6; background: #fef2f2; padding: 14px 16px; border-left: 3px solid #dc2626; border-radius: 6px; }
    .footer { padding: 20px 32px 28px; border-top: 1px solid #f3f4f6; text-align: center; color: #9ca3af; font-size: 12.5px; }
    .footer p { margin: 4px 0; }
    .footer a { color: #6b7280; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <p class="brand">${safeBrand}</p>
      <h1>Confirma tu correo electrónico</h1>
    </div>
    <div class="body">
      <p class="lead">Hola, ${safeName}:</p>
      <p>Gracias por registrarte en <strong>${safeBrand}</strong>. Haz clic en el botón de abajo para confirmar tu dirección de correo y activar tu cuenta:</p>
      <div class="btn-wrap">
        <a class="btn" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Confirmar mi correo</a>
      </div>
      <p class="alt-link">Si el botón no funciona, copia y pega este enlace en tu navegador:<br/><a href="${safeUrl}">${safeUrl}</a></p>
      <div class="note">
        <strong>Nota importante:</strong> este enlace expira en <strong>60 minutos</strong>. Si el plazo se agota, inicia el proceso de confirmación nuevamente desde la pantalla de login.
      </div>
    </div>
    <div class="footer">
      <p>Si no creaste una cuenta en ${safeBrand}, ignora este mensaje.</p>
      <p>© ${year} ${safeBrand} · Soporte: <a href="mailto:${safeSupport}">${safeSupport}</a></p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: Request) {
  // ===== Seed auto (roles + admin demo): evita dependencia de la migración SQL
  const seed = await ensurePlatformSeed();
  if (seed.error) {
    console.error("[signup] ensurePlatformSeed falló:", seed.error);
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const fromName = process.env.RESEND_FROM_NAME || "Soporte Plataforma Lujav";
  const replyTo =
    process.env.RESEND_REPLY_TO ||
    process.env.RESEND_SUPPORT_EMAIL ||
    fromEmail;
  const supportEmail =
    process.env.RESEND_SUPPORT_EMAIL || "support@plataformalujav.space";

  let body: {
    name?: unknown;
    email?: unknown;
    password?: unknown;
  } | null = null;

  try {
    body = (await req.json()) as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
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

  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
  const rawPassword =
    typeof body.password === "string" ? body.password : "";

  if (!rawName || !rawEmail || !rawPassword) {
    return NextResponse.json(
      {
        ok: false as const,
        error:
          "Faltan datos obligatorios: nombre, correo empresarial y contraseña.",
      },
      { status: 400 }
    );
  }

  if (rawName.length < 2 || rawName.length > 200) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "El nombre debe tener entre 2 y 200 caracteres.",
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

  if (rawPassword.length < 8) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "La contraseña debe tener al menos 8 caracteres.",
      },
      { status: 400 }
    );
  }

  // --- Hash de password (scrypt) listo para users.password_hash ---
  let passwordHash: string;
  try {
    passwordHash = hashPassword(rawPassword);
  } catch {
    return NextResponse.json(
      {
        ok: false as const,
        error:
          "No se pudo procesar la contraseña. Intenta nuevamente en unos segundos.",
      },
      { status: 500 }
    );
  }

  // --- INSERT real en Supabase: users + user_roles ---
  try {
    const now = new Date().toISOString();
    const isDev = (process.env.NODE_ENV ?? "production") !== "production";

    // 1) Upsert del usuario en `users`
    //    En DEVELOPMENT: marcamos el correo como verificado automáticamente
    //    (no necesitas Resend ni links para probar localmente).
    //    En PRODUCTION: se mantiene email_verified=false y hay que confirmar.
    const { data: userData, error: userError } = await supabase
      .from("users")
      .upsert(
        {
          email,
          password_hash: passwordHash,
          name: rawName,
          agreed_terms_at: now,
          is_active: true,
          email_verified: isDev,
          email_verified_at: isDev ? now : null,
        },
        {
          onConflict: "email",
          ignoreDuplicates: false,
        }
      )
      .select("id");

    if (userError) {
      console.error("[signup] upsert users error:", userError);
      throw userError;
    }

    // Buscamos el ID del usuario por email (funciona tanto en insert como en update de upsert)
    const { data: foundUser, error: findErr } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    if (findErr || !foundUser) {
      console.error("[signup] no se pudo encontrar usuario tras upsert:", findErr);
      throw findErr ?? new Error("usuario-no-encontrado");
    }

    // 2) Buscamos el ID del rol "user"
    const { data: roleData, error: roleErr } = await supabase
      .from("roles")
      .select("id")
      .eq("name", "user")
      .limit(1)
      .maybeSingle();

    if (roleErr) {
      console.error("[signup] error al buscar rol user:", roleErr);
      throw roleErr;
    }
    if (!roleData) {
      throw new Error("rol-user-no-existe");
    }

    // 3) Asignar el rol (ON CONFLICT DO NOTHING)
    const { error: urError } = await supabase
      .from("user_roles")
      .insert({
        user_id: foundUser.id,
        role_id: roleData.id,
      });

    // Ignoramos error de duplicado (equivale a ON CONFLICT DO NOTHING)
    if (urError && !/duplicate|23505|unique_violation/i.test(String(urError.message ?? urError.code ?? ""))) {
      console.error("[signup] insert user_roles error:", urError);
      throw urError;
    }

    // Evitamos el warning de variable no usada (ya se usó foundUser)
    void userData;
  } catch (err) {
    console.error("[signup] INSERT en Supabase falló:", err);
    const real = formatDbError(err);
    return NextResponse.json(
      {
        ok: false as const,
        error:
          real?.message ||
          "No se pudo crear la cuenta en este momento. Inténtalo más tarde.",
        debug: real,
      },
      { status: 500 }
    );
  }

  if (!resendKey) {
    return NextResponse.json(
      {
        ok: false as const,
        error:
          "Falta configurar RESEND_API_KEY en el servidor. Contacta al administrador.",
      },
      { status: 500 }
    );
  }

  // --- Token de verificación por email (HMAC firmado) ---
  const ttl = parseInt(process.env.AUTH_TOKEN_TTL_MINUTES ?? "60", 10);
  const verificationToken = createSignedToken(
    {
      email,
      purpose: "email-confirm",
    },
    ttl
  );

  const verificationUrl = buildVerificationUrl(verificationToken);

  const resend = new Resend(resendKey);

  try {
    const html = confirmationEmailHtml(
      rawName,
      verificationUrl,
      fromName,
      supportEmail
    );

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [email],
      subject: `Confirma tu correo · ${fromName}`,
      replyTo: replyTo,
      headers: {
        "X-Entity-Ref-ID": `signup:${Buffer.from(email).toString(
          "base64url"
        )}`,
      },
      html,
    });
  } catch (err) {
    console.error("[signup] Resend falló:", err);
    return NextResponse.json(
      {
        ok: false as const,
        error:
          "No se pudo enviar el correo de confirmación. Inténtalo más tarde.",
      },
      { status: 502 }
    );
  }

  // Devolvemos OK siempre (incluso si email ya existe) para no leakear
  // cuentas registradas a atacantes de enumeración.
  return NextResponse.json({
    ok: true as const,
    message:
      "Cuenta creada. Si tu correo está autorizado, te enviaremos un enlace de confirmación en breve.",
  });
}
