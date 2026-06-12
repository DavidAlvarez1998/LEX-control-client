"use client";

// Checklist de DOCUMENTOS REQUERIDOS del proceso: junta los documentos que exigen
// las etapas (reglas.documentosRequeridos + requeridosSi que apliquen según datos),
// y da un botón "Subir" por cada uno, YA con el nombre exacto que pide el gate
// (p. ej. peticion.pdf, poder.pdf, reiteracion.pdf). Así avanzar de etapa no se
// bloquea por no saber el nombre. Sube el archivo real a tecnovapp.

import { BotonSubirDoc } from "@/components/boton-subir-doc";
import { documentosOpcionalesDeEtapas, documentosRequeridosDeEtapas, etiquetaDoc, type EtapaDef } from "@/lib/procesos";
import { subirArchivoProceso, type DocumentoProceso } from "@/lib/procesos-api";

export function DocumentosRequeridos({
  procesoId,
  etapas,
  datos,
  documentos,
  onChange,
  resaltar = false,
  readOnly = false,
}: {
  procesoId: string;
  etapas: EtapaDef[];
  datos: Record<string, unknown>;
  documentos: DocumentoProceso[];
  onChange: (docs: DocumentoProceso[]) => void;
  resaltar?: boolean; // anillo de énfasis cuando una etapa se bloqueó por documentos
  readOnly?: boolean;
}) {
  const requeridos = documentosRequeridosDeEtapas(etapas, datos);
  const opcionales = documentosOpcionalesDeEtapas(etapas, datos);
  const items = [
    ...requeridos.map((nombre) => ({ nombre, req: true })),
    ...opcionales.map((nombre) => ({ nombre, req: false })),
  ];
  if (items.length === 0) return null;

  const presente = (nombre: string) =>
    documentos.find((d) => d.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());

  async function subir(nombre: string, file: File) {
    const doc = await subirArchivoProceso(procesoId, file, nombre);
    onChange([doc, ...documentos.filter((d) => d.nombre.trim().toLowerCase() !== nombre.trim().toLowerCase())]);
  }

  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50 p-4 transition-shadow dark:border-amber-500/30 dark:bg-amber-500/10 ${resaltar ? "ring-2 ring-amber-400 dark:ring-amber-500" : ""}`}>
      <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Documentos del proceso</h3>
      <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300/80">
        Los marcados con <span className="text-red-500">*</span> se exigen para avanzar de etapa.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map(({ nombre, req }) => {
          const doc = presente(nombre);
          return (
            <li
              key={nombre}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/60 bg-white px-3 py-2 dark:border-amber-500/20 dark:bg-slate-900"
            >
              <span className={`text-sm font-medium ${doc ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-200"}`}>
                {doc ? "✓ " : "• "}
                {etiquetaDoc(nombre)}
                {req ? <span className="ml-0.5 text-red-500">*</span> : <span className="ml-1 font-normal text-slate-400">(opcional)</span>}
              </span>
              <div className="flex items-center gap-3">
                {doc?.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-indigo-600 hover:underline">
                    Abrir
                  </a>
                )}
                {!readOnly && (
                  <BotonSubirDoc etiqueta={etiquetaDoc(nombre)} yaSubido={!!doc} onSubir={(file) => subir(nombre, file)} />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
