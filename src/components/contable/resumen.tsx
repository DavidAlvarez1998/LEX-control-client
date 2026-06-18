"use client";

// Pestaña Resumen: P&L del mes (derivado por la API) + desglose de egresos.

import { Card, StatCard } from "@/components/ui";
import { Banda, money, useCargar } from "./bits";
import { contableApi } from "@/lib/contable";

export function ResumenTab({ periodo }: { periodo: string }) {
  const { data: r, loading, error, recargar } = useCargar(() => contableApi.reporte(periodo));

  if (loading) return <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>;
  if (error) return <Banda tone="rojo" onRetry={recargar}>{error}</Banda>;
  if (!r) return null;

  const d = r.desglose;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Ingresos del mes" value={money(r.totalIngresos)} />
        <StatCard label="Egresos del mes" value={money(r.totalEgresos)} />
        <StatCard
          label="Utilidad neta"
          value={money(r.utilidadNeta)}
          hint={r.utilidadNeta >= 0 ? "En positivo" : "En rojo"}
        />
      </div>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Desglose de egresos · {periodo}
        </h3>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Desglose label="Gastos generales" value={d.egresosGenerales} />
          <Desglose label="Nómina" value={d.nomina} />
          <Desglose label="Servicios fijos" value={d.serviciosFijos} />
          <Desglose label="Caja menor" value={d.cajaMenor} />
        </dl>
        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
          Todos los valores se calculan al leer; solo se cuentan movimientos en estado PAGADO del periodo.
        </p>
      </Card>
    </div>
  );
}

function Desglose({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-200 px-4 py-3 dark:border-slate-600 dark:bg-slate-600/40">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{money(value)}</dd>
    </div>
  );
}
