"use client";

// Barra del CASO: muestra todos los procesos enlazados (DdP → DdP reiteración →
// Tutela) "como si fueran uno", resaltando el actual. Cada nodo enlaza a su ficha.
// Solo se renderiza si el caso tiene más de un proceso.

import Link from "next/link";
import { Fragment } from "react";
import { Card } from "@/components/ui";
import { ESTADO_LABEL } from "@/lib/procesos";
import type { CasoNodo } from "@/lib/procesos-api";

function fmtFecha(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export function CasoChain({ nodos, actualId }: { nodos: CasoNodo[]; actualId: string }) {
  if (nodos.length < 2) return null;
  const ahora = new Date();
  return (
    <Card className="mb-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Caso · {nodos.length} procesos
      </h3>
      <div className="flex items-stretch overflow-x-auto pb-1">
        {nodos.map((n, i) => {
          const actual = n.id === actualId;
          const abierto = n.estado !== "CERRADO" && n.estado !== "ARCHIVADO";
          const vencido = !!n.fechaLimite && abierto && new Date(n.fechaLimite) < ahora;
          return (
            <Fragment key={n.id}>
              {i > 0 && (
                <div className="mx-1 mt-6 h-0.5 w-6 shrink-0 self-start bg-slate-200 dark:bg-slate-700 sm:w-10" />
              )}
              <Link
                href={`/procesos/${n.id}`}
                style={{ minWidth: 150 }}
                className={`block shrink-0 rounded-lg border px-3 py-2 transition-colors ${
                  actual
                    ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-500/10"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {n.tipoProcesoNombre}
                  </span>
                  {actual && <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">actual</span>}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{n.codigoInterno}</div>
                <div className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">{n.etapaNombre}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{ESTADO_LABEL[n.estado]}</div>
                {n.fechaLimite && (
                  <div className={`mt-0.5 text-xs ${vencido ? "font-medium text-red-600 dark:text-red-400" : "text-slate-400"}`}>
                    {vencido ? "Venció el " : "Vence el "}
                    {fmtFecha(n.fechaLimite)}
                  </div>
                )}
              </Link>
            </Fragment>
          );
        })}
      </div>
    </Card>
  );
}
