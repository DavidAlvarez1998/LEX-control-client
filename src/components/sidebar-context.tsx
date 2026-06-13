"use client";

// Estado del drawer del sidebar en móvil. En desktop (lg+) el sidebar es fijo y
// este estado se ignora; en móvil la hamburguesa del topbar lo abre y el backdrop
// (o navegar) lo cierra. Context compartido entre Topbar (botón) y Sidebar (drawer).
import { createContext, useContext, useState, type ReactNode } from "react";

type SidebarCtx = { open: boolean; setOpen: (v: boolean) => void };

const SidebarContext = createContext<SidebarCtx | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarCtx {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar debe usarse dentro de <SidebarProvider>");
  return ctx;
}
