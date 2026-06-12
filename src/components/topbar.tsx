"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";

export function Topbar() {
  const pathname = usePathname();

  const current =
    NAV_ITEMS.find((i) =>
      i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)
    )?.label ?? "LEX Control";

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{current}</h1>

      <div className="flex items-center gap-3">
        <GlobalSearch />
        <ThemeToggle />
      </div>
    </header>
  );
}
