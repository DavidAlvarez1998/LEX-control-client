"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-100">
      {/* Marca */}
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500 font-bold text-white">
          LX
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">LEX Control</p>
          <p className="text-xs text-slate-400">Portal Cliente</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
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
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold">
            C
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium">Cliente</p>
            <p className="text-xs text-slate-400">cliente@lex.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
