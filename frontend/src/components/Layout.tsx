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
    <div className="min-h-screen bg-[#f7f8f9]">
      <header className="border-b border-brand-gray-border bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90">
            <img
              src="/logo-header.png"
              srcSet="/logo-header.png 1x, /logo-header@2x.png 2x"
              alt=""
              className="h-12 w-auto"
              width={144}
              height={96}
              decoding="async"
            />
            <span className="text-xl font-bold tracking-tight text-brand-blue">ObraGest</span>
          </Link>
          <nav className="flex gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                  location.pathname === link.to
                    ? "bg-brand-blue text-white"
                    : "text-brand-gray hover:bg-brand-gray-light"
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
