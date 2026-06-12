"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui";
import { DocumentosProceso } from "@/components/documentos-proceso";
import { DatosProceso } from "@/components/datos-proceso";
import { DocumentosRequeridos } from "@/components/documentos-requeridos";
import { CasoChain } from "@/components/caso-chain";
import { ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { ESTADO_LABEL, JURISDICCION_LABEL, evaluarCondicion, type EtapaDef } from "@/lib/procesos";
import { actualizarProceso, escalarProceso, getCasoChain, getProceso, moverEtapa, type CasoNodo, type ProcesoDetalle } from "@/lib/procesos-api";
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
  // para re-disparar) y refs para hacer scroll al form / al panel de documentos.
  const [resaltarCampos, setResaltarCampos] = useState<{ keys: string[]; nonce: number } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const docsRef = useRef<HTMLDivElement>(null);

  const cargarCaso = () => getCasoChain(id).then(setCaso).catch(() => setCaso([]));
  useEffect(() => {
    getProceso(id)
      .then(setProceso)
      .catch(() => setProceso(null));
    cargarCaso();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
  const idxActual = etapas.findIndex((e) => e.key === proceso.etapaActual);
  const etapaActualDef = etapas.find((e) => e.key === proceso.etapaActual);
  const accionDerivar = etapaActualDef?.accion?.tipo === "crearDerivado" ? etapaActualDef.accion : null;
  // ¿El derivado de esta acción YA existe? (al cargar la página, no solo tras crearlo
  // en esta sesión): un hijo del caso colgado de este proceso con el tipo destino.
  const derivadoEnCaso = accionDerivar
    ? caso.find((n) => n.casoRelacionadoId === proceso.id && n.tipoProcesoNombre === accionDerivar.tipoDestinoNombre)
    : undefined;
  const yaDerivado = derivado ?? (derivadoEnCaso ? { id: derivadoEnCaso.id, nuevo: false } : null);

  async function irAEtapa(key: string) {
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
        // En vez de solo listar, GUÍA: campos → abre y marca el formulario; documentos
        // → resalta el panel de requeridos. Scroll al destino correspondiente.
        setBloqueo({ etapa: key, faltantes, documentosFaltantes });
        if (faltantes.length > 0) {
          setResaltarCampos({ keys: faltantes, nonce: Date.now() });
          setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
        } else {
          setTimeout(() => docsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
        }
      } else if (e instanceof ApiError && e.status === 422) {
        setBloqueo({ etapa: key, faltantes: [], motivo: "Esta etapa no está disponible con los datos actuales del proceso." });
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

  return (
    <RolEmpresaGuard roles={["JURIDICO", "COMERCIAL"]}>
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={proceso.titulo}
        subtitle={`${proceso.tipoProceso.nombre} · ${JURISDICCION_LABEL[proceso.jurisdiccion]}`}
        action={
          <Link href="/procesos">
            <Button variant="ghost">← Procesos</Button>
          </Link>
        }
      />

      {/* Barra de caso: la cadena DdP → DdP reiteración → Tutela como un solo caso.
          Reemplaza el viejo enlace "Ver caso relacionado" (solo aparece si hay >1). */}
      <CasoChain nodos={caso} actualId={proceso.id} />

      {/* Fallback: si por algo no cargó la cadena pero sí hay caso base, enlace simple. */}
      {caso.length < 2 && proceso.casoRelacionadoId && (
        <div className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Este proceso deriva de un caso base.{" "}
          <Link
            href={`/procesos/${proceso.casoRelacionadoId}`}
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
          <DatoVencimiento iso={proceso.fechaLimite} />
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Etapas del proceso
          </h3>
          <ol className="space-y-1">
            {etapas.map((e: EtapaDef, i: number) => {
              const done = i < idxActual;
              const current = i === idxActual;
              // Ramas por valor: si la etapa tiene `disponibleSi` y no se cumple,
              // se muestra atenuada y no es clicable.
              const disponible = !e.disponibleSi || evaluarCondicion(e.disponibleSi, proceso!.datos);
              return (
                <li key={e.key}>
                  <button
                    type="button"
                    disabled={!disponible || !puedeEditar}
                    onClick={() => irAEtapa(e.key)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      !puedeEditar ? "cursor-default" : disponible ? "hover:bg-slate-50 dark:hover:bg-slate-800" : "cursor-not-allowed opacity-40"
                    } ${current ? "bg-indigo-50 dark:bg-indigo-500/10" : ""}`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                        done
                          ? "bg-emerald-500 text-white"
                          : current
                            ? "bg-indigo-600 text-white"
                            : "border border-slate-300 text-slate-400 dark:border-slate-700"
                      }`}
                    >
                      {done ? "✓" : e.orden}
                    </span>
                    <span className={current ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}>
                      {e.nombre}
                      {e.terminal && <span className="ml-2 text-xs text-slate-400">(final)</span>}
                    </span>
                    {e.reglas?.plazoDias && (
                      <span
                        className={`ml-auto text-xs ${
                          e.reglas.plazoDias <= 3
                            ? "font-semibold text-rose-600 dark:text-rose-400"
                            : "text-slate-400"
                        }`}
                        title={e.reglas.plazoDias <= 3 ? "Término muy corto" : undefined}
                      >
                        {e.reglas.plazoDias <= 3 && "⚠ "}
                        {e.reglas.plazoDias} días{e.reglas.plazoTipoDias === "habiles" ? " háb." : ""}
                      </span>
                    )}
                  </button>
                  {current && (() => {
                    const v = vencimientoActivo(proceso.fechaLimite);
                    return v ? <div className={`ml-9 mt-1 text-xs font-medium ${v.cls}`}>⏱ {v.texto}</div> : null;
                  })()}
                  {bloqueo?.etapa === e.key && (
                    <div className="ml-9 mt-1 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                      {bloqueo.motivo ?? (
                        <>
                          {bloqueo.faltantes.length > 0 && (
                            <div>Faltan datos para avanzar: te llevé al formulario y marqué los campos a llenar ↓</div>
                          )}
                          {(bloqueo.documentosFaltantes?.length ?? 0) > 0 && (
                            <div>Faltan documentos: {bloqueo.documentosFaltantes!.join(", ")} — súbelos en «Documentos requeridos» ↓</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {puedeEditar && (
            <p className="mt-3 text-xs text-slate-400">
              Haz clic en una etapa para mover el proceso. Las etapas con reglas se bloquean si faltan datos.
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
                    href={`/procesos/${yaDerivado.id}`}
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
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Partes</h3>
            <ul className="space-y-3 text-sm">
              {proceso.partes.map((p) => (
                <li key={p.id}>
                  <div className="font-medium text-slate-800 dark:text-slate-100">
                    {p.litigante.nombre}
                    {p.esNuestroCliente && (
                      <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                        Nuestro cliente
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {p.rol}
                    {p.litigante.tipoDocumento &&
                      ` · ${p.litigante.tipoDocumento} ${p.litigante.numeroDocumento ?? ""}`}
                  </div>
                </li>
              ))}
              {proceso.partes.length === 0 && (
                <li className="text-slate-400">Sin partes registradas.</li>
              )}
            </ul>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Documentos</h3>
            <DocumentosProceso
              procesoId={proceso.id}
              docs={proceso.documentos ?? []}
              onDocsChange={(documentos) => setProceso((p) => (p ? { ...p, documentos } : p))}
              readOnly={!puedeEditar}
            />
          </Card>
        </div>
      </div>

      <div ref={formRef}>
      <Card className="mb-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Formulario del proceso
        </h3>
        <DatosProceso
          procesoId={proceso.id}
          tipoProcesoId={proceso.tipoProceso.id}
          esquema={proceso.tipoProceso.esquemaFormulario ?? []}
          datos={proceso.datos}
          onSaved={(datos) => setProceso((p) => (p ? { ...p, datos } : p))}
          documentos={proceso.documentos ?? []}
          onDocSubido={(doc) =>
            setProceso((p) =>
              p
                ? { ...p, documentos: [doc, ...(p.documentos ?? []).filter((d) => d.nombre.trim().toLowerCase() !== doc.nombre.trim().toLowerCase())] }
                : p,
            )
          }
          resaltarCampos={resaltarCampos ?? undefined}
          readOnly={!puedeEditar}
        />
      </Card>
      </div>

      {/* Documentos requeridos por las etapas (peticion.pdf, poder.pdf,
          reiteracion.pdf…): un botón "Subir" por cada uno, ya con el nombre exacto
          que pide el gate, para que avanzar de etapa no se bloquee. */}
      <div ref={docsRef}>
        <DocumentosRequeridos
          procesoId={proceso.id}
          etapas={proceso.tipoProceso.etapas ?? []}
          datos={proceso.datos}
          documentos={proceso.documentos ?? []}
          onChange={(documentos) => setProceso((p) => (p ? { ...p, documentos } : p))}
          resaltar={(bloqueo?.documentosFaltantes?.length ?? 0) > 0}
          readOnly={!puedeEditar}
        />
      </div>
    </div>
    </RolEmpresaGuard>
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

  async function guardar() {
    setGuardando(true);
    try {
      const actualizado = await actualizarProceso(procesoId, {
        radicado: texto.trim() || null,
      });
      onSaved(actualizado);
      setEditando(false);
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
            className="w-full min-w-0 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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

function DatoVencimiento({ iso }: { iso: string | null | undefined }) {
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
  }
  return (
    <div>
      <div className="text-xs text-slate-400">Vencimiento</div>
      <div className={`mt-0.5 font-medium ${clase}`}>{value}</div>
    </div>
  );
}
