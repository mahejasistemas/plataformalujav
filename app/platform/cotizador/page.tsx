export default function CotizadorPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-red-700">
            Módulo 01
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            Cotizador
          </h1>
          <p className="mt-2 max-w-xl text-sm text-gray-500">
            Genera cotizaciones de transporte al instante, calcula rutas,
            costos por peso/volumen y tarifas cliente.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-100">
          <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
          En construcción
        </div>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-start gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-700 to-red-600 text-white shadow-sm shadow-red-700/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="h-7 w-7">
              <rect x="4" y="3" width="16" height="18" rx="3" />
              <path d="M8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15h.01M8 19h2M12 19h2M16 19h.01" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Crea tu primera cotización
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Selecciona origen, destino, tipo de carga y servicio. Los
              precios se calculan en tiempo real.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-700 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-700/25 transition hover:from-red-800 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-700/30"
          >
            Crear cotización
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="h-4 w-4">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </section>
    </div>
  );
}
