"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui";
import { vtName } from "@/lib/view-transition";
import { DocumentosProceso } from "@/components/documentos-proceso";
import { DatosProceso, type DatosProcesoHandle } from "@/components/datos-proceso";
import { PartesProceso } from "@/components/partes-proceso";
import { CasoChain } from "@/components/caso-chain";
import { ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { ESTADO_LABEL, JURISDICCION_LABEL, camposDeCondicion, documentosOpcionalesDeEtapas, etiquetaDoc, evaluarCondicion, puedeSerVerdad, rutaProceso, type Condicion, type EtapaDef } from "@/lib/procesos";
import { actualizarProceso, calcularVencimiento, escalarProceso, getCasoChain, getProceso, getSugerenciasActuaciones, listActuaciones, marcarActuacionesVistas, moverEtapa, sincronizarActuaciones, validarRadicado, type ActuacionItem, type CasoNodo, type ProcesoDetalle, type SugerenciaHito } from "@/lib/procesos-api";
import { getUser } from "@/lib/auth";
import { RolEmpresaGuard } from "@/components/rol-empresa-guard";

export default function ExpedientePage() {
  const { id } = useParams<{ id: string }>();
  const [proceso, setProceso] = useState<ProcesoDetalle | null | undefined>(undefined);
  const [bloqueo, setBloqueo] = useState<{ etapa: string; faltantes: string[]; documentosFaltantes?: string[]; motivo?: string } | null>(null);
  const [derivado, setDerivado] = useState<{ id: string; nuevo: boolean } | null>(null);
  const [escalando, setEscalando] = useState(false);
  const [caso, setCaso] = useState<CasoNodo[]>([]);
  // Guía al bloquear una etapa: campos faltantes a marcar en el form (con nonce
  // para re-disparar). El scroll al primer campo faltante lo hace DatosProceso.
  const [resaltarCampos, setResaltarCampos] = useState<{ keys: string[]; nonce: number } | null>(null);
  // Vencimiento ESTIMADO en vivo desde los datos, para mostrarlo en el recuadro de
  // arriba aunque aún no se haya guardado fechaLimite (al poner la fecha de radicación).
  const [vencEstimado, setVencEstimado] = useState<string | null>(null);
  // Stepper laboral agrupado por fase: fases que el usuario abrió manualmente (la
  // fase actual va abierta siempre).
  const [fasesAbiertas, setFasesAbiertas] = useState<number[]>([]);
  // Para guardar lo diligenciado (sin guardar) ANTES de avanzar de etapa.
  const datosRef = useRef<DatosProcesoHandle>(null);

  const cargarCaso = () => getCasoChain(id).then(setCaso).catch(() => setCaso([]));
  useEffect(() => {
    getProceso(id)
      .then(setProceso)
      .catch(() => setProceso(null));
    cargarCaso();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Si no hay fechaLimite guardada, estimar el vencimiento desde los datos actuales.
  useEffect(() => {
    if (!proceso || proceso.fechaLimite) { setVencEstimado(null); return; }
    calcularVencimiento(proceso.tipoProceso.id, proceso.datos)
      .then((r) => setVencEstimado(r.fechaLimite))
      .catch(() => setVencEstimado(null));
  }, [proceso?.fechaLimite, proceso?.tipoProceso.id, proceso?.datos]);

  if (proceso === undefined) {
    return <Card className="text-sm text-slate-500">Cargando…</Card>;
  }
  if (proceso === null) {
    return (
      <Card className="text-sm text-slate-500">
        Proceso no encontrado.{" "}
        <Link href="/procesos" className="font-medium text-indigo-600 hover:underline">
          Volver
        </Link>
      </Card>
    );
  }

  const etapas = (proceso.tipoProceso.etapas ?? []).slice().sort((a, b) => a.orden - b.orden);
  const etapaActualDef = etapas.find((e) => e.key === proceso.etapaActual);
  const ordenActual = etapaActualDef?.orden ?? -1;
  // Pasos del stepper: etapas agrupadas por `orden`. Un orden con varias etapas es
  // una DECISIÓN (ramas alternativas según los datos, p. ej. Reiteración o Tutela).
  const pasos: { orden: number; etapas: EtapaDef[] }[] = [];
  for (const e of etapas) {
    const last = pasos[pasos.length - 1];
    if (last && last.orden === e.orden) last.etapas.push(e);
    else pasos.push({ orden: e.orden, etapas: [e] });
  }
  // Stepper agrupado por FASE (solo laboral): agrupa las etapas en 6 fases, oculta
  // las ramas que ya NO pueden aplicar a este rol×instancia (no las atenúa), y muestra
  // la fase actual expandida. Los demás tipos conservan el stepper plano.
  const esLaboral = proceso.tipoProceso.grupo === "LABORAL";
  const FASE_LABEL: Record<number, string> = {
    1: "Demanda y admisión", 2: "Traslado y contestación", 3: "Audiencias",
    4: "Sentencia y recurso", 5: "Segunda instancia", 6: "Terminación",
  };
  const aplicables = etapas.filter((e) => !e.disponibleSi || puedeSerVerdad(e.disponibleSi, proceso.datos));
  const etapasPorFase = new Map<number, EtapaDef[]>();
  for (const e of aplicables) {
    const f = e.fase ?? 0;
    (etapasPorFase.get(f) ?? etapasPorFase.set(f, []).get(f)!).push(e);
  }
  const fasesPresentes = [...etapasPorFase.keys()].sort((a, b) => a - b);
  const faseActual = etapaActualDef?.fase ?? fasesPresentes[0] ?? 1;
  const toggleFase = (f: number) =>
    setFasesAbiertas((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const accionDerivar = etapaActualDef?.accion?.tipo === "crearDerivado" ? etapaActualDef.accion : null;
  // ¿El derivado de esta acción YA existe? (al cargar la página, no solo tras crearlo
  // en esta sesión): un hijo del caso colgado de este proceso con el tipo destino.
  const derivadoEnCaso = accionDerivar
    ? caso.find((n) => n.casoRelacionadoId === proceso.id && n.tipoProcesoNombre === accionDerivar.tipoDestinoNombre)
    : undefined;
  const yaDerivado = derivado ?? (derivadoEnCaso ? { id: derivadoEnCaso.id, nuevo: false } : null);

  // Helpers de render del stepper (plazo de la etapa + mensaje de bloqueo por etapa).
  const plazoSpan = (e: EtapaDef) =>
    e.reglas?.plazoDias ? (
      <span
        className={`ml-auto text-xs ${e.reglas.plazoDias <= 3 ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-400"}`}
        title={e.reglas.plazoDias <= 3 ? "Término muy corto" : undefined}
      >
        {e.reglas.plazoDias <= 3 && "⚠ "}
        {e.reglas.plazoDias} días{e.reglas.plazoTipoDias === "habiles" ? " háb." : ""}
      </span>
    ) : null;
  const bloqueoMsg = (key: string) =>
    bloqueo?.etapa === key ? (
      <div className="ml-9 mt-1 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
        {bloqueo.motivo ?? (
          <>
            {bloqueo.faltantes.length > 0 && <div>Faltan datos para avanzar: te llevé al formulario y marqué los campos a llenar ↓</div>}
            {(bloqueo.documentosFaltantes?.length ?? 0) > 0 && (
              <div>Faltan documentos: {bloqueo.documentosFaltantes!.join(", ")} — súbelos en el formulario ↓</div>
            )}
          </>
        )}
      </div>
    ) : null;

  async function irAEtapa(key: string) {
    // Guarda primero lo diligenciado sin guardar, para que el avance evalúe lo último.
    // El guardado dispara el auto-avance del motor: si ya dejó el proceso en la etapa
    // pedida (o cerró el caso), no hace falta moverlo otra vez.
    const flushed = await datosRef.current?.flush().catch(() => null);
    if (flushed && (flushed.etapaActual === key || flushed.estado === "CERRADO" || flushed.estado === "ARCHIVADO")) {
      setBloqueo(null);
      setResaltarCampos(null);
      return;
    }
    try {
      const actualizado = await moverEtapa(proceso!.id, key);
      setProceso(actualizado);
      setBloqueo(null);
      setResaltarCampos(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        const faltantes = (e.issues as { faltantes?: string[] })?.faltantes ?? [];
        const documentosFaltantes = (e.issues as { documentosFaltantes?: string[] })?.documentosFaltantes ?? [];
        if (faltantes.length === 0 && documentosFaltantes.length === 0) {
          // Otro tipo de 400 (p. ej. proceso archivado): muestra el mensaje real.
          setBloqueo({ etapa: key, faltantes: [], motivo: e.message || "No se pudo mover a esta etapa." });
          return;
        }
        // GUÍA: abre el formulario en edición y marca los campos faltantes; los
        // documentos viven inline en el formulario (bajo su campo), así que con
        // abrir el form + scroll basta. `keys` vacío igual abre la edición.
        setBloqueo({ etapa: key, faltantes, documentosFaltantes });
        // El scroll al primer campo faltante lo hace DatosProceso (sabe cuáles
        // resaltó y cuándo renderizó el form en edición).
        setResaltarCampos({ keys: faltantes, nonce: Date.now() });
      } else if (e instanceof ApiError && e.status === 422) {
        // La etapa depende de un campo del formulario (disponibleSi): guía a él.
        const condicion = (e.issues as { condicion?: { campo?: string; igualA?: unknown } })?.condicion;
        const campo = condicion?.campo;
        const def = campo
          ? (proceso!.tipoProceso.esquemaFormulario ?? []).find((c) => c.key === campo)
          : undefined;
        if (campo) {
          const label = def?.label ?? campo;
          const actual = proceso!.datos[campo];
          const vacio = actual === undefined || actual === null || actual === "" || (Array.isArray(actual) && actual.length === 0);
          const esperado = (Array.isArray(condicion?.igualA) ? condicion!.igualA : [condicion?.igualA])
            .filter((v) => v != null)
            .map(String)
            .join(" o ");
          // Distingue "falta llenar" de "el valor no habilita esta rama" (p. ej.
          // reiteración exige respuesta PARCIAL, pero la respuesta fue NO).
          setResaltarCampos({ keys: [campo], nonce: Date.now() });
          setBloqueo({
            etapa: key,
            faltantes: [],
            motivo: vacio
              ? `Para habilitar esta etapa, completa "${label}" en el formulario ↓`
              : `Esta etapa solo aplica si "${label}" es ${esperado} — actualmente es "${Array.isArray(actual) ? actual.join(", ") : String(actual)}". Si corresponde, usa la otra opción disponible o corrige el campo ↓`,
          });
        } else {
          // Condición compuesta (todas/alguna): guía al primer campo referenciado
          // que esté vacío; si todos tienen valor, mensaje genérico.
          const campos = condicion ? camposDeCondicion(condicion as Condicion) : [];
          const pendiente = campos.find((c) => {
            const v = proceso!.datos[c];
            return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
          });
          if (pendiente) {
            const label = (proceso!.tipoProceso.esquemaFormulario ?? []).find((c) => c.key === pendiente)?.label ?? pendiente;
            setResaltarCampos({ keys: [pendiente], nonce: Date.now() });
            setBloqueo({ etapa: key, faltantes: [], motivo: `Para habilitar esta etapa, completa "${label}" en el formulario ↓` });
          } else {
            setBloqueo({ etapa: key, faltantes: [], motivo: "Esta etapa no está disponible con los datos actuales del proceso." });
          }
        }
      }
    }
  }

  async function escalar() {
    setEscalando(true);
    try {
      const nuevo = await escalarProceso(proceso!.id);
      setDerivado({ id: nuevo.id, nuevo: true });
      cargarCaso(); // refresca la barra de caso con el nuevo proceso
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const procesoId = (e.issues as { procesoId?: string })?.procesoId;
        if (procesoId) setDerivado({ id: procesoId, nuevo: false });
      }
    } finally {
      setEscalando(false);
    }
  }

  // El COMERCIAL ve el expediente en SOLO LECTURA (su cliente); editar es de
  // JURIDICO/admin. La API ya rechaza (403) cualquier escritura no autorizada.
  const u = getUser();
  const puedeEditar = !!u?.esAdminEmpresa || (u?.roles ?? []).includes("JURIDICO");

  // Fila de una etapa dentro de una fase (stepper laboral agrupado).
  const renderEtapaBtn = (e: EtapaDef) => {
    const disponible = !e.disponibleSi || evaluarCondicion(e.disponibleSi, proceso.datos);
    const cur = e.key === proceso.etapaActual;
    return (
      <div key={e.key}>
        <button
          type="button"
          disabled={!puedeEditar}
          onClick={() => irAEtapa(e.key)}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
            !puedeEditar ? "cursor-default" : disponible ? "hover:bg-slate-200 dark:hover:bg-slate-600" : "opacity-50 hover:opacity-90 hover:bg-slate-200 dark:hover:bg-slate-600"
          } ${cur ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cur ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"}`} />
          <span className={cur ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}>
            {e.nombre}
            {e.terminal && <span className="ml-2 text-xs text-slate-400">(final)</span>}
          </span>
          {plazoSpan(e)}
        </button>
        {cur && (() => {
          const v = vencimientoActivo(proceso.fechaLimite);
          return v ? <div className={`ml-6 mt-1 text-xs font-medium ${v.cls}`}>⏱ {v.texto}</div> : null;
        })()}
        {bloqueoMsg(e.key)}
      </div>
    );
  };

  return (
    <RolEmpresaGuard roles={["JURIDICO", "COMERCIAL"]}>
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={proceso.titulo}
        titleStyle={{ viewTransitionName: vtName("proceso-titulo", proceso.id) }}
        subtitle={`${proceso.tipoProceso.nombre} · ${JURISDICCION_LABEL[proceso.jurisdiccion]}`}
        action={
          <Link href="/procesos">
            <Button variant="ghost">← Procesos</Button>
          </Link>
        }
      />
      <TituloEditable procesoId={proceso.id} valor={proceso.titulo} onSaved={setProceso} readOnly={!puedeEditar} />

      {/* Barra de caso: la cadena DdP → DdP reiteración → Tutela como un solo caso.
          Reemplaza el viejo enlace "Ver caso relacionado" (solo aparece si hay >1). */}
      <CasoChain nodos={caso} actualId={proceso.id} />

      {/* Fallback: si por algo no cargó la cadena pero sí hay caso base, enlace simple. */}
      {caso.length < 2 && proceso.casoRelacionadoId && (
        <div className="mb-4 rounded-md bg-slate-200 px-3 py-2 text-xs text-slate-600 dark:bg-slate-600 dark:text-slate-300">
          Este proceso deriva de un caso base.{" "}
          <Link
            href={rutaProceso({ id: proceso.casoRelacionadoId, grupo: proceso.tipoProceso.grupo })}
            className="font-medium text-indigo-600 hover:underline"
          >
            Ver caso relacionado →
          </Link>
        </div>
      )}

      <Card className="mb-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
          <Dato label="Código interno" value={proceso.codigoInterno} />
          {/* Datos judiciales: solo para procesos que van ante un juez. */}
          {proceso.tipoProceso.esJudicial && (
            <RadicadoDato procesoId={proceso.id} valor={proceso.radicado} onSaved={setProceso} readOnly={!puedeEditar} />
          )}
          <Dato label="Estado" value={ESTADO_LABEL[proceso.estado]} />
          <Dato label="Cliente" value={proceso.cliente?.nombre ?? "—"} />
          <Dato label="Abogado responsable" value={proceso.responsable?.nombre ?? "Sin asignar"} />
          {proceso.tipoProceso.esJudicial && (
            <Dato label="Despacho / juzgado" value={proceso.despachoJuzgado ?? "—"} />
          )}
          {proceso.tipoProceso.esJudicial && (
            <Dato label="Cuantía" value={proceso.cuantiaValor ? `$${formatMoney(proceso.cuantiaValor)}` : "—"} />
          )}
          {proceso.tipoProceso.esJudicial && (
            <Dato label="Próxima audiencia" value={fecha(proceso.proximaAudiencia)} />
          )}
          <DatoVencimiento iso={proceso.fechaLimite ?? vencEstimado} estimado={!proceso.fechaLimite && !!vencEstimado} />
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Etapas del proceso
          </h3>
          {esLaboral ? (
            // Stepper agrupado por fase (1..6): la fase actual va abierta; las demás se
            // pueden desplegar. Dentro de cada fase solo se ven las etapas que aplican.
            <ol className="space-y-1">
              {fasesPresentes.map((fase) => {
                const list = etapasPorFase.get(fase)!;
                const estado = fase < faseActual ? "done" : fase === faseActual ? "current" : "future";
                const abierta = estado === "current" || fasesAbiertas.includes(fase);
                const circle = `flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  estado === "done" ? "bg-emerald-500 text-white" : estado === "current" ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-400 dark:border-slate-600"
                }`;
                return (
                  <li key={fase}>
                    <button
                      type="button"
                      onClick={() => toggleFase(fase)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-200 dark:hover:bg-slate-600 ${estado === "current" ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}
                    >
                      <span className={circle}>{estado === "done" ? "✓" : fase}</span>
                      <span className={estado === "current" ? "font-medium text-slate-800 dark:text-slate-100" : estado === "future" ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-300"}>
                        {FASE_LABEL[fase] ?? `Fase ${fase}`}
                      </span>
                      <span className="ml-auto text-xs text-slate-400">{abierta ? "▾" : "▸"}</span>
                    </button>
                    {abierta && <div className="ml-9 mt-1 space-y-1">{list.map(renderEtapaBtn)}</div>}
                  </li>
                );
              })}
            </ol>
          ) : (
          <ol className="space-y-1">
            {pasos.map((paso, pi) => {
              const numero = pi + 1;
              const current = paso.etapas.some((e) => e.key === proceso.etapaActual);
              const done = paso.orden < ordenActual;
              const numCls = `flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                done ? "bg-emerald-500 text-white" : current ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-400 dark:border-slate-600"
              }`;

              // Paso simple (una sola etapa).
              if (paso.etapas.length === 1) {
                const e = paso.etapas[0];
                const disponible = !e.disponibleSi || evaluarCondicion(e.disponibleSi, proceso.datos);
                return (
                  <li key={e.key}>
                    <button
                      type="button"
                      disabled={!puedeEditar}
                      onClick={() => irAEtapa(e.key)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        !puedeEditar ? "cursor-default" : disponible ? "hover:bg-slate-200 dark:hover:bg-slate-600" : "opacity-50 hover:opacity-90 hover:bg-slate-200 dark:hover:bg-slate-600"
                      } ${current ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}
                    >
                      <span className={numCls}>{done ? "✓" : numero}</span>
                      <span className={current ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}>
                        {e.nombre}
                        {e.terminal && <span className="ml-2 text-xs text-slate-400">(final)</span>}
                      </span>
                      {plazoSpan(e)}
                    </button>
                    {current && (() => {
                      const v = vencimientoActivo(proceso.fechaLimite);
                      return v ? <div className={`ml-9 mt-1 text-xs font-medium ${v.cls}`}>⏱ {v.texto}</div> : null;
                    })()}
                    {bloqueoMsg(e.key)}
                  </li>
                );
              }

              // Paso de DECISIÓN: varias ramas alternativas (según los datos).
              return (
                <li key={`paso-${paso.orden}`}>
                  <div className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className={numCls}>{done ? "✓" : numero}</span>
                    <span className={current ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}>
                      Cómo continuar <span className="text-xs font-normal text-slate-400">(elige una)</span>
                    </span>
                  </div>
                  <div className="ml-9 space-y-1">
                    {paso.etapas.map((rama) => {
                      const disp = !rama.disponibleSi || evaluarCondicion(rama.disponibleSi, proceso.datos);
                      const ramaCurrent = rama.key === proceso.etapaActual;
                      return (
                        <div key={rama.key}>
                          <button
                            type="button"
                            disabled={!puedeEditar}
                            onClick={() => irAEtapa(rama.key)}
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                              !puedeEditar ? "cursor-default" : disp ? "hover:bg-slate-200 dark:hover:bg-slate-600" : "opacity-50 hover:opacity-90 hover:bg-slate-200 dark:hover:bg-slate-600"
                            } ${ramaCurrent ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}
                          >
                            <span className="text-slate-400">→</span>
                            <span className={ramaCurrent ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}>{rama.nombre}</span>
                            {plazoSpan(rama)}
                          </button>
                          {bloqueoMsg(rama.key)}
                        </div>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
          )}
          {puedeEditar && (
            <p className="mt-3 text-xs text-slate-400">
              Haz clic en un paso para mover el proceso. Los pasos con reglas se bloquean si faltan datos.
            </p>
          )}

          {puedeEditar && accionDerivar && (() => {
            // Cuando el proceso destino es del MISMO tipo, no es un "escalamiento":
            // es una continuación del caso (en el DdP, la reiteración por respuesta
            // parcial). Si es otro tipo, sí es un escalamiento (DdP → tutela).
            const destino = accionDerivar.tipoDestinoNombre;
            const esContinuacion = destino === proceso.tipoProceso.nombre;
            return (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              {yaDerivado ? (
                // Ya se creó el derivado (reiteración / tutela): no ofrecer crearlo de nuevo.
                <>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {esContinuacion ? "La reiteración ya está creada" : `La ${destino} ya está creada`}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300/80">
                    Forma parte de este caso.
                  </p>
                  <Link
                    href={rutaProceso({ id: yaDerivado.id, grupo: esContinuacion ? proceso.tipoProceso.grupo : "CONSTITUCIONAL" })}
                    className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline"
                  >
                    {yaDerivado.nuevo ? "✓ Creado — abrir expediente →" : "Abrir expediente →"}
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Acción disponible: {etapaActualDef?.nombre ?? (esContinuacion ? `continuar el ${destino}` : `escalar a ${destino}`)}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300/80">
                    {esContinuacion
                      ? `Crea un nuevo ${destino} que reitera este, vinculado como el mismo caso (copia el peticionario y los datos de la solicitud). El proceso actual queda como caso base.`
                      : `Crea un proceso de ${destino} vinculado a este como parte del mismo caso. El proceso actual queda como caso base.`}
                  </p>
                  <Button className="mt-2" onClick={escalar} disabled={escalando}>
                    {escalando ? "Creando…" : esContinuacion ? `Crear la reiteración` : `Crear ${destino}`}
                  </Button>
                </>
              )}
            </div>
            );
          })()}
        </Card>

        <div className="space-y-5">
          <Card>
            <PartesProceso proceso={proceso} onChange={setProceso} readOnly={!puedeEditar} />
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Documentos</h3>
            {(() => {
              // Documentos OPCIONALES sugeridos por la etapa/datos actuales (p. ej.
              // "Recurso" cuando la respuesta fue parcial). No bloquean; solo guían.
              const sugeridos = documentosOpcionalesDeEtapas(
                proceso.tipoProceso.etapas,
                proceso.datos,
              );
              return sugeridos.length > 0 ? (
                <p className="mb-3 rounded-md bg-slate-200 px-3 py-2 text-xs text-slate-600 dark:bg-slate-600 dark:text-slate-300">
                  Puedes adjuntar (opcional):{" "}
                  <span className="font-medium">{sugeridos.map(etiquetaDoc).join(", ")}</span>.
                </p>
              ) : null;
            })()}
            <DocumentosProceso
              procesoId={proceso.id}
              docs={proceso.documentos ?? []}
              onDocsChange={(documentos) => setProceso((p) => (p ? { ...p, documentos } : p))}
              readOnly={!puedeEditar}
              ocultarPlantillas={proceso.tipoProceso.grupo === "LABORAL"}
            />
          </Card>
        </div>
      </div>

      <div>
      <Card className="mb-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Formulario del proceso
        </h3>
        <DatosProceso
          ref={datosRef}
          procesoId={proceso.id}
          tipoProcesoId={proceso.tipoProceso.id}
          grupo={proceso.tipoProceso.grupo}
          etapaActual={proceso.etapaActual}
          esquema={proceso.tipoProceso.esquemaFormulario ?? []}
          etapas={proceso.tipoProceso.etapas ?? []}
          datos={proceso.datos}
          onSaved={(actualizado) => { setProceso(actualizado); cargarCaso(); }}
          documentos={proceso.documentos ?? []}
          onDocSubido={(doc) =>
            setProceso((p) =>
              p
                ? { ...p, documentos: [doc, ...(p.documentos ?? []).filter((d) => d.nombre.trim().toLowerCase() !== doc.nombre.trim().toLowerCase())] }
                : p,
            )
          }
          onDocEliminado={(id) =>
            setProceso((p) => (p ? { ...p, documentos: (p.documentos ?? []).filter((d) => d.id !== id) } : p))
          }
          resaltarCampos={resaltarCampos ?? undefined}
          readOnly={!puedeEditar}
        />
      </Card>
      </div>

      {/* Actuaciones del juzgado (Rama Judicial / CPNU): bitácora externa, distinta
          de las etapas internas. Solo para procesos judiciales con radicado. */}
      {proceso.tipoProceso.esJudicial && (
        <div>
          <ActuacionesJuzgado
            procesoId={proceso.id}
            radicado={proceso.radicado}
            datos={proceso.datos}
            onChanged={() => getProceso(proceso.id).then(setProceso).catch(() => {})}
            readOnly={!puedeEditar}
          />
        </div>
      )}
    </div>
    </RolEmpresaGuard>
  );
}

/** Panel de actuaciones de la Rama Judicial: lista + "Actualizar" (sync) +
 *  badges "nueva" PERSISTENTES (no leídas, #3) + "Marcar como vistas" +
 *  sugerencias de avance de etapa derivadas de los hitos (#1). */
function ActuacionesJuzgado({
  procesoId,
  radicado,
  datos,
  onChanged,
  readOnly = false,
}: {
  procesoId: string;
  radicado: string | null;
  datos: Record<string, unknown>;
  onChanged: () => void;
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<ActuacionItem[] | null>(null);
  const [sugerencias, setSugerencias] = useState<SugerenciaHito[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [aplicando, setAplicando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tono: "ok" | "info" | "warn" } | null>(null);

  const cargar = () => {
    if (!radicado) { setItems([]); return; }
    listActuaciones(procesoId).then(setItems).catch(() => setItems([]));
    getSugerenciasActuaciones(procesoId).then(setSugerencias).catch(() => setSugerencias([]));
  };
  useEffect(cargar, [procesoId, radicado]);

  const numNuevas = (items ?? []).filter((a) => a.nueva).length;

  async function actualizar() {
    setSincronizando(true);
    setAviso(null);
    try {
      const r = await sincronizarActuaciones(procesoId);
      if (r.reservado) {
        setAviso({ texto: "El proceso figura como reservado en la Rama: no muestra actuaciones.", tono: "warn" });
      } else if (!r.encontrado) {
        setAviso({ texto: "El radicado aún no aparece en la Rama Judicial (puede tardar días en publicarse).", tono: "warn" });
      } else {
        setAviso({
          texto: r.nuevas > 0 ? `✓ ${r.nuevas} actuación(es) nueva(s) de ${r.total}.` : `Sin novedades (${r.total} actuaciones).`,
          tono: r.nuevas > 0 ? "ok" : "info",
        });
      }
      cargar();
      if (r.encontrado && r.nuevas > 0) onChanged(); // refresca datos (ultimaActuacion / juzgado)
    } catch {
      setAviso({ texto: "No se pudo consultar la Rama Judicial. Intenta más tarde.", tono: "warn" });
    } finally {
      setSincronizando(false);
    }
  }

  async function marcarVistas() {
    await marcarActuacionesVistas(procesoId).catch(() => {});
    cargar();
  }

  // #1: pre-llena el campo de fecha sugerido (dispara el auto-avance del motor si
  // se cumplen los requisitos). El abogado igual debe adjuntar el documento del juez.
  async function usarFecha(s: SugerenciaHito) {
    if (!s.campoFecha || !s.fechaSugerida) return;
    setAplicando(s.etapaKey);
    try {
      await actualizarProceso(procesoId, { datos: { ...datos, [s.campoFecha]: s.fechaSugerida } });
      onChanged();
      cargar();
    } finally {
      setAplicando(null);
    }
  }

  const tono = aviso?.tono === "ok"
    ? "text-emerald-600 dark:text-emerald-400"
    : aviso?.tono === "warn"
    ? "text-amber-600 dark:text-amber-400"
    : "text-slate-500 dark:text-slate-400";

  return (
    <Card className="mb-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Actuaciones del juzgado
            {numNuevas > 0 && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                {numNuevas} nueva{numNuevas > 1 ? "s" : ""}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400">Lo que publica la Rama Judicial para este radicado.</p>
        </div>
        {!readOnly && radicado && (
          <div className="flex shrink-0 gap-2">
            {numNuevas > 0 && (
              <Button variant="ghost" onClick={marcarVistas}>Marcar como vistas</Button>
            )}
            <Button onClick={actualizar} disabled={sincronizando}>
              {sincronizando ? "Actualizando…" : "Actualizar"}
            </Button>
          </div>
        )}
      </div>

      {!radicado ? (
        <p className="rounded-md bg-slate-200 px-3 py-2 text-xs text-slate-600 dark:bg-slate-600 dark:text-slate-300">
          Agrega el radicado del proceso para traer sus actuaciones desde la Rama Judicial.
        </p>
      ) : (
        <>
          {aviso && <p className={`mb-3 text-xs font-medium ${tono}`}>{aviso.texto}</p>}

          {/* #1: sugerencias de avance (no auto-avanza; el abogado confirma y adjunta). */}
          {sugerencias.length > 0 && (
            <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <p className="mb-2 text-xs font-semibold text-indigo-800 dark:text-indigo-200">Sugerencias de la Rama</p>
              <ul className="space-y-1.5">
                {sugerencias.map((s) => (
                  <li key={s.etapaKey} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-indigo-900 dark:text-indigo-200">
                      Posible avance a <strong>{s.etapaNombre}</strong>
                      {s.fechaSugerida ? <> · {fecha(s.fechaSugerida)}</> : null}
                      <span className="block text-indigo-700/70 dark:text-indigo-300/60">“{s.actuacion}”</span>
                    </span>
                    {!readOnly && s.campoFecha && s.fechaSugerida && (
                      <button
                        onClick={() => usarFecha(s)}
                        disabled={aplicando === s.etapaKey}
                        className="shrink-0 rounded-md bg-indigo-600 px-2 py-1 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {aplicando === s.etapaKey ? "…" : "Usar fecha"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {items === null ? (
            <p className="text-sm text-slate-400">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-400">
              Sin actuaciones todavía. Usa “Actualizar” para consultarlas en la Rama.
            </p>
          ) : (
            <ol className="space-y-2">
              {items.map((a) => (
                <li key={a.id} className="flex gap-3 border-l-2 border-slate-200 pl-3 dark:border-slate-600">
                  <span className="w-24 shrink-0 text-xs text-slate-400">{fecha(a.fechaActuacion)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.actuacion}</span>
                      {a.nueva && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                          nueva
                        </span>
                      )}
                    </div>
                    {a.anotacion && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{a.anotacion}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Card>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  );
}

// Título del caso editable in-situ. En trámites ante entidad (DdP) el título se
// auto-genera al crear ("Tipo — Entidad") y se ajusta acá si hace falta.
function TituloEditable({
  procesoId,
  valor,
  onSaved,
  readOnly = false,
}: {
  procesoId: string;
  valor: string;
  onSaved: (p: ProcesoDetalle) => void;
  readOnly?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  const [guardando, setGuardando] = useState(false);

  if (readOnly) return null;

  async function guardar() {
    const t = texto.trim();
    if (!t) return;
    setGuardando(true);
    try {
      const actualizado = await actualizarProceso(procesoId, { titulo: t });
      onSaved(actualizado);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="-mt-3 mb-4">
      {editando ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") guardar();
              if (e.key === "Escape") {
                setTexto(valor);
                setEditando(false);
              }
            }}
            className="w-full max-w-md rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-600 dark:text-slate-100"
          />
          <button
            onClick={guardar}
            disabled={guardando}
            className="shrink-0 text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
          >
            {guardando ? "…" : "Guardar"}
          </button>
          <button
            onClick={() => {
              setTexto(valor);
              setEditando(false);
            }}
            className="shrink-0 text-xs text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setTexto(valor);
            setEditando(true);
          }}
          className="text-xs text-slate-400 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          ✎ Editar título
        </button>
      )}
    </div>
  );
}

// Radicado editable in-situ: escribe en la columna canónica `proceso.radicado`
// (la que leen facturación y contable), no en el JSON del formulario.
function RadicadoDato({
  procesoId,
  valor,
  onSaved,
  readOnly = false,
}: {
  procesoId: string;
  valor: string | null;
  onSaved: (p: ProcesoDetalle) => void;
  readOnly?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor ?? "");
  const [guardando, setGuardando] = useState(false);
  // Feedback de validación contra la Rama Judicial (no bloquea; solo informa).
  const [feedback, setFeedback] = useState<{ texto: string; warn: boolean } | null>(null);

  async function guardar() {
    setGuardando(true);
    try {
      const limpio = texto.trim();
      const actualizado = await actualizarProceso(procesoId, { radicado: limpio || null });
      onSaved(actualizado);
      setEditando(false);
      setFeedback(null);
      if (limpio.replace(/\D/g, "").length === 23) {
        validarRadicado(limpio)
          .then((r) =>
            setFeedback(
              r.esPrivado
                ? { texto: "Figura como reservado en la Rama.", warn: true }
                : r.encontrado
                ? { texto: `✓ Encontrado en la Rama${r.despacho ? `: ${r.despacho.trim()}` : ""}.`, warn: false }
                : { texto: "Aún no aparece en la Rama (puede tardar en publicarse).", warn: true },
            ),
          )
          .catch(() => {});
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div className="text-xs text-slate-400">Radicado</div>
      {editando ? (
        <div className="mt-0.5 flex items-center gap-1.5">
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") guardar();
              if (e.key === "Escape") {
                setTexto(valor ?? "");
                setEditando(false);
              }
            }}
            placeholder="23 dígitos del juzgado"
            className="w-full min-w-0 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-600 dark:text-slate-100"
          />
          <button
            onClick={guardar}
            disabled={guardando}
            className="shrink-0 text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
          >
            {guardando ? "…" : "Guardar"}
          </button>
          <button
            onClick={() => {
              setTexto(valor ?? "");
              setEditando(false);
            }}
            className="shrink-0 text-xs text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="mt-0.5 flex items-center gap-2">
          <span className={`font-medium ${valor ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}`}>
            {valor ?? "Sin radicar"}
          </span>
          {!readOnly && (
            <button
              onClick={() => {
                setTexto(valor ?? "");
                setEditando(true);
              }}
              className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              editar
            </button>
          )}
        </div>
      )}
      {feedback && (
        <p className={`mt-1 text-xs ${feedback.warn ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {feedback.texto}
        </p>
      )}
    </div>
  );
}

function fecha(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

// Celda de "Vencimiento" con semáforo: rojo si venció, ámbar si vence en ≤3 días.
// Cuenta regresiva de la etapa activa (días calendario hasta la fechaLimite, que
// el backend ya derivó con días hábiles). Solo presentación.
function vencimientoActivo(iso: string | null | undefined): { texto: string; cls: string } | null {
  if (!iso) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const dias = Math.round((f.getTime() - hoy.getTime()) / 86_400_000);
  const fecha = f.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  if (dias < 0) return { texto: `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"} · ${fecha}`, cls: "text-rose-600 dark:text-rose-400" };
  if (dias === 0) return { texto: `Vence hoy · ${fecha}`, cls: "text-rose-600 dark:text-rose-400" };
  if (dias <= 3) return { texto: `Vence en ${dias} día${dias === 1 ? "" : "s"} · ${fecha}`, cls: "text-amber-600 dark:text-amber-400" };
  return { texto: `Vence el ${fecha}`, cls: "text-slate-500 dark:text-slate-400" };
}

function DatoVencimiento({ iso, estimado = false }: { iso: string | null | undefined; estimado?: boolean }) {
  let value = "—";
  let clase = "text-slate-700 dark:text-slate-200";
  if (iso) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const f = new Date(`${iso.slice(0, 10)}T00:00:00`);
    const dias = Math.round((f.getTime() - hoy.getTime()) / 86_400_000);
    value = iso.slice(0, 10);
    if (dias < 0) {
      value += " (vencido)";
      clase = "font-semibold text-red-600";
    } else if (dias <= 3) {
      value += " (por vencer)";
      clase = "font-semibold text-amber-600";
    }
    if (estimado) value += " (estimado)";
  }
  return (
    <div>
      <div className="text-xs text-slate-400">Vencimiento</div>
      <div className={`mt-0.5 font-medium ${clase}`}>{value}</div>
    </div>
  );
}
