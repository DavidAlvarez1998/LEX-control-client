"use client";

// Vista + edición del formulario dinámico de un proceso. Permite completar/
// corregir `datos` después de creado (incl. la tutela derivada que nace vacía).
// Guarda contra PATCH /procesos/:id (validación tolerante: borradores incompletos).

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import { BotonSubirDoc } from "./boton-subir-doc";
import { FormularioDinamico } from "./formulario-dinamico";
import { VencimientoHint } from "./vencimiento-hint";
import { errorMessage } from "@/lib/api";
import {
  campoEfectivamenteRequerido,
  campoVisible,
  documentosOpcionalesDeEtapas,
  documentosRequeridosDeEtapas,
  etiquetaDoc,
  type CampoEsquema,
  type EtapaDef,
} from "@/lib/procesos";
import { actualizarDatos, subirArchivoProceso, type DocumentoProceso, type ProcesoDetalle } from "@/lib/procesos-api";

export function DatosProceso({
  procesoId,
  tipoProcesoId,
  esquema,
  etapas = [],
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
  etapas?: EtapaDef[]; // para mostrar los documentos requeridos/opcionales inline
  datos: Record<string, unknown>;
  onSaved: (proceso: ProcesoDetalle) => void; // proceso completo (incluye etapa auto-avanzada)
  documentos?: DocumentoProceso[]; // para saber qué documentos ya están adjuntos
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
  const [erroresGuardar, setErroresGuardar] = useState<string[]>([]); // keys marcadas al validar al guardar
  const formRef = useRef<HTMLDivElement>(null);

  // Al intentar avanzar una etapa bloqueada (por datos O documentos), se abre el
  // form en edición partiendo de los datos actuales para que el campo y/o su
  // documento aparezcan inline. El nonce re-dispara en cada intento.
  useEffect(() => {
    if (resaltarCampos) {
      setBorrador(datos);
      setEditando(true);
      // Scroll al PRIMER campo faltante (no al tope del form): los campos de la
      // etapa que falta (p. ej. radicación) están abajo en la lista, así que ir
      // al tope dejaba al usuario sin ver lo que debe llenar. Espera a que el
      // form en edición renderice.
      const primero = resaltarCampos.keys[0];
      setTimeout(() => {
        const cont = formRef.current;
        const destino = primero ? cont?.querySelector(`[data-campo="${CSS.escape(primero)}"]`) : null;
        (destino ?? cont)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resaltarCampos?.nonce]);

  // Marca solo los que SIGUEN vacíos en el borrador (se limpian al llenarlos).
  const esVacio = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  // Campos marcados en rojo: los del intento de avance + los del intento de guardar,
  // pero solo mientras sigan vacíos (se limpian al llenarlos).
  const erroresVivos = [...new Set([...(resaltarCampos?.keys ?? []), ...erroresGuardar])].filter((k) => esVacio(borrador[k]));

  const presente = (nombre: string) =>
    documentos.find((d) => d.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());

  async function subirDoc(nombre: string, file: File) {
    const doc = await subirArchivoProceso(procesoId, file, nombre);
    onDocSubido?.(doc);
  }

  // Bloque de documentos inline (bajo un campo del formulario). Los requeridos van
  // con * y los demás como "(opcional)". Suben al instante (el proceso ya existe).
  const bloqueDocs = (titulo: string, docs: string[], requeridos: string[]) => {
    if (docs.length === 0) return null;
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="mb-2 text-sm font-medium text-amber-900 dark:text-amber-200">{titulo}</p>
        <ul className="space-y-2">
          {docs.map((nombre) => {
            const doc = presente(nombre);
            const req = requeridos.includes(nombre);
            return (
              <li key={nombre} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/60 bg-white px-3 py-2 dark:border-amber-500/20 dark:bg-slate-900">
                <span className={`text-sm font-medium ${doc ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-200"}`}>
                  {doc ? "✓ " : "• "}
                  {etiquetaDoc(nombre)}
                  {req ? <span className="ml-0.5 text-red-500">*</span> : <span className="ml-1 font-normal text-slate-400">(opcional)</span>}
                </span>
                <BotonSubirDoc etiqueta={etiquetaDoc(nombre)} yaSubido={!!doc} onSubir={(f) => subirDoc(nombre, f)} />
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  async function guardar() {
    // Validar requeridos efectivos (incluye los que activa "¿Contestaron?") + los
    // documentos requeridos: no se guarda hasta completarlos.
    const camposFaltan = esquema.filter(
      (c) => campoVisible(c, borrador) && campoEfectivamenteRequerido(c, borrador) && esVacio(borrador[c.key]),
    );
    const docsFaltan = documentosRequeridosDeEtapas(etapas, borrador).filter((n) => !presente(n));
    if (camposFaltan.length > 0 || docsFaltan.length > 0) {
      setErroresGuardar(camposFaltan.map((c) => c.key));
      setError(
        `Completa antes de guardar: ${[...camposFaltan.map((c) => c.label), ...docsFaltan.map(etiquetaDoc)].join(", ")}.`,
      );
      return;
    }
    setErroresGuardar([]);
    setGuardando(true);
    setError(null);
    try {
      const actualizado = await actualizarDatos(procesoId, borrador);
      onSaved(actualizado); // proceso completo: refleja la etapa auto-avanzada sin refrescar
      setEditando(false);
    } catch (e) {
      setError(errorMessage(e, "Error al guardar"));
    } finally {
      setGuardando(false);
    }
  }

  if (!editando) {
    // Solo los campos CON valor: los vacíos llenaban el resumen de "—" y huecos.
    const visibles = esquema.filter((c) => campoVisible(c, datos) && !esVacio(datos[c.key]));
    return (
      <div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((c) => (
            <div key={c.key} className={c.tipo === "textoLargo" ? "sm:col-span-2 lg:col-span-3" : undefined}>
              <dt className="text-xs text-slate-400">{c.label}</dt>
              <dd className="mt-0.5 whitespace-pre-line text-slate-700 dark:text-slate-200">{formatValor(datos[c.key])}</dd>
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
    <div ref={formRef}>
      <FormularioDinamico
        esquema={esquema}
        datos={borrador}
        onChange={(k, v) => setBorrador((d) => ({ ...d, [k]: v }))}
        errores={erroresVivos}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        // Slots: vencimiento en vivo tras la fecha de radicación + documentos INLINE
        // bajo su campo (suben al instante). Bajo "¿Requiere poder?": petición/poder
        // (los que no dependen de la respuesta). Bajo "¿Contestaron?": la respuesta y
        // demás docs que aparecen al responder (Sí/Parcial).
        slotDespuesDe={{
          fechaRadicacion: <VencimientoHint tipoProcesoId={tipoProcesoId} datos={borrador} />,
          requierePoder: (() => {
            const neutro = { ...borrador, contestaron: "" };
            const req = documentosRequeridosDeEtapas(etapas, neutro);
            const docs = [...req, ...documentosOpcionalesDeEtapas(etapas, neutro)];
            return bloqueDocs("Documentos a adjuntar", docs, req);
          })(),
          contestaron: (() => {
            const neutro = { ...borrador, contestaron: "" };
            const reqResp = documentosRequeridosDeEtapas(etapas, borrador).filter((d) => !documentosRequeridosDeEtapas(etapas, neutro).includes(d));
            const optResp = documentosOpcionalesDeEtapas(etapas, borrador).filter((d) => !documentosOpcionalesDeEtapas(etapas, neutro).includes(d));
            return bloqueDocs("Documentos de la respuesta", [...reqResp, ...optResp], reqResp);
          })(),
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
