"use client";

// Checklist de DOCUMENTOS REQUERIDOS del proceso: junta los documentos que exigen
// las etapas (reglas.documentosRequeridos + requeridosSi que apliquen según datos),
// y da un botón "Subir" por cada uno, YA con el nombre exacto que pide el gate
// (p. ej. peticion.pdf, poder.pdf, reiteracion.pdf). Así avanzar de etapa no se
// bloquea por no saber el nombre. Sube el archivo real a tecnovapp.

import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { documentosRequeridosDeEtapas, type EtapaDef } from "@/lib/procesos";
import { subirArchivoProceso, type DocumentoProceso } from "@/lib/procesos-api";

export function DocumentosRequeridos({
  procesoId,
  etapas,
  datos,
  documentos,
  onChange,
  readOnly = false,
}: {
  procesoId: string;
  etapas: EtapaDef[];
  datos: Record<string, unknown>;
  documentos: DocumentoProceso[];
  onChange: (docs: DocumentoProceso[]) => void;
  readOnly?: boolean;
}) {
  const requeridos = documentosRequeridosDeEtapas(etapas, datos);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (requeridos.length === 0) return null;

  const presente = (nombre: string) =>
    documentos.find((d) => d.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());

  async function subir(nombre: string, file: File) {
    setSubiendo(nombre);
    setError(null);
    try {
      const doc = await subirArchivoProceso(procesoId, file, nombre);
      onChange([doc, ...documentos.filter((d) => d.nombre.trim().toLowerCase() !== nombre.trim().toLowerCase())]);
    } catch (e) {
      setError(errorMessage(e, "No se pudo subir el documento"));
    } finally {
      setSubiendo(null);
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Documentos requeridos</h3>
      <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300/80">
        El sistema los exige para avanzar de etapa.
      </p>
      <ul className="mt-3 space-y-2">
        {requeridos.map((nombre) => {
          const doc = presente(nombre);
          return (
            <li
              key={nombre}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/60 bg-white px-3 py-2 dark:border-amber-500/20 dark:bg-slate-900"
            >
              <span className={`text-sm font-medium ${doc ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-200"}`}>
                {doc ? "✓ " : "• "}
                {nombre}
              </span>
              <div className="flex items-center gap-3">
                {doc?.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-indigo-600 hover:underline">
                    Abrir
                  </a>
                )}
                {!readOnly && (
                  <label className="cursor-pointer text-xs font-medium text-indigo-600 hover:underline">
                    {subiendo === nombre ? "Subiendo…" : doc ? "Reemplazar" : "Subir"}
                    <input
                      type="file"
                      className="hidden"
                      disabled={subiendo === nombre}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) subir(nombre, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
