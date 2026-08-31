import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createSignedToken, buildVerificationUrl } from "@/lib/auth-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SendConfirmationRequest = {
  email: string;
  name?: string;
};

function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function confirmationEmailHtml(params: {
  userName: string;
  verificationUrl: string;
  expiresMinutes: number;
  brandName?: string;
  supportEmail?: string;
}): string {
  const {
    userName,
    verificationUrl,
    expiresMinutes,
    brandName = "Plataforma Lujav",
    supportEmail = process.env.RESEND_SUPPORT_EMAIL || "support@plataformalujav.space",
  } = params;

  const u = escapeHtml;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirma tu correo - ${u(brandName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;">
    <tbody>
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
            <tbody>
              <tr>
                <td style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);border-top-left-radius:12px;border-top-right-radius:12px;padding:28px 32px;color:#fff;">
                  <div style="font-size:18px;font-weight:700;letter-spacing:0.2px;">${u(brandName)}</div>
                </td>
              </tr>
              <tr>
                <td style="background-color:#ffffff;padding:32px;border-left:1px solid #f3f4f6;border-right:1px solid #f3f4f6;">
                  <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Bienvenido, ${u(userName)}!</h1>
                  <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#4b5563;">
                    Gracias por registrarte. Haz clic en el bot&oacute;n de abajo para confirmar tu direcci&oacute;n de correo y activar tu cuenta.
                  </p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
                    <tbody>
                      <tr>
                        <td style="border-radius:10px;background:#b91c1c;">
                          <a href="${u(verificationUrl)}"
                             style="display:inline-block;padding:14px 24px;color:#fff;font-weight:600;font-size:15px;text-decoration:none;border-radius:10px;"
                             target="_blank" rel="noopener noreferrer">
                            Confirmar mi correo
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#6b7280;word-break:break-all;">
                    O copia y pega este enlace en tu navegador:<br />
                    <a href="${u(verificationUrl)}" style="color:#b91c1c;text-decoration:underline;">${u(verificationUrl)}</a>
                  </p>
                  <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
                    Este enlace expira en ${Number.isFinite(expiresMinutes) ? expiresMinutes : 60} minutos. Si no solicitaste esta acci&oacute;n, puedes ignorar este correo.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#ffffff;padding:0 32px 28px;border-left:1px solid #f3f4f6;border-right:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6;border-bottom-left-radius:12px;border-bottom-right-radius:12px;font-size:12px;color:#9ca3af;line-height:1.5;">
                  <div style="margin-bottom:4px;">&copy; ${year} ${u(brandName)}. Todos los derechos reservados.</div>
                  <div>Contacto: <a href="mailto:${u(supportEmail)}" style="color:#b91c1c;text-decoration:none;">${u(supportEmail)}</a></div>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}

export async function POST(req: Request) {
  try {
    let body: Partial<SendConfirmationRequest> = {};
    try {
      body = (await req.json()) as Partial<SendConfirmationRequest>;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Cuerpo JSON inválido." },
        { status: 400 }
      );
    }

    const email = body.email;
    const name = body.name?.trim() || "Usuario";

    if (!isEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Correo electrónico inválido." },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Servicio de correo no configurado: falta RESEND_API_KEY en variables de entorno.",
        },
        { status: 500 }
      );
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const fromName = process.env.RESEND_FROM_NAME || "Soporte Plataforma Lujav";
    const replyTo = process.env.RESEND_REPLY_TO || process.env.RESEND_FROM_EMAIL || fromEmail;
    const resolvedSupportEmail = process.env.RESEND_SUPPORT_EMAIL || "support@plataformalujav.space";
    const ttl = Number(process.env.AUTH_TOKEN_TTL_MINUTES ?? 60);

    const token = createSignedToken(
      { email, purpose: "email-confirm" },
      ttl
    );
    const verificationUrl = buildVerificationUrl(token);
    const html = confirmationEmailHtml({
      userName: name,
      verificationUrl,
      expiresMinutes: ttl,
      supportEmail: resolvedSupportEmail,
    });

    const resend = new Resend(apiKey);

    try {
      await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        replyTo: replyTo,
        to: [email],
        subject: "Confirma tu correo - Plataforma Lujav",
        html,
      });
    } catch (err) {
      console.error("[resend] send error:", err);
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo enviar el correo de confirmación. Revisa la configuración de Resend.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        "Correo de confirmación enviado. Revisa tu bandeja de entrada.",
    });
  } catch (err) {
    console.error("[send-confirmation] unexpected:", err);
    return NextResponse.json(
      { ok: false, error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
