"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type TabItem = {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
};

function CalculatorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15h.01M8 19h2M12 19h2M16 19h.01" />
    </svg>
  );
}

function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function MapPinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

const TABS: TabItem[] = [
  {
    href: "/platform",
    label: "Inicio",
    icon: HomeIcon,
  },
  {
    href: "/platform/cotizador",
    label: "Cotizador",
    icon: CalculatorIcon,
  },
  {
    href: "/platform/codigo-postal",
    label: "Código Postal",
    icon: MapPinIcon,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: sidebar izquierda fija */}
      <aside
        className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:flex-col lg:border-r lg:border-gray-200 lg:bg-white">
        {/* Logo + marca */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-6">
          <div className="relative h-10 w-10 shrink-0">
            <Image
              src="/metaweb.svg"
              alt="MetaWeb logo"
              fill
              className="object-contain"
              sizes="40px"
              priority
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-red-700">
              Plataforma Lujav
            </p>
            <p className="truncate text-xs text-gray-500">
              Panel interno
            </p>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex flex-1 flex-col gap-2 px-3 py-6">
          {TABS.map(({ href, label, icon: Icon }) => {
            const isRoot = href === "/platform";
            const active = isRoot
              ? pathname === "/platform" ||
                pathname === "/platform/"
              : pathname === href ||
                pathname === `${href}/` ||
                pathname?.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-gradient-to-r from-red-700 to-red-600 text-white shadow-sm shadow-red-700/20"
                    : "text-gray-700 hover:bg-red-50 hover:text-red-700",
                ].join(" ")}
              >
                <Icon
                  className={[
                    "h-5 w-5 shrink-0",
                    active ? "text-white" : "text-gray-500 group-hover:text-red-700",
                  ].join(" ")}
                />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-5 text-xs text-gray-500">
          <p className="font-medium text-gray-700">
            MetaWeb Dev Solutions
          </p>
          <p className="mt-1 text-[11px] leading-relaxed">
            Desarrollado para Transportes Lujav · v1.0
          </p>
        </div>
      </aside>

      {/* Móvil / tablet: bottom navigation */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-2">
          {TABS.map(({ href, label, icon: Icon }) => {
            const isRoot = href === "/platform";
            const active = isRoot
              ? pathname === "/platform" ||
                pathname === "/platform/"
              : pathname === href ||
                pathname === `${href}/` ||
                pathname?.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5 text-[11px] font-semibold transition-all",
                  active
                    ? "bg-gradient-to-r from-red-700 to-red-600 text-white shadow-sm shadow-red-700/20"
                    : "text-gray-600 hover:bg-red-50 hover:text-red-700",
                ].join(" ")}
              >
                <Icon
                  className={[
                    "h-5 w-5",
                    active ? "text-white" : "text-gray-500",
                  ].join(" ")}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
