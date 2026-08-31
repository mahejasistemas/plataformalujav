import { NextResponse } from "next/server";

export const revalidate = 604800;

type PostaliaColonia = {
  nombre?: string;
  tipo?: string;
  ciudad?: string;
  zona?: string;
};

type PostaliaSuccess = {
  cp: string;
  estado: string;
  municipio: string;
  ciudad?: string;
  colonias?: PostaliaColonia[];
  asentamientos?: PostaliaColonia[];
};

type PostaliaError = {
  error?: string;
  message?: string;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ cp: string }> }
) {
  try {
    const { cp } = await ctx.params;
    const rawCp = String(cp ?? "").trim();

    if (!/^\d{5}$/.test(rawCp)) {
      return NextResponse.json(
        {
          ok: false as const,
          error:
            "Código postal inválido. Debe ser una cadena numérica de exactamente 5 dígitos.",
        },
        { status: 400 }
      );
    }

    const base = (process.env.POSTALIA_API_BASE ?? "").replace(/\/$/, "");
    const token = process.env.POSTALIA_API_TOKEN;

    if (!base || !token) {
      console.error("[postalia] falta POSTALIA_API_BASE o POSTALIA_API_TOKEN");
      return NextResponse.json(
        {
          ok: false as const,
          error:
            "El servicio de códigos postales no está configurado en el servidor.",
          debug: { missing: !base ? "POSTALIA_API_BASE" : "POSTALIA_API_TOKEN" },
        },
        { status: 500 }
      );
    }

    const endpoint = `${base}/codigos-postales/${encodeURIComponent(rawCp)}`;

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      next: { revalidate: 604800 },
    });

    const text = await res.text();
    let data: PostaliaSuccess | PostaliaError | null = null;
    try {
      data = text ? (JSON.parse(text) as PostaliaSuccess | PostaliaError) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(
          {
            ok: false as const,
            error: "No se encontró información para ese código postal.",
            codigo: rawCp,
          },
          { status: 404 }
        );
      }

      if (res.status === 401 || res.status === 403) {
        console.error("[postalia] auth error:", res.status, text.slice(0, 300));
        return NextResponse.json(
          {
            ok: false as const,
            error:
              "No fue posible consultar el servicio de códigos postales (credenciales inválidas).",
            debug: { status: res.status },
          },
          { status: 502 }
        );
      }

      if (res.status === 429) {
        return NextResponse.json(
          {
            ok: false as const,
            error:
              "Límite de consultas alcanzado. Intenta nuevamente en unos segundos.",
          },
          { status: 429 }
        );
      }

      console.error("[postalia] upstream error:", res.status, text.slice(0, 500));
      return NextResponse.json(
        {
          ok: false as const,
          error:
            "No se pudo consultar el código postal en este momento. Inténtalo más tarde.",
          debug: { status: res.status, upstream: (data as PostaliaError | null)?.message || (data as PostaliaError | null)?.error || text.slice(0, 200) },
        },
        { status: 502 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "Respuesta vacía del servicio de códigos postales.",
        },
        { status: 502 }
      );
    }

    const success = data as PostaliaSuccess;
    const asentamientos = success.colonias ?? success.asentamientos ?? [];

    return NextResponse.json({
      ok: true as const,
      data: {
        codigo_postal: success.cp ?? rawCp,
        estado: success.estado ?? "",
        municipio: success.municipio ?? "",
        ciudad: success.ciudad ?? success.municipio ?? "",
        asentamientos: asentamientos.map((a) => ({
          nombre: a.nombre ?? "",
          tipo: a.tipo ?? "Colonia",
          ciudad: a.ciudad ?? "",
          zona: a.zona ?? "",
        })),
      },
    });
  } catch (err) {
    console.error("[postalia] GET inesperado:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false as const,
        error:
          "Error interno al consultar el código postal. Inténtalo nuevamente.",
        debug: { message: msg },
      },
      { status: 500 }
    );
  }
}
