"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const ALLOWED_DOMAINS = [
  "transporteslujav.com",
  "dlnforwarding.com",
  "plataformalujav.space",
];

function emailIsAllowed(email: string): boolean {
  const atIdx = email.lastIndexOf("@");
  if (atIdx === -1) return false;
  const domain = email.slice(atIdx + 1).toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [emailHint, setEmailHint] = useState<string | null>(null);

  function onEmailBlur(e: React.FocusEvent<HTMLInputElement>) {
    const v = e.target.value.trim();
    if (!v) {
      setEmailHint(null);
      return;
    }
    if (!emailIsAllowed(v)) {
      setEmailHint(
        `Solo se permiten correos de: ${ALLOWED_DOMAINS.join(", ")}.`
      );
    } else {
      setEmailHint(null);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");
    const terms = Boolean(fd.get("terms"));

    if (!name || !email || !password || !confirm) {
      setStatus({
        kind: "error",
        message: "Completa todos los campos.",
      });
      return;
    }
    if (!emailIsAllowed(email)) {
      setStatus({
        kind: "error",
        message: `Correo no permitido. Usa uno de: ${ALLOWED_DOMAINS.join(", ")}.`,
      });
      return;
    }
    if (password.length < 8) {
      setStatus({
        kind: "error",
        message: "La contraseña debe tener al menos 8 caracteres.",
      });
      return;
    }
    if (password !== confirm) {
      setStatus({
        kind: "error",
        message: "Las contraseñas no coinciden.",
      });
      return;
    }
    if (!terms) {
      setStatus({
        kind: "error",
        message: "Acepta los Términos y Políticas para continuar.",
      });
      return;
    }

    setStatus({ kind: "loading" });

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
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
            "No se pudo completar el registro.",
        });
        return;
      }

      setStatus({
        kind: "success",
        message:
          data.message ||
          "Cuenta creada. Te enviamos un correo de confirmación.",
      });
      form.reset();
      setEmailHint(null);
    } catch {
      setStatus({
        kind: "error",
        message: "Error de conexión. Revisa tu red e intenta nuevamente.",
      });
    }
  }

  return (
    <div className="flex w-full max-w-md max-h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <header className="flex-none px-1">
        <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-black sm:text-[2.25rem]">
          Crear cuenta
        </h1>
        <p className="mt-2 text-sm leading-5 text-gray-500 sm:text-base">
          Completa tus datos para acceder a Plataforma Lujav.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        noValidate
        className="mt-4 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-1 pb-2 pr-1 [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 hover:[&::-webkit-scrollbar-thumb]:bg-gray-300"
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="name"
            className="text-sm font-semibold text-black"
          >
            Nombre completo
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Ej: Juan Pérez"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-black outline-none transition-all placeholder:text-gray-400 sm:text-base focus:border-red-600 focus:ring-4 focus:ring-red-600/10"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-sm font-semibold text-black"
          >
            Correo empresarial
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            onBlur={onEmailBlur}
            placeholder="tu@transporteslujav.com"
            className={
              "h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-black outline-none transition-all placeholder:text-gray-400 sm:text-base focus:ring-4 " +
              (emailHint
                ? "border-red-500 focus:border-red-600 focus:ring-red-600/10"
                : "border-gray-200 focus:border-red-600 focus:ring-red-600/10")
            }
          />
          {emailHint && (
            <p className="text-xs font-medium text-red-700">{emailHint}</p>
          )}
          <p className="text-[11px] leading-5 text-gray-500">
            Dominios permitidos:{" "}
            <span className="font-medium text-gray-700">
              @transporteslujav.com · @dlnforwarding.com · @plataformalujav.space
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-sm font-semibold text-black"
          >
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 pr-11 text-sm text-black outline-none transition-all placeholder:text-gray-400 sm:text-base focus:border-red-600 focus:ring-4 focus:ring-red-600/10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition-colors hover:text-gray-700"
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

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirm"
            className="text-sm font-semibold text-black"
          >
            Confirmar contraseña
          </label>
          <div className="relative">
            <input
              id="confirm"
              name="confirm"
              type={showConfirm ? "text" : "password"}
              required
              autoComplete="new-password"
              minLength={8}
              placeholder="Repite la contraseña"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 pr-11 text-sm text-black outline-none transition-all placeholder:text-gray-400 sm:text-base focus:border-red-600 focus:ring-4 focus:ring-red-600/10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={
                showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"
              }
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition-colors hover:text-gray-700"
            >
              {showConfirm ? (
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

        <label className="flex cursor-pointer items-start gap-2.5 pt-0.5 text-sm leading-5 text-gray-600">
          <input
            type="checkbox"
            name="terms"
            className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-gray-300 accent-red-700 appearance-none checked:bg-red-700 checked:border-red-700 checked:bg-[radial-gradient(circle,white_40%,transparent_45%)]"
          />
          <span>
            Acepto los{" "}
            <a
              href="#"
              className="font-medium text-gray-800 underline underline-offset-2"
            >
              Términos &amp; Políticas
            </a>{" "}
            y confirmo que mi correo pertenece a los dominios permitidos.
          </span>
        </label>

        {status.kind === "success" && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-800">
            {status.message}
          </div>
        )}
        {status.kind === "error" && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
            {status.message}
          </div>
        )}

        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-700 to-red-600 text-sm font-semibold text-white shadow-lg shadow-red-700/20 transition-all hover:from-red-800 hover:to-red-700 hover:shadow-red-800/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:from-red-700 disabled:hover:to-red-600 disabled:active:scale-100 sm:text-base"
        >
          {status.kind === "loading" ? (
            <>
              <svg
                className="h-4 w-4 animate-spin sm:h-5 sm:w-5"
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
              Creando cuenta...
            </>
          ) : (
            "Registrar cuenta"
          )}
        </button>

        <p className="mt-1 text-center text-sm text-gray-600">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/"
            className="font-semibold text-red-700 transition-colors hover:text-red-800"
          >
            Iniciar sesión
          </Link>
        </p>

        <p className="mt-4 text-center text-xs leading-5 text-gray-500">
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
