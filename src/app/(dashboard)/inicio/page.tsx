"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, StatCard } from "@/components/ui";
import { api, isApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { getUser } from "@/lib/auth";
import { getVencimientos, listProcesos, type ProcesoListItem, type Vencimientos } from "@/lib/procesos-api";
import { vencimientoTexto } from "@/lib/vencimiento";

type Cliente = { id: string; nombre: string; estado: string; fechaIngreso: string };
type CarteraRow = { saldoPendiente: number | null };
type Reporte = { utilidadNeta: number };
type Alertas = Record<string, { id: string }[]>;

const periodo = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function InicioPage() {
  // Predicado de acceso (espejo del sidebar): el admin de empresa ve todo; el resto,
  // según sus roles de empresa. Solo se piden/pintan los widgets accesibles.
  const u = getUser();
  const tieneRol = (r: string) => !!u?.esAdminEmpresa || (u?.roles ?? []).includes(r);
  const puedeProcesos = tieneRol("JURIDICO");
  const puedeClientes = tieneRol("JURIDICO") || tieneRol("COMERCIAL");
  const puedeComercial = tieneRol("COMERCIAL");
  const puedeContable = tieneRol("CONTABLE");
  const sinModulos = !puedeProcesos && !puedeClientes && !puedeComercial && !puedeContable;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [procesos, setProcesos] = useState(0);
  const [cartera, setCartera] = useState<number | null>(null);
  const [utilidad, setUtilidad] = useState<number | null>(null);
  const [alertas, setAlertas] = useState<Alertas | null>(null);
  const [venc, setVenc] = useState<Vencimientos | null>(null);
  const [novedades, setNovedades] = useState<ProcesoListItem[]>([]); // P2
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);

  // Cada widget es independiente; un fallo NO debe verse como "0" real → si alguno
  // falla, se marca `errorCarga` y se ofrece reintentar (en vez de tragar el error).
  // Excepción: 403/404 = el módulo no está habilitado para el plan/rol de la empresa
  // (típico en una empresa recién creada y vacía); eso NO es un fallo de carga, así
  // que se ignora en silencio y el widget queda en su estado vacío. Solo errores
  // reales (5xx, red, timeout) muestran el aviso de "datos incompletos".
  const cargar = useCallback(async () => {
    setLoading(true);
    setErrorCarga(false);
    const falla = (err: unknown) => {
      if (isApiError(err) && (err.status === 403 || err.status === 404)) return;
      setErrorCarga(true);
    };
    await Promise.all([
      puedeClientes ? api.get<Cliente[]>("/clientes").then(setClientes).catch(falla) : null,
      puedeProcesos ? api.get<{ total: number }>("/procesos").then((p) => setProcesos(p.total ?? 0)).catch(falla) : null,
      puedeProcesos ? getVencimientos().then(setVenc).catch(falla) : null,
      puedeProcesos ? listProcesos({ conNovedades: true }).then((r) => setNovedades(r.items)).catch(falla) : null,
      puedeContable ? api.get<CarteraRow[]>("/contable/cartera").then((ca) => setCartera(ca.reduce((s, c) => s + (c.saldoPendiente ?? 0), 0))).catch(falla) : null,
      puedeContable ? api.get<Reporte>(`/contable/reportes?periodo=${periodo()}`).then((r) => setUtilidad(r.utilidadNeta)).catch(falla) : null,
      puedeComercial ? api.get<Alertas>("/comercial/alertas").then(setAlertas).catch(falla) : null,
    ]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const prospectos = clientes.filter((c) => c.estado === "PROSPECTO").length;
  const money = (v: number | null) => (v == null ? "—" : `$${formatMoney(v)}`);
  const recientes = [...clientes].sort((a, b) => +new Date(b.fechaIngreso) - +new Date(a.fechaIngreso)).slice(0, 5);

  const ALERTAS_LABEL: [string, string][] = [
    ["tareaVencida", "Tareas vencidas"],
    ["propuestaSinRespuesta", "Propuestas sin respuesta"],
    ["contratoSinFirmar", "Contratos sin firmar"],
    ["prospectoSinSeguimiento", "Prospectos sin seguimiento"],
    ["cuotaInicialVencida", "Cuotas iniciales vencidas"],
    ["citaHoy", "Citas de hoy"],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Bienvenido a tu portal</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Resumen de tu despacho · {periodo()}</p>
      </div>

      {errorCarga && !loading && (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          No se pudieron cargar algunos datos del resumen (los números pueden estar incompletos).{" "}
          <button onClick={cargar} className="font-medium underline">Reintentar</button>
        </Card>
      )}

      {/* KPIs clicables — solo los de las secciones a las que el rol tiene acceso. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {puedeClientes && (
          <StatCard label="Clientes" value={loading ? "…" : String(clientes.length)} hint={`${prospectos} en prospecto`} href="/clientes" />
        )}
        {puedeProcesos && <StatCard label="Procesos" value={loading ? "…" : String(procesos)} href="/procesos" />}
        {puedeContable && <StatCard label="Cartera pendiente" value={loading ? "…" : money(cartera)} href="/contable" />}
        {puedeContable && <StatCard label="Utilidad del mes" value={loading ? "…" : money(utilidad)} href="/contable" />}
      </div>

      {/* Vencimientos de procesos (JURIDICO / admin). */}
      {puedeProcesos && venc && venc.vencido.length + venc.por_vencer.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium text-amber-900 dark:text-amber-200">Vencimientos de procesos</h3>
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {venc.vencido.length > 0 && <span className="text-rose-600 dark:text-rose-400">{venc.vencido.length} vencido{venc.vencido.length === 1 ? "" : "s"}</span>}
              {venc.vencido.length > 0 && venc.por_vencer.length > 0 && " · "}
              {venc.por_vencer.length > 0 && `${venc.por_vencer.length} por vencer`}
            </span>
          </div>
          <ul className="space-y-1.5 text-sm">
            {[...venc.vencido, ...venc.por_vencer].slice(0, 5).map((p) => {
              const v = vencimientoTexto(p);
              return (
                <li key={p.id} className="flex flex-col gap-0.5">
                  <Link href={`/procesos/${p.id}`} className="truncate font-medium text-indigo-600 hover:underline">
                    {p.codigoInterno} · {p.titulo}
                  </Link>
                  {v && <span className={`text-xs ${v.cls}`}>{v.texto}</span>}
                </li>
              );
            })}
          </ul>
          <Link href="/procesos" className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:underline">
            Ver todos los procesos →
          </Link>
        </Card>
      )}

      {/* P2 — novedades del juzgado (procesos con actuaciones nuevas). */}
      {puedeProcesos && novedades.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium text-emerald-900 dark:text-emerald-200">🏛️ Novedades del juzgado</h3>
            <span className="text-xs text-emerald-700 dark:text-emerald-300">{novedades.length} proceso{novedades.length === 1 ? "" : "s"}</span>
          </div>
          <ul className="space-y-1.5">
            {novedades.slice(0, 6).map((p) => (
              <li key={p.id}>
                <Link href={`/procesos/${p.id}`} className="flex items-center justify-between gap-2 text-sm hover:underline">
                  <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">{p.titulo}</span>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                    {p.actuacionesNuevas} nueva{p.actuacionesNuevas === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/procesos" className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:underline">
            Ver procesos con novedades →
          </Link>
        </Card>
      )}

      {(puedeComercial || puedeClientes) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Pendientes / alertas comerciales (COMERCIAL / admin). */}
          {puedeComercial && (
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-800 dark:text-slate-100">Pendientes</h3>
                <Link href="/agenda" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Ver agenda →</Link>
              </div>
              {!alertas ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{loading ? "Cargando…" : "Sin pendientes."}</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {ALERTAS_LABEL.map(([k, label]) => {
                    const n = alertas[k]?.length ?? 0;
                    const destino = ["tareaVencida", "citaHoy", "prospectoSinSeguimiento"].includes(k) ? "/agenda" : "/clientes";
                    return n > 0 ? (
                      <li key={k}>
                        <Link href={destino} className="flex items-center justify-between rounded-md px-1.5 py-1 text-sm hover:bg-slate-200 dark:hover:bg-slate-600">
                          <span className="text-slate-600 dark:text-slate-300">{label}</span>
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{n}</span>
                        </Link>
                      </li>
                    ) : (
                      <li key={k} className="flex items-center justify-between px-1.5 py-1 text-sm">
                        <span className="text-slate-400">{label}</span>
                        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-400 dark:bg-slate-600">{n}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          {/* Últimos clientes (COMERCIAL / JURIDICO / admin). */}
          {puedeClientes && (
            <Card className={puedeComercial ? "" : "lg:col-span-3"}>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-800 dark:text-slate-100">Últimos clientes</h3>
                <Link href="/clientes" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Ver todos</Link>
              </div>
              {recientes.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{loading ? "Cargando…" : "Aún no hay clientes."}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {recientes.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <Link href={`/clientes/${c.id}`} className="font-medium text-slate-700 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400">{c.nombre}</Link>
                      <span className="text-xs text-slate-400">{c.estado.toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Sin módulos asignados: accesos base. */}
      {sinModulos && (
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tu cuenta no tiene módulos asignados todavía. Mientras tanto puedes ir a tu{" "}
            <Link href="/agenda" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">agenda</Link>{" "}
            o a{" "}
            <Link href="/cuenta" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">mi cuenta</Link>.
          </p>
        </Card>
      )}
    </div>
  );
}
