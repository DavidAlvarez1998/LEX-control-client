"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, Input, Textarea } from "@/components/form-ui";
import {
  adjuntarDocumento,
  editarDocumento,
  eliminarDocumento,
  generarDocumento,
  getPlantillasDeProceso,
  renderDocumento,
  type DocumentoProceso,
  type PlantillaItem,
} from "@/lib/procesos-api";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Descarga el texto como .doc (se abre en Word/Google Docs para firmar y exportar
 * a PDF). NO se usa `white-space:pre-wrap` porque Word lo ignora y deja el texto
 * "de corrido": en su lugar cada línea es un <p> y las líneas en blanco un espacio.
 * Da formato de documento real: márgenes carta, Times 12, cuerpo justificado,
 * títulos (líneas en MAYÚSCULAS) en negrita, fecha a la derecha, firma centrada.
 */
function descargarDoc(nombre: string, contenido: string) {
  const base = nombre.replace(/\.(doc|docx|pdf|txt)$/i, "").trim() || "documento";
  const lineas = contenido.replace(/\r/g, "").split("\n");
  const esTitulo = (l: string) => {
    const t = l.trim();
    return t.length > 1 && /[A-ZÁÉÍÓÚÑ]/.test(t) && !/[a-záéíóúñ]/.test(t);
  };
  let primeraVista = false; // la 1ª línea con texto (fecha) va a la derecha
  let firmando = false; // desde la línea de raya, todo va centrado
  const cuerpo = lineas
    .map((l) => {
      const t = l.trim();
      if (/^_+$/.test(t)) firmando = true;
      if (t === "") return `<p class="sp">&nbsp;</p>`;
      const clases: string[] = [];
      if (!primeraVista) { clases.push("r"); primeraVista = true; }
      else if (firmando) clases.push("c");
      if (esTitulo(l)) clases.push("h");
      return `<p class="${clases.join(" ")}">${esc(l)}</p>`;
    })
    .join("");
  const html =
    `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>` +
    `<head><meta charset='utf-8'><title>${esc(base)}</title>` +
    `<style>` +
    `@page { size: 21.59cm 27.94cm; margin: 3cm 2.5cm 3cm 3cm; }` +
    `body { font-family:'Times New Roman',serif; font-size:12pt; color:#000; }` +
    `p { margin:0; line-height:1.5; text-align:justify; }` +
    `p.sp { line-height:1; }` +
    `p.h { font-weight:bold; }` +
    `p.r { text-align:right; }` +
    `p.c { text-align:center; }` +
    `</style></head><body>${cuerpo}</body></html>`;
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Sección "Documentos" del expediente: lista de documentos (borradores generados
 * + archivos adjuntos), generación desde plantillas del tipo, adjuntar por enlace,
 * y edición del borrador generado (Fase 4 de legal-tramites).
 */
export function DocumentosProceso({
  procesoId,
  docs,
  onDocsChange,
  readOnly = false,
  ocultarPlantillas = false,
}: {
  procesoId: string;
  // Controlado: la lista vive en la página (misma fuente que el panel "Documentos
  // requeridos"), así eliminar/agregar/generar aquí se refleja allá al instante.
  docs: DocumentoProceso[];
  onDocsChange: (docs: DocumentoProceso[]) => void;
  readOnly?: boolean;
  // Oculta el bloque "Generar desde plantilla" (p. ej. en Proceso Laboral).
  ocultarPlantillas?: boolean;
}) {
  const [plantillas, setPlantillas] = useState<PlantillaItem[]>([]);
  const [plantillaId, setPlantillaId] = useState("");
  const [adjNombre, setAdjNombre] = useState("");
  const [adjUrl, setAdjUrl] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<DocumentoProceso | null>(null);

  useEffect(() => {
    getPlantillasDeProceso(procesoId)
      .then(setPlantillas)
      .catch(() => setPlantillas([]));
  }, [procesoId]);

  async function correr(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError("No se pudo completar la acción. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const generar = () =>
    correr(async () => {
      const doc = await generarDocumento(procesoId, plantillaId);
      onDocsChange([doc, ...docs]);
      setPlantillaId("");
      setEditId(doc.id);
      setBorrador(doc.contenido ?? "");
    });

  // Genera y descarga el .doc SIN guardarlo en la lista de documentos.
  const generarYDescargar = () =>
    correr(async () => {
      const { nombre, contenido } = await renderDocumento(procesoId, plantillaId);
      descargarDoc(nombre, contenido);
      setPlantillaId("");
    });

  const adjuntar = () =>
    correr(async () => {
      const doc = await adjuntarDocumento(procesoId, adjNombre.trim(), adjUrl.trim());
      onDocsChange([doc, ...docs]);
      setAdjNombre("");
      setAdjUrl("");
    });

  const guardar = () =>
    correr(async () => {
      const doc = await editarDocumento(procesoId, editId!, { contenido: borrador });
      onDocsChange(docs.map((x) => (x.id === doc.id ? doc : x)));
      setEditId(null);
    });

  const eliminar = (docId: string) =>
    correr(async () => {
      await eliminarDocumento(procesoId, docId);
      onDocsChange(docs.filter((x) => x.id !== docId));
      if (editId === docId) setEditId(null);
      setABorrar(null);
    });

  return (
    <div className="space-y-4">
      {/* Lista */}
      <ul className="space-y-2 text-sm">
        {docs.map((doc) => (
          <li key={doc.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-600">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-slate-800 dark:text-slate-100">{doc.nombre}</span>
                  {doc.origenRamaIdReg && (
                    <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-600 dark:text-slate-300">del juzgado</span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {doc.origenRamaIdReg ? "Importado del expediente" : doc.contenido != null ? "Borrador generado" : "Archivo adjunto"}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    Abrir
                  </a>
                )}
                {doc.contenido != null && (
                  <button
                    type="button"
                    onClick={() => descargarDoc(doc.nombre, doc.contenido ?? "")}
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    Descargar
                  </button>
                )}
                {!readOnly && doc.contenido != null && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(doc.id);
                      setBorrador(doc.contenido ?? "");
                    }}
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    Editar
                  </button>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setABorrar(doc)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>

            {editId === doc.id && (
              <div className="mt-3 space-y-2">
                <Textarea value={borrador} onChange={setBorrador} rows={12} />
                <div className="flex gap-2">
                  <Button onClick={guardar} disabled={busy}>
                    Guardar
                  </Button>
                  <Button variant="ghost" onClick={() => setEditId(null)} disabled={busy}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
        {docs.length === 0 && <li className="text-slate-400">Sin documentos todavía.</li>}
      </ul>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {readOnly ? null : (
        <>
      {/* Generar desde plantilla (oculto p. ej. en Proceso Laboral) */}
      {!ocultarPlantillas && (
      <div className="border-t border-slate-100 pt-4 dark:border-slate-600">
        <Field label="Minutas">
          <select
            value={plantillaId}
            onChange={(e) => setPlantillaId(e.target.value)}
            disabled={plantillas.length === 0}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="">
              {plantillas.length === 0 ? "Este tipo no tiene plantillas" : "Selecciona una plantilla…"}
            </option>
            {plantillas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={generarYDescargar} disabled={busy || !plantillaId}>
              Generar y descargar
            </Button>
            <Button variant="ghost" onClick={generar} disabled={busy || !plantillaId}>
              Generar borrador editable
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            «Generar y descargar» baja un .doc para revisar/firmar y subir el firmado; no lo agrega a la lista. «Borrador editable» lo guarda aquí para editarlo.
          </p>
        </Field>
      </div>
      )}

      {/* Adjuntar por enlace */}
      <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-600">
        <Field label="Adjuntar archivo (enlace)">
          <Input value={adjNombre} onChange={setAdjNombre} placeholder="Nombre del documento" />
        </Field>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input value={adjUrl} onChange={setAdjUrl} placeholder="https://…" />
          </div>
          <Button onClick={adjuntar} disabled={busy || !adjNombre.trim() || !adjUrl.trim()}>
            Adjuntar
          </Button>
        </div>
      </div>
        </>
      )}

      <ConfirmDialog
        open={!!aBorrar}
        title="Eliminar documento"
        message={`¿Eliminar "${aBorrar?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        danger
        busy={busy}
        onConfirm={() => aBorrar && eliminar(aBorrar.id)}
        onCancel={() => setABorrar(null)}
      />
    </div>
  );
}
