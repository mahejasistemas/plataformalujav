import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type RoutePoint = { lat: number; lng: number };

type OsrmResponse = {
  code: string;
  routes?: Array<{
    geometry: string | { coordinates: Array<[number, number]> };
    distance: number;
    duration: number;
    legs?: Array<{ distance: number; duration: number; summary?: string }>;
  }>;
  waypoints?: Array<{ name: string; location: [number, number] }>;
};

type RouteSummary = {
  geometry: Array<[number, number]>; // [lng, lat]
  distance_meters: number;
  duration_seconds: number;
  distance_km: string;
  duration_human: string;
  origin_name: string;
  destination_name: string;
};

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

function decodePolyline(str: string, precision: number = 5): Array<[number, number]> {
  const factor = Math.pow(10, precision);
  const coordinates: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const len = str.length;

  while (index < len) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push([lng / factor, lat / factor]);
  }
  return coordinates;
}

function isValidPoint(p: unknown): p is RoutePoint {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  const lat = Number(o.lat);
  const lng = Number(o.lng);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export async function POST(req: Request) {
  try {
    let body: { origin?: unknown; destination?: unknown } | null = null;
    try {
      body = (await req.json()) as { origin?: unknown; destination?: unknown };
    } catch {
      return NextResponse.json(
        { ok: false as const, error: "Cuerpo JSON inválido." },
        { status: 400 }
      );
    }

    if (!body || !isValidPoint(body.origin) || !isValidPoint(body.destination)) {
      return NextResponse.json(
        {
          ok: false as const,
          error:
            "Origen y destino son obligatorios y deben ser objetos con lat y lng numéricos válidos.",
        },
        { status: 400 }
      );
    }

    const o = body.origin as RoutePoint;
    const d = body.destination as RoutePoint;

    const coords = `${o.lng.toFixed(6)},${o.lat.toFixed(6)};${d.lng.toFixed(6)},${d.lat.toFixed(6)}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${encodeURIComponent(coords)}?overview=full&geometries=polyline&steps=false&alternatives=false`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PlataformaLujav/1.0 (support@plataformalujav.space)",
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "No se pudo calcular la ruta en este momento.",
          debug: { status: res.status, upstream: await res.text().then((t) => t.slice(0, 250)).catch(() => "") },
        },
        { status: 502 }
      );
    }

    const data = (await res.json()) as OsrmResponse;
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return NextResponse.json(
        {
          ok: false as const,
          error:
            "No existe una ruta vehicular disponible entre estos dos puntos. Prueba con otro par de códigos postales.",
        },
        { status: 422 }
      );
    }

    const route = data.routes[0];
    const geometry =
      typeof route.geometry === "string"
        ? decodePolyline(route.geometry, 5)
        : Array.isArray(route.geometry?.coordinates)
          ? route.geometry!.coordinates
          : [];

    const waypoints = data.waypoints ?? [];
    const origin_name = waypoints[0]?.name || `Origen (${o.lat.toFixed(4)}, ${o.lng.toFixed(4)})`;
    const destination_name =
      waypoints[1]?.name ||
      `Destino (${d.lat.toFixed(4)}, ${d.lng.toFixed(4)})`;

    const summary: RouteSummary = {
      geometry,
      distance_meters: Number(route.distance) || 0,
      duration_seconds: Number(route.duration) || 0,
      distance_km: formatDistance(Number(route.distance) || 0),
      duration_human: formatDuration(Number(route.duration) || 0),
      origin_name,
      destination_name,
    };

    return NextResponse.json({ ok: true as const, data: summary });
  } catch (err) {
    console.error("[routing/route] error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false as const,
        error: "Error interno al calcular la ruta.",
        debug: { message: msg },
      },
      { status: 500 }
    );
  }
}
