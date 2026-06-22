"use client";

// Documentos de un contrato: lista + subida real de archivos (vía la API →
// microservicio documental) + quitar. Usa el uploader estándar `DocumentosUploader`
// en modo "en vivo" (subida inmediata), con la categoría como campo `extra`. Lo usan
// la gestión del admin (/contratos) y "Mi Contrato" (/cuenta).

import { useState } from "react";
import { Field } from "./form-ui";
import { api, uploadFile } from "@/lib/api";
import { DocumentosUploader, type DocSubido } from "./documentos-uploader";

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
}: {
  contratoId: string;
  docs: DocumentoContrato[];
  onChange: (d: DocumentoContrato[]) => void;
  // `onError` ya no se usa (los errores se muestran inline en el uploader); se
  // mantiene opcional por compatibilidad con los call sites existentes.
  onError?: (m: string | null) => void;
}) {
  const [categoria, setCategoria] = useState<Categoria>("PERSONAL");
  const existentes: DocSubido[] = docs.map((d) => ({ id: d.id, nombre: d.nombre, url: d.url, sub: CAT_LABEL[d.categoria] }));

  return (
    <DocumentosUploader
      titulo="Documentos del contrato"
      opcional={false}
      existentes={existentes}
      extra={
        <Field label="Categoría del documento">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as Categoria)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      }
      subir={async (file) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("categoria", categoria);
        fd.append("nombre", file.name);
        if (file.type) fd.append("tipo", file.type);
        const doc = await uploadFile<DocumentoContrato>(`/contratos/${contratoId}/documentos`, fd);
        onChange([doc, ...docs]);
      }}
      quitar={async (id) => {
        await api.del(`/contratos/${contratoId}/documentos/${id}`);
        onChange(docs.filter((d) => d.id !== id));
      }}
    />
  );
}
