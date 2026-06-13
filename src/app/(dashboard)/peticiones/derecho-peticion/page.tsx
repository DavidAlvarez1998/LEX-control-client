"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Modal, PageHeader, PlusIcon } from "@/components/ui";
import { Input, SelectableCard } from "@/components/form-ui";
import { ESTADO_LABEL, type EstadoProceso } from "@/lib/procesos";
import { getTipos, listProcesos, type ProcesoListItem } from "@/lib/procesos-api";
import { errorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { RolEmpresaGuard } from "@/components/rol-empresa-guard";

const hoyISO = () => new Date().toISOString().slice(0, 10);

// Presentación del vencimiento de una fila (igual que en /procesos): fecha + color.
function venceUI(item: ProcesoListItem): { fecha: string; sub: string | null; cls: string } {
  if (!item.fechaLimite) return { fecha: "—", sub: null, cls: "text-slate-400" };
  const fecha = new Date(item.fechaLimite).toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
  const esHoy = item.fechaLimite.slice(0, 10) === hoyISO();
  if (item.semaforo === "vencido") return { fecha, sub: "vencido", cls: "text-rose-600 dark:text-rose-400 font-medium" };
  if (esHoy) return { fecha, sub: "vence hoy", cls: "text-rose-600 dark:text-rose-400 font-medium" };
  if (item.semaforo === "por_vencer") return { fecha, sub: "por vencer", cls: "text-amber-600 dark:text-amber-400 font-medium" };
  return { fecha, sub: null, cls: "text-slate-600 dark:text-slate-300" };
}

const grupoUrgencia = (i: ProcesoListItem) =>
  i.estado === "CERRADO" || i.estado === "ARCHIVADO" ? 2 : i.fechaLimite ? 0 : 1;

export default function DerechoPeticionPage() {
  const router = useRouter();
  const [items, setItems] = useState<ProcesoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  // Ids de los dos TipoProceso de DdP: el que se envía (solicitar, "el actual") y
  // el que se recibe. Una petición se crea eligiendo modalidad → tipo correspondiente.
  const [tipoSolicitar, setTipoSolicitar] = useState<string | null>(null);
  const [tipoRecibir, setTipoRecibir] = useState<string | null>(null);
  const [modalNueva, setModalNueva] = useState(false);

  useEffect(() => {
    getTipos()
      .then((ts) => {
        setTipoSolicitar(ts.find((t) => t.nombre === "Derecho de Petición")?.id ?? null);
        setTipoRecibir(ts.find((t) => t.nombre === "Derecho de Petición Recibido")?.id ?? null);
      })
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
      // Solo peticiones (trámite ante entidad). El detalle vive en /procesos/[id]
      // (motor genérico compartido); aquí solo cambia el listado y la creación.
      .then((r) => setItems(r.items.filter((i) => !i.esJudicial)))
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
  const hayTipos = !!(tipoSolicitar || tipoRecibir);

  return (
    <RolEmpresaGuard roles={["JURIDICO"]}>
      <div>
        <PageHeader
          title="Derecho de Petición"
          subtitle="Peticiones ante entidades de tu despacho."
          action={
            <div className="flex gap-2">
              <Link href="/peticiones">
                <Button variant="ghost">← Peticiones</Button>
              </Link>
              {puedeEditar && hayTipos && (
                <Button onClick={() => setModalNueva(true)}>
                  <PlusIcon /> Nueva petición
                </Button>
              )}
            </div>
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
          <EmptyState
            title="No hay peticiones"
            description="Crea tu primer derecho de petición para empezar."
            action={
              puedeEditar && hayTipos ? (
                <Button onClick={() => setModalNueva(true)}>
                  <PlusIcon /> Nueva petición
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3 font-medium">Petición</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Etapa</th>
                  <th className="px-5 py-3 font-medium">Vence</th>
                  <th className="px-5 py-3 font-medium">Responsable</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((t) => {
                  const v = venceUI(t);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/procesos/${t.id}`)}
                      className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-5 py-3 align-top">
                        <div className="font-medium text-indigo-600 group-hover:underline dark:text-indigo-400">{t.titulo}</div>
                        <div className="text-xs text-slate-500">
                          {t.tipoProcesoNombre} · {t.codigoInterno}
                          {t.radicado && ` · Rad. ${t.radicado}`}
                        </div>
                        {(t.casoRelacionadoId || t.tieneDerivados) && (
                          t.casoRelacionadoId ? (
                            <Link
                              href={`/procesos/${t.casoRelacionadoId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                            >
                              ↗ parte de un caso (ver base)
                            </Link>
                          ) : (
                            <span className="mt-0.5 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                              caso con derivados
                            </span>
                          )
                        )}
                      </td>
                      <td className="px-5 py-3 align-top text-slate-700 dark:text-slate-200">
                        {t.clienteNombre ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3 align-top text-slate-600 dark:text-slate-300">{t.etapaNombre}</td>
                      <td className={`px-5 py-3 align-top text-xs ${v.cls}`}>
                        {v.fecha}
                        {v.sub && <div className="text-[11px] font-normal">{v.sub}</div>}
                      </td>
                      <td className="px-5 py-3 align-top text-slate-600 dark:text-slate-300">
                        {t.responsableNombre ?? <span className="text-slate-400">Sin asignar</span>}
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

        <Modal open={modalNueva} onClose={() => setModalNueva(false)} title="Nueva petición">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ¿Esta petición la envías a una entidad, o la recibes y debes responderla?
          </p>
          {tipoSolicitar && (
            <SelectableCard
              title="La envío (solicitud)"
              subtitle="Tú o tu cliente presentan la petición ante una entidad y esperan respuesta."
              onClick={() => router.push(`/procesos/nuevo?tipo=${tipoSolicitar}`)}
            />
          )}
          {tipoRecibir && (
            <SelectableCard
              title="La recibo (respuesta)"
              subtitle="Tu cliente recibió una petición y debe responderla dentro del término legal."
              onClick={() => router.push(`/procesos/nuevo?tipo=${tipoRecibir}`)}
            />
          )}
        </Modal>
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
