import { Link, useLocation } from "react-router-dom";

const links = [
  { to: "/", label: "Obras" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/categorias", label: "Categorias" },
  { to: "/configuracoes", label: "Configurações" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight hover:opacity-90">
            ObraGest
          </Link>
          <nav className="flex gap-4">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded px-3 py-1 text-sm transition ${
                  location.pathname === link.to
                    ? "bg-slate-700 font-medium"
                    : "hover:bg-slate-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
