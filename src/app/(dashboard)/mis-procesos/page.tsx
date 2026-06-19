"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { RolEmpresaGuard } from "@/components/rol-empresa-guard";
import { getUser } from "@/lib/auth";
import { listProcesos, type ProcesoListItem } from "@/lib/procesos-api";
import { ESTADO_LABEL, rutaProceso } from "@/lib/procesos";

// Vence + semáforo (mismo criterio que la lista de Procesos).
function vence(item: ProcesoListItem): { fecha: string; sub: string | null; cls: string } {
  if (!item.fechaLimite) return { fecha: "—", sub: null, cls: "text-muted" };
  const fecha = new Date(item.fechaLimite).toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
  if (item.semaforo === "vencido") return { fecha, sub: "vencido", cls: "text-rose-600 dark:text-rose-400 font-medium" };
  if (item.semaforo === "por_vencer") return { fecha, sub: "por vencer", cls: "text-amber-600 dark:text-amber-400 font-medium" };
  return { fecha, sub: null, cls: "text-slate-600 dark:text-slate-300" };
}

// Orden deadline-first: primero los que tienen fecha (asc), luego los sin fecha.
function ordenar(items: ProcesoListItem[]): ProcesoListItem[] {
  return [...items].sort((a, b) => {
    if (!a.fechaLimite && !b.fechaLimite) return 0;
    if (!a.fechaLimite) return 1;
    if (!b.fechaLimite) return -1;
    return a.fechaLimite.localeCompare(b.fechaLimite);
  });
}

export default function MisProcesosPage() {
  const router = useRouter();
  const [items, setItems] = useState<ProcesoListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const yo = getUser();
    if (!yo?.id) { setItems([]); return; }
    listProcesos({ responsableId: yo.id })
      .then((r) => setItems(ordenar(r.items)))
      .catch(() => setError("No pudimos cargar tus procesos."));
  }, []);

  return (
    <RolEmpresaGuard roles={["JURIDICO"]}>
      <div>
        <PageHeader title="Mis procesos" subtitle="Los procesos en los que eres el abogado responsable." />

        {error ? (
          <Card className="border-red-200 bg-red-50 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">{error}</Card>
        ) : items === null ? (
          <Card className="text-sm text-muted">Cargando…</Card>
        ) : items.length === 0 ? (
          <EmptyState title="No tienes procesos asignados" description="Cuando seas el responsable de un proceso, aparecerá aquí con su vencimiento." />
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Proceso</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Etapa</th>
                  <th className="px-5 py-3 font-medium">Vence</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => {
                  const v = vence(t);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => router.push(rutaProceso({ id: t.id, grupo: t.grupo }))}
                      className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-hover dark:border-slate-700"
                    >
                      <td className="px-5 py-3 align-top">
                        <div className="font-medium text-accent group-hover:underline">{t.titulo}</div>
                        <div className="text-xs text-muted">{t.tipoProcesoNombre} · {t.codigoInterno}{t.radicado ? ` · Rad. ${t.radicado}` : ""}</div>
                      </td>
                      <td className="px-5 py-3 align-top text-slate-600 dark:text-slate-300">{t.clienteNombre ?? "—"}</td>
                      <td className="px-5 py-3 align-top text-slate-600 dark:text-slate-300">{t.etapaNombre}</td>
                      <td className={`px-5 py-3 align-top ${v.cls}`}>
                        {v.fecha}
                        {v.sub && <div className="text-xs">{v.sub}</div>}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">{ESTADO_LABEL[t.estado]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </RolEmpresaGuard>
  );
}
