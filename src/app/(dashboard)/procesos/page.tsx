"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, PageHeader, PlusIcon } from "@/components/ui";
import { Select } from "@/components/form-ui";
import {
  ESTADO_LABEL,
  JURISDICCION_LABEL,
  type AreaPractica,
  type EstadoProceso,
} from "@/lib/procesos";
import { getAreas, listProcesos, type ProcesoListItem } from "@/lib/procesos-api";

// Mapa label → enum para los filtros (los Select muestran etiquetas legibles).
const ESTADO_POR_LABEL = Object.fromEntries(
  Object.entries(ESTADO_LABEL).map(([k, v]) => [v, k]),
) as Record<string, EstadoProceso>;

export default function ProcesosPage() {
  const [areas, setAreas] = useState<AreaPractica[]>([]);
  const [items, setItems] = useState<ProcesoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areaNombre, setAreaNombre] = useState("");
  const [estadoLabel, setEstadoLabel] = useState("");

  useEffect(() => {
    getAreas().then(setAreas).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const area = areas.find((a) => a.nombre === areaNombre)?.slug;
    const estado = estadoLabel ? ESTADO_POR_LABEL[estadoLabel] : undefined;
    listProcesos({ area, estado })
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  }, [areas, areaNombre, estadoLabel]);

  const nombreArea = useMemo(
    () => (slug: string | null) => areas.find((a) => a.slug === slug)?.nombre ?? slug ?? "—",
    [areas],
  );

  return (
    <div>
      <PageHeader
        title="Procesos"
        subtitle="Procesos legales de tu despacho."
        action={
          <Link href="/procesos/nuevo">
            <Button>
              <PlusIcon /> Nuevo proceso
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-56">
          <Select
            value={areaNombre}
            onChange={setAreaNombre}
            opciones={areas.filter((a) => a.activo).map((a) => a.nombre)}
            placeholder="Todas las áreas"
          />
        </div>
        <div className="w-48">
          <Select
            value={estadoLabel}
            onChange={setEstadoLabel}
            opciones={Object.values(ESTADO_LABEL)}
            placeholder="Todos los estados"
          />
        </div>
      </div>

      {loading ? (
        <Card className="text-sm text-slate-500">Cargando…</Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>
      ) : items.length === 0 ? (
        <EmptyState
          title="No hay procesos"
          description="Crea tu primer proceso para empezar a gestionar un proceso legal."
          action={
            <Link href="/procesos/nuevo">
              <Button>
                <PlusIcon /> Nuevo proceso
              </Button>
            </Link>
          }
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Caso</th>
                <th className="px-5 py-3 font-medium">Área</th>
                <th className="px-5 py-3 font-medium">Radicado</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <td className="px-5 py-3">
                    <Link href={`/procesos/${t.id}`} className="font-medium text-indigo-600 hover:underline">
                      {t.codigoInterno}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{t.titulo}</div>
                    <div className="text-xs text-slate-500">{t.tipoProcesoNombre}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {nombreArea(t.areaSlug)}
                    <div className="text-xs text-slate-400">{JURISDICCION_LABEL[t.jurisdiccion]}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {t.radicado ?? <span className="text-slate-400">Sin radicar</span>}
                  </td>
                  <td className="px-5 py-3">
                    <EstadoBadge estado={t.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: EstadoProceso }) {
  const color =
    estado === "ABIERTO"
      ? "bg-sky-50 text-sky-700"
      : estado === "EN_PROCESO"
        ? "bg-indigo-50 text-indigo-700"
        : estado === "SUSPENDIDO"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-500";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}
