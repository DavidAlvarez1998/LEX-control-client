"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getToken, getTokenExpiry, isExpired } from "@/lib/auth";

/**
 * Protege las vistas del portal: si no hay sesión (o el token venció), redirige
 * a /login. Además programa un cierre de sesión PROACTIVO justo en el `exp` del
 * token, de modo que una pestaña inactiva se cierra sola al caducar (8h).
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Cargando…
      </div>
    );
  }

  return <>{children}</>;
}
