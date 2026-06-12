"use client";

// Botón + MODAL unificado para subir CUALQUIER documento del proceso. Muestra la
// etiqueta amable (sin extensión: el nombre interno es solo la clave del gate) y
// el nombre REAL del archivo elegido (que puede diferir y ser cualquier formato).
// `onSubir` puede ser async (subida inmediata) o sync (guardar para subir luego).

import { useState } from "react";
import { Button, Modal } from "@/components/ui";

export function BotonSubirDoc({
  etiqueta,
  yaSubido = false,
  onSubir,
  disabled = false,
  className = "text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400",
}: {
  etiqueta: string;
  yaSubido?: boolean;
  onSubir: (file: File) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setFile(null);
    setError(null);
    setOpen(true);
  }

  async function confirmar() {
    if (!file) return;
    setSubiendo(true);
    setError(null);
    try {
      await onSubir(file);
      setOpen(false);
      setFile(null);
    } catch {
      setError("No se pudo subir el documento. Inténtalo de nuevo.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <>
      <button type="button" disabled={disabled} onClick={abrir} className={className}>
        {yaSubido ? "Reemplazar" : "Subir"}
      </button>

      <Modal
        open={open}
        onClose={() => !subiendo && setOpen(false)}
        title={`Subir ${etiqueta}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={subiendo}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={subiendo || !file}>
              {subiendo ? "Subiendo…" : "Subir"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Adjunta el documento <strong className="text-slate-700 dark:text-slate-200">{etiqueta}</strong>.
          Puede ser cualquier formato (PDF, Word, imagen…); se guardará con el nombre del archivo que elijas.
        </p>
        <label className="mt-1 block">
          <input
            type="file"
            disabled={subiendo}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 dark:text-slate-300 dark:file:bg-indigo-500/10 dark:file:text-indigo-300"
          />
        </label>
        {file && (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ {file.name}</p>
        )}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </Modal>
    </>
  );
}
