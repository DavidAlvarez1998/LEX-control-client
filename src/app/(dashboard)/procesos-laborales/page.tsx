"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { Input } from "@/components/form-ui";
import { ESTADO_LABEL, rutaProceso, type EstadoProceso } from "@/lib/procesos";
import { getTipos, listProcesos, type ProcesoListItem } from "@/lib/procesos-api";
import { errorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { RolEmpresaGuard } from "@/components/rol-empresa-guard";

// El catálogo siembra un único tipo laboral; desde aquí se crea (rol + instancia
// se eligen dentro del formulario).
const TIPO_LABORAL = "Proceso Laboral";

const hoyISO = () => new Date().toISOString().slice(0, 10);
function venceUI(item: ProcesoListItem): { fecha: string; sub: string | null; cls: string } {
  if (!item.fechaLimite) return { fecha: "—", sub: null, cls: "text-slate-400" };
  const fecha = new Date(item.fechaLimite).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const esHoy = item.fechaLimite.slice(0, 10) === hoyISO();
  if (item.semaforo === "vencido") return { fecha, sub: "vencido", cls: "text-rose-600 dark:text-rose-400 font-medium" };
  if (esHoy) return { fecha, sub: "vence hoy", cls: "text-rose-600 dark:text-rose-400 font-medium" };
  if (item.semaforo === "por_vencer") return { fecha, sub: "por vencer", cls: "text-amber-600 dark:text-amber-400 font-medium" };
  return { fecha, sub: null, cls: "text-slate-600 dark:text-slate-300" };
}
const grupoUrgencia = (i: ProcesoListItem) =>
  i.estado === "CERRADO" || i.estado === "ARCHIVADO" ? 2 : i.fechaLimite ? 0 : 1;

export default function ProcesosLaboralesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ProcesoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [tipoId, setTipoId] = useState<string | null>(null); // id del tipo "Proceso Laboral"

  useEffect(() => {
    getTipos()
      .then((ts) => setTipoId(ts.find((t) => t.nombre === TIPO_LABORAL)?.id ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listProcesos({ q: q || undefined })
      .then((r) => setItems(r.items.filter((i) => i.grupo === "LABORAL")))
      .catch((e) => setError(errorMessage(e, "Error al cargar")))
      .finally(() => setLoading(false));
  }, [q]);

  const ordenados = useMemo(() => {
    return [...items].sort((a, b) => {
      const ga = grupoUrgencia(a), gb = grupoUrgencia(b);
      if (ga !== gb) return ga - gb;
      if (ga === 0) return (a.fechaLimite ?? "").localeCompare(b.fechaLimite ?? "");
      return 0;
    });
  }, [items]);

  const u = getUser();
  const puedeEditar = !!u?.esAdminEmpresa || (u?.roles ?? []).includes("JURIDICO");

  return (
    <RolEmpresaGuard roles={["JURIDICO"]}>
      <div>
        <PageHeader
          title="Procesos Laborales"
          subtitle="Proceso ordinario laboral (Ley 2452/2025): demandante o demandado, única o doble instancia."
          action={
            puedeEditar ? (
              <Button
                disabled={!tipoId}
                onClick={() => tipoId && router.push(`/procesos-laborales/nuevo?tipo=${tipoId}`)}
              >
                + Nuevo proceso laboral
              </Button>
            ) : undefined
          }
        />

        <div className="mb-4 w-72">
          <Input value={qInput} onChange={setQInput} placeholder="Buscar por código, título, cliente o radicado…" />
        </div>

        {loading ? (
          <Card className="text-sm text-slate-500">Cargando…</Card>
        ) : error ? (
          <Card className="border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>
        ) : ordenados.length === 0 ? (
          <EmptyState title="No hay procesos laborales" description="Crea uno con el botón “Nuevo proceso laboral”." />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3 font-medium">Proceso</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Etapa</th>
                  <th className="px-5 py-3 font-medium">Vence</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((t) => {
                  const v = venceUI(t);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => router.push(rutaProceso(t))}
                      className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-5 py-3 align-top">
                        <div className="font-medium text-indigo-600 group-hover:underline dark:text-indigo-400">{t.titulo}</div>
                        <div className="text-xs text-slate-500">
                          {t.codigoInterno}
                          {t.radicado && ` · Rad. ${t.radicado}`}
                        </div>
                      </td>
                      <td className="px-5 py-3 align-top text-slate-700 dark:text-slate-200">
                        {t.clienteNombre ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3 align-top text-slate-600 dark:text-slate-300">{t.etapaNombre}</td>
                      <td className={`px-5 py-3 align-top text-xs ${v.cls}`}>
                        {v.fecha}
                        {v.sub && <div className="text-[11px] font-normal">{v.sub}</div>}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <EstadoBadge estado={t.estado} />
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
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}
