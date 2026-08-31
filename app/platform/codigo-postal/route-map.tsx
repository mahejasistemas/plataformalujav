"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map, Marker, LngLatBounds } from "maplibre-gl";

type RouteMapProps = {
  origin: { lat: number; lng: number; cp?: string; label?: string } | null;
  destination: { lat: number; lng: number; cp?: string; label?: string } | null;
  geometry: Array<[number, number]> | null;
  loading?: boolean;
  errorMessage?: string | null;
};

const OSM_LIBRE_STYLE: import("maplibre-gl").StyleSpecification = {
  version: 8,
  sources: {
    "raster-tiles": {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "raster-tiles",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
};

function isValidCoordinateTuple(
  c: unknown
): c is [number, number] {
  if (!Array.isArray(c) || c.length < 2) return false;
  const [lng, lat] = c as [unknown, unknown];
  if (typeof lng !== "number" || typeof lat !== "number") return false;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false;
  return true;
}

export function RouteMap({
  origin,
  destination,
  geometry,
  loading,
  errorMessage,
}: RouteMapProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<Map | null>(null);
  const originMarker = useRef<Marker | null>(null);
  const destMarker = useRef<Marker | null>(null);
  const routeSourceId = "route-traffic-lujav";
  const routeLayerId = "route-traffic-lujav-line";
  const routeLayerCasingId = "route-traffic-lujav-casing";
  const sourcesLayersDone = useRef(false);
  const paintStateRef = useRef<{
    origin: RouteMapProps["origin"];
    destination: RouteMapProps["destination"];
    geometry: RouteMapProps["geometry"];
  }>({ origin: null, destination: null, geometry: null });

  useEffect(() => {
    paintStateRef.current = { origin, destination, geometry };
  }, [origin, destination, geometry]);

  const ensureSourceAndLayers = (inst: Map): boolean => {
    if (sourcesLayersDone.current) return true;

    if (!inst.getSource(routeSourceId)) {
      try {
        inst.addSource(routeSourceId, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      } catch {
        return false;
      }
    }
    if (!inst.getSource(routeSourceId)) return false;

    if (!inst.getLayer(routeLayerCasingId)) {
      try {
        inst.addLayer({
          id: routeLayerCasingId,
          type: "line",
          source: routeSourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#1e3a8a",
            "line-width": 7,
            "line-opacity": 0.35,
          },
        });
      } catch {
        /* ignore */
      }
    }
    if (!inst.getLayer(routeLayerId)) {
      try {
        inst.addLayer({
          id: routeLayerId,
          type: "line",
          source: routeSourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#1d4ed8",
            "line-width": 4.5,
          },
        });
      } catch {
        /* ignore */
      }
    }

    sourcesLayersDone.current = !!(
      inst.getLayer(routeLayerId) && inst.getLayer(routeLayerCasingId)
    );
    return true;
  };

  const paintCurrentState = () => {
    const inst = mapInstance.current;
    if (!inst) return;
    if (!ensureSourceAndLayers(inst)) return;

    const { origin: curO, destination: curD, geometry: curG } =
      paintStateRef.current;

    const cleanGeo = (curG ?? []).filter(isValidCoordinateTuple);

    try {
      const src = inst.getSource(routeSourceId) as
        | { setData: (d: unknown) => void }
        | undefined;
      if (src && "setData" in src) {
        src.setData({
          type: "FeatureCollection",
          features:
            cleanGeo.length >= 2
              ? [
                  {
                    type: "Feature" as const,
                    properties: {},
                    geometry: {
                      type: "LineString" as const,
                      coordinates: cleanGeo,
                    },
                  },
                ]
              : [],
        });
      }
    } catch {
      /* ignore */
    }

    const points: Array<{
      point: [number, number];
      kind: "o" | "d";
    }> = [];
    if (curO) points.push({ point: [curO.lng, curO.lat], kind: "o" });
    if (curD) points.push({ point: [curD.lng, curD.lat], kind: "d" });

    for (const p of points) {
      const existing = p.kind === "o" ? originMarker.current : destMarker.current;
      if (existing) continue;
      const isOrigin = p.kind === "o";
      const el = document.createElement("div");
      const bg = isOrigin ? "#10b981" : "#2563eb";
      const ring = isOrigin ? "rgba(16,185,129,0.2)" : "rgba(37,99,235,0.2)";
      el.innerHTML = `
        <div style="position:relative;width:36px;height:36px;border-radius:9999px;background:${bg};color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 16px rgba(15,23,42,0.18);box-shadow:0 0 0 4px ${ring};">
          ${isOrigin ? "O" : "D"}
          <span style="position:absolute;left:50%;bottom:-4px;transform:translateX(-50%) rotate(45deg);width:8px;height:8px;background:${bg};"></span>
        </div>`;
      try {
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat(p.point)
          .addTo(inst);
        if (isOrigin) originMarker.current = marker;
        else destMarker.current = marker;
      } catch {
        /* ignore */
      }
    }

    if (!curO) {
      try {
        originMarker.current?.remove();
      } catch {
        /* noop */
      }
      originMarker.current = null;
    } else if (originMarker.current) {
      try {
        originMarker.current.setLngLat([curO.lng, curO.lat]);
      } catch {
        /* noop */
      }
    }
    if (!curD) {
      try {
        destMarker.current?.remove();
      } catch {
        /* noop */
      }
      destMarker.current = null;
    } else if (destMarker.current) {
      try {
        destMarker.current.setLngLat([curD.lng, curD.lat]);
      } catch {
        /* noop */
      }
    }

    const pairs: Array<[number, number]> = [];
    if (curO && isValidCoordinateTuple([curO.lng, curO.lat])) pairs.push([curO.lng, curO.lat]);
    if (curD && isValidCoordinateTuple([curD.lng, curD.lat])) pairs.push([curD.lng, curD.lat]);
    if (cleanGeo.length >= 2) {
      const lngs = cleanGeo.map((c) => c[0]);
      const lats = cleanGeo.map((c) => c[1]);
      pairs.push([Math.min(...lngs), Math.min(...lats)]);
      pairs.push([Math.max(...lngs), Math.max(...lats)]);
    }
    if (pairs.length >= 2) {
      try {
        const sw = pairs.reduce<[number, number]>(
          (acc, p) => [Math.min(acc[0], p[0]), Math.min(acc[1], p[1])],
          [Infinity, Infinity]
        );
        const ne = pairs.reduce<[number, number]>(
          (acc, p) => [Math.max(acc[0], p[0]), Math.max(acc[1], p[1])],
          [-Infinity, -Infinity]
        );
        const bounds = new maplibregl.LngLatBounds(sw, ne) as LngLatBounds;
        const diffLng = Math.abs(ne[0] - sw[0]);
        const paddingPx = Math.max(28, Math.min(88, diffLng > 10 ? 48 : 80));
        inst.fitBounds(bounds, {
          padding: { top: paddingPx, bottom: paddingPx, left: paddingPx, right: paddingPx },
          duration: 700,
          maxZoom: 13,
        });
      } catch {
        /* noop */
      }
    } else if (curO && isValidCoordinateTuple([curO.lng, curO.lat])) {
      try {
        inst.flyTo({ center: [curO.lng, curO.lat], zoom: 11, duration: 500 });
      } catch {
        /* noop */
      }
    } else if (curD && isValidCoordinateTuple([curD.lng, curD.lat])) {
      try {
        inst.flyTo({ center: [curD.lng, curD.lat], zoom: 11, duration: 500 });
      } catch {
        /* noop */
      }
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstance.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: OSM_LIBRE_STYLE,
      center: [-102.5528, 23.6345],
      zoom: 4.2,
      trackResize: true,
    });
    mapInstance.current = map;

    try {
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right"
      );
      map.addControl(
        new maplibregl.ScaleControl({ unit: "metric", maxWidth: 120 }),
        "bottom-left"
      );
    } catch {
      /* optional */
    }

    let ready = false;
    const finishSetup = () => {
      if (ready) return;
      ready = true;
      try {
        map.resize();
      } catch {
        /* noop */
      }
      paintCurrentState();
    };

    map.on("load", finishSetup);
    map.on("styledata", finishSetup);
    map.on("idle", finishSetup);

    const t1 = window.setTimeout(() => {
      try {
        map.resize();
      } catch {
        /* noop */
      }
    }, 0);
    const t2 = window.setTimeout(() => {
      try {
        map.resize();
        paintCurrentState();
      } catch {
        /* noop */
      }
    }, 300);

    const ro =
      typeof ResizeObserver !== "undefined" && wrapperRef.current
        ? new ResizeObserver(() => {
            try {
              map.resize();
            } catch {
              /* noop */
            }
          })
        : null;
    if (ro && wrapperRef.current) ro.observe(wrapperRef.current);

    const onResize = () => {
      try {
        map.resize();
      } catch {
        /* noop */
      }
    };
    window.addEventListener("resize", onResize);

    const interval = window.setInterval(() => {
      if (sourcesLayersDone.current) return;
      try {
        if (ensureSourceAndLayers(map)) paintCurrentState();
      } catch {
        /* ignore */
      }
    }, 250);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearInterval(interval);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      try {
        map.off("load", finishSetup);
        map.off("styledata", finishSetup);
        map.off("idle", finishSetup);
      } catch {
        /* ignore */
      }
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
        } catch {
          /* noop */
        }
        mapInstance.current = null;
        sourcesLayersDone.current = false;
      }
    };
  }, []);

  useEffect(() => {
    paintCurrentState();
  }, [origin, destination, geometry]);

  return (
    <div
      ref={wrapperRef}
      className="relative isolate flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl bg-gray-50"
    >
      <div className="flex flex-none items-center justify-between border-b border-gray-100 bg-white px-4 py-2.5 sm:px-5 sm:py-3">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold text-gray-900 sm:text-sm">
            Ruta trazada
          </h3>
          <p className="truncate text-[11px] text-gray-500 sm:text-xs">
            {loading
              ? "Calculando la ruta más rápida…"
              : origin && destination
                ? "MapLibre GL · OpenStreetMap · OSRM Driving"
                : "Ingresa origen y destino para visualizar la ruta."}
          </p>
        </div>
        <div className="hidden items-center gap-3 text-xs text-gray-500 sm:flex">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-emerald-100"
              style={{ backgroundColor: "#10b981" }}
            />
            Origen
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-blue-100"
              style={{ backgroundColor: "#2563eb" }}
            />
            Destino
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-6 rounded-full bg-blue-700" />
            Ruta
          </span>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 bg-gray-100">
        <div
          ref={mapRef}
          className="relative h-full w-full bg-white"
          style={{ width: "100%", height: "100%" }}
          aria-label="Mapa con ruta trazada entre origen y destino"
          suppressHydrationWarning
        />

        {!mapInstance.current && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-md ring-1 ring-gray-200">
              <svg
                className="h-4 w-4 animate-spin text-blue-600"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="3"
                />
                <path
                  d="M22 12a10 10 0 0 0-10-10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-sm font-medium text-gray-700">Cargando mapa…</span>
            </div>
          </div>
        )}

        {loading && mapInstance.current ? (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-4 bg-white/30 backdrop-blur-[1.5px]">
            <div className="flex items-center gap-2.5 rounded-full bg-white px-4 py-2 shadow-md ring-1 ring-gray-200">
              <svg
                className="h-4 w-4 animate-spin text-blue-600"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="3"
                />
                <path
                  d="M22 12a10 10 0 0 0-10-10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                Geocodificando y calculando ruta…
              </span>
            </div>
          </div>
        ) : null}

        {errorMessage && mapInstance.current ? (
          <div className="absolute left-1/2 top-4 z-10 w-[min(calc(100%-2rem),520px)] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
            <div className="flex items-start gap-2.5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="mt-0.5 h-5 w-5 flex-none text-amber-600"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
              <p className="text-sm leading-relaxed text-amber-800">{errorMessage}</p>
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-white/95 px-2 py-1 text-[10px] font-medium text-gray-500 shadow ring-1 ring-gray-200">
          © OpenStreetMap · OSRM
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .maplibregl-map,
            .maplibregl-canvas-container,
            .maplibregl-canvas {
              width: 100% !important;
              height: 100% !important;
              display: block !important;
            }
            .maplibregl-map { font-family: inherit; position: relative; }
            .maplibregl-canvas { outline: none; }
          `,
        }}
      />
    </div>
  );
}
