"use client";

// Vista + edición del formulario dinámico de un proceso. Permite completar/
// corregir `datos` después de creado (incl. la tutela derivada que nace vacía).
// Guarda contra PATCH /procesos/:id (validación tolerante: borradores incompletos).

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { Button } from "./ui";
import { BotonSubirDoc } from "./boton-subir-doc";
import { AdjuntosLibres } from "./adjuntos-libres";
import { FormularioDinamico } from "./formulario-dinamico";
import { VencimientoHint } from "./vencimiento-hint";
import { errorMessage } from "@/lib/api";
import {
  campoEfectivamenteRequerido,
  campoVisible,
  camposDeCondicion,
  documentosOpcionalesDeEtapas,
  documentosRequeridosDeEtapas,
  etiquetaDoc,
  evaluarCondicion,
  type CampoEsquema,
  type EtapaDef,
} from "@/lib/procesos";
import { actualizarDatos, subirArchivoProceso, type DocumentoProceso, type ProcesoDetalle } from "@/lib/procesos-api";

// Permite a la ficha "vaciar" (guardar) los cambios del formulario sin guardar ANTES
// de intentar avanzar de etapa: así el avance evalúa lo recién diligenciado.
export type DatosProcesoHandle = { flush: () => Promise<ProcesoDetalle | null> };

export const DatosProceso = forwardRef<
  DatosProcesoHandle,
  {
    procesoId: string;
    tipoProcesoId: string; // para calcular el vencimiento en vivo al editar la fecha
    grupo?: string; // grupo del tipo (LABORAL ancla los docs por campo, no en un cuadro)
    etapaActual?: string; // para no exigir docs de etapas futuras al guardar
    esquema: CampoEsquema[];
    etapas?: EtapaDef[]; // para mostrar los documentos requeridos/opcionales inline
    datos: Record<string, unknown>;
    onSaved: (proceso: ProcesoDetalle) => void; // proceso completo (incluye etapa auto-avanzada)
    documentos?: DocumentoProceso[]; // para saber qué documentos ya están adjuntos
    onDocSubido?: (doc: DocumentoProceso) => void; // refleja la subida en la ficha
    onDocEliminado?: (docId: string) => void; // refleja el borrado (multi-adjuntos libres)
    // Campos a resaltar como faltantes (al intentar avanzar de etapa): abre el form
    // en edición y los marca; cada marca se limpia al llenar el campo. Su identidad
    // cambia en cada intento bloqueado para re-disparar el efecto.
    resaltarCampos?: { keys: string[]; nonce: number };
    readOnly?: boolean;
  }
