"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";

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
  const [estado, setEstado] = useState<"verificando" | "ok">("verificando");

  useEffect(() => {
    if (getUser()?.esAdminEmpresa) {
      setEstado("ok");
    } else {
      router.replace("/"); // sin permiso → al inicio, no se renderiza el contenido
    }
  }, [router]);

  if (estado !== "ok") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Cargando…
      </div>
    );
  }

  return <>{children}</>;
}
