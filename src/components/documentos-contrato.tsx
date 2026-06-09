"use client";

// Bloque reutilizable de documentos de un contrato: lista + subida real de
// archivos (vía la API → microservicio documental) + quitar. Lo usan tanto la
// pantalla de gestión del admin (/contratos) como "Mi Contrato" (/cuenta): la
// API permite subir/quitar tanto al gestor como al DUEÑO del contrato.

import { useState } from "react";
import { Button } from "./ui";
import { ConfirmDialog } from "./confirm-dialog";
import { Field, Input } from "./form-ui";
import { api, ApiError, uploadFile } from "@/lib/api";

export type Categoria = "PERSONAL" | "PROFESIONAL" | "CONTRACTUAL" | "FINANCIERO" | "LEGAL";

export type DocumentoContrato = {
  id: string;
  categoria: Categoria;
  nombre: string;
  tipo: string | null;
  url: string | null;
  createdAt: string;
};

export const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: "PERSONAL", label: "Personal (cédula, hoja de vida…)" },
  { value: "PROFESIONAL", label: "Profesional (tarjeta, licencias…)" },
  { value: "CONTRACTUAL", label: "Contractual (contrato firmado, otrosí…)" },
  { value: "FINANCIERO", label: "Financiero (RUT, cuenta, soportes…)" },
  { value: "LEGAL", label: "Legal (confidencialidad, políticas…)" },
];

export const CAT_LABEL = Object.fromEntries(
  CATEGORIAS.map((c) => [c.value, c.label.split(" (")[0]]),
) as Record<Categoria, string>;

export function DocumentosContrato({
  contratoId,
  docs,
  onChange,
  onError,
}: {
  contratoId: string;
  docs: DocumentoContrato[];
  onChange: (d: DocumentoContrato[]) => void;
  onError: (m: string | null) => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [categoria, setCategoria] = useState<Categoria>("PERSONAL");
  const [nombre, setNombre] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [confirmar, setConfirmar] = useState<DocumentoContrato | null>(null);
  const [borrando, setBorrando] = useState(false);

  async function subir() {
    if (!archivo) {
      onError("Selecciona un archivo");
      return;
    }
    setSubiendo(true);
    onError(null);
    try {
      const fd = new FormData();
      fd.append("file", archivo);
      fd.append("categoria", categoria);
      fd.append("nombre", nombre.trim() || archivo.name);
      if (archivo.type) fd.append("tipo", archivo.type);
      const doc = await uploadFile<DocumentoContrato>(`/contratos/${contratoId}/documentos`, fd);
      onChange([doc, ...docs]);
      setArchivo(null);
      setNombre("");
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Error al subir el documento");
    } finally {
      setSubiendo(false);
    }
  }

  async function borrar() {
    if (!confirmar) return;
    setBorrando(true);
    onError(null);
    try {
      await api.del(`/contratos/${contratoId}/documentos/${confirmar.id}`);
      onChange(docs.filter((d) => d.id !== confirmar.id));
      setConfirmar(null);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Error al eliminar el documento");
    } finally {
      setBorrando(false);
    }
  }

  return (
    <div className="space-y-4">
      {docs.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Aún no hay documentos cargados.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800 dark:text-slate-100">{d.nombre}</p>
                <span className="text-xs text-slate-500 dark:text-slate-400">{CAT_LABEL[d.categoria]}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {d.url && (
                  <a href={d.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                    Ver
                  </a>
                )}
                <button onClick={() => setConfirmar(d)} className="font-medium text-red-600 hover:text-red-500">
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Categoría">
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as Categoria)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nombre del documento">
            <Input value={nombre} onChange={setNombre} placeholder="Ej. Cédula, Contrato firmado…" />
          </Field>
        </div>
        <input
          type="file"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 dark:text-slate-300 dark:file:bg-indigo-500/10 dark:file:text-indigo-300"
        />
        <div className="mt-3">
          <Button onClick={subir} disabled={subiendo || !archivo}>
            {subiendo ? "Subiendo…" : "Subir documento"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmar}
        title="Quitar documento"
        message={`¿Seguro que quieres quitar "${confirmar?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Quitar"
        danger
        busy={borrando}
        onConfirm={borrar}
        onCancel={() => setConfirmar(null)}
      />
    </div>
  );
}
