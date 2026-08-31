export default function PlatformHomePage() {
  return (
    <div className="relative flex min-h-[calc(100vh-8rem)] w-full items-center justify-center overflow-hidden px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[50rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-sky-100/50 via-blue-200/40 to-transparent blur-3xl" />
        <div className="absolute left-1/2 top-[45%] h-[32rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-sky-200/40 via-indigo-100/30 to-transparent blur-3xl" />
      </div>

      <div className="flex w-full max-w-4xl flex-col items-center gap-10 text-center">
        <h1 className="text-3xl font-normal tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
          Pregunta lo que quieras, MetaWeb Dev
        </h1>

        <div className="w-full max-w-2xl">
          <div className="group flex items-center gap-3 rounded-full bg-white px-5 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.05)] ring-1 ring-gray-200/60 transition-shadow hover:shadow-[0_2px_6px_rgba(0,0,0,0.1),0_8px_24px_rgba(0,0,0,0.08)] focus-within:shadow-[0_2px_6px_rgba(0,0,0,0.1),0_8px_24px_rgba(0,0,0,0.08)] focus-within:ring-1 focus-within:ring-gray-300">
            <button
              type="button"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              aria-label="Nueva consulta"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>

            <input
              type="text"
              placeholder="Pregunta a Gemini"
              className="flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-500 focus:outline-none"
            />

            <button
              type="button"
              className="flex flex-none items-center gap-1.5 rounded-full py-1.5 pl-3 pr-2 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-100"
              aria-label="Seleccionar modelo"
            >
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
