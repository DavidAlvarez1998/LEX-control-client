"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { USER_CHANGED_EVENT, getUser } from "@/lib/auth";

/**
 * Restringe una pantalla al administrador de la empresa (`esAdminEmpresa`).
 * Ocultar el ítem en el sidebar no basta: un USUARIO común que escriba la URL
 * a mano igual entraría. Este portero lo rebota al inicio. La API sigue siendo
 * la autoridad real cuando estas pantallas se conecten a datos.
 *
 * Va DENTRO de `AuthGuard` (el dashboard ya garantiza que hay sesión), así que
 * aquí solo se decide por rol.
 */
export function AdminEmpresaGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<"verificando" | "ok">("verificando");

  // Reevalúa al montar, al navegar y cuando se refrescan los roles (/auth/me):
  // si el usuario deja de ser admin de empresa estando aquí, se le rebota.
  useEffect(() => {
    const check = () => {
      if (getUser()?.esAdminEmpresa) setEstado("ok");
      else router.replace("/inicio"); // sin permiso → al inicio, no se renderiza el contenido
    };
    check();
    window.addEventListener(USER_CHANGED_EVENT, check);
    return () => window.removeEventListener(USER_CHANGED_EVENT, check);
  }, [router, pathname]);

  if (estado !== "ok") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Cargando…
      </div>
    );
  }

  return <>{children}</>;
}
