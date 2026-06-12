"use client";

// Vista + edición del formulario dinámico de un proceso. Permite completar/
// corregir `datos` después de creado (incl. la tutela derivada que nace vacía).
// Guarda contra PATCH /procesos/:id (validación tolerante: borradores incompletos).

import { useEffect, useState } from "react";
import { Button } from "./ui";
import { BotonSubirDoc } from "./boton-subir-doc";
import { FormularioDinamico } from "./formulario-dinamico";
import { VencimientoHint } from "./vencimiento-hint";
import { errorMessage } from "@/lib/api";
import { campoVisible, type CampoEsquema } from "@/lib/procesos";
import { actualizarDatos, subirArchivoProceso, type DocumentoProceso } from "@/lib/procesos-api";

export function DatosProceso({
  procesoId,
  tipoProcesoId,
  esquema,
  datos,
  onSaved,
  documentos = [],
  onDocSubido,
  resaltarCampos,
  readOnly = false,
}: {
  procesoId: string;
  tipoProcesoId: string; // para calcular el vencimiento en vivo al editar la fecha
  esquema: CampoEsquema[];
  datos: Record<string, unknown>;
  onSaved: (datos: Record<string, unknown>) => void;
  documentos?: DocumentoProceso[]; // para saber si el poder ya está adjunto
  onDocSubido?: (doc: DocumentoProceso) => void; // refleja la subida en la ficha
  // Campos a resaltar como faltantes (al intentar avanzar de etapa): abre el form
  // en edición y los marca; cada marca se limpia al llenar el campo. Su identidad
  // cambia en cada intento bloqueado para re-disparar el efecto.
  resaltarCampos?: { keys: string[]; nonce: number };
  readOnly?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Record<string, unknown>>(datos);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al recibir campos a resaltar (etapa bloqueada por datos), abre el form en
  // edición partiendo de los datos actuales. El nonce re-dispara en cada intento.
  useEffect(() => {
    if (resaltarCampos && resaltarCampos.keys.length > 0) {
      setBorrador(datos);
      setEditando(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resaltarCampos?.nonce]);

  // Marca solo los que SIGUEN vacíos en el borrador (se limpian al llenarlos).
  const esVacio = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  const erroresVivos = (resaltarCampos?.keys ?? []).filter((k) => esVacio(borrador[k]));

  const poderActual = documentos.find((d) => d.nombre.trim().toLowerCase() === "poder.pdf");

  async function subirPoder(file: File) {
    const doc = await subirArchivoProceso(procesoId, file, "poder.pdf");
    onDocSubido?.(doc);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const actualizado = await actualizarDatos(procesoId, borrador);
      onSaved(actualizado.datos);
      setEditando(false);
    } catch (e) {
      setError(errorMessage(e, "Error al guardar"));
    } finally {
      setGuardando(false);
    }
  }

  if (!editando) {
    const visibles = esquema.filter((c) => campoVisible(c, datos));
    return (
      <div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((c) => (
            <div key={c.key}>
              <dt className="text-xs text-slate-400">{c.label}</dt>
              <dd className="mt-0.5 text-slate-700 dark:text-slate-200">{formatValor(datos[c.key])}</dd>
            </div>
          ))}
          {visibles.length === 0 && <p className="text-slate-400">Sin datos aún.</p>}
        </dl>
        {!readOnly && (
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => {
              setBorrador(datos);
              setEditando(true);
            }}
          >
            Editar datos
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      <FormularioDinamico
        esquema={esquema}
        datos={borrador}
        onChange={(k, v) => setBorrador((d) => ({ ...d, [k]: v }))}
        errores={erroresVivos}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        // Slots: vencimiento en vivo tras la fecha de radicación (igual que en la
        // creación) + uploader del poder bajo el check "¿Requiere poder?". El proceso
        // ya existe, así que el poder se sube al instante. Ambos opcionales.
        slotDespuesDe={{
          fechaRadicacion: <VencimientoHint tipoProcesoId={tipoProcesoId} datos={borrador} />,
          requierePoder: Boolean(borrador.requierePoder) ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Poder <span className="font-normal text-amber-700/80 dark:text-amber-300/70">(opcional)</span>
                </p>
                <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300/80">
                  {poderActual ? "✓ Poder adjunto. Puedes reemplazarlo." : "Adjunta el poder (cualquier formato)."}
                </p>
              </div>
              <BotonSubirDoc etiqueta="Poder" yaSubido={!!poderActual} onSubir={subirPoder} />
            </div>
          ) : null,
        }}
      />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
        <Button variant="ghost" onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function formatValor(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}
