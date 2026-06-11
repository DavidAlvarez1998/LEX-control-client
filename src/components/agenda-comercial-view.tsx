"use client";

// Agenda del comercial del despacho como CALENDARIO MENSUAL (espejo de la del
// admin): cuadro del mes; clic en un día abre un modal para ver/agregar
// actividades sobre un CLIENTE. El comercial ve la suya; el admin de empresa
// puede elegir la de un miembro. Ver openspec/changes/comercial-rol-portal/.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Modal, PageHeader } from "@/components/ui";
import { Field } from "@/components/form-ui";
import { errorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import {
  comercialApi, listClientesAgenda, listComerciales, TIPO_GESTION,
  type AgendaItem, type ClienteAgenda, type MiembroMin,
} from "@/lib/comercial-api";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";

const humaniza = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

// Rol legible del creador de una actividad (para la vista del admin de empresa).
const ROL_LABEL: Record<string, string> = { COMERCIAL: "Comercial", JURIDICO: "Jurídico", CONTABLE: "Contable" };
function rolLegible(rp: { roles: string[]; esAdminEmpresa: boolean } | null): string {
  if (!rp) return "—";
  if (rp.roles.length) return rp.roles.map((r) => ROL_LABEL[r] ?? humaniza(r)).join(", ");
  return rp.esAdminEmpresa ? "Admin" : "Usuario";
}
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const noonIso = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString();
const horaDe = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true }) : "");

// Link a WhatsApp: solo dígitos; un móvil local (10 dígitos) se asume Colombia (+57).
const waLink = (tel: string) => {
  const d = tel.replace(/\D/g, "");
  const intl = d.length === 10 ? `57${d}` : d;
  return `https://wa.me/${intl}`;
};

function WhatsAppIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.16c-.24.68-1.42 1.32-1.96 1.36-.5.04-.98.22-3.3-.69-2.79-1.1-4.56-3.94-4.7-4.12-.14-.18-1.13-1.5-1.13-2.86 0-1.36.71-2.03.97-2.31.24-.26.53-.32.71-.32.18 0 .35 0 .51.01.16.01.39-.06.6.46.24.58.79 2 .86 2.14.07.14.12.31.02.49-.09.18-.14.29-.27.45-.14.16-.29.36-.41.48-.14.14-.28.29-.12.57.16.28.71 1.18 1.53 1.91 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.18-.21.69-.81.87-1.09.18-.28.36-.23.6-.14.25.09 1.57.74 1.84.87.28.14.46.21.53.32.07.12.07.66-.17 1.34Z" />
    </svg>
  );
}

