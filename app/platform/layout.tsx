import type { Metadata } from "next";
import { Sidebar } from "./components/sidebar";

export const metadata: Metadata = {
  title: "Plataforma Lujav · Inicio",
  description:
    "Panel interno de Transportes Lujav: cotizador, códigos postales y herramientas operativas.",
};

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900">
      <div className="mx-auto flex w-full max-w-[1440px]">
        <Sidebar />
        <main className="flex-1 min-w-0 px-4 pb-24 pt-8 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
