import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type NominatimPlace = {
  lat: string;
  lon: string;
  display_name?: string;
  class?: string;
  type?: string;
  address?: Record<string, string>;
};

type GeoPoint = {
  lat: number;
  lng: number;
  label: string;
  postal_code: string;
};

function isFinitePoint(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

async function queryNominatim(url: string): Promise<NominatimPlace[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "PlataformaLujav/1.0 (support@plataformalujav.space)",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Nominatim ${res.status}`);
  }
  const data = (await res.json()) as NominatimPlace[];
  if (!Array.isArray(data)) return [];
  return data;
}

async function getBestPoint(rawCp: string): Promise<GeoPoint | null> {
  const strategies: Array<{ url: string; priority: number }> = [
    {
      priority: 1,
      url:
        "https://nominatim.openstreetmap.org/search" +
        `?postalcode=${encodeURIComponent(rawCp)}` +
        `&country=Mexico&countrycodes=mx` +
        `&format=json&limit=3&addressdetails=1&accept-language=es`,
    },
    {
      priority: 2,
      url:
        "https://nominatim.openstreetmap.org/search" +
        `?q=${encodeURIComponent(`${rawCp}, México`)}` +
        `&countrycodes=mx&format=json&limit=3&addressdetails=0&accept-language=es`,
    },
  ];

  for (const s of strategies) {
    try {
      const places = await queryNominatim(s.url);
      for (const p of places) {
        const lat = Number(p.lat);
        const lng = Number(p.lon);
        if (isFinitePoint(lat, lng)) {
          const label =
            p.display_name && p.display_name.includes(rawCp)
              ? p.display_name
              : `${rawCp} · ${p.display_name ?? "México"}`;
          return { lat, lng, label, postal_code: rawCp };
        }
      }
    } catch {
      /* next strategy */
    }
  }
  return null;
}

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
          error: "Código postal inválido. Debe ser numérico de 5 dígitos.",
        },
        { status: 400 }
      );
    }

    const point = await getBestPoint(rawCp);
    if (!point) {
      return NextResponse.json(
        {
          ok: false as const,
          error:
            "No se encontró la ubicación para este código postal. Intenta con otro CP de México.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true as const, data: point });
  } catch (err) {
    console.error("[postalia/geocode] error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false as const,
        error: "Error interno al geocodificar el código postal.",
        debug: { message: msg },
      },
      { status: 500 }
    );
  }
}
