"use client";

import { useState, FormEvent } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    const terms = Boolean(fd.get("terms"));

    if (!email || !password) {
      setStatus({
        kind: "error",
        message: "Completa el correo y la contraseña.",
      });
      return;
    }
    if (!terms) {
      setStatus({
        kind: "error",
        message: "Debes aceptar los Términos y Políticas para continuar.",
      });
      return;
    }

    setStatus({ kind: "loading" });

    try {
      const res = await fetch("/api/auth/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, email }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setStatus({
          kind: "error",
          message:
            data.error ||
            data.message ||
            "No se pudo enviar el correo. Inténtalo más tarde.",
        });
        return;
      }

      setStatus({
        kind: "success",
        message:
          data.message ||
          "Correo de confirmación enviado. Revisa tu bandeja de entrada.",
      });
    } catch {
      setStatus({
        kind: "error",
        message: "Error de conexión. Revisa tu red e intenta nuevamente.",
      });
    }
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-[2.75rem] font-bold leading-tight tracking-tight text-black">
        Iniciar Sesion
      </h1>
      <p className="mt-3 text-base leading-6 text-gray-500">
        Porfavor ingrese sus datos para continuar.
      </p>

      <form
        onSubmit={onSubmit}
        noValidate
        className="mt-8 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-2">
          <label
            htmlFor="name"
            className="text-sm font-semibold text-black"
          >
            Nombre
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Enter your name ..."
            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-black outline-none transition-all placeholder:text-gray-400 focus:border-red-600 focus:ring-4 focus:ring-red-600/10"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="email"
            className="text-sm font-semibold text-black"
          >
            Correo Empresarial
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue="ejemplo@transporteslujav.com"
            className="h-12 w-full rounded-xl border-2 border-red-600 bg-white px-4 text-base text-black outline-none transition-all placeholder:text-gray-400 focus:ring-4 focus:ring-red-600/10"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-semibold text-black"
            >
              Contraseña
            </label>
            <a
              href="#"
              className="text-sm font-semibold text-red-700 transition-colors hover:text-red-800"
            >
              Olvide la Contraseña
            </a>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder=""
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 pr-12 text-base text-black outline-none transition-all placeholder:text-gray-400 focus:border-red-600 focus:ring-4 focus:ring-red-600/10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword ? "Hide password" : "Show password"
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 transition-colors hover:text-gray-700"
            >
              {showPassword ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                  />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-600">
          <input
            type="checkbox"
            name="terms"
            className="h-5 w-5 rounded-full border-2 border-gray-300 accent-red-700 appearance-none checked:bg-red-700 checked:border-red-700 checked:bg-[radial-gradient(circle,white_40%,transparent_45%)]"
          />
          <span>
            I agree to the{" "}
            <a href="#" className="font-medium text-gray-800 underline underline-offset-2">
              Terms & Privacy
            </a>
          </span>
        </label>

        {status.kind === "success" && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {status.message}
          </div>
        )}
        {status.kind === "error" && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {status.message}
          </div>
        )}

        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="mt-2 flex h-14 items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-red-700 to-red-600 text-base font-semibold text-white shadow-lg shadow-red-700/25 transition-all hover:from-red-800 hover:to-red-700 hover:shadow-red-800/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:from-red-700 disabled:hover:to-red-600 disabled:active:scale-100"
        >
          {status.kind === "loading" ? (
            <>
              <svg
                className="h-5 w-5 animate-spin"
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
              Enviando confirmación...
            </>
          ) : (
            "Log in"
          )}
        </button>

        <p className="mt-2 text-center text-sm text-gray-600">
          Have an account?{" "}
          <a
            href="#"
            className="font-semibold text-red-700 transition-colors hover:text-red-800"
          >
            Signup
          </a>
        </p>

        <p className="mt-6 text-center text-xs text-gray-500">
          Al continuar, acepta nuestras{" "}
          <a
            href="#"
            className="font-medium text-red-700 underline underline-offset-2 transition-colors hover:text-red-800"
          >
            Políticas
          </a>{" "}
          y{" "}
          <a
            href="#"
            className="font-medium text-red-700 underline underline-offset-2 transition-colors hover:text-red-800"
          >
            Privacidad
          </a>
        </p>
      </form>
    </div>
  );
}
