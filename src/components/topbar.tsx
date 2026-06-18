"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { useSidebar } from "@/components/sidebar-context";

export function Topbar() {
  const pathname = usePathname();
  const { setOpen } = useSidebar();

  const current =
    NAV_ITEMS.find((i) =>
      i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)
    )?.label ?? "LEX Control";

  return (
    <header className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 dark:border-slate-600 dark:bg-slate-700 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setOpen(true)}
          className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-600 lg:hidden"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="truncate text-lg font-semibold text-slate-800 dark:text-slate-100">{current}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <GlobalSearch />
        <ThemeToggle />
      </div>
    </header>
  );
}
