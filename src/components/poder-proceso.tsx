"use client";

// Espacio para subir el PODER de un proceso (p. ej. Derecho de Petición). Se
// muestra cuando el campo `requierePoder` del formulario está en Sí. El documento
// se guarda con nombre fijo "poder.pdf" para satisfacer la regla
// `documentosRequeridos` condicional de la etapa (el motor bloquea el avance si
// requierePoder=Sí y no existe ese documento). Ver sdd-derecho-peticion.

import { useState } from "react";
import { Button } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { subirArchivoProceso, type DocumentoProceso } from "@/lib/procesos-api";

// Debe coincidir con `documentosRequeridos: ["poder.pdf"]` del esquema del DdP.
const NOMBRE_PODER = "poder.pdf";
const esPoder = (d: DocumentoProceso) => d.nombre.trim().toLowerCase() === NOMBRE_PODER;

export function PoderProceso({
  procesoId,
  documentos,
  onChange,
  readOnly = false,
}: {
  procesoId: string;
  documentos: DocumentoProceso[];
  onChange: (docs: DocumentoProceso[]) => void;
  readOnly?: boolean;
}) {
  const poder = documentos.find(esPoder);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [reemplazando, setReemplazando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir() {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const doc = await subirArchivoProceso(procesoId, archivo, NOMBRE_PODER);
      // Reemplaza cualquier poder previo (en la UI) por el recién subido.
      onChange([doc, ...documentos.filter((d) => !esPoder(d))]);
      setArchivo(null);
      setReemplazando(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo subir el poder");
    } finally {
      setSubiendo(false);
    }
  }

  const fileInput = (
    <input
      type="file"
      onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
      className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 dark:text-slate-300 dark:file:bg-indigo-500/10 dark:file:text-indigo-300"
    />
  );

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Poder</h3>
      <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300/80">
        Este proceso requiere poder. Es obligatorio para avanzar de etapa.
      </p>

      {poder ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 dark:border-emerald-500/30 dark:bg-slate-900">
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              ✓ Poder adjunto
            </span>
            <div className="flex shrink-0 gap-3">
              {poder.url && (
                <a
                  href={poder.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  Abrir
                </a>
              )}
              {!readOnly && !reemplazando && (
                <button
                  type="button"
                  onClick={() => setReemplazando(true)}
                  className="text-xs font-medium text-slate-500 hover:text-indigo-600"
                >
                  Reemplazar
                </button>
              )}
            </div>
          </div>
          {!readOnly && reemplazando && (
            <div className="space-y-2">
              {fileInput}
              <div className="flex gap-2">
                <Button onClick={subir} disabled={subiendo || !archivo}>
                  {subiendo ? "Subiendo…" : "Reemplazar poder"}
                </Button>
                <Button variant="ghost" onClick={() => { setReemplazando(false); setArchivo(null); }} disabled={subiendo}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : readOnly ? (
        <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">Pendiente de adjuntar.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {fileInput}
          <Button onClick={subir} disabled={subiendo || !archivo}>
            {subiendo ? "Subiendo…" : "Subir poder"}
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
