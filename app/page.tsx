import Image from "next/image";
import { LoginForm } from "./login-form";

export default function Home() {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden w-1/2 lg:block">
        <div className="absolute inset-0 overflow-hidden rounded-r-3xl" style={{
          background: "linear-gradient(135deg, #dc2626 0%, #ef4444 25%, #b91c1c 50%, #991b1b 75%, #7f1d1d 100%)"
        }}>
          <div className="absolute left-1/4 top-1/4 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-400/30 blur-3xl" />
          <div className="absolute right-1/4 top-1/3 h-80 w-80 translate-x-1/2 rounded-full bg-rose-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-red-300/20 blur-3xl" />
        </div>
        <div className="relative flex h-full flex-col justify-between p-16">
          <div>
            <p className="text-lg font-normal text-white/80">Plataforma Lujav</p>
            <h1 className="mt-4 text-5xl font-bold leading-tight text-white drop-shadow-sm">
              Cotizacion de Transportes Lujav
              <br />
            </h1>
          </div>
          <div className="flex justify-center">
            <div className="relative w-64 h-16 drop-shadow-md">
            <p className="mb-6 text-center text-sm font-medium text-white/70">Desarrollado por</p>

              <Image
                src="/metaweb.svg"
                alt="MetaWeb Dev Solutions"
                fill
                priority
                className="object-contain brightness-0 invert"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-1 flex-col items-center justify-center px-6 py-12 sm:px-16 lg:w-1/2">
        <LoginForm />
      </div>
    </div>
  );
}
