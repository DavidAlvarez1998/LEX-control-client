"use client";

// Adjuntar VARIOS documentos a un proceso ya existente (subida inmediata). Es un
// wrapper delgado del uploader estándar `DocumentosUploader` en modo "en vivo": los
// docs de esta sección se agrupan por un `prefix` interno en el nombre (p. ej.
// "audiencia: ") para que cada sección liste solo los suyos. Conserva la API previa
// (procesoId/docs/prefix/onSubido/onEliminado) para no tocar los call sites.

import { DocumentosUploader, type DocSubido } from "./documentos-uploader";
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
  const existentes: DocSubido[] = grupo.map((d) => ({ id: d.id, nombre: nombreVisible(d.nombre), url: d.url }));

  return (
    <DocumentosUploader
      titulo={titulo}
      opcional={false}
      readOnly={readOnly}
      existentes={existentes}
      subir={async (file) => {
        const doc = await subirArchivoProceso(procesoId, file, `${prefix}${file.name}`);
        onSubido(doc);
      }}
      quitar={async (id) => {
        await eliminarDocumento(procesoId, id);
        onEliminado(id);
      }}
    />
  );
}
