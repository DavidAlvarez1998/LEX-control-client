"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/form-ui";
import { api, errorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { comercialApi, listComerciales, type CarteraResumen, type ComisionDespacho, type MiembroMin } from "@/lib/comercial-api";

type Cliente = {
  id: string; nombre: string; estado: string; email: string | null;
  telefono: string | null; tipoDocumento: string | null; numeroDocumento: string | null;
  ciudad: string | null; tipoCaso: string | null; viabilidad: string | null; resumenCaso: string | null;
  responsableComercial: { id: string; nombre: string } | null;
};
type Fase = { id: string; fase: string; fechaInicioFase: string; fechaCierreFase: string | null; motivoPerdida: string | null };
type Seguimiento = { id: string; tipoGestion: string; motivoContacto: string | null; resultado: string | null; proximaTarea: string | null; fechaProximaTarea: string | null; estadoSeguimiento: string; fechaContacto: string };
type Cotizacion = { id: string; tipoServicio: string; valorCotizado: string; formaPago: string; estadoPropuesta: string; createdAt: string };
type Contrato = { id: string; tipoContrato: string; estadoContrato: string; estadoPoder: string; tipoCobroAcordado: string; valorAcordado: string | null };
type Solicitud = { id: string; clienteId: string; contratoId: string | null; estado: string; procesoId: string | null };

const FASES = ["LEAD", "CONTACTO", "EVALUACION", "PROPUESTA", "NEGOCIACION", "CONTRATO", "PODERES", "FIRMADO", "PERDIDO"];
// El "camino hacia la firma" (lineal, sin PERDIDO que es la salida).
const CAMINO = ["LEAD", "CONTACTO", "EVALUACION", "PROPUESTA", "NEGOCIACION", "CONTRATO", "PODERES", "FIRMADO"];
const LABEL: Record<string, string> = {
  LEAD: "Lead", CONTACTO: "Contacto", EVALUACION: "Evaluación", PROPUESTA: "Propuesta",
  NEGOCIACION: "Negociación", CONTRATO: "Contrato", PODERES: "Poderes", FIRMADO: "Firmado",
};
const GESTION = ["LLAMADA", "WHATSAPP", "REUNION", "VIDEOLLAMADA", "CORREO", "OTRO"];
const FORMA_PAGO = ["CONTADO", "CUOTAS", "CUOTALITIS", "CUOTA_MIXTA", "PRIMA_EXITO"];
const bonito = (s: string | null) => (s ? s.replace(/_/g, " ") : "—");

export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [fases, setFases] = useState<Fase[]>([]);
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, f, s, q, k, sol] = await Promise.all([
        api.get<Cliente>(`/clientes/${id}`),
        api.get<Fase[]>(`/comercial/clientes/${id}/fases`).catch(() => []),
        api.get<Seguimiento[]>(`/comercial/seguimientos?clienteId=${id}`).catch(() => []),
        api.get<Cotizacion[]>(`/comercial/cotizaciones?clienteId=${id}`).catch(() => []),
        api.get<Contrato[]>(`/comercial/contratos?clienteId=${id}`).catch(() => []),
        api.get<Solicitud[]>(`/comercial/solicitudes`).catch(() => []),
      ]);
      setCliente(c); setFases(f); setSeguimientos(s); setCotizaciones(q);
      setContratos(k); setSolicitudes(sol.filter((x) => x.clienteId === id));
    } catch (err) {
      setError(errorMessage(err, "Error al cargar"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>;
  if (error || !cliente)
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
        {error ?? "Cliente no encontrado"}. <Link href="/clientes" className="underline">Volver</Link>
      </Card>
    );

  const faseActual = fases.find((f) => f.fechaCierreFase === null);

  return (
    <div className="space-y-5">
      <Link href="/clientes" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">← Clientes</Link>

      {/* Camino hacia la firma (parte superior) */}
      <FunnelStepper clienteId={id} faseActual={faseActual} estado={cliente.estado} onChange={cargar} />

      {/* Cabecera */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{cliente.nombre}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {cliente.numeroDocumento ? `${cliente.tipoDocumento ?? ""} ${cliente.numeroDocumento} · ` : ""}
              {cliente.email ?? "sin correo"} · {cliente.telefono ?? "sin teléfono"}
            </p>
            {cliente.responsableComercial && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Responsable: {cliente.responsableComercial.nombre}
                {cliente.responsableComercial.id === getUser()?.id ? " (tú)" : ""}
              </p>
            )}
            {cliente.resumenCaso && <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">{cliente.resumenCaso}</p>}
          </div>
          <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
            {cliente.estado}
          </span>
        </div>
      </Card>

      <SeguimientoSection clienteId={id} seguimientos={seguimientos} onChange={cargar} />
      <CotizacionSection clienteId={id} cotizaciones={cotizaciones} onChange={cargar} />
      <ContratoSection clienteId={id} contratos={contratos} solicitudes={solicitudes} esAdmin={!!getUser()?.esAdminEmpresa} onChange={cargar} />
      <CarteraSection clienteId={id} />
      <ComisionSection clienteId={id} esAdmin={!!getUser()?.esAdminEmpresa} />
    </div>
  );
}

// ---------- Camino hacia la firma (stepper) ----------
function FunnelStepper({ clienteId, faseActual, estado, onChange }: { clienteId: string; faseActual?: Fase; estado: string; onChange: () => void }) {
  const [fase, setFase] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cerrado = estado === "CLIENTE"; // ya firmó → camino completo
  const perdido = faseActual?.fase === "PERDIDO" || estado === "DESCARTADO";
  const idxActual = cerrado ? CAMINO.length - 1 : CAMINO.indexOf(faseActual?.fase ?? "");

  async function mover() {
    if (!fase) return;
    setErr(null); setBusy(true);
    try {
      await api.post(`/comercial/clientes/${clienteId}/fase`, { fase, ...(fase === "PERDIDO" && motivo ? { motivoPerdida: motivo } : {}) });
      setFase(""); setMotivo(""); onChange();
    } catch (e) { setErr(errorMessage(e, "Error")); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Camino hacia la firma</h3>
        {perdido && <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600 dark:bg-red-950/40 dark:text-red-300">Perdido</span>}
        {cerrado && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Firmado · Cliente</span>}
      </div>

      <div className={`flex items-center overflow-x-auto pb-1 ${perdido ? "opacity-50" : ""}`}>
        {CAMINO.map((f, i) => {
          const done = cerrado || idxActual > i;
          const current = !cerrado && idxActual === i;
          return (
            <Fragment key={f}>
              {i > 0 && (
                <div className={`mx-1 h-0.5 w-6 shrink-0 sm:w-10 ${cerrado || idxActual >= i ? "bg-indigo-400" : "bg-slate-200 dark:bg-slate-700"}`} />
              )}
              <div className="flex shrink-0 flex-col items-center gap-1" style={{ minWidth: 62 }}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                  current ? "bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-500/20"
                    : done ? "bg-indigo-600 text-white"
                    : "border border-slate-300 text-slate-400 dark:border-slate-600"}`}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={`text-center text-[11px] leading-tight ${
                  current ? "font-semibold text-indigo-700 dark:text-indigo-300"
                    : done ? "text-slate-600 dark:text-slate-300" : "text-slate-400"}`}>
                  {LABEL[f]}
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>

      {cerrado ? (
        <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
          ✅ Negocio cerrado — ya es <strong>cliente</strong>. El caso continúa en{" "}
          <Link href="/procesos" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">Procesos</Link>.
        </p>
      ) : perdido ? (
        <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Marcado como perdido{faseActual?.motivoPerdida ? `: ${faseActual.motivoPerdida}` : "."}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="w-44"><Field label="Avanzar a"><Select value={fase} onChange={setFase} opciones={FASES} /></Field></div>
          {fase === "PERDIDO" && (
            <div className="w-52"><Field label="Motivo" requerido><Input value={motivo} onChange={setMotivo} placeholder="Motivo de pérdida" /></Field></div>
          )}
          <Button onClick={mover} disabled={busy || !fase || (fase === "PERDIDO" && !motivo)}>{busy ? "…" : "Mover"}</Button>
          {err && <p className="w-full text-sm text-red-600 dark:text-red-400">{err}</p>}
        </div>
      )}
    </Card>
  );
}

// ---------- Seguimientos ----------
function SeguimientoSection({ clienteId, seguimientos, onChange }: { clienteId: string; seguimientos: Seguimiento[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [tipoGestion, setTipo] = useState("LLAMADA");
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState("");
  const [proximaTarea, setProxima] = useState("");
  const [fechaProximaTarea, setFecha] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function crear() {
    setErr(null); setBusy(true);
    try {
      const body: Record<string, unknown> = { clienteId, tipoGestion };
      if (motivo.trim()) body.motivoContacto = motivo.trim();
      if (resultado.trim()) body.resultado = resultado.trim();
      if (proximaTarea.trim()) body.proximaTarea = proximaTarea.trim();
      if (fechaProximaTarea) body.fechaProximaTarea = fechaProximaTarea;
      await api.post("/comercial/seguimientos", body);
      setOpen(false); setMotivo(""); setResultado(""); setProxima(""); setFecha(""); onChange();
    } catch (e) { setErr(errorMessage(e, "Error")); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Seguimiento</h3>
        <Button variant="ghost" onClick={() => setOpen(!open)}>{open ? "Cancelar" : "Registrar contacto"}</Button>
      </div>
      {open && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-2">
          <Field label="Tipo de gestión"><Select value={tipoGestion} onChange={setTipo} opciones={GESTION} placeholder="—" /></Field>
          <Field label="Próxima tarea (fecha)"><Input type="date" value={fechaProximaTarea} onChange={setFecha} /></Field>
          <Field label="Motivo del contacto"><Input value={motivo} onChange={setMotivo} placeholder="Motivo" /></Field>
          <Field label="Próxima tarea"><Input value={proximaTarea} onChange={setProxima} placeholder="Qué sigue" /></Field>
          <div className="sm:col-span-2"><Field label="Resultado"><Textarea value={resultado} onChange={setResultado} rows={2} /></Field></div>
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={crear} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
          </div>
          {err && <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">{err}</p>}
        </div>
      )}
      {seguimientos.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Aún no hay contactos registrados.</p>
      ) : (
        <ul className="space-y-2">
          {seguimientos.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-0 dark:border-slate-800">
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-200">{bonito(s.tipoGestion)}</span>
                {s.motivoContacto && <span className="text-slate-500 dark:text-slate-400"> · {s.motivoContacto}</span>}
                {s.resultado && <div className="text-xs text-slate-500 dark:text-slate-400">{s.resultado}</div>}
              </div>
              <span className="shrink-0 text-xs text-slate-400">{new Date(s.fechaContacto).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------- Cotizaciones ----------
function CotizacionSection({ clienteId, cotizaciones, onChange }: { clienteId: string; cotizaciones: Cotizacion[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [tipoServicio, setServicio] = useState("");
  const [valor, setValor] = useState("");
  const [formaPago, setForma] = useState("CONTADO");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function crear() {
    setErr(null);
    if (!tipoServicio.trim() || !valor) { setErr("Servicio y valor son obligatorios"); return; }
    setBusy(true);
    try {
      await api.post("/comercial/cotizaciones", { clienteId, tipoServicio: tipoServicio.trim(), valorCotizado: Number(valor), formaPago });
      setOpen(false); setServicio(""); setValor(""); onChange();
    } catch (e) { setErr(errorMessage(e, "Error")); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cotizaciones</h3>
        <Button variant="ghost" onClick={() => setOpen(!open)}>{open ? "Cancelar" : "Nueva cotización"}</Button>
      </div>
      {open && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-3">
          <Field label="Servicio" requerido><Input value={tipoServicio} onChange={setServicio} placeholder="Ej. Tutela" /></Field>
          <Field label="Valor" requerido><MoneyInput value={valor} onChange={setValor} placeholder="0" /></Field>
          <Field label="Forma de pago"><Select value={formaPago} onChange={setForma} opciones={FORMA_PAGO} placeholder="—" /></Field>
          <div className="sm:col-span-3 flex justify-end">
            <Button onClick={crear} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
          </div>
          {err && <p className="sm:col-span-3 text-sm text-red-600 dark:text-red-400">{err}</p>}
        </div>
      )}
      {cotizaciones.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Sin cotizaciones.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {cotizaciones.map((q) => (
              <tr key={q.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="py-2 font-medium text-slate-700 dark:text-slate-200">{q.tipoServicio}</td>
                <td className="py-2 text-slate-600 dark:text-slate-300">${formatMoney(q.valorCotizado)}</td>
                <td className="py-2 capitalize text-slate-500 dark:text-slate-400">{bonito(q.formaPago).toLowerCase()}</td>
                <td className="py-2 text-right">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{q.estadoPropuesta}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </Card>
  );
}

// ---------- Contrato + cobro + enviar a proceso ----------
const TIPO_CONTRATO = ["PRESTACION_SERVICIOS", "MANDATO", "OTRO"];
const MODALIDAD = ["FIJO", "CUOTALITIS", "CUOTA_MIXTA", "PRIMA_EXITO", "OTRO"];

function ContratoSection({ clienteId, contratos, solicitudes, esAdmin, onChange }: { clienteId: string; contratos: Contrato[]; solicitudes: Solicitud[]; esAdmin: boolean; onChange: () => void }) {
  const contrato = contratos[0];
  const solicitud = solicitudes.find((s) => (contrato ? s.contratoId === contrato.id : true));
  const firmado = contrato?.estadoContrato === "FIRMADO" && contrato?.estadoPoder === "FIRMADO";

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null); setBusy(true);
    try { await fn(); onChange(); } catch (e) { setErr(errorMessage(e, "Error")); } finally { setBusy(false); }
  };

  // Crear contrato
  const [crear, setCrear] = useState(false);
  const [tipoContrato, setTipoContrato] = useState("PRESTACION_SERVICIOS");
  const [cobroAcordado, setCobroAcordado] = useState("FIJO");
  const [valor, setValor] = useState("");

  // Configurar cobro
  const [cobroOpen, setCobroOpen] = useState(false);
  const [modalidad, setModalidad] = useState("FIJO");
  const [valorFijo, setValorFijo] = useState("");

  // Asignar a abogado (solo admin)
  const [asignar, setAsignar] = useState(false);
  const [abogados, setAbogados] = useState<{ id: string; nombre: string }[]>([]);
  const [tipos, setTipos] = useState<{ id: string; nombre: string }[]>([]);
  const [abogadoId, setAbogadoId] = useState("");
  const [tipoProcesoId, setTipoProcesoId] = useState("");

  useEffect(() => {
    if (!esAdmin) return;
    api.get<{ id: string; nombre: string }[]>("/mi-empresa/usuarios").then(setAbogados).catch(() => {});
    api.get<{ id: string; nombre: string }[]>("/catalogo/tipos-proceso").then(setTipos).catch(() => {});
  }, [esAdmin]);

  const sel = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Contrato y cierre</h3>

      {!contrato ? (
        crear ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="Tipo de contrato"><Select value={tipoContrato} onChange={setTipoContrato} opciones={TIPO_CONTRATO} placeholder="—" /></Field>
            <Field label="Cobro acordado"><Select value={cobroAcordado} onChange={setCobroAcordado} opciones={MODALIDAD} placeholder="—" /></Field>
            <Field label="Valor acordado"><MoneyInput value={valor} onChange={setValor} placeholder="0" /></Field>
            <div className="sm:col-span-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCrear(false)}>Cancelar</Button>
              <Button disabled={busy} onClick={() => run(async () => {
                await api.post("/comercial/contratos", { clienteId, tipoContrato, tipoCobroAcordado: cobroAcordado, ...(valor ? { valorAcordado: Number(valor) } : {}) });
                setCrear(false);
              })}>{busy ? "…" : "Crear contrato"}</Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setCrear(true)}>Crear contrato</Button>
        )
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="text-slate-600 dark:text-slate-300">Tipo: <strong>{contrato.tipoContrato.replace(/_/g, " ")}</strong></span>
            <span className="text-slate-600 dark:text-slate-300">Contrato: <Estado v={contrato.estadoContrato} /></span>
            <span className="text-slate-600 dark:text-slate-300">Poder: <Estado v={contrato.estadoPoder} /></span>
            <span className="text-slate-600 dark:text-slate-300">Cobro: {contrato.tipoCobroAcordado}{contrato.valorAcordado ? ` · $${formatMoney(contrato.valorAcordado)}` : ""}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {!firmado && (
              <Button variant="ghost" disabled={busy} onClick={() => run(() => api.patch(`/comercial/contratos/${contrato.id}`, { estadoContrato: "FIRMADO", estadoPoder: "FIRMADO" }))}>
                Marcar contrato y poder firmados
              </Button>
            )}
            <Button variant="ghost" onClick={() => setCobroOpen(!cobroOpen)}>{cobroOpen ? "Cerrar cobro" : "Configurar cobro"}</Button>
            {firmado && !solicitud && (
              <Button disabled={busy} onClick={() => run(() => api.post("/comercial/solicitudes", { clienteId, contratoId: contrato.id }))}>
                Enviar a proceso
              </Button>
            )}
          </div>

          {cobroOpen && (
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-3">
              <Field label="Modalidad"><Select value={modalidad} onChange={setModalidad} opciones={MODALIDAD} placeholder="—" /></Field>
              <Field label="Valor fijo"><MoneyInput value={valorFijo} onChange={setValorFijo} placeholder="0" /></Field>
              <div className="flex items-end">
                <Button disabled={busy} onClick={() => run(async () => {
                  await api.put(`/comercial/contratos/${contrato.id}/cobro`, { modalidadCobro: modalidad, ...(valorFijo ? { valorFijo: Number(valorFijo) } : {}) });
                  setCobroOpen(false);
                })}>{busy ? "…" : "Guardar cobro"}</Button>
              </div>
            </div>
          )}

          {/* Solicitud de asignación */}
          {solicitud && (
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-slate-600 dark:text-slate-300">Solicitud de asignación: <strong>{solicitud.estado}</strong></p>
              {solicitud.estado === "ASIGNADA" && solicitud.procesoId && (
                <Link href={`/procesos/${solicitud.procesoId}`} className="mt-1 inline-block font-medium text-indigo-600 hover:underline dark:text-indigo-400">Ver el proceso →</Link>
              )}
              {esAdmin && (solicitud.estado === "PENDIENTE" || solicitud.estado === "EN_REVISION") && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Abogado</span>
                    <select value={abogadoId} onChange={(e) => setAbogadoId(e.target.value)} className={sel}>
                      <option value="">Selecciona…</option>
                      {abogados.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </label>
                  <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tipo de proceso</span>
                    <select value={tipoProcesoId} onChange={(e) => setTipoProcesoId(e.target.value)} className={sel}>
                      <option value="">Selecciona…</option>
                      {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                  </label>
                  <div className="flex items-end">
                    <Button disabled={busy || !abogadoId} onClick={() => run(() => api.post(`/comercial/solicitudes/${solicitud.id}/asignar`, { abogadoAsignadoId: abogadoId, ...(tipoProcesoId ? { tipoProcesoId } : {}) }))}>
                      {busy ? "…" : "Asignar abogado"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {err && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p>}
    </Card>
  );
}

function Estado({ v }: { v: string }) {
  const cls = v === "FIRMADO" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
    : v === "ENVIADO" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{v}</span>;
}

// Resumen de cobro/cartera del cliente (solo lectura). Disponible con el módulo
// comercial; deriva pagado/saldo de los ingresos. Ver comercial-rol-portal.
function CarteraSection({ clienteId }: { clienteId: string }) {
  const [filas, setFilas] = useState<CarteraResumen[] | null>(null);
  useEffect(() => {
    comercialApi.carteraCliente(clienteId).then(setFilas).catch(() => setFilas([]));
  }, [clienteId]);

  if (!filas || filas.length === 0) return null; // sin plan de cobro aún → no ocupa espacio
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Estado de cobro</h3>
      <div className="space-y-3">
        {filas.map((c) => (
          <div key={c.id} className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Dato label="Total acordado" value={c.valorTotalAcordado != null ? `$${formatMoney(Number(c.valorTotalAcordado))}` : "—"} />
            <Dato label="Pagado" value={`$${formatMoney(c.valorPagado)}`} />
            <Dato label="Saldo" value={c.saldoPendiente != null ? `$${formatMoney(c.saldoPendiente)}` : "—"} />
            <Dato label="Próximo pago" value={c.fechaProximoPago ? c.fechaProximoPago.slice(0, 10) : "—"} />
          </div>
        ))}
      </div>
    </Card>
  );
}

const COMISION_ESTADO_CLS: Record<string, string> = {
  PENDIENTE: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  PAGADA: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  ANULADA: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

// Comisiones internas del despacho. El ADMINISTRADOR las registra/edita; el
// COMERCIAL solo ve las suyas (la API ya las acota). Ver comercial-rol-portal.
function ComisionSection({ clienteId, esAdmin }: { clienteId: string; esAdmin: boolean }) {
  const [comisiones, setComisiones] = useState<ComisionDespacho[] | null>(null);
  const [comerciales, setComerciales] = useState<MiembroMin[]>([]);
  const [open, setOpen] = useState(false);
  const [comercialId, setComercialId] = useState("");
  const [base, setBase] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [monto, setMonto] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(() => {
    comercialApi.comisiones({ clienteId }).then(setComisiones).catch(() => setComisiones([]));
  }, [clienteId]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (esAdmin) listComerciales().then((m) => setComerciales(m.filter((x) => x.roles.includes("COMERCIAL")))).catch(() => {});
  }, [esAdmin]);

  async function crear() {
    setErr(null);
    if (!comercialId) return setErr("Elige el comercial.");
    if (!monto.trim()) return setErr("Indica el monto.");
    setBusy(true);
    try {
      await comercialApi.crearComision({
        clienteId, comercialId,
        baseCalculo: Number(base || monto),
        porcentaje: porcentaje.trim() ? Number(porcentaje) : undefined,
        monto: Number(monto),
      });
      setComercialId(""); setBase(""); setPorcentaje(""); setMonto(""); setOpen(false);
      cargar();
    } catch (e) {
      setErr(errorMessage(e, "Error al registrar"));
    } finally { setBusy(false); }
  }

  async function cambiarEstado(id: string, estado: string) {
    await comercialApi.editarComision(id, { estado }).catch(() => {});
    cargar();
  }

  if (comisiones === null) return null;
  // El comercial sin comisiones no necesita ver una tarjeta vacía.
  if (!esAdmin && comisiones.length === 0) return null;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Comisiones</h3>
        {esAdmin && <Button variant="ghost" onClick={() => { setErr(null); setOpen((v) => !v); }}>{open ? "Cerrar" : "Registrar comisión"}</Button>}
      </div>

      {esAdmin && open && (
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 p-3 sm:grid-cols-2">
          <Field label="Comercial" requerido>
            <select value={comercialId} onChange={(e) => setComercialId(e.target.value)} className={inputClsLocal}>
              <option value="">Selecciona…</option>
              {comerciales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Field>
          <Field label="Base de cálculo"><MoneyInput value={base} onChange={setBase} placeholder="Valor acordado" /></Field>
          <Field label="Porcentaje (%)"><input value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} className={inputClsLocal} placeholder="Opcional" inputMode="decimal" /></Field>
          <Field label="Monto" requerido><MoneyInput value={monto} onChange={setMonto} placeholder="0" /></Field>
          {err && <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">{err}</p>}
          <div className="flex justify-end sm:col-span-2">
            <Button onClick={crear} disabled={busy}>{busy ? "Guardando…" : "Registrar"}</Button>
          </div>
        </div>
      )}

      {comisiones.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Sin comisiones registradas.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {comisiones.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="py-2 font-medium text-slate-700 dark:text-slate-200">${formatMoney(Number(c.monto))}</td>
                <td className="py-2 text-slate-500 dark:text-slate-400">{c.porcentaje != null ? `${Number(c.porcentaje)}% de $${formatMoney(Number(c.baseCalculo))}` : "monto fijo"}</td>
                <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COMISION_ESTADO_CLS[c.estado]}`}>{c.estado}</span></td>
                {esAdmin && (
                  <td className="py-2 text-right text-xs font-medium">
                    {c.estado !== "PAGADA" && <button onClick={() => cambiarEstado(c.id, "PAGADA")} className="mr-3 text-emerald-600 dark:text-emerald-400 hover:underline">Marcar pagada</button>}
                    {c.estado !== "ANULADA" && <button onClick={() => cambiarEstado(c.id, "ANULADA")} className="text-red-600 dark:text-red-400 hover:underline">Anular</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </Card>
  );
}

const inputClsLocal =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400 dark:text-slate-500">{label}</div>
      <div className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  );
}
