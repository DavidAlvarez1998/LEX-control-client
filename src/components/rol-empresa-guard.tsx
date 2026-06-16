"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { USER_CHANGED_EVENT, getUser } from "@/lib/auth";

/**
 * Restringe una pantalla a quien tenga alguno de los `roles` de empresa
 * indicados (RolEmpresa) — o sea admin de empresa (`esAdminEmpresa`), que ve
 * todo. Ocultar el ítem del sidebar no basta: un usuario que escriba la URL a
 * mano igual entraría; este portero lo rebota al inicio. La API sigue siendo la
 * autoridad real (requirePermiso). Va DENTRO de `AuthGuard`.
 */
export function RolEmpresaGuard({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<"verificando" | "ok">("verificando");

  // Reevalúa al montar, al navegar y cuando se refrescan los roles (/auth/me):
  // si el usuario pierde el acceso estando en la vista, se le rebota al inicio.
  useEffect(() => {
    const check = () => {
      const u = getUser();
      const permitido =
        !!u?.esAdminEmpresa || (u?.roles ?? []).some((r) => roles.includes(r));
      if (permitido) setEstado("ok");
      else router.replace("/inicio");
    };
    check();
    window.addEventListener(USER_CHANGED_EVENT, check);
    return () => window.removeEventListener(USER_CHANGED_EVENT, check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
