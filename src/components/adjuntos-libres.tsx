"use client";

// Adjuntar VARIOS documentos con nombre libre (editable) a un proceso. A diferencia
// de BotonSubirDoc (un doc con nombre fijo/clave), aquí el usuario sube N archivos y
// le pone a cada uno el nombre que quiera. Se agrupan por un `prefix` interno en el
// nombre (p. ej. "audiencia: ") para que cada sección liste solo los suyos.

import { useState } from "react";
import { Button } from "./ui";
import { Input } from "./form-ui";
import { ConfirmDialog } from "./confirm-dialog";
import { subirArchivoProceso, eliminarDocumento, type DocumentoProceso } from "@/lib/procesos-api";

export function AdjuntosLibres({
  procesoId,
  docs,
  prefix,
  titulo = "Documentos",
  onSubido,
  onEliminado,
  readOnly = false,
}: {
  procesoId: string;
  docs: DocumentoProceso[];
  prefix: string; // p. ej. "audiencia: " — agrupa los docs de esta sección
  titulo?: string;
  onSubido: (doc: DocumentoProceso) => void;
  onEliminado: (docId: string) => void;
  readOnly?: boolean;
}) {
  const grupo = docs.filter((d) => d.nombre.toLowerCase().startsWith(prefix.toLowerCase()));
  const nombreVisible = (n: string) => n.slice(prefix.length).trim() || n;
  // Nombre real del archivo (último segmento del path de la URL).
  const nombreArchivo = (url?: string | null) => {
    if (!url) return null;
    try { return decodeURIComponent(url.split("?")[0].split("/").pop() || "") || null; } catch { return url; }
  };
  const [nombre, setNombre] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<DocumentoProceso | null>(null);

  async function agregar() {
    if (!file || !nombre.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const doc = await subirArchivoProceso(procesoId, file, `${prefix}${nombre.trim()}`);
      onSubido(doc);
      setNombre("");
      setFile(null);
    } catch {
      setError("No se pudo subir el documento.");
    } finally {
      setBusy(false);
    }
  }

  async function borrar(doc: DocumentoProceso) {
    setBusy(true);
    setError(null);
    try {
      await eliminarDocumento(procesoId, doc.id);
      onEliminado(doc.id);
      setABorrar(null);
    } catch {
      setError("No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/60">
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{titulo}</p>

      {grupo.length > 0 && (
        <ul className="mb-3 space-y-2">
          {grupo.map((doc) => {
            const archivo = nombreArchivo(doc.url);
            return (
              <li key={doc.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{nombreVisible(doc.nombre)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                        Ver
                      </a>
                    )}
                    {!readOnly && (
                      <button type="button" onClick={() => setABorrar(doc)} className="text-xs font-medium text-red-600 hover:underline">
                        Eliminar
                      </button>
                    )}
                  </span>
                </div>
                {archivo && <p className="mt-1 truncate text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ {archivo}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1">
            <Input value={nombre} onChange={setNombre} placeholder="Nombre del documento" />
          </div>
          <label className="cursor-pointer rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600">
            {file ? `✓ ${file.name}` : "Elegir archivo"}
            <input type="file" className="hidden" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Button onClick={agregar} disabled={busy || !file || !nombre.trim()}>
            {busy ? "Subiendo…" : "Agregar"}
          </Button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <ConfirmDialog
        open={!!aBorrar}
        title="Eliminar documento"
        message={`¿Eliminar "${aBorrar ? nombreVisible(aBorrar.nombre) : ""}"?`}
        confirmText="Eliminar"
        danger
        busy={busy}
        onConfirm={() => aBorrar && borrar(aBorrar)}
        onCancel={() => setABorrar(null)}
      />
    </div>
  );
}
