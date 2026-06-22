"use client";

// Uploader ESTÁNDAR de N documentos. Dos modos:
//
//  • Pendiente (form de creación, la entidad aún no existe): controlado con
//    `value`/`onChange`; recoge los `File` en memoria con nombre editable y el
//    padre los sube al crear. Filas con nombre autocompletado del archivo.
//
//  • En vivo (entidad ya existente: ficha de proceso, contrato): pasa `subir`
//    (sube AL INSTANTE cada archivo soltado) + `existentes` (ya subidos) +
//    `quitar`. Sin paso de nombres: el nombre es el del archivo.
//
// Para UN documento con nombre fijo (poder.pdf, demanda.pdf…) usar `BotonSubirDoc`.

import { useState, type ReactNode } from "react";
import { Input } from "./form-ui";
import { ConfirmDialog } from "./confirm-dialog";

export type DocPendiente = { id: string; nombre: string; file: File | null };
export type DocSubido = { id: string; nombre: string; url?: string | null; sub?: string };

let _seq = 0;
export function nuevoDocId() {
  _seq += 1;
  return `doc-${Math.floor(performance.now())}-${_seq}`;
}

function sinExtension(nombre: string) {
  const i = nombre.lastIndexOf(".");
  return i > 0 ? nombre.slice(0, i) : nombre;
}

function formatoTamano(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentosUploader({
  // Común
  titulo = "Documentos",
  descripcion,
  opcional = true,
  readOnly = false,
  extra,
  // Modo pendiente (form de creación)
  value,
  onChange,
  // Modo en vivo (entidad existente)
  existentes,
  subir,
  quitar,
}: {
  titulo?: string;
  descripcion?: string;
  opcional?: boolean;
  readOnly?: boolean;
  extra?: ReactNode; // p. ej. selector de categoría, sobre la zona de carga (modo en vivo)
  value?: DocPendiente[];
  onChange?: (next: DocPendiente[]) => void;
  existentes?: DocSubido[];
  subir?: (file: File) => Promise<void>;
  quitar?: (id: string) => Promise<void>;
}) {
  const live = !!subir;
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<DocSubido | null>(null);

  // — Modo pendiente —
  const items = value ?? [];
  const agregarPend = (files: FileList | File[]) => {
    const nuevos = Array.from(files).map((file) => ({ id: nuevoDocId(), nombre: sinExtension(file.name), file }));
    if (nuevos.length) onChange?.([...items, ...nuevos]);
  };
  const setNombre = (id: string, nombre: string) => onChange?.(items.map((d) => (d.id === id ? { ...d, nombre } : d)));
  const reemplazar = (id: string, file: File) =>
    onChange?.(items.map((d) => (d.id === id ? { ...d, file, nombre: d.nombre.trim() || sinExtension(file.name) } : d)));
  const quitarPend = (id: string) => onChange?.(items.filter((d) => d.id !== id));

  // — Modo en vivo: sube al instante (secuencial) —
  async function subirVivo(files: FileList | File[]) {
    const arr = Array.from(files);
    if (!arr.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of arr) await subir!(file);
    } catch {
      setError("No se pudo subir el documento. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  async function quitarVivo(doc: DocSubido) {
    setBusy(true);
    setError(null);
    try {
      await quitar!(doc.id);
      setABorrar(null);
    } catch {
      setError("No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  const onDrop = (files: FileList) => (live ? subirVivo(files) : agregarPend(files));

  const dropzone = (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files?.length) onDrop(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed px-3 py-4 text-center transition-colors ${
        busy ? "pointer-events-none opacity-60" : ""
      } ${
        drag
          ? "border-indigo-400 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/10"
          : "border-slate-300 bg-white hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-indigo-500/50"
      }`}
    >
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {busy ? "Subiendo…" : (
          <>
            Arrastra archivos aquí o <span className="text-indigo-600 dark:text-indigo-400">elígelos</span>
          </>
        )}
      </span>
      <span className="text-xs text-slate-400">Puedes agregar varios</span>
      <input
        type="file"
        multiple
        disabled={busy}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onDrop(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/60">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {titulo}
        {opcional && <span className="ml-1 font-normal text-slate-400">(opcional)</span>}
      </p>
      {descripcion && <p className="mb-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">{descripcion}</p>}

      {/* Lista */}
      {live
        ? (existentes?.length ?? 0) > 0 && (
            <ul className="mb-3 mt-3 space-y-2">
              {existentes!.map((d) => (
                <li key={d.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{d.nombre}</p>
                      {d.sub && <p className="text-xs text-slate-400">{d.sub}</p>}
                    </div>
                    <span className="flex shrink-0 items-center gap-3 text-xs">
                      {d.url && (
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                          Ver
                        </a>
                      )}
                      {!readOnly && (
                        <button type="button" onClick={() => setABorrar(d)} className="font-medium text-red-600 hover:underline">
                          Quitar
                        </button>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )
        : items.length > 0 && (
            <ul className="mb-3 mt-3 space-y-2">
              {items.map((d) => (
                <li key={d.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-[10rem] flex-1">
                      <Input value={d.nombre} onChange={(v) => setNombre(d.id, v)} placeholder="Nombre del documento" />
                    </div>
                    <button
                      type="button"
                      onClick={() => quitarPend(d.id)}
                      className="px-2 py-2 text-sm font-medium text-slate-400 hover:text-red-500"
                      aria-label="Quitar documento"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {d.file ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <span className="truncate">✓ {d.file.name}</span>
                        <span className="text-slate-400">· {formatoTamano(d.file.size)}</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Falta el archivo</span>
                    )}
                    <label className="cursor-pointer font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                      {d.file ? "Reemplazar" : "Elegir archivo"}
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) reemplazar(d.id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}

      {!readOnly && (
        <>
          {extra && <div className="mb-3">{extra}</div>}
          {dropzone}
        </>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <ConfirmDialog
        open={!!aBorrar}
        title="Quitar documento"
        message={`¿Quitar "${aBorrar?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Quitar"
        danger
        busy={busy}
        onConfirm={() => aBorrar && quitarVivo(aBorrar)}
        onCancel={() => setABorrar(null)}
      />
    </div>
  );
}
