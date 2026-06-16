"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, StatCard } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { getVencimientos, type Vencimientos } from "@/lib/procesos-api";

type Cliente = { id: string; nombre: string; estado: string; fechaIngreso: string };
type CarteraRow = { saldoPendiente: number | null };
type Reporte = { utilidadNeta: number };
type Alertas = Record<string, { id: string }[]>;

const periodo = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function InicioPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [procesos, setProcesos] = useState(0);
  const [cartera, setCartera] = useState<number | null>(null);
  const [utilidad, setUtilidad] = useState<number | null>(null);
  const [alertas, setAlertas] = useState<Alertas | null>(null);
  const [venc, setVenc] = useState<Vencimientos | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [cl, pr, ca, re, al, ve] = await Promise.all([
        api.get<Cliente[]>("/clientes").catch(() => [] as Cliente[]),
        api.get<{ total: number }>("/procesos").catch(() => ({ total: 0 })),
        api.get<CarteraRow[]>("/contable/cartera").catch(() => [] as CarteraRow[]),
        api.get<Reporte>(`/contable/reportes?periodo=${periodo()}`).catch(() => null),
        api.get<Alertas>("/comercial/alertas").catch(() => null),
        getVencimientos().catch(() => null),
      ]);
      setClientes(cl);
      setProcesos(pr.total ?? 0);
      setCartera(ca.length ? ca.reduce((s, c) => s + (c.saldoPendiente ?? 0), 0) : null);
      setUtilidad(re ? re.utilidadNeta : null);
      setAlertas(al);
      setVenc(ve);
      setLoading(false);
    })();
  }, []);

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clientes" value={loading ? "…" : String(clientes.length)} hint={`${prospectos} en prospecto`} />
        <StatCard label="Procesos" value={loading ? "…" : String(procesos)} />
        <StatCard label="Cartera pendiente" value={loading ? "…" : money(cartera)} />
        <StatCard label="Utilidad del mes" value={loading ? "…" : money(utilidad)} />
      </div>

      {venc && venc.vencido.length + venc.por_vencer.length > 0 && (
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
              const vencido = p.semaforo === "vencido";
              const fecha = p.fechaLimite
                ? new Date(p.fechaLimite).toLocaleDateString("es-CO", { day: "2-digit", month: "short", timeZone: "UTC" })
                : "";
              return (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <Link href={`/procesos/${p.id}`} className="truncate font-medium text-indigo-600 hover:underline">
                    {p.codigoInterno} · {p.titulo}
                  </Link>
                  <span className={`shrink-0 text-xs font-medium ${vencido ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {fecha} {vencido ? "(vencido)" : "(por vencer)"}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link href="/procesos" className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:underline">
            Ver todos los procesos →
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-800 dark:text-slate-100">Pendientes</h3>
            <Link href="/agenda" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Ver agenda →</Link>
          </div>
          {!alertas ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{loading ? "Cargando…" : "Sin pendientes (o el módulo comercial no está contratado)."}</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {ALERTAS_LABEL.map(([k, label]) => {
                const n = alertas[k]?.length ?? 0;
                const destino = ["tareaVencida", "citaHoy", "prospectoSinSeguimiento"].includes(k) ? "/agenda" : "/clientes";
                return n > 0 ? (
                  <li key={k}>
                    <Link href={destino} className="flex items-center justify-between rounded-md px-1.5 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                      <span className="text-slate-600 dark:text-slate-300">{label}</span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{n}</span>
                    </Link>
                  </li>
                ) : (
                  <li key={k} className="flex items-center justify-between px-1.5 py-1 text-sm">
                    <span className="text-slate-400">{label}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-400 dark:bg-slate-800">{n}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
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
      </div>
    </div>
  );
}