>(function DatosProceso({
  procesoId,
  tipoProcesoId,
  grupo,
  etapaActual,
  esquema,
  etapas = [],
  datos,
  onSaved,
  documentos = [],
  onDocSubido,
  onDocEliminado,
  resaltarCampos,
  readOnly = false,
}, ref) {
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

  // Documentos inline (bajo un campo del formulario): cada documento es su PROPIA
  // tarjeta, titulada con el nombre del documento (no un encabezado genérico). Los
  // requeridos llevan * y los demás "(opcional)". Debajo se muestra el nombre del
  // archivo subido (.pdf/.doc…). Suben al instante (el proceso ya existe).
  const bloqueDocs = (_titulo: string, docs: string[], requeridos: string[]) => {
    if (docs.length === 0) return null;
    return (
      <div className="space-y-2">
        {docs.map((nombre) => {
          const doc = presente(nombre);
          const req = requeridos.includes(nombre);
          const archivo = nombreArchivo(doc?.url);
          return (
            <div key={nombre} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-700/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {etiquetaDoc(nombre)}
                  {req ? <span className="ml-0.5 text-red-500">*</span> : <span className="ml-1 font-normal text-slate-400">(opcional)</span>}
                </span>
                <BotonSubirDoc etiqueta={etiquetaDoc(nombre)} yaSubido={!!doc} url={doc?.url} onSubir={(f) => subirDoc(nombre, f)} />
              </div>
              <p className={`mt-1 truncate text-xs ${archivo ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                {archivo ? `✓ ${archivo}` : "Sin archivo adjunto"}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  async function guardar() {
    // Validar requeridos efectivos (incluye los que activa "¿Contestaron?") + los
    // documentos requeridos: no se guarda hasta completarlos.
    const camposFaltan = esquema.filter(
      (c) => campoVisible(c, borrador) && campoEfectivamenteRequerido(c, borrador) && esVacio(borrador[c.key]),
    );
    // Solo se exigen los documentos de la etapa ACTUAL y anteriores: los de etapas
    // futuras (p. ej. citación/sentencia) no deben bloquear un guardado — y menos si
    // el caso se va a archivar (retiro art. 67, rechazo). Si no se conoce la etapa
    // actual, se cae al comportamiento previo (todas).
    const ordenActual = etapas.find((e) => e.key === etapaActual)?.orden ?? Infinity;
    const etapasHastaActual = etapas.filter((e) => e.orden <= ordenActual);
    const docsFaltan = documentosRequeridosDeEtapas(etapasHastaActual, borrador).filter((n) => !presente(n));
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

  // Guardado TOLERANTE para "guardar antes de avanzar": persiste lo diligenciado (el
  // server acepta borradores incompletos) y devuelve el proceso (con la etapa que el
  // motor auto-avanzó). Si no hay edición pendiente, no hace nada.
  useImperativeHandle(
    ref,
    () => ({
      async flush() {
        if (!editando) return null;
        try {
          const actualizado = await actualizarDatos(procesoId, borrador);
          onSaved(actualizado);
          setEditando(false);
          return actualizado;
        } catch {
          return null;
        }
      },
    }),
    [editando, borrador, procesoId, onSaved],
  );

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

  const tieneCampo = (k: string) => esquema.some((c) => c.key === k);
  // El hint de vencimiento bajo radicación/recepción es para DdP/tutela (su plazo corre
  // desde esa fecha). En el laboral el plazo NO corre desde la radicación, así que ahí no
  // va; el único hint laboral es el de subsanar, bajo "Fecha del auto" (más abajo).
  const slots: Record<string, ReactNode> = grupo === "LABORAL" ? {} : {
    fechaRadicacion: <VencimientoHint tipoProcesoId={tipoProcesoId} datos={borrador} />,
    fechaRecepcion: <VencimientoHint tipoProcesoId={tipoProcesoId} datos={borrador} />,
  };
  let docsSinAnclar: string[] = [];
  let reqSinAnclar: string[] = [];
  // Slots que van ARRIBA del campo (no debajo). P. ej. el PDF de la notificación
  // sube antes de su fecha (primero adjuntar, luego fechar).
  const slotsAntes: Record<string, ReactNode> = {};

  if (grupo === "LABORAL") {
    // Laboral: cada documento va INLINE, justo debajo del campo que lo habilita
    // (no agrupado en un cuadro). Los docs fijos de cada etapa se anclan a su primer
    // campo requerido —la "opción" de esa etapa, p. ej. `auto-admision.pdf` bajo
    // "Decisión del auto"— y los condicionales (requeridosSi/opcionalesSi) bajo el
    // campo de su condición (p. ej. `contestacion.pdf` bajo "¿Contestaron?").
    const a = anclasPorCampo(etapas, borrador, tieneCampo);
    for (const [campo, info] of Object.entries(a.porCampo)) {
      slots[campo] = bloqueDocs("Documentos a adjuntar", info.docs, info.req);
    }
    docsSinAnclar = a.sinAnclar;
    reqSinAnclar = a.sinAnclarReq;
    // Hints de plazo calculados, combinados con el documento ya anclado al campo
    // (para no pisarlo): el hint va arriba y debajo el bloque de adjuntar.
    const conHint = (campo: string, hint: ReactNode) => {
      const prev = slots[campo];
      slots[campo] = (<>{hint}{prev}</>);
    };
    // Si el auto fue INADMISIÓN, plazo para subsanar (5 días hábiles desde la fecha del auto).
    if (borrador.decisionAuto === "INADMISIÓN" && tieneCampo("fechaAdmision")) {
      conHint("fechaAdmision", <VencimientoHint tipoProcesoId={tipoProcesoId} datos={borrador} etiqueta="Plazo para subsanar:" desdeCampo="fechaAdmision" />);
    }
    // La notificación se SUBE primero y luego se fecha: el PDF de la notificación va
    // ARRIBA del campo "Fecha de la notificación" (no debajo). El vencimiento (10 días
    // hábiles) sí queda debajo de la fecha, que es de donde se calcula.
    if (tieneCampo("fechaNotificacion")) {
      if (slots["fechaNotificacion"]) {
        slotsAntes["fechaNotificacion"] = slots["fechaNotificacion"];
        delete slots["fechaNotificacion"];
      }
      conHint("fechaNotificacion", <VencimientoHint tipoProcesoId={tipoProcesoId} datos={borrador} etiqueta="Vence para contestar:" desdeCampo="fechaNotificacion" />);
    }
    // Traslado de la reconvención: vencimiento (10 días hábiles) + el PDF de la
    // notificación, bajo "Fecha de notificación de la reconvención" (no bajo la decisión).
    if (tieneCampo("fechaNotificacionReconvencion")) {
      conHint(
        "fechaNotificacionReconvencion",
        <>
          <VencimientoHint tipoProcesoId={tipoProcesoId} datos={borrador} etiqueta="Vence para contestar la reconvención:" desdeCampo="fechaNotificacionReconvencion" />
          {bloqueDocs("Notificación de la reconvención", ["notificacion-reconvencion.pdf"], [])}
        </>,
      );
    }
    // Estado "archivada" cuando el juez RECHAZA la reconvención (directo o tras la
    // subsanación). No archiva el proceso principal — solo marca la reconvención.
    const reconRechazada = borrador.decisionReconvencion === "RECHAZAR" || borrador.decisionTrasSubsanacionReconvencion === "RECHAZAR";
    if (reconRechazada) {
      const campo = borrador.decisionTrasSubsanacionReconvencion === "RECHAZAR" ? "decisionTrasSubsanacionReconvencion" : "decisionReconvencion";
      if (tieneCampo(campo)) {
        const prev = slots[campo];
        slots[campo] = (
          <>
            {prev}
            <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
              Reconvención archivada (rechazada por el juez)
            </span>
          </>
        );
      }
    }
    // Preparación de la audiencia: subir VARIOS documentos con nombre libre (bajo
    // "¿Se puede conciliar?"). El campo "Observaciones de la preparación" va debajo.
    if (tieneCampo("conciliable") && onDocSubido) {
      slots.conciliable = (
        <AdjuntosLibres
          procesoId={procesoId}
          docs={documentos}
          prefix="audiencia: "
          titulo="Documentos para la audiencia"
          onSubido={onDocSubido}
          onEliminado={(id) => onDocEliminado?.(id)}
          readOnly={readOnly}
        />
      );
    }
  } else {
    // DdP enviado usa requierePoder/contestaron; el recibido no tiene requierePoder y
    // su "respuesta" es `contestada`. Se elige el campo que EXISTA en el esquema.
    const campoBaseDoc = tieneCampo("requierePoder") ? "requierePoder" : tieneCampo("queSolicita") ? "queSolicita" : null;
    const campoRespuesta = tieneCampo("contestaron") ? "contestaron" : tieneCampo("contestada") ? "contestada" : null;
    // "neutro": estado sin respuesta, para separar los docs base de los de la respuesta.
    const neutro = { ...borrador, contestaron: "", contestada: "", medioRespuesta: "" };
    const baseReq = documentosRequeridosDeEtapas(etapas, neutro);
    const baseDocs = [...baseReq, ...documentosOpcionalesDeEtapas(etapas, neutro)];
    const respReq = documentosRequeridosDeEtapas(etapas, borrador).filter((d) => !baseReq.includes(d));
    const respOpt = documentosOpcionalesDeEtapas(etapas, borrador).filter((d) => !documentosOpcionalesDeEtapas(etapas, neutro).includes(d));
    if (campoBaseDoc && baseDocs.length) slots[campoBaseDoc] = bloqueDocs("Documentos a adjuntar", baseDocs, baseReq);
    if (campoRespuesta && [...respReq, ...respOpt].length) slots[campoRespuesta] = bloqueDocs("Documentos de la respuesta", [...respReq, ...respOpt], respReq);
    // Documentos que NO quedaron anclados (la tutela no tiene esos campos): bloque propio.
    const anclados = new Set<string>();
    if (campoBaseDoc && baseDocs.length) baseDocs.forEach((d) => anclados.add(d.toLowerCase()));
    if (campoRespuesta) [...respReq, ...respOpt].forEach((d) => anclados.add(d.toLowerCase()));
    const reqTodos = documentosRequeridosDeEtapas(etapas, borrador);
    const optTodos = documentosOpcionalesDeEtapas(etapas, borrador);
    docsSinAnclar = [...reqTodos, ...optTodos].filter((d) => !anclados.has(d.toLowerCase()));
    reqSinAnclar = reqTodos.filter((d) => !anclados.has(d.toLowerCase()));
  }

  // Cierre del proceso: si los datos YA implican un terminal, el botón de guardar lo
  // refleja para que el cierre se note. (a) Archivo: alguna etapa terminal con
  // `disponibleSi` satisfecho (retiro art. 67 o rechazo definitivo de la demanda).
  // (b) Final: el proceso llegó a su fin natural (2ª instancia decidida, o sentencia en
  // firme sin recurso, o apelación negada).
  const terminalDisp =
    grupo === "LABORAL" ? etapas.find((e) => e.terminal && e.disponibleSi && evaluarCondicion(e.disponibleSi, borrador)) : undefined;
  const terminalArchivo = !!terminalDisp && terminalDisp.key.startsWith("archivad");
  const terminalFinal =
    grupo === "LABORAL" && !terminalArchivo &&
    (!!terminalDisp || // p. ej. terminada_conciliacion (acuerdo de las partes)
      !!borrador.decisionSegundaInstancia ||
      (!!borrador.decisionSentencia && borrador.hayRecurso === "NO") ||
      (borrador.hayRecurso === "SI" && borrador.concedeApelacion === "NO"));
  const labelGuardar = guardando
    ? "Guardando…"
    : terminalArchivo
      ? "Guardar y archivar"
      : terminalFinal
        ? "Guardar y finalizar"
        : "Guardar";

  return (
    <div ref={formRef}>
      {grupo === "LABORAL" ? (
        // Laboral: secciones por etapa, en una sola columna (lectura vertical, sin el
        // emparejamiento raro izquierda/derecha). Cada sección oculta si todos sus
        // campos están ocultos (reusa mostrarSi). Los docs van inline bajo su campo.
        <div className="space-y-6">
          {seccionesLaboral(etapas, esquema, borrador)
            .filter((s) => s.campos.some((c) => campoVisible(c, borrador)))
            .map((s) => (
              <div key={s.titulo}>
                <h4 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  {s.titulo}
                </h4>
                <FormularioDinamico
                  esquema={s.campos}
                  datos={borrador}
                  onChange={(k, v) => setBorrador((d) => ({ ...d, [k]: v }))}
                  errores={erroresVivos}
                  className="grid grid-cols-1 gap-4"
                  slotDespuesDe={slots}
                  slotAntesDe={slotsAntes}
                />
              </div>
            ))}
        </div>
      ) : (
        <FormularioDinamico
          esquema={esquema}
          datos={borrador}
          onChange={(k, v) => setBorrador((d) => ({ ...d, [k]: v }))}
          errores={erroresVivos}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          // Documentos INLINE bajo su campo (suben al instante): los base bajo
          // requierePoder/queSolicita y los de la respuesta bajo contestaron/contestada.
          slotDespuesDe={slots}
        />
      )}
      {docsSinAnclar.length > 0 && (
        <div className="mt-4">{bloqueDocs("Documentos del proceso", docsSinAnclar, reqSinAnclar)}</div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button onClick={guardar} disabled={guardando}>
          {labelGuardar}
        </Button>
        <Button variant="ghost" onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
});

// Nombre real del archivo subido a partir de su URL (último segmento del path).
export function nombreArchivo(url?: string | null): string | null {
  if (!url) return null;
  try {
    return decodeURIComponent(url.split("?")[0].split("/").pop() || "") || null;
  } catch {
    return url;
  }
}

function formatValor(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}

// Título de sección por etapa del laboral (las audiencias se fusionan en una).
const TITULO_SECCION_LABORAL: Record<string, string> = {
  presentacion: "Presentación de la demanda",
  admision: "Calificación de la demanda (auto)",
  subsanacion: "Subsanación (inadmisión)",
  recurso_rechazo: "Recurso contra el rechazo",
  retiro: "Retiro de la demanda (art. 67)",
  traslado: "Traslado y notificación",
  contestacion: "Contestación (reforma / reconvención)",
  preparacionAudiencia: "Preparación de la audiencia",
  citacionAudiencia: "Citación a audiencia",
  preparacionAudiencia_doble: "Preparación de la audiencia",
  citacionAudiencia_doble: "Citación a audiencia",
  audienciaUnica: "Etapas de la audiencia",
  audienciaArt77: "Etapas de la audiencia",
  audienciaArt80: "Etapas de la audiencia",
  recurso: "Recurso contra la sentencia",
  remision2inst: "Remisión al Tribunal (2ª instancia)",
  sustentacion2inst: "Sustentación del recurso (2ª instancia)",
  audiencia2inst: "Audiencia de 2ª instancia",
  sentencia2inst: "Sentencia de 2ª instancia",
};

/**
 * Agrupa los campos del laboral en SECCIONES por etapa (solo presentación visual; no
 * decide requeridos ni habilita nada). Cada campo se asigna a la etapa que lo
 * introduce: 1) camposRequeridos + campos de las condiciones de la etapa; 2) campos
 * dependientes vía `mostrarSi` (heredan la sección del campo que los controla,
 * transitivo); 3) los sueltos, por proximidad al campo anterior. Devuelve secciones
 * en el orden del flujo; el render oculta las vacías (todos sus campos ocultos).
 */
function seccionesLaboral(etapas: EtapaDef[], esquema: CampoEsquema[], datos: Record<string, unknown>): { titulo: string; campos: CampoEsquema[] }[] {
  const orden = [...etapas].sort((a, b) => a.orden - b.orden);
  const enEsquema = (k: string) => esquema.some((c) => c.key === k);
  const asignado: Record<string, string> = {}; // campoKey -> stageKey
  // 1) Campos directos de cada etapa (first-claim-wins por orden).
  for (const e of orden) {
    const r = e.reglas;
    const directos = [
      ...(r?.camposRequeridos ?? []),
      ...(e.disponibleSi ? camposDeCondicion(e.disponibleSi) : []),
      ...(r?.requeridosSi ?? []).flatMap((x) => camposDeCondicion(x.si)),
      ...(r?.opcionalesSi ?? []).flatMap((x) => camposDeCondicion(x.si)),
    ];
    for (const k of directos) if (enEsquema(k) && asignado[k] == null) asignado[k] = e.key;
  }
  // 2) Dependientes (mostrarSi → dueño del campo referenciado), transitivo.
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const c of esquema) {
      if (asignado[c.key] != null || !c.mostrarSi) continue;
      const dueno = camposDeCondicion(c.mostrarSi).map((r) => asignado[r]).find((s) => s != null);
      if (dueno) { asignado[c.key] = dueno; cambio = true; }
    }
  }
  // 3) Sueltos: sección del campo anterior en el esquema (proximidad).
  let ultimo: string | undefined;
  for (const c of esquema) {
    if (asignado[c.key] != null) { ultimo = asignado[c.key]; continue; }
    asignado[c.key] = ultimo ?? orden[0]?.key ?? "";
    ultimo = asignado[c.key];
  }
  // Doble instancia: la audiencia se parte en Art. 77 / Art. 80 y el recurso es
  // apelación; única: una sola "Etapas de la audiencia" y recurso de reposición.
  const doble = String(datos?.tipoInstancia) === "Doble instancia";
  const ART80 = new Set(["audienciaAlegatos", "fechaSentencia", "decisionSentencia"]);
  const AUDIENCIA = new Set([
    "conciliaResultado", "acuerdoConciliacion", "audienciaExcepciones", "audienciaSaneamiento",
    "audienciaFijacionLitigio", "audienciaPruebas", ...ART80,
  ]);
  const PREP = new Set(["conciliable", "observacionesPreparacion"]);
  const CITACION = new Set(["fechaAudiencia"]);
  // Título de una ETAPA (define el ORDEN de las secciones), según instancia.
  const tituloEtapa = (stageKey: string): string | null => {
    if (stageKey === "audienciaUnica") return doble ? null : "Etapas de la audiencia";
    if (stageKey === "audienciaArt77") return doble ? "Audiencia art. 77" : null;
    if (stageKey === "audienciaArt80") return doble ? "Audiencia art. 80 y sentencia" : null;
    if (stageKey === "recurso") return doble ? "Apelación contra la sentencia" : "Recurso de reposición";
    if (stageKey === "citacionAudiencia") return doble ? null : "Citación a audiencia";
    if (stageKey === "preparacionAudiencia") return doble ? null : "Preparación de la audiencia";
    if (stageKey === "citacionAudiencia_doble") return doble ? "Citación a audiencia" : null;
    if (stageKey === "preparacionAudiencia_doble") return doble ? "Preparación de la audiencia" : null;
    return TITULO_SECCION_LABORAL[stageKey] ?? null;
  };
  // Título de un CAMPO: los de la audiencia se rutean por campo (Art. 77/80 en doble).
  const tituloCampo = (campoKey: string): string => {
    if (AUDIENCIA.has(campoKey)) {
      return doble ? (ART80.has(campoKey) ? "Audiencia art. 80 y sentencia" : "Audiencia art. 77") : "Etapas de la audiencia";
    }
    if (PREP.has(campoKey)) return "Preparación de la audiencia";
    if (CITACION.has(campoKey)) return "Citación a audiencia";
    return tituloEtapa(asignado[campoKey]) ?? "Datos del proceso";
  };
  const titulos: string[] = [];
  const porTitulo: Record<string, CampoEsquema[]> = {};
  for (const e of orden) {
    const t = tituloEtapa(e.key);
    if (t && !titulos.includes(t)) { titulos.push(t); porTitulo[t] = []; }
  }
  for (const c of esquema) {
    const t = tituloCampo(c.key);
    (porTitulo[t] ??= []).push(c);
    if (!titulos.includes(t)) titulos.push(t);
  }
  return titulos.filter((t) => (porTitulo[t]?.length ?? 0) > 0).map((t) => ({ titulo: t, campos: porTitulo[t] }));
}

/**
 * Mapea los documentos de las etapas a un campo "ancla" para mostrarlos INLINE bajo
 * ese campo (no en un cuadro suelto). Recorre las etapas disponibles según `datos`:
 *  - documentos fijos de la etapa → bajo su PRIMER campo requerido presente en el
 *    esquema (la "opción" de esa etapa, p. ej. `auto-admision.pdf` bajo decisionAuto);
 *  - documentos condicionales (requeridosSi/opcionalesSi) cuyo `si` se cumple → bajo
 *    el campo de su condición (p. ej. `contestacion.pdf` bajo contestaron).
 * Los que no logran anclarse (campo ausente) caen en `sinAnclar`.
 */
function anclasPorCampo(
  etapas: EtapaDef[],
  datos: Record<string, unknown>,
  tieneCampo: (k: string) => boolean,
): { porCampo: Record<string, { docs: string[]; req: string[] }>; sinAnclar: string[]; sinAnclarReq: string[] } {
  const porCampo: Record<string, { docs: string[]; req: string[] }> = {};
  const anclados = new Set<string>();
  const add = (campo: string | undefined, doc: string, req: boolean) => {
    if (!campo || !tieneCampo(campo)) return;
    const bucket = (porCampo[campo] ??= { docs: [], req: [] });
    const low = doc.toLowerCase();
    if (!bucket.docs.some((d) => d.toLowerCase() === low)) {
      bucket.docs.push(doc);
      if (req) bucket.req.push(doc);
    }
    anclados.add(low);
  };
  for (const e of [...etapas].sort((a, b) => a.orden - b.orden)) {
    if (e.disponibleSi && !evaluarCondicion(e.disponibleSi, datos)) continue;
    const r = e.reglas;
    if (!r) continue;
    const anchor = (r.camposRequeridos ?? []).find(tieneCampo);
    for (const d of r.documentosRequeridos ?? []) add(anchor, d, true);
    for (const d of r.documentosOpcionales ?? []) add(anchor, d, false);
    for (const rs of r.requeridosSi ?? []) {
      if (!evaluarCondicion(rs.si, datos)) continue;
      const campoSi = camposDeCondicion(rs.si).find(tieneCampo) ?? anchor;
      for (const d of rs.documentosRequeridos ?? []) add(campoSi, d, true);
    }
    for (const os of r.opcionalesSi ?? []) {
      if (!evaluarCondicion(os.si, datos)) continue;
      const campoSi = camposDeCondicion(os.si).find(tieneCampo) ?? anchor;
      for (const d of os.documentosOpcionales ?? []) add(campoSi, d, false);
    }
  }
  const reqAll = documentosRequeridosDeEtapas(etapas, datos);
  const optAll = documentosOpcionalesDeEtapas(etapas, datos);
  const sinAnclar = [...reqAll, ...optAll].filter((d) => !anclados.has(d.toLowerCase()));
  const sinAnclarReq = reqAll.filter((d) => !anclados.has(d.toLowerCase()));
  return { porCampo, sinAnclar, sinAnclarReq };
}
