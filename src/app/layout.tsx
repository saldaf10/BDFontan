import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BD Fontan",
  description: "Sistema de gestion de admisiones y asistencia del Colegio Fontan"
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/prospectos", label: "Prospectos" },
  { href: "/seguimientos", label: "Seguimientos" },
  { href: "/estudiantes", label: "Estudiantes" },
  { href: "/eventos", label: "Eventos" },
  { href: "/analisis", label: "Análisis" },
  { href: "/reportes", label: "Reportes" }
];

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <div className="min-h-screen bg-slate-50">
          <header className="border-b border-slate-200 bg-white">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-lg font-semibold text-fontan-ink">
                Colegio Fontan
              </Link>
              <div className="flex gap-4 text-sm text-slate-600">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="hover:text-fontan-blue">
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
