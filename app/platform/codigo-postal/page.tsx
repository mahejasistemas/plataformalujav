"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState, type FormEvent } from "react";

const RouteMap = dynamic(() => import("./route-map").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center rounded-2xl bg-white ring-1 ring-gray-200/70">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <svg className="h-4 w-4 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        Cargando mapa…
      </div>
    </div>
  ),
});

type Asentamiento = {
  nombre: string;
  tipo: string;
  ciudad: string;
  zona: string;
};

type CpResult = {
  codigo_postal: string;
  estado: string;
  municipio: string;
  ciudad: string;
  asentamientos: Asentamiento[];
};

type GeoPoint = {
  lat: number;
  lng: number;
  label: string;
  postal_code: string;
};

type RouteSummary = {
  geometry: Array<[number, number]>;
  distance_meters: number;
  duration_seconds: number;
  distance_km: string;
  duration_human: string;
  origin_name: string;
  destination_name: string;
};

type EndpointStatus<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; data: T }
  | { kind: "not_found"; message: string }
  | { kind: "error"; message: string };

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function cleanCp(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 5);
}

async function fetchCp(cp: string): Promise<EndpointStatus<CpResult>> {
  const value = cleanCp(cp);
  if (value.length !== 5) return { kind: "idle" };

  try {
    const res = await fetch(`/api/postalia/codigos-postales/${encodeURIComponent(value)}`);
    const json = (await res.json()) as
      | { ok: true; data: CpResult }
      | { ok: false; error: string };

    if (!res.ok || !("ok" in json) || json.ok === false) {
      const msg = (json as { ok: false; error: string }).error || "Ocurrió un error inesperado.";
      if (res.status === 404) return { kind: "not_found", message: msg };
      return { kind: "error", message: msg };
    }
    return { kind: "found", data: json.data };
  } catch (err) {
    return {
      kind: "error",
      message:
        err instanceof Error ? err.message : "No se pudo conectar con el servicio.",
    };
  }
}

async function geocodeCp(cp: string): Promise<EndpointStatus<GeoPoint>> {
  const value = cleanCp(cp);
  if (value.length !== 5) return { kind: "idle" };

  try {
    const res = await fetch(`/api/postalia/geocode/${encodeURIComponent(value)}`);
    const json = (await res.json()) as
      | { ok: true; data: GeoPoint }
      | { ok: false; error: string };

    if (!res.ok || !("ok" in json) || json.ok === false) {
      const msg = (json as { ok: false; error: string }).error || "No se pudo obtener la ubicación.";
      if (res.status === 404) return { kind: "not_found", message: msg };
      return { kind: "error", message: msg };
    }
    return { kind: "found", data: json.data };
  } catch (err) {
    return {
      kind: "error",
      message:
        err instanceof Error ? err.message : "Error al conectar con geocodificación.",
    };
  }
}

async function fetchRoute(
  origin: GeoPoint,
  destination: GeoPoint
): Promise<EndpointStatus<RouteSummary>> {
  try {
    const res = await fetch("/api/routing/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination }),
    });
    const json = (await res.json()) as
      | { ok: true; data: RouteSummary }
      | { ok: false; error: string };

    if (!res.ok || !("ok" in json) || json.ok === false) {
      const msg = (json as { ok: false; error: string }).error || "No se pudo calcular la ruta.";
      if (res.status === 422 || res.status === 404) return { kind: "not_found", message: msg };
      return { kind: "error", message: msg };
    }
    return { kind: "found", data: json.data };
  } catch (err) {
    return {
      kind: "error",
      message:
        err instanceof Error ? err.message : "Error al conectar con el servicio de rutas.",
    };
  }
}

