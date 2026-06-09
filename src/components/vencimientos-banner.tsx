"use client";

// Banner de vencimientos próximos/vencidos para el listado de procesos. Consume
// GET /procesos/vencimientos (semáforo). No muestra nada si todo está al día.

import Link from "next/link";
import { useEffect, useState } from "react";
import { getVencimientos, type Vencimientos } from "@/lib/procesos-api";

export function VencimientosBanner() {
  const [v, setV] = useState<Vencimientos | null>(null);

  useEffect(() => {
    getVencimientos()
      .then(setV)
      .catch(() => {});
  }, []);

  if (!v) return null;
  const urgentes = [...v.vencido, ...v.por_vencer];
  if (urgentes.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="mb-1.5 text-sm font-medium text-amber-800 dark:text-amber-200">
        Vencimientos: {v.vencido.length} vencido{v.vencido.length === 1 ? "" : "s"} ·{" "}
        {v.por_vencer.length} por vencer
      </div>
      <ul className="space-y-1 text-xs">
        {urgentes.slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <Link href={`/procesos/${p.id}`} className="font-medium text-indigo-600 hover:underline">
              {p.codigoInterno}
            </Link>
            <span className="truncate text-slate-600 dark:text-slate-300">{p.titulo}</span>
            <span
              className={`ml-auto shrink-0 ${
                p.semaforo === "vencido" ? "font-semibold text-red-600" : "text-amber-600"
              }`}
            >
              {p.fechaLimite?.slice(0, 10)} {p.semaforo === "vencido" ? "(vencido)" : "(por vencer)"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
