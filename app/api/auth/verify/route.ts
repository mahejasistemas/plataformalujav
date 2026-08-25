import { NextResponse } from "next/server";
import { verifySignedToken } from "@/lib/auth-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type VerifyRequest = {
  token: string;
};

export async function POST(req: Request) {
  try {
    let body: Partial<VerifyRequest> = {};
    try {
      body = (await req.json()) as Partial<VerifyRequest>;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Cuerpo JSON inválido." },
        { status: 400 }
      );
    }

    const token = body.token;
    if (typeof token !== "string" || !token) {
      return NextResponse.json(
        { ok: false, error: "Token faltante." },
        { status: 400 }
      );
    }

    const payload = verifySignedToken(token, "email-confirm");
    if (!payload) {
      return NextResponse.json(
        { ok: false, error: "Token inválido o expirado." },
        { status: 401 }
      );
    }

    // TODO: cuando se conecte la DB, actualizar aquí:
    // UPDATE users SET email_verified=true, email_verified_at=NOW() WHERE email=payload.email AND deleted_at IS NULL;

    return NextResponse.json({
      ok: true,
      email: payload.email,
      message: "Correo verificado correctamente.",
    });
  } catch (err) {
    console.error("[verify] unexpected:", err);
    return NextResponse.json(
      { ok: false, error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
