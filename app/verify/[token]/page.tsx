"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Status = "loading" | "success" | "error" | "expired";

export default function VerifyTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    params.then((p) => {
      try {
        setToken(decodeURIComponent(p.token));
      } catch {
        setToken(p.token);
      }
    });
  }, [params]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          email?: string;
          message?: string;
        };

        if (cancelled) return;

        if (!res.ok || !data.ok) {
          const msg = data.error || "No se pudo verificar el enlace.";
          setMessage(msg);
          setStatus(
            msg.toLowerCase().includes("expirad") ||
              msg.toLowerCase().includes("vencid")
              ? "expired"
              : "error"
          );
          return;
        }

        setEmail(data.email ?? "");
        setMessage(data.message || "Cuenta verificada correctamente.");
        setStatus("success");
      } catch {
        if (!cancelled) {
          setMessage("Error de conexión. Inténtalo nuevamente.");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div
          className={
            "mx-auto flex h-14 w-14 items-center justify-center rounded-full " +
            (status === "success"
              ? "bg-green-100 text-green-700"
              : status === "loading"
              ? "bg-gray-100 text-gray-600"
              : "bg-red-100 text-red-700")
          }
        >
          {status === "loading" ? (
            <svg
              className="h-7 w-7 animate-spin"
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
          ) : status === "success" ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className="h-7 w-7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className="h-7 w-7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
              />
            </svg>
          )}
        </div>

        <h1 className="mt-5 text-center text-2xl font-bold text-black">
          {status === "loading"
            ? "Verificando correo..."
            : status === "success"
            ? "¡Correo confirmado!"
            : status === "expired"
            ? "Enlace expirado"
            : "No se pudo verificar"}
        </h1>

        <p className="mt-2 text-center text-sm leading-6 text-gray-600">
          {message || "Procesando tu solicitud."}
        </p>

        {status === "success" && email && (
          <p className="mt-3 text-center text-xs font-medium text-gray-500">
            {email}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/"
            className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-red-700 to-red-600 text-sm font-semibold text-white shadow-lg shadow-red-700/20 transition-all hover:from-red-800 hover:to-red-700"
          >
            Ir al inicio de sesión
          </Link>
          {status !== "loading" && status !== "success" && (
            <Link
              href="/"
              className="flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-semibold text-black transition-colors hover:bg-gray-50"
            >
              Reenviar correo de confirmación
            </Link>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          Plataforma Lujav · Desarrollado por MetaWeb Dev Solutions
        </p>
      </div>
    </div>
  );
}
