"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { clearSession, getUser, type AuthUser } from "@/lib/auth";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-100">
      {/* Marca → inicio */}
      <Link
        href="/"
        aria-label="Ir al inicio"
        className="flex h-16 items-center gap-2 px-6 transition-colors hover:bg-slate-800/60"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500 font-bold text-white">
          LX
        </div>
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold">LEX Control</p>
          <p className="truncate text-xs text-slate-400">
            {user?.empresa ?? "Portal Cliente"}
          </p>
        </div>
      </Link>

      {/* Navegación */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.filter((item) => !item.adminOnly || user?.esAdminEmpresa).map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white",
              ].join(" ")}
            >
              <span className={active ? "text-indigo-300" : "text-slate-400"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Pie */}
      <div className="border-t border-slate-800 px-3 py-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold uppercase">
            {user?.nombre?.charAt(0) ?? "?"}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">
              {user?.nombre ?? "—"}
            </p>
            <p className="truncate text-xs text-slate-400">
              {user?.email ?? ""}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <svg
            className="h-5 w-5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
