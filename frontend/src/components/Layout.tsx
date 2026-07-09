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
      <header className="bg-[#09264c] text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90">
            <img src="/logo.png" alt="ObraGest" className="h-9 w-auto" />
            <span className="text-xl font-bold tracking-tight">ObraGest</span>
          </Link>
          <nav className="flex gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                  location.pathname === link.to
                    ? "bg-[#0d3470]"
                    : "hover:bg-[#0d3470]"
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
