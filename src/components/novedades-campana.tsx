"use client";

// P17 (versión LIVIANA) — campanita 🔔 en el topbar del cliente con un contador =
// nº de procesos con novedades del juzgado (actuacionesNuevas > 0). Derivado de los
// procesos existentes vía listProcesos({ conNovedades }) — NO es un subsistema de
// notificaciones (sin modelo Notificacion, sin migración). Solo visible para JURIDICO
// (o admin de empresa). Refresca al cargar, al volver a la pestaña y cada 60s.
// Calca el patrón de lex-control-admin/src/components/prospectos-pendientes.tsx.

import { useEffect, useState } from "react";
import Link from "next/link";
import { listProcesos } from "@/lib/procesos-api";
import { getUser } from "@/lib/auth";

export function NovedadesCampana() {
  const [count, setCount] = useState(0);
  const [puede, setPuede] = useState(false);

  useEffect(() => {
    const u = getUser();
    const ok = !!u?.esAdminEmpresa || (u?.roles ?? []).includes("JURIDICO");
    setPuede(ok);
    if (!ok) return;

    let vivo = true;
    const cargar = () =>
      listProcesos({ conNovedades: true })
        .then((r) => { if (vivo) setCount(r.total); })
        .catch(() => {});
    cargar();
    const onFocus = () => cargar();
    window.addEventListener("focus", onFocus);
    const id = setInterval(cargar, 60_000);
    return () => {
      vivo = false;
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
    };
  }, []);

  // Sin permiso → no se muestra. Con permiso siempre se ve la campanita (con o sin
  // contador), para que el usuario sepa dónde mirar.
  if (!puede) return null;

  return (
    <Link
      href="/procesos?conNovedades=1"
      title={
        count > 0
          ? `${count} proceso(s) con novedades del juzgado`
          : "Procesos con novedades del juzgado"
      }
      aria-label={
        count > 0
          ? `${count} procesos con novedades del juzgado`
          : "Novedades del juzgado"
      }
      className="relative rounded-lg p-2 text-muted hover:bg-hover"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-4 text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
