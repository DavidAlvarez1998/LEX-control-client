"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Field, Input, Textarea } from "@/components/form-ui";
import {
  adjuntarDocumento,
  editarDocumento,
  eliminarDocumento,
  generarDocumento,
  getPlantillasDeProceso,
  type DocumentoProceso,
  type PlantillaItem,
} from "@/lib/procesos-api";

/**
 * Sección "Documentos" del expediente: lista de documentos (borradores generados
 * + archivos adjuntos), generación desde plantillas del tipo, adjuntar por enlace,
 * y edición del borrador generado (Fase 4 de legal-tramites).
 */
export function DocumentosProceso({
  procesoId,
  inicial,
}: {
  procesoId: string;
  inicial: DocumentoProceso[];
}) {
  const [docs, setDocs] = useState<DocumentoProceso[]>(inicial);
  const [plantillas, setPlantillas] = useState<PlantillaItem[]>([]);
  const [plantillaId, setPlantillaId] = useState("");
  const [adjNombre, setAdjNombre] = useState("");
  const [adjUrl, setAdjUrl] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setDocs((d) => [doc, ...d]);
      setPlantillaId("");
      setEditId(doc.id);
      setBorrador(doc.contenido ?? "");
    });

  const adjuntar = () =>
    correr(async () => {
      const doc = await adjuntarDocumento(procesoId, adjNombre.trim(), adjUrl.trim());
      setDocs((d) => [doc, ...d]);
      setAdjNombre("");
      setAdjUrl("");
    });

  const guardar = () =>
    correr(async () => {
      const doc = await editarDocumento(procesoId, editId!, { contenido: borrador });
      setDocs((d) => d.map((x) => (x.id === doc.id ? doc : x)));
      setEditId(null);
    });

  const eliminar = (docId: string) =>
    correr(async () => {
      await eliminarDocumento(procesoId, docId);
      setDocs((d) => d.filter((x) => x.id !== docId));
      if (editId === docId) setEditId(null);
    });

  return (
    <div className="space-y-4">
      {/* Lista */}
      <ul className="space-y-2 text-sm">
        {docs.map((doc) => (
          <li key={doc.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-800 dark:text-slate-100">{doc.nombre}</div>
                <div className="text-xs text-slate-400">
                  {doc.contenido != null ? "Borrador generado" : "Archivo adjunto"}
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
                    onClick={() => {
                      setEditId(doc.id);
                      setBorrador(doc.contenido ?? "");
                    }}
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    Editar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => eliminar(doc.id)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Eliminar
                </button>
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

      {/* Generar desde plantilla */}
      <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
        <Field label="Generar desde plantilla">
          <div className="flex gap-2">
            <select
              value={plantillaId}
              onChange={(e) => setPlantillaId(e.target.value)}
              disabled={plantillas.length === 0}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
            <Button onClick={generar} disabled={busy || !plantillaId}>
              Generar
            </Button>
          </div>
        </Field>
      </div>

      {/* Adjuntar por enlace */}
      <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
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
    </div>
  );
}
