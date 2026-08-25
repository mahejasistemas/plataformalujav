import { NextResponse } from "next/server";
import { Resend } from "resend";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { createSignedToken, buildVerificationUrl } from "@/lib/auth-tokens";
import { ConfirmationEmail } from "@/emails/ConfirmationEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SendConfirmationRequest = {
  email: string;
  name?: string;
};

function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
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
    const fromName = process.env.RESEND_FROM_NAME || "Plataforma Lujav";
    const ttl = Number(process.env.AUTH_TOKEN_TTL_MINUTES ?? 60);

    const token = createSignedToken(
      { email, purpose: "email-confirm" },
      ttl
    );
    const verificationUrl = buildVerificationUrl(token);

    const resend = new Resend(apiKey);

    try {
      const emailNode = ConfirmationEmail({
        userName: name,
        verificationUrl,
        expiresMinutes: ttl,
      }) as React.ReactElement;
      const html = renderToStaticMarkup(emailNode);
      await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: "Confirma tu correo - Plataforma Lujav",
        html: "<!DOCTYPE html>" + html,
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
        "Correo de confirmación enviado. Revisa tu bandeja de entrada (y spam).",
    });
  } catch (err) {
    console.error("[send-confirmation] unexpected:", err);
    return NextResponse.json(
      { ok: false, error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