export default function CodigoPostalPage() {
  const [origen, setOrigen] = useState<string>("");
  const [destino, setDestino] = useState<string>("");

  const [origenCp] = useState<EndpointStatus<CpResult>>({ kind: "idle" });
  const [destinoCp] = useState<EndpointStatus<CpResult>>({ kind: "idle" });
  const [origenGeo, setOrigenGeo] = useState<EndpointStatus<GeoPoint>>({ kind: "idle" });
  const [destinoGeo, setDestinoGeo] = useState<EndpointStatus<GeoPoint>>({ kind: "idle" });
  const [route, setRoute] = useState<EndpointStatus<RouteSummary>>({ kind: "idle" });

  const origenClean = useMemo(() => cleanCp(origen), [origen]);
  const destinoClean = useMemo(() => cleanCp(destino), [destino]);

  const anyLoading =
    origenCp.kind === "loading" ||
    destinoCp.kind === "loading" ||
    origenGeo.kind === "loading" ||
    destinoGeo.kind === "loading" ||
    route.kind === "loading";

  const runFullFlow = useCallback(async (rawFrom: string, rawTo: string) => {
    const oCp = cleanCp(rawFrom);
    const dCp = cleanCp(rawTo);
    if (oCp.length !== 5 || dCp.length !== 5) return;

    setOrigenGeo({ kind: "loading" });
    setDestinoGeo({ kind: "loading" });
    setRoute({ kind: "idle" });

    const [oGeo, dGeo] = await Promise.all([
      geocodeCp(oCp),
      geocodeCp(dCp),
    ]);
    setOrigenGeo(oGeo);
    setDestinoGeo(dGeo);

    const bothGeoOk = oGeo.kind === "found" && dGeo.kind === "found";
    if (!bothGeoOk) return;

    setRoute({ kind: "loading" });
    try {
      const routeRes = await fetchRoute(oGeo.data, dGeo.data);
      if (routeRes.kind === "found") {
        setRoute(routeRes);
      } else {
        const fallbackGeo: RouteSummary = {
          geometry: [
            [oGeo.data.lng, oGeo.data.lat],
            [dGeo.data.lng, dGeo.data.lat],
          ],
          distance_meters: 0,
          duration_seconds: 0,
          distance_km: "—",
          duration_human: "Vista aérea",
          origin_name: oGeo.data.label,
          destination_name: dGeo.data.label,
        };
        setRoute({ kind: "found", data: fallbackGeo });
      }
    } catch {
      const fallbackGeo: RouteSummary = {
        geometry: [
          [oGeo.data.lng, oGeo.data.lat],
          [dGeo.data.lng, dGeo.data.lat],
        ],
        distance_meters: 0,
        duration_seconds: 0,
        distance_km: "—",
        duration_human: "Vista aérea",
        origin_name: oGeo.data.label,
        destination_name: dGeo.data.label,
      };
      setRoute({ kind: "found", data: fallbackGeo });
    }
  }, []);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void runFullFlow(origenClean, destinoClean);
  };

  const mapOrigin =
    origenGeo.kind === "found"
      ? {
          lat: origenGeo.data.lat,
          lng: origenGeo.data.lng,
          cp: origenGeo.data.postal_code,
          label: origenGeo.data.label,
        }
      : null;
  const mapDest =
    destinoGeo.kind === "found"
      ? {
          lat: destinoGeo.data.lat,
          lng: destinoGeo.data.lng,
          cp: destinoGeo.data.postal_code,
          label: destinoGeo.data.label,
        }
      : null;

  const straightLineGeometry =
    mapOrigin && mapDest
      ? ([[mapOrigin.lng, mapOrigin.lat], [mapDest.lng, mapDest.lat]] as Array<[number, number]>)
      : null;

  const mapGeometry = route.kind === "found" && route.data.geometry && route.data.geometry.length > 0
    ? route.data.geometry
    : straightLineGeometry;

  const mapError =
    route.kind === "error" ? route.message : route.kind === "not_found" ? route.message : null;
  const isMapLoading =
    anyLoading &&
    (origenGeo.kind === "loading" || destinoGeo.kind === "loading" || route.kind === "loading");

  return (
    <div className="flex h-[calc(100dvh-theme(spacing.10)-theme(spacing.10))] min-h-0 w-full flex-col gap-4 pb-[env(safe-area-inset-bottom)] lg:h-[calc(100dvh-theme(spacing.10)-theme(spacing.10))]">
      <header className="flex flex-none flex-col gap-1">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700/80">
              Herramienta operativa
            </p>
            <h1 className="mt-0.5 truncate text-[22px] font-semibold leading-tight tracking-tight text-gray-900 sm:text-2xl">
              Ruta por Código Postal
            </h1>
          </div>
          <div className="hidden flex-none items-center gap-2 text-right sm:flex">
          </div>
        </div>
        <p className="max-w-3xl text-[13px] leading-relaxed text-gray-500">
          Ingresa origen y destino para visualizar la ruta en el mapa.
        </p>
      </header>

      <section className="flex-none rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200/70 sm:px-5 sm:py-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1 w-6 rounded-full bg-gradient-to-r from-emerald-500 to-blue-600" />
            <h2 className="text-[13px] font-semibold tracking-tight text-gray-800">
              Consulta de ruta
            </h2>
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Origen · Destino
          </span>
        </div>
        <form onSubmit={onSubmit}>
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="origen" className="text-[13px] font-medium text-gray-700">
                  Origen
                </label>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200/80">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" />
                  CP
                </span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-emerald-600">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" style={{ height: "18px", width: "18px" }} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s-7-6.3-7-12a7 7 0 1 1 14 0c0 5.7-7 12-7 12Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                </div>
                <input
                  id="origen"
                  name="origen"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="06700"
                  value={origenClean}
                  onChange={(e) => setOrigen(e.target.value)}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-[14px] font-medium tracking-wide text-gray-900 placeholder:font-normal placeholder:text-gray-400 shadow-sm transition focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div className="hidden items-end justify-center pb-1 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-500 ring-1 ring-gray-200">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="destino" className="text-[13px] font-medium text-gray-700">
                  Destino
                </label>
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-blue-700 ring-1 ring-blue-200/80">
                  <span className="h-1 w-1 rounded-full bg-blue-500" />
                  CP
                </span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                  <svg viewBox="0 0 24 24" fill="none" style={{ height: "18px", width: "18px" }} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5" />
                    <path d="M12 3v18" />
                    <path d="m5 9 4-6h10l4 6" />
                    <path d="M5 15l4 6h10l4-6" />
                  </svg>
                </div>
                <input
                  id="destino"
                  name="destino"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="64630"
                  value={destinoClean}
                  onChange={(e) => setDestino(e.target.value)}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-[14px] font-medium tracking-wide text-gray-900 placeholder:font-normal placeholder:text-gray-400 shadow-sm transition focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={anyLoading}
              className={classNames(
                "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold text-white shadow-sm transition md:w-auto",
                anyLoading
                  ? "cursor-not-allowed bg-blue-400"
                  : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
              )}
            >
              {anyLoading ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Consultando
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 3 9 15" />
                    <path d="m15 3 6 0 0 6" />
                    <path d="m5 21 6-6" />
                    <path d="M3 15v6h6" />
                  </svg>
                  Trazar ruta
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {(route.kind === "found" || route.kind === "loading") && (
        <section className="flex-none rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200/70 sm:px-5 sm:py-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1 w-6 rounded-full bg-gradient-to-r from-amber-500 to-red-500" />
              <h2 className="text-[13px] font-semibold tracking-tight text-gray-800">
                Resumen de ruta
              </h2>
            </div>
            {route.kind === "loading" ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-blue-700 ring-1 ring-blue-200/80">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Calculando
              </span>
            ) : (
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                {route.data.duration_human === "Vista aérea" ? "Vista aérea" : "Ruta vehicular"}
              </span>
            )}
          </div>

          {route.kind === "loading" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-gray-50/80 px-3 py-2.5 ring-1 ring-gray-200/60">
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-blue-600" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s-7-6.3-7-12a7 7 0 1 1 14 0c0 5.7-7 12-7 12Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  Distancia
                </div>
                <div className="mt-1.5">
                  <span className="text-[20px] font-semibold tracking-tight text-gray-900">
                    {route.data.distance_km}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50/80 px-3 py-2.5 ring-1 ring-gray-200/60">
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-emerald-600" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  Tiempo
                </div>
                <div className="mt-1.5">
                  <span className="text-[20px] font-semibold tracking-tight text-gray-900">
                    {route.data.duration_human}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50/60 px-3 py-2.5 ring-1 ring-emerald-200/60 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Origen
                </div>
                <div className="mt-1.5">
                  <p className="line-clamp-2 text-[12.5px] font-medium leading-snug text-gray-800">
                    {route.data.origin_name}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-blue-50/60 px-3 py-2.5 ring-1 ring-blue-200/60 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-blue-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Destino
                </div>
                <div className="mt-1.5">
                  <p className="line-clamp-2 text-[12.5px] font-medium leading-snug text-gray-800">
                    {route.data.destination_name}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="relative flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1 w-6 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" />
            <h2 className="text-[13px] font-semibold tracking-tight text-gray-800">
              Vista del mapa
            </h2>
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
            MapLibre · OSM
          </span>
        </div>
        <div className="relative flex min-h-0 flex-1 rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/70">
          <RouteMap
            origin={mapOrigin}
            destination={mapDest}
            geometry={mapGeometry}
            loading={isMapLoading}
            errorMessage={mapError}
          />
        </div>
      </section>
    </div>
  );
}
