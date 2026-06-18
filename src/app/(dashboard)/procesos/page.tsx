"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, EmptyState, PageHeader, PlusIcon } from "@/components/ui";
import { vtName } from "@/lib/view-transition";
import { Input, Select } from "@/components/form-ui";
import {
  ESTADO_LABEL,
  JURISDICCION_LABEL,
  type AreaPractica,
  type EstadoProceso,
  type Jurisdiccion,
  type TipoProceso,
} from "@/lib/procesos";
import { getAreas, getTipos, listProcesos, type ProcesoListItem } from "@/lib/procesos-api";
import { errorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { RolEmpresaGuard } from "@/components/rol-empresa-guard";
import { VencimientosBanner } from "@/components/vencimientos-banner";

// Mapa label → enum para los filtros (los Select muestran etiquetas legibles).
const ESTADO_POR_LABEL = Object.fromEntries(
  Object.entries(ESTADO_LABEL).map(([k, v]) => [v, k]),
) as Record<string, EstadoProceso>;

// Orden de las tarjetas de jurisdicción en la landing de Procesos.
const JURISDICCIONES = Object.keys(JURISDICCION_LABEL) as Jurisdiccion[];

// Etiqueta sin el prefijo "Jurisdicción " (p. ej. "Ordinaria · Civil").
const sinJurisdiccion = (s: string) => s.replace(/^Jurisdicción\s+/i, "");

// Nombre de tipo sin el prefijo "Proceso " (p. ej. "Ejecutivo (singular o mixto)").
const sinPrefijoProceso = (s: string) => {
  const r = s.replace(/^Proceso\s+/i, "");
  return r !== s ? r.charAt(0).toUpperCase() + r.slice(1) : s;
};

// Vista "Sección": agrupa el nivel 1 por `grupo` (las viejas pestañas). Orden + etiqueta.
const GRUPOS = ["PETICION", "CONSTITUCIONAL", "LABORAL", "JUDICIAL"] as const;
const GRUPO_LABEL: Record<string, string> = {
  PETICION: "Peticiones",
  CONSTITUCIONAL: "Acciones Constitucionales",
  LABORAL: "Procesos Laborales",
  JUDICIAL: "Procesos judiciales",
};

// ¿El tipo ya fue curado contra su procedimiento real? Si la API aún no manda el
// flag (transición), cae al criterio viejo (no-judicial = curado); con flag, manda él.
const esCurado = (t: { actualizado?: boolean; grupo: string }) =>
  t.actualizado === undefined ? t.grupo !== "JUDICIAL" : t.actualizado;

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

function ProcesosInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Jurisdicción seleccionada (query param): sin ella, Procesos muestra las
  // tarjetas de jurisdicción; con ella, la lista de esa jurisdicción.
  const jurSel = searchParams.get("jurisdiccion");
  const tipoSel = searchParams.get("tipo");
  // Vista del nivel 1: por jurisdicción (default) o por sección (grupo = vieja pestaña).
  const vista = searchParams.get("vista") === "seccion" ? "seccion" : "jurisdiccion";
  const grupoSel = searchParams.get("grupo");
  const [areas, setAreas] = useState<AreaPractica[]>([]);
  const [tipos, setTipos] = useState<TipoProceso[]>([]);
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
    getTipos().then(setTipos).catch(() => {});
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

  // Tipo seleccionado (nivel 3): el objeto del catálogo cuyo id viene en ?tipo.
  const tipoSelObj = useMemo(() => tipos.find((t) => t.id === tipoSel), [tipos, tipoSel]);

  // Procesos del tipo elegido (nivel 3): se filtran por nombre de tipo, que es lo
  // único que trae el proceso en el listado.
  const ordenados = useMemo(() => {
    return [...items].filter((i) => i.tipoProcesoNombre === tipoSelObj?.nombre).sort((a, b) => {
      const ga = grupoUrgencia(a), gb = grupoUrgencia(b);
      if (ga !== gb) return ga - gb;
      if (ga === 0) return (a.fechaLimite ?? "").localeCompare(b.fechaLimite ?? "");
      return 0;
    });
  }, [items, tipoSelObj]);

  // Conteos: TIPOS por jurisdicción (nivel 1) y PROCESOS por tipo (nivel 2).
  const conteoTiposPorJur = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tipos) m[t.jurisdiccion] = (m[t.jurisdiccion] ?? 0) + 1;
    return m;
  }, [tipos]);
  const conteoPorTipo = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of items) m[i.tipoProcesoNombre] = (m[i.tipoProcesoNombre] ?? 0) + 1;
    return m;
  }, [items]);
  const conteoTiposPorGrupo = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tipos) {
      // Un tipo judicial ya curado "se gradúa": sale del bucket genérico "Procesos judiciales".
      if (t.grupo === "JUDICIAL" && esCurado(t)) continue;
      m[t.grupo] = (m[t.grupo] ?? 0) + 1;
    }
    return m;
  }, [tipos]);
  // Tipos del nodo de nivel 1 abierto (por jurisdicción o por grupo según la vista).
  // En la vista Sección, "Procesos judiciales" excluye los ya curados (se graduaron).
  const tiposDeNivel1 = useMemo(
    () =>
      tipos.filter((t) =>
        vista === "seccion"
          ? t.grupo === grupoSel && !(t.grupo === "JUDICIAL" && esCurado(t))
          : t.jurisdiccion === jurSel,
      ),
    [tipos, vista, grupoSel, jurSel],
  );

  const responsableOpciones = Array.from(responsablesRef.current.entries()).map(([id, nombre]) => ({ id, nombre }));
  const nombreResponsable = (id: string) => responsablesRef.current.get(id) ?? "";

  // El COMERCIAL ve los procesos de sus clientes en SOLO LECTURA; crear/editar es
  // de JURIDICO (o admin de empresa). La API es la autoridad real (403 en escritura).
  const u = getUser();
  const puedeEditar = !!u?.esAdminEmpresa || (u?.roles ?? []).includes("JURIDICO");

  const accionNuevo = puedeEditar ? (
    <Link href="/procesos/nuevo">
      <Button>
        <PlusIcon /> Nuevo proceso
      </Button>
    </Link>
  ) : undefined;

  // Toggle de vista (arriba a la derecha): agrupar por Jurisdicción ↔ por Sección.
  const toggleVista = (
    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-700">
      <Link
        href="/procesos"
        className={`rounded-md px-3 py-1.5 font-medium ${vista === "jurisdiccion" ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"}`}
      >
        Jurisdicción
      </Link>
      <Link
        href="/procesos?vista=seccion"
        className={`rounded-md px-3 py-1.5 font-medium ${vista === "seccion" ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"}`}
      >
        Sección
      </Link>
    </div>
  );

  // Nodo de nivel 1 abierto: una jurisdicción o un grupo, según la vista.
  const nivel1Sel = vista === "seccion" ? grupoSel : jurSel;

  // ── NIVEL 1: tarjetas de jurisdicción o de sección (según la vista) ──
  if (!nivel1Sel) {
    const tarjetas =
      vista === "seccion"
        ? GRUPOS.map((g) => ({ key: g as string, label: GRUPO_LABEL[g], n: conteoTiposPorGrupo[g] ?? 0, href: `/procesos?vista=seccion&grupo=${g}` }))
        : JURISDICCIONES.map((j) => ({ key: j as string, label: sinJurisdiccion(JURISDICCION_LABEL[j]), n: conteoTiposPorJur[j] ?? 0, href: `/procesos?jurisdiccion=${j}` }));
    return (
      <RolEmpresaGuard roles={["JURIDICO"]}>
        <div>
          <PageHeader
            title="Procesos"
            subtitle={vista === "seccion" ? "Elige una sección para ver sus procesos." : "Elige una jurisdicción para ver sus procesos."}
            action={
              <div className="flex items-center gap-2">
                {toggleVista}
                {accionNuevo}
              </div>
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tarjetas.map((c) => (
              <Link
                key={c.key}
                href={c.href}
                className="lex-card group rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="font-medium text-slate-800 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">
                  {c.label}
                </div>
                <div className="mt-1 h-5 text-sm text-slate-500">
                  {tipos.length === 0 ? "" : `${c.n} ${c.n === 1 ? "tipo" : "tipos"}`}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </RolEmpresaGuard>
    );
  }

  // Etiqueta y enlaces del nodo de nivel 1 abierto (jurisdicción o sección).
  const nivel1Label =
    vista === "seccion"
      ? GRUPO_LABEL[nivel1Sel] ?? "Procesos"
      : JURISDICCION_LABEL[nivel1Sel as Jurisdiccion]
        ? sinJurisdiccion(JURISDICCION_LABEL[nivel1Sel as Jurisdiccion])
        : "Procesos";
  const hrefNivel1 = vista === "seccion" ? "/procesos?vista=seccion" : "/procesos";
  const hrefNivel2 = vista === "seccion" ? `/procesos?vista=seccion&grupo=${nivel1Sel}` : `/procesos?jurisdiccion=${nivel1Sel}`;
  const hrefTipo = (id: string) =>
    vista === "seccion" ? `/procesos?vista=seccion&grupo=${nivel1Sel}&tipo=${id}` : `/procesos?jurisdiccion=${nivel1Sel}&tipo=${id}`;

  // ── NIVEL 2: tarjetas de cada tipo del nodo elegido ──
  if (!tipoSel) {
    return (
      <RolEmpresaGuard roles={["JURIDICO"]}>
        <div>
          <Link
            href={hrefNivel1}
            className="mb-3 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            ← {vista === "seccion" ? "Secciones" : "Jurisdicciones"}
          </Link>
          <PageHeader title={nivel1Label} subtitle="Elige un tipo de proceso." action={accionNuevo} />
          {tiposDeNivel1.length === 0 ? (
            <Card className="text-sm text-slate-500">No hay tipos de proceso aquí.</Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tiposDeNivel1.map((t) => {
                const n = conteoPorTipo[t.nombre] ?? 0;
                // Tipos aún sin curar → tarjeta en tono gris + badge "No actualizado".
                const noActualizado = !esCurado(t);
                return (
                  <Link
                    key={t.id}
                    href={hrefTipo(t.id)}
                    className={`lex-card group rounded-xl border p-5 ${
                      noActualizado
                        ? "border-slate-200 bg-slate-100 dark:border-slate-700/60 dark:bg-slate-800/40"
                        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 ${
                          noActualizado
                            ? "text-slate-500 dark:text-slate-400"
                            : "text-slate-800 dark:text-slate-100"
                        }`}
                      >
                        {sinPrefijoProceso(t.nombre)}
                      </div>
                      {noActualizado && (
                        <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-600 dark:text-slate-400">
                          No actualizado
                        </span>
                      )}
                    </div>
                    <div className="mt-1 h-5 text-sm text-slate-400">
                      {loading ? "" : `${n} ${n === 1 ? "proceso" : "procesos"}`}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </RolEmpresaGuard>
    );
  }

  // ── NIVEL 3: procesos del tipo elegido ──
  return (
    <RolEmpresaGuard roles={["JURIDICO"]}>
      <div>
      <Link
        href={hrefNivel2}
        className="mb-3 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        ← {nivel1Label}
      </Link>
      <PageHeader
        title={tipoSelObj ? sinPrefijoProceso(tipoSelObj.nombre) : "Procesos"}
        subtitle={puedeEditar ? "Procesos legales de tu despacho." : "Procesos de tus clientes (solo lectura)."}
        action={
          puedeEditar ? (
            <Link href={`/procesos/nuevo?tipo=${tipoSel}`}>
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
              <Link href={`/procesos/nuevo?tipo=${tipoSel}`}>
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
            <thead className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-600">
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
                  className="group cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-200 dark:border-slate-600 dark:hover:bg-slate-600/50"
                >
                  <td className="px-5 py-3 align-top">
                    <div className="font-medium text-indigo-600 group-hover:underline dark:text-indigo-400" style={{ viewTransitionName: vtName("proceso-titulo", t.id) }}>{t.titulo}</div>
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

export default function ProcesosPage() {
  return (
    <Suspense fallback={<Card className="text-sm text-slate-500">Cargando…</Card>}>
      <ProcesosInner />
    </Suspense>
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
