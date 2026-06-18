"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { Input } from "@/components/form-ui";
import { ESTADO_LABEL, rutaProceso, type EstadoProceso } from "@/lib/procesos";
import { getTipos, listProcesos, type ProcesoListItem } from "@/lib/procesos-api";
import { errorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { RolEmpresaGuard } from "@/components/rol-empresa-guard";

// Las 4 acciones constitucionales (nombre exacto del tipo en el catálogo → card).
const ACCIONES = [
  { tipo: "Acción de tutela", titulo: "Acción de Tutela", desc: "Protección inmediata de derechos fundamentales (art. 86 C.P.)." },
  { tipo: "Acción popular", titulo: "Acción Popular", desc: "Defensa de derechos e intereses colectivos (Ley 472/1998)." },
  { tipo: "Acción de grupo", titulo: "Acción de Grupo", desc: "Reparación del daño a un grupo de ≥20 personas (Ley 472/1998)." },
  { tipo: "Acción de cumplimiento", titulo: "Acción de Cumplimiento", desc: "Hacer efectiva una ley o acto administrativo (Ley 393/1997)." },
];

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

export default function AccionesConstitucionalesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ProcesoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState(""); // "" = todas
  const [tipoIds, setTipoIds] = useState<Record<string, string>>({}); // nombre → id (para las cards)

  useEffect(() => {
    getTipos()
      .then((ts) => setTipoIds(Object.fromEntries(ts.map((t) => [t.nombre, t.id]))))
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
      .then((r) => setItems(r.items.filter((i) => i.grupo === "CONSTITUCIONAL")))
      .catch((e) => setError(errorMessage(e, "Error al cargar")))
      .finally(() => setLoading(false));
  }, [q]);

  const ordenados = useMemo(() => {
    return [...items]
      .filter((t) => !tipoFiltro || t.tipoProcesoNombre === tipoFiltro)
      .sort((a, b) => {
        const ga = grupoUrgencia(a), gb = grupoUrgencia(b);
        if (ga !== gb) return ga - gb;
        if (ga === 0) return (a.fechaLimite ?? "").localeCompare(b.fechaLimite ?? "");
        return 0;
      });
  }, [items, tipoFiltro]);

  const u = getUser();
  const puedeEditar = !!u?.esAdminEmpresa || (u?.roles ?? []).includes("JURIDICO");

  return (
    <RolEmpresaGuard roles={["JURIDICO"]}>
      <div>
        <PageHeader
          title="Acciones Constitucionales"
          subtitle="Tutela, acción popular, de grupo y de cumplimiento."
        />

        {/* Cards: crear cada acción (todas existen en el catálogo) */}
        {puedeEditar && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ACCIONES.map((a) => {
              const id = tipoIds[a.tipo];
              return (
                <button
                  key={a.tipo}
                  type="button"
                  disabled={!id}
                  onClick={() => id && router.push(`/acciones-constitucionales/nueva?tipo=${id}`)}
                  className="flex h-full flex-col rounded-xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm transition-colors hover:border-indigo-300 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-100">{a.titulo}</span>
                  <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">{a.desc}</span>
                  <span className="mt-3 text-xs font-medium text-indigo-600 dark:text-indigo-400">+ Nueva</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="w-72">
            <Input value={qInput} onChange={setQInput} placeholder="Buscar por código, título, cliente o radicado…" />
          </div>
          <div className="flex flex-wrap gap-1">
            {[{ v: "", label: "Todas" }, ...ACCIONES.map((a) => ({ v: a.tipo, label: a.titulo.replace("Acción ", "").replace("de ", "") }))].map(
              ({ v, label }) => (
                <button
                  key={v || "todas"}
                  type="button"
                  onClick={() => setTipoFiltro(v)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    tipoFiltro === v
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        {loading ? (
          <Card className="text-sm text-slate-500">Cargando…</Card>
        ) : error ? (
          <Card className="border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>
        ) : ordenados.length === 0 ? (
          <EmptyState title="No hay acciones constitucionales" description="Crea una desde las tarjetas de arriba." />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Acción</th>
                  <th className="px-5 py-3 font-medium">Tipo</th>
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
                      className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-200 dark:border-slate-600 dark:hover:bg-slate-600/50"
                    >
                      <td className="px-5 py-3 align-top">
                        <div className="font-medium text-indigo-600 group-hover:underline dark:text-indigo-400">{t.titulo}</div>
                        <div className="text-xs text-slate-500">
                          {t.codigoInterno}
                          {t.radicado && ` · Rad. ${t.radicado}`}
                        </div>
                      </td>
                      <td className="px-5 py-3 align-top text-slate-600 dark:text-slate-300">{t.tipoProcesoNombre}</td>
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
          : "bg-slate-200 text-slate-500";
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}