function TipoIcon({ tipo }: { tipo: string }) {
  const props = { className: "h-[18px] w-[18px]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (tipo) {
    case "WHATSAPP": return <WhatsAppIcon />;
    case "REUNION": return (<svg {...props}><circle cx="9" cy="8" r="3" /><path d="M2.5 19a6.5 6.5 0 0 1 13 0" /><path d="M16 5a3 3 0 0 1 0 6" /><path d="M19.5 19a6.5 6.5 0 0 0-3-5.2" /></svg>);
    case "VIDEOLLAMADA": return (<svg {...props}><rect x="2" y="6" width="13" height="12" rx="2" /><path d="m22 8-5 4 5 4V8Z" /></svg>);
    case "CORREO": return (<svg {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>);
    case "OTRO": return (<svg {...props}><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>);
    default: return (<svg {...props}><path d="M6.5 3.5c.5 0 .9.3 1 .8l.8 3a1 1 0 0 1-.3 1l-1.4 1.2a12 12 0 0 0 5 5l1.2-1.4a1 1 0 0 1 1-.3l3 .8c.5.1.8.5.8 1V19a2 2 0 0 1-2.2 2A16 16 0 0 1 4 6.7 2 2 0 0 1 6 4.5Z" /></svg>); // LLAMADA
  }
}

export function AgendaComercialView() {
  const esAdmin = !!getUser()?.esAdminEmpresa;
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [comercialId, setComercialId] = useState("");
  const [comerciales, setComerciales] = useState<MiembroMin[]>([]);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [clientes, setClientes] = useState<ClienteAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dia, setDia] = useState<Date | null>(null);

  const inicioMes = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor]);
  const finMes = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), [cursor]);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const comQ = esAdmin && comercialId ? comercialId : undefined;
      const [ag, cs] = await Promise.all([
        comercialApi.agenda({ desde: noonIso(inicioMes), hasta: noonIso(finMes), comercialId: comQ, incluirCompletadas: true }),
        listClientesAgenda(),
      ]);
      setItems(ag.items); setClientes(cs);
    } catch (err) {
      setError(errorMessage(err, "Error al cargar la agenda."));
    } finally { setLoading(false); }
  }, [inicioMes, finMes, comercialId, esAdmin]);
  useEffect(() => { cargar(); }, [cargar]);
  // La agenda es de todos: el admin filtra/asigna por CUALQUIER miembro activo del despacho.
  useEffect(() => { if (esAdmin) listComerciales().then((m) => setComerciales(m.filter((x) => x.activo))).catch(() => {}); }, [esAdmin]);

  const porDia = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const it of items) {
      if (!it.fechaProximaTarea) continue;
      const k = toKey(new Date(it.fechaProximaTarea));
      const arr = map.get(k) ?? [];
      arr.push(it);
      map.set(k, arr);
    }
    return map;
  }, [items]);

  const celdas = useMemo(() => {
    const offset = (inicioMes.getDay() + 6) % 7; // 0 = lunes
    const total = Math.ceil((offset + finMes.getDate()) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const dayNum = i - offset + 1;
      return dayNum >= 1 && dayNum <= finMes.getDate() ? new Date(cursor.getFullYear(), cursor.getMonth(), dayNum) : null;
    });
  }, [cursor, inicioMes, finMes]);

  const hoyKey = toKey(new Date());
  const tituloMes = inicioMes.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const mover = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const mostrarComercial = esAdmin && !comercialId;
  const comNombre = (id: string | null) => comerciales.find((c) => c.id === id)?.nombre ?? null;

  return (
    <div>
      <PageHeader title="Agenda" subtitle="Tu mes de actividades. Haz clic en un día para agendar." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => mover(-1)}>‹</Button>
        <span className="min-w-44 text-center text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">{tituloMes}</span>
        <Button variant="ghost" onClick={() => mover(1)}>›</Button>
        <Button variant="ghost" onClick={() => setCursor(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); })}>Hoy</Button>
        {esAdmin && (
          <select value={comercialId} onChange={(e) => setComercialId(e.target.value)} className="ml-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
            <option value="">Todos los miembros</option>
            {comerciales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
      </div>

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
          {error} <button onClick={cargar} className="font-medium underline">reintentar</button>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
          {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {celdas.map((d, i) => {
            if (!d) return <div key={i} className="min-h-24 border-b border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30" />;
            const k = toKey(d);
            const acts = porDia.get(k) ?? [];
            const esHoy = k === hoyKey;
            const pasado = k < hoyKey;
            return (
              <button key={i} onClick={() => setDia(d)}
                className="min-h-24 border-b border-r border-slate-100 dark:border-slate-800 p-1.5 text-left align-top transition hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20">
                <div className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${esHoy ? "bg-indigo-600 font-semibold text-white" : "text-slate-500 dark:text-slate-400"}`}>{d.getDate()}</div>
                <div className="space-y-0.5">
                  {acts.slice(0, 3).map((a) => (
                    <div key={a.id} className={`truncate rounded px-1 py-0.5 text-[11px] ${
                      a.completada ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 line-through"
                      : pasado ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                      : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"}`}>
                      {horaDe(a.fechaProximaTarea)} {a.cliente?.nombre ?? a.titulo ?? humaniza(a.tipoGestion)}{mostrarComercial && comNombre(a.comercialId) ? ` · ${comNombre(a.comercialId)}` : ""}
                    </div>
                  ))}
                  {acts.length > 3 && <div className="px-1 text-[11px] text-slate-400">+{acts.length - 3} más</div>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>
      {loading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}

      {dia && (
        <DiaModal
          dia={dia}
          actividades={porDia.get(toKey(dia)) ?? []}
          clientes={clientes}
          esAdmin={esAdmin}
          comerciales={comerciales}
          onClose={() => setDia(null)}
          onChange={cargar}
        />
      )}
    </div>
  );
}

function DiaModal({ dia, actividades, clientes, esAdmin, comerciales, onClose, onChange }: {
  dia: Date; actividades: AgendaItem[]; clientes: ClienteAgenda[];
  esAdmin?: boolean; comerciales: MiembroMin[];
  onClose: () => void; onChange: () => Promise<void>;
}) {
  const [clienteId, setClienteId] = useState("");
  const [tipo, setTipo] = useState("LLAMADA");
  const [titulo, setTitulo] = useState("");
  const [nota, setNota] = useState("");
  const [h12, setH12] = useState(9);
  const [min, setMin] = useState(0);
  const [mer, setMer] = useState<"AM" | "PM">("AM");
  const [comercialAsignado, setComercialAsignado] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const [query, setQuery] = useState("");
  const activos = useMemo(() => clientes.filter((c) => c.estado !== "DESCARTADO"), [clientes]);
  const sel = useMemo(() => clientes.find((c) => c.id === clienteId) ?? null, [clientes, clienteId]);
  // El cliente es OPCIONAL: no se pre-lista. Solo aparecen resultados al escribir.
  const matches = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return [];
    return activos.filter((c) =>
      c.nombre.toLowerCase().includes(t) || (c.telefono ?? "").toLowerCase().includes(t),
    ).slice(0, 8);
  }, [activos, query]);

  async function agendar() {
    setErr(null);
    setBusy(true);
    try {
      const h24 = (h12 % 12) + (mer === "PM" ? 12 : 0);
      const cuando = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h24, min);
      await comercialApi.addSeguimiento(clienteId, {
        tipoGestion: tipo, titulo: titulo.trim() || undefined, motivoContacto: nota.trim() || undefined,
        fechaProximaTarea: cuando.toISOString(),
        comercialId: esAdmin && comercialAsignado ? comercialAsignado : undefined,
      });
      setTitulo(""); setNota(""); setClienteId(""); setQuery(""); setComercialAsignado("");
      setMostrarForm(false);
      await onChange();
    } catch (e) {
      setErr(errorMessage(e, "Error al agendar."));
    } finally { setBusy(false); }
  }

  const titulo_ = dia.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <Modal open onClose={onClose} title={titulo_.charAt(0).toUpperCase() + titulo_.slice(1)} size="lg"
      footer={<Button variant="ghost" onClick={onClose}>Cerrar</Button>}>
      {actividades.length > 0 && !mostrarForm && (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Actividades del día</p>
            <Button onClick={() => { setErr(null); setMostrarForm(true); }}>+ Agendar actividad</Button>
          </div>
          <ul className="space-y-2">
            {actividades.map((a) => <ActivityRow key={a.id} a={a} esAdmin={esAdmin} onChange={onChange} />)}
          </ul>
        </>
      )}

      {(actividades.length === 0 || mostrarForm) && (
      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-3 space-y-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Agendar actividad</p>
        <Field label="Cliente (opcional)">
          {sel ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
              <span className="truncate text-slate-800 dark:text-slate-100"><b>{sel.nombre}</b></span>
              <button type="button" onClick={() => { setClienteId(""); setQuery(""); }} className="shrink-0 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Quitar</button>
            </div>
          ) : (
            <>
              <input value={query} onChange={(e) => setQuery(e.target.value)} className={inputCls} placeholder="Escribe para buscar un cliente… (opcional)" />
              {query.trim() && (
                <ul className="mt-1 max-h-44 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  {matches.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">Sin resultados</li>
                  ) : matches.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => { setClienteId(c.id); setQuery(""); }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                        <span className="font-medium text-slate-800 dark:text-slate-100">{c.nombre}</span>
                        {c.telefono && <span className="text-slate-500 dark:text-slate-400"> · {c.telefono}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Field>
        {sel && (
          sel.telefono ? (
            <a href={waLink(sel.telefono)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
              <WhatsAppIcon /> {sel.telefono}
            </a>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500">Este cliente no tiene teléfono registrado.</p>
          )
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>{TIPO_GESTION.map((t) => <option key={t} value={t}>{humaniza(t)}</option>)}</select></Field>
          <Field label="Hora">
            <div className="flex items-center gap-1.5">
              <select value={h12} onChange={(e) => setH12(Number(e.target.value))} className={inputCls} aria-label="Hora">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-slate-400">:</span>
              <select value={min} onChange={(e) => setMin(Number(e.target.value))} className={inputCls} aria-label="Minutos">
                {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
              </select>
              <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                {(["AM", "PM"] as const).map((x) => (
                  <button key={x} type="button" onClick={() => setMer(x)}
                    className={`px-3 py-2 text-sm font-medium transition ${mer === x ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                    {x}
                  </button>
                ))}
              </div>
            </div>
          </Field>
        </div>
        <Field label="Motivo / título"><input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputCls} placeholder="Ej. Insistir con la oferta" /></Field>
        <Field label="Nota"><textarea value={nota} onChange={(e) => setNota(e.target.value)} className={`${inputCls} resize-y`} rows={2} placeholder="Contexto / qué ofrecer" /></Field>
        {esAdmin && comerciales.length > 0 && (
          <Field label="Comercial asignado">
            <select value={comercialAsignado} onChange={(e) => setComercialAsignado(e.target.value)} className={inputCls}>
              <option value="">Yo / sin asignar</option>
              {comerciales.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Field>
        )}
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <div className="flex justify-end gap-2">
          {actividades.length > 0 && <Button variant="ghost" onClick={() => { setMostrarForm(false); setErr(null); }} disabled={busy}>Volver</Button>}
          <Button onClick={agendar} disabled={busy}>{busy ? "…" : "Agendar"}</Button>
        </div>
      </div>
      )}
    </Modal>
  );
}

function ActivityRow({ a, esAdmin, onChange }: { a: AgendaItem; esAdmin?: boolean; onChange: () => Promise<void> }) {
  const [mode, setMode] = useState<"view" | "edit" | "cancel" | "complete">("view");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resultadoInput, setResultadoInput] = useState("");

  const base = useMemo(() => (a.fechaProximaTarea ? new Date(a.fechaProximaTarea) : new Date()), [a.fechaProximaTarea]);
  const [tipo, setTipo] = useState(a.tipoGestion);
  const [titulo, setTitulo] = useState(a.titulo ?? "");
  const [nota, setNota] = useState(a.motivoContacto ?? "");
  const [fechaDia, setFechaDia] = useState(toKey(base));
  const [h12, setH12] = useState(((base.getHours() + 11) % 12) + 1);
  const [min, setMin] = useState(base.getMinutes());
  const [mer, setMer] = useState<"AM" | "PM">(base.getHours() >= 12 ? "PM" : "AM");
  const [motivo, setMotivo] = useState("");

  const cancelada = a.canceladaEn != null;
  const inactiva = a.completada || cancelada;

  async function guardar() {
    setBusy(true); setErr(null);
    try {
      const h24 = (h12 % 12) + (mer === "PM" ? 12 : 0);
      const [yy, mm, dd] = fechaDia.split("-").map(Number);
      const cuando = new Date(yy, mm - 1, dd, h24, min);
      await comercialApi.editarSeguimiento(a.id, {
        tipoGestion: tipo, titulo: titulo.trim() || null, motivoContacto: nota.trim() || null,
        fechaProximaTarea: cuando.toISOString(),
      });
      setMode("view"); await onChange();
    } catch (e) { setErr(errorMessage(e, "Error al guardar.")); }
    finally { setBusy(false); }
  }
  async function completar() {
    setBusy(true); setErr(null);
    try {
      const r = resultadoInput.trim();
      if (a.completada) await comercialApi.editarSeguimiento(a.id, { resultado: r || null });
      else await comercialApi.completarSeguimiento(a.id, r ? { resultado: r } : {});
      setMode("view"); await onChange();
    } catch (e) { setErr(errorMessage(e, "Error.")); }
    finally { setBusy(false); }
  }
  async function cancelar() {
    if (!motivo.trim()) { setErr("Indica el motivo de la cancelación."); return; }
    setBusy(true); setErr(null);
    try { await comercialApi.cancelarSeguimiento(a.id, motivo.trim()); setMode("view"); await onChange(); }
    catch (e) { setErr(errorMessage(e, "Error.")); }
    finally { setBusy(false); }
  }
  async function reabrir() {
    setBusy(true); setErr(null);
    try { await comercialApi.reabrirSeguimiento(a.id); await onChange(); }
    catch (e) { setErr(errorMessage(e, "Error.")); }
    finally { setBusy(false); }
  }

  const vencida = !inactiva && a.fechaProximaTarea != null && new Date(a.fechaProximaTarea) < new Date();
  const badgeCls = a.completada
    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
    : cancelada ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
    : vencida ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
    : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400";

  if (mode === "edit") return (
    <li className="rounded-lg border border-indigo-200 dark:border-indigo-800 px-3 py-2.5 text-sm space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Tipo"><select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>{TIPO_GESTION.map((t) => <option key={t} value={t}>{humaniza(t)}</option>)}</select></Field>
        <Field label="Fecha"><input type="date" value={fechaDia} onChange={(e) => setFechaDia(e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="Hora">
        <div className="flex items-center gap-1.5">
          <select value={h12} onChange={(e) => setH12(Number(e.target.value))} className={inputCls}>{Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}</select>
          <span className="text-slate-400">:</span>
          <select value={min} onChange={(e) => setMin(Number(e.target.value))} className={inputCls}>{Array.from({ length: 12 }, (_, i) => i * 5).map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}</select>
          <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            {(["AM", "PM"] as const).map((x) => <button key={x} type="button" onClick={() => setMer(x)} className={`px-3 py-2 text-sm font-medium transition ${mer === x ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{x}</button>)}
          </div>
        </div>
      </Field>
      <Field label="Motivo / título"><input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputCls} /></Field>
      <Field label="Nota"><textarea value={nota} onChange={(e) => setNota(e.target.value)} className={`${inputCls} resize-y`} rows={2} /></Field>
      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => { setMode("view"); setErr(null); }} disabled={busy}>Volver</Button>
        <Button onClick={guardar} disabled={busy}>{busy ? "…" : "Guardar"}</Button>
      </div>
    </li>
  );

  return (
    <li className="flex items-start gap-3 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2.5 text-sm">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${badgeCls}`} title={humaniza(a.tipoGestion)} aria-label={humaniza(a.tipoGestion)}>
        <TipoIcon tipo={a.tipoGestion} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`truncate font-medium text-slate-800 dark:text-slate-100 ${inactiva ? "line-through" : ""}`}>{a.cliente?.nombre ?? "Actividad"}</p>
          <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{horaDe(a.fechaProximaTarea)}{vencida && " · vencida"}</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{humaniza(a.tipoGestion)}</p>
        {esAdmin && a.registradoPor && (
          <p className="text-xs text-slate-400 dark:text-slate-500">Creado por {a.registradoPor.nombre} · {rolLegible(a.registradoPor)}</p>
        )}
        {a.cliente?.telefono && (
          <a href={waLink(a.cliente.telefono)} target="_blank" rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
            <WhatsAppIcon /> {a.cliente.telefono}
          </a>
        )}
        {a.titulo && <p className="mt-0.5 text-slate-700 dark:text-slate-300">{a.titulo}</p>}
        {a.motivoContacto && <p className="text-slate-500 dark:text-slate-400">{a.motivoContacto}</p>}
        {a.completada && (
          <>
            <p className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">✓ Completada</p>
            {a.resultado && <p className="text-xs text-slate-700 dark:text-slate-200"><span className="text-slate-400 dark:text-slate-500">Resultado:</span> {a.resultado}</p>}
          </>
        )}
        {cancelada && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">✗ Cancelada{a.motivoCancelacion ? ` · ${a.motivoCancelacion}` : ""}</p>}

        {mode === "complete" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input value={resultadoInput} onChange={(e) => setResultadoInput(e.target.value)} placeholder="Resultado" className={`${inputCls} max-w-xs`} />
            <Button onClick={completar} disabled={busy}>{busy ? "…" : a.completada ? "Guardar" : "Completar"}</Button>
            <Button variant="ghost" onClick={() => { setMode("view"); setErr(null); }} disabled={busy}>Volver</Button>
          </div>
        )}
        {mode === "cancel" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la cancelación" className={`${inputCls} max-w-xs`} />
            <Button onClick={cancelar} disabled={busy}>{busy ? "…" : "Confirmar"}</Button>
            <Button variant="ghost" onClick={() => { setMode("view"); setErr(null); }} disabled={busy}>Volver</Button>
          </div>
        )}
        {err && mode === "view" && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

        {mode === "view" && (
          <div className="mt-1.5 flex flex-wrap gap-3 text-xs font-medium">
            {!inactiva && <button onClick={() => { setResultadoInput(""); setErr(null); setMode("complete"); }} disabled={busy} className="text-emerald-600 dark:text-emerald-400 hover:underline">Completar</button>}
            {!inactiva && <button onClick={() => setMode("edit")} disabled={busy} className="text-indigo-600 dark:text-indigo-400 hover:underline">Editar</button>}
            {!inactiva && <button onClick={() => { setMotivo(""); setErr(null); setMode("cancel"); }} disabled={busy} className="text-amber-600 dark:text-amber-400 hover:underline">Cancelar</button>}
            {a.completada && <button onClick={() => { setResultadoInput(a.resultado ?? ""); setErr(null); setMode("complete"); }} disabled={busy} className="text-indigo-600 dark:text-indigo-400 hover:underline">Editar resultado</button>}
            {inactiva && <button onClick={reabrir} disabled={busy} className="text-indigo-600 dark:text-indigo-400 hover:underline">Reabrir</button>}
          </div>
        )}
      </div>
    </li>
  );
}
