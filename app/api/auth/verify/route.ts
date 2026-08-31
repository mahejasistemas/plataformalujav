import { NextResponse } from "next/server";
import { verifySignedToken } from "@/lib/auth-tokens";
import { supabase } from "@/lib/supabase";

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

    try {
      const isoNow = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("users")
        .update({
          email_verified: true,
          email_verified_at: isoNow,
          updated_at: isoNow,
        })
        .eq("email", payload.email)
        .is("deleted_at", null);

      if (updErr) {
        console.error("[verify] UPDATE users error:", updErr);
        throw updErr;
      }
    } catch (err) {
      console.error("[verify] UPDATE en Supabase falló:", err);
      return NextResponse.json(
        { ok: false, error: "Error al marcar correo como verificado." },
        { status: 500 }
      );
    }

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
