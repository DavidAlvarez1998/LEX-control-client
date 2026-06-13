"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, EmptyState, PageHeader, PlusIcon } from "@/components/ui";
import { Input, Select } from "@/components/form-ui";
import {
  ESTADO_LABEL,
  JURISDICCION_LABEL,
  type AreaPractica,
  type EstadoProceso,
} from "@/lib/procesos";
import { getAreas, listProcesos, type ProcesoListItem } from "@/lib/procesos-api";
import { errorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { RolEmpresaGuard } from "@/components/rol-empresa-guard";
import { VencimientosBanner } from "@/components/vencimientos-banner";

// Mapa label → enum para los filtros (los Select muestran etiquetas legibles).
const ESTADO_POR_LABEL = Object.fromEntries(
  Object.entries(ESTADO_LABEL).map(([k, v]) => [v, k]),
) as Record<string, EstadoProceso>;

const hoyISO = () => new Date().toISOString().slice(0, 10);

/** Presentación del vencimiento de una fila: fecha + color + etiqueta de urgencia.
 *  "Vence hoy" se deriva aquí (fechaLimite === hoy); el semáforo viene de la API. */
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

// Orden por urgencia: abiertos con fecha (más próximo/vencido primero) → abiertos
// sin fecha → cerrados/archivados. Las fechas ISO comparan cronológicamente.
const grupoUrgencia = (i: ProcesoListItem) =>
  i.estado === "CERRADO" || i.estado === "ARCHIVADO" ? 2 : i.fechaLimite ? 0 : 1;

export default function ProcesosPage() {
  const router = useRouter();
  const [areas, setAreas] = useState<AreaPractica[]>([]);
  const [items, setItems] = useState<ProcesoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areaNombre, setAreaNombre] = useState("");
  const [estadoLabel, setEstadoLabel] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [responsableId, setResponsableId] = useState("");
  // Opciones de responsable: se acumulan de los procesos vistos (no hay endpoint
  // de equipo accesible a JURIDICO). Una vez visto, el responsable queda en el filtro.
  const responsablesRef = useRef<Map<string, string>>(new Map());
  const [, forceTick] = useState(0);

  useEffect(() => {
    getAreas().then(setAreas).catch(() => {});
  }, []);

  // Debounce de la búsqueda.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const area = areas.find((a) => a.nombre === areaNombre)?.slug;
    const estado = estadoLabel ? ESTADO_POR_LABEL[estadoLabel] : undefined;
    listProcesos({ area, estado, q: q || undefined, responsableId: responsableId || undefined })
      .then((r) => {
        setItems(r.items);
        let nuevo = false;
        for (const it of r.items) {
          if (it.responsableId && it.responsableNombre && !responsablesRef.current.has(it.responsableId)) {
            responsablesRef.current.set(it.responsableId, it.responsableNombre);
            nuevo = true;
          }
        }
        if (nuevo) forceTick((n) => n + 1);
      })
      .catch((e) => setError(errorMessage(e, "Error al cargar")))
      .finally(() => setLoading(false));
  }, [areas, areaNombre, estadoLabel, q, responsableId]);

  const nombreArea = useMemo(
    () => (slug: string | null) => areas.find((a) => a.slug === slug)?.nombre ?? slug ?? "—",
    [areas],
  );

  const ordenados = useMemo(() => {
    // Procesos = solo la sección judicial. Peticiones y Acciones Constitucionales
    // viven en sus propias secciones.
    return [...items].filter((i) => i.grupo === "JUDICIAL").sort((a, b) => {
      const ga = grupoUrgencia(a), gb = grupoUrgencia(b);
      if (ga !== gb) return ga - gb;
      if (ga === 0) return (a.fechaLimite ?? "").localeCompare(b.fechaLimite ?? "");
      return 0;
    });
  }, [items]);

  const responsableOpciones = Array.from(responsablesRef.current.entries()).map(([id, nombre]) => ({ id, nombre }));
  const nombreResponsable = (id: string) => responsablesRef.current.get(id) ?? "";

  // El COMERCIAL ve los procesos de sus clientes en SOLO LECTURA; crear/editar es
  // de JURIDICO (o admin de empresa). La API es la autoridad real (403 en escritura).
  const u = getUser();
  const puedeEditar = !!u?.esAdminEmpresa || (u?.roles ?? []).includes("JURIDICO");

  return (
    <RolEmpresaGuard roles={["JURIDICO", "COMERCIAL"]}>
      <div>
      <PageHeader
        title="Procesos"
        subtitle={puedeEditar ? "Procesos legales de tu despacho." : "Procesos de tus clientes (solo lectura)."}
        action={
          puedeEditar ? (
            <Link href="/procesos/nuevo">
              <Button>
                <PlusIcon /> Nuevo proceso
              </Button>
            </Link>
          ) : undefined
        }
      />

      <VencimientosBanner />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-64">
          <Input value={qInput} onChange={setQInput} placeholder="Buscar por código, título, cliente o radicado…" />
        </div>
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
        {responsableOpciones.length > 0 && (
          <div className="w-52">
            <Select
              value={responsableId ? nombreResponsable(responsableId) : ""}
              onChange={(nombre) => {
                const found = responsableOpciones.find((r) => r.nombre === nombre);
                setResponsableId(found?.id ?? "");
              }}
              opciones={responsableOpciones.map((r) => r.nombre)}
              placeholder="Todos los responsables"
            />
          </div>
        )}
      </div>

      {loading ? (
        <Card className="text-sm text-slate-500">Cargando…</Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>
      ) : ordenados.length === 0 ? (
        <EmptyState
          title="No hay procesos"
          description={puedeEditar ? "Crea tu primer proceso para empezar a gestionar un proceso legal." : "Aún no hay procesos de tus clientes."}
          action={
            puedeEditar ? (
              <Link href="/procesos/nuevo">
                <Button>
                  <PlusIcon /> Nuevo proceso
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3 font-medium">Proceso</th>
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
                      {t.tipoProcesoNombre} · {nombreArea(t.areaSlug)} · {t.codigoInterno}
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
                  <td className="px-5 py-3 align-top text-slate-600 dark:text-slate-300">
                    {t.etapaNombre}
                  </td>
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
