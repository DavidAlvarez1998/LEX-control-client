"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getToken, getTokenExpiry, isExpired } from "@/lib/auth";
import { refreshSession } from "@/lib/api";

/**
 * Protege las vistas del portal: si no hay sesión (o el token venció), redirige
 * a /login. Además programa un cierre de sesión PROACTIVO justo en el `exp` del
 * token, de modo que una pestaña inactiva se cierra sola al caducar (8h).
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token || isExpired(token)) {
      clearSession();
      router.replace("/login");
      return;
    }
    setChecked(true);

    // Auto-logout exacto al vencer el token (sin esperar a la próxima petición).
    const ms = (getTokenExpiry(token) ?? 0) - Date.now();
    const timer = setTimeout(() => {
      clearSession();
      router.replace("/login");
    }, Math.max(0, ms));
    return () => clearTimeout(timer);
  }, [router]);

  // Refresca los roles desde la BD en cada navegación y al volver a la pestaña.
  // Si un admin de empresa cambió los roles del usuario, sidebar y porteros se
  // actualizan sin re-login (updateUser solo emite evento si algo cambió).
  useEffect(() => {
    refreshSession();
    const onFocus = () => refreshSession();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pathname]);

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Cargando…
      </div>
    );
  }

  return <>{children}</>;
}
