"use client";

// Panel estructurado de NOTIFICACIONES AL DEMANDADO (ejecutivo de mínima cuantía),
// bajo "Fecha de notificación". Lista los demandados del proceso (rol DEMANDADO/
// EJECUTADO), muestra su(s) correo(s) y deja adjuntar la notificación de CADA uno
// (la notificación es personal a cada demandado). El mandamiento de pago va aparte
// (es un único documento, la orden, igual para todos). Las partes y sus correos se
// gestionan en «Partes del proceso» (no se duplica acá). Cada doc se ata al demandado
// por el prefijo del nombre, sin tocar la base. Base para el futuro botón "Notificar".

import { AdjuntosLibres } from "./adjuntos-libres";
import type { DocumentoProceso, ParteDetalle } from "@/lib/procesos-api";

export function NotificacionesDemandados({
  procesoId,
  partes,
  docs,
  onSubido,
  onEliminado,
  readOnly = false,
}: {
  procesoId: string;
  partes: ParteDetalle[];
  docs: DocumentoProceso[];
  onSubido: (doc: DocumentoProceso) => void;
  onEliminado: (id: string) => void;
  readOnly?: boolean;
}) {
  const demandados = partes.filter((p) => p.rol === "DEMANDADO" || p.rol === "EJECUTADO");

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/60">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Notificaciones al demandado <span className="font-normal text-slate-400">(opcional)</span>
      </span>
      <p className="mb-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Una notificación por cada demandado. El mandamiento de pago va aparte (es uno solo).
        Los demandados y sus correos se gestionan en «Partes del proceso».
      </p>

      {demandados.length === 0 ? (
        <p className="text-xs text-slate-400">
          No hay demandados cargados. Agrégalos en «Partes del proceso», más abajo en la ficha.
        </p>
      ) : (
        <div className="space-y-3">
          {demandados.map((d) => {
            const correos = (d.litigante.correos ?? []).filter(Boolean);
            return (
              <div key={d.id} className="rounded-md border border-slate-200 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-800">
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{d.litigante.nombre}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {correos.length
                      ? correos.join(", ")
                      : d.litigante.correoDesconocido
                        ? "correo desconocido"
                        : "sin correo registrado"}
                  </span>
                </div>
                <AdjuntosLibres
                  procesoId={procesoId}
                  docs={docs}
                  prefix={`Notificación [${d.litigante.nombre}]: `}
                  titulo="Adjuntar notificación"
                  onSubido={onSubido}
                  onEliminado={onEliminado}
                  readOnly={readOnly}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
