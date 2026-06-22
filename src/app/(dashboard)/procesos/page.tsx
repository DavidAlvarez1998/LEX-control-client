"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, EmptyState, PageHeader, PlusIcon } from "@/components/ui";
import { vtName } from "@/lib/view-transition";
import { Input, Select } from "@/components/form-ui";
import {
  esCurado,
  ESTADO_LABEL,
  JURISDICCION_LABEL,
  type AreaPractica,
  type CategoriaProceso,
  type EstadoProceso,
  type Jurisdiccion,
  type TipoProceso,
} from "@/lib/procesos";
import { getAreas, getCategorias, getTipos, listProcesos, type ProcesoListItem } from "@/lib/procesos-api";
import { errorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { RolEmpresaGuard } from "@/components/rol-empresa-guard";
import { VencimientosBanner } from "@/components/vencimientos-banner";

/**
 * Botón "Nuevo proceso" que despliega dos modos: **Avanzado** (el formulario
 * completo con etapas y flujo, lo único disponible hoy → navega a `href`) y
 * **Sencillo** (aún no implementado: queda visible como "Pendiente", sin acción).
 * Se usa en la landing (a nivel de jurisdicciones) y en la lista de cada tipo.
 */
function NuevoProcesoMenu({ href }: { href: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen((o) => !o)}>
        <PlusIcon /> Nuevo proceso
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <Link href={href} onClick={() => setOpen(false)} className="block px-3 py-2.5 transition-colors hover:bg-hover">
            <div className="text-sm font-medium text-foreground">Avanzado</div>
            <div className="text-xs text-muted">Formulario completo con etapas y flujo</div>
          </Link>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="block w-full cursor-not-allowed border-t border-line px-3 py-2.5 text-left opacity-60"
          >
            <div className="text-sm font-medium text-foreground">
              Sencillo
              <span className="ml-1.5 rounded-full bg-hover px-1.5 py-0.5 text-[10px] font-normal text-muted">Pendiente</span>
            </div>
            <div className="text-xs text-muted">Aún no disponible</div>
          </button>
        </div>
      )}
    </div>
  );
}

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

// Nombre de tipo para mostrar: el `nombreVisual` del catálogo si existe; si no,
// quita el prefijo "Proceso ".
const tipoLabel = (t: TipoProceso) => t.nombreVisual ?? sinPrefijoProceso(t.nombre);

// Bucket sintético para tipos de una jurisdicción que no tienen categoría (no se
// pierden: caen bajo "Otros"). No existe en el catálogo.
const OTROS_CAT = "__otros__";

// Vista "Sección": agrupa el nivel 1 por `grupo` (las viejas pestañas). Orden + etiqueta.
const GRUPOS = ["PETICION", "CONSTITUCIONAL", "LABORAL", "JUDICIAL"] as const;
const GRUPO_LABEL: Record<string, string> = {
  PETICION: "Peticiones",
  CONSTITUCIONAL: "Acciones Constitucionales",
  LABORAL: "Procesos Laborales",
  JUDICIAL: "Procesos judiciales",
};

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
  // Categoría del sub-árbol civil (Declarativo/Ejecutivo/…). Solo aplica a Civil.
  const catSel = searchParams.get("cat");
  const [areas, setAreas] = useState<AreaPractica[]>([]);
  const [categorias, setCategorias] = useState<CategoriaProceso[]>([]);
  const [tipos, setTipos] = useState<TipoProceso[]>([]);
  const [items, setItems] = useState<ProcesoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areaNombre, setAreaNombre] = useState("");
  const [estadoLabel, setEstadoLabel] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [conNovedades, setConNovedades] = useState(false); // P1: solo procesos con novedades del juzgado
  // Opciones de responsable: se acumulan de los procesos vistos (no hay endpoint
  // de equipo accesible a JURIDICO). Una vez visto, el responsable queda en el filtro.
  const responsablesRef = useRef<Map<string, string>>(new Map());
  const [, forceTick] = useState(0);

  useEffect(() => {
    getAreas().then(setAreas).catch(() => {});
    getCategorias().then(setCategorias).catch(() => {});
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
    listProcesos({ area, estado, q: q || undefined, responsableId: responsableId || undefined, conNovedades: conNovedades || undefined })
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
  }, [areas, areaNombre, estadoLabel, q, responsableId, conNovedades]);

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
      // Los JUDICIAL (con o sin curar) viven en "Procesos judiciales": no tienen otra
      // sección a la cual "graduarse" (las familias con sección usan otro `grupo`).
      m[t.grupo] = (m[t.grupo] ?? 0) + 1;
    }
    return m;
  }, [tipos]);
  // Tipos del nodo de nivel 1 abierto (por jurisdicción o por grupo según la vista).
  const tiposDeNivel1 = useMemo(
    () =>
      tipos.filter((t) =>
        vista === "seccion" ? t.grupo === grupoSel : t.jurisdiccion === jurSel,
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
    <NuevoProcesoMenu href="/procesos/nuevo" />
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
                <Link href="/mis-procesos"><Button variant="ghost">Mis procesos</Button></Link>
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
  // El "volver" desde el nivel 3 regresa a la categoría civil cuando hay una (cat).
  const hrefNivel2 =
    vista === "seccion"
      ? `/procesos?vista=seccion&grupo=${nivel1Sel}`
      : catSel
        ? `/procesos?jurisdiccion=${nivel1Sel}&cat=${catSel}`
        : `/procesos?jurisdiccion=${nivel1Sel}`;
  const hrefTipo = (id: string) =>
    vista === "seccion"
      ? `/procesos?vista=seccion&grupo=${nivel1Sel}&tipo=${id}`
      : catSel
        ? `/procesos?jurisdiccion=${nivel1Sel}&cat=${catSel}&tipo=${id}`
        : `/procesos?jurisdiccion=${nivel1Sel}&tipo=${id}`;
  // ── Categorías (clase de proceso) de la jurisdicción abierta ──
  // Data-driven: si la jurisdicción tiene categorías, se inserta el nivel de
  // categoría; si no, lista plana. Aplica a CUALQUIER jurisdicción (sin hardcode).
  const categoriasJur =
    vista === "jurisdiccion" && jurSel ? categorias.filter((c) => c.jurisdiccion === jurSel) : [];
  const usaCategorias = categoriasJur.length > 0;
  const slugsCat = new Set(categoriasJur.map((c) => c.slug));
  // Tipos de la jurisdicción sin categoría conocida → bucket "Otros" (no se pierden).
  const tiposSinCat = tiposDeNivel1.filter((t) => !t.categoriaSlug || !slugsCat.has(t.categoriaSlug));
  const tiposDeCategoria = (slug: string) =>
    slug === OTROS_CAT ? tiposSinCat : tiposDeNivel1.filter((t) => t.categoriaSlug === slug);
  // Categoría seleccionada (?cat=): objeto del catálogo o el bucket sintético "Otros".
  const catObjActual = catSel
    ? catSel === OTROS_CAT
      ? { slug: OTROS_CAT, nombre: "Otros", proximamente: false }
      : categoriasJur.find((c) => c.slug === catSel) ?? null
    : null;
  const nivel2BackLabel = catObjActual?.nombre ?? nivel1Label;

  // Tarjeta de un tipo de proceso (reutilizada en lista plana y hojas de categoría).
  const tipoCard = (t: TipoProceso) => {
    const n = conteoPorTipo[t.nombre] ?? 0;
    // Tipos aún sin curar → tarjeta en tono gris + badge "No actualizado".
    const noActualizado = !esCurado(t);
    return (
      <Link
        key={t.id}
        href={hrefTipo(t.id)}
        className={`lex-card group rounded-xl border border-line p-5 ${noActualizado ? "bg-bg" : "bg-surface"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className={`font-medium group-hover:text-accent ${noActualizado ? "text-muted" : "text-foreground"}`}>
            {tipoLabel(t)}
          </div>
          {noActualizado && (
            <span className="shrink-0 rounded-full bg-hover px-2 py-0.5 text-[11px] font-medium text-muted">
              No actualizado
            </span>
          )}
        </div>
        <div className="mt-1 h-5 text-sm text-muted">
          {loading ? "" : `${n} ${n === 1 ? "proceso" : "procesos"}`}
        </div>
      </Link>
    );
  };

  // ── NIVEL 2: tarjetas de cada tipo del nodo elegido ──
  if (!tipoSel) {
    // ── NIVEL 2.5: tipos de una categoría seleccionada ──
    if (usaCategorias && catObjActual) {
      const hojas = tiposDeCategoria(catObjActual.slug);
      return (
        <RolEmpresaGuard roles={["JURIDICO"]}>
          <div>
            <Link
              href={`/procesos?jurisdiccion=${nivel1Sel}`}
              className="mb-3 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              ← {nivel1Label}
            </Link>
            <PageHeader title={catObjActual.nombre} subtitle="Elige un tipo de proceso." action={accionNuevo} />
            {hojas.length === 0 ? (
              <Card className="text-sm text-muted">
                Próximamente. Aún no hay tipos de proceso configurados en esta categoría.
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{hojas.map(tipoCard)}</div>
            )}
          </div>
        </RolEmpresaGuard>
      );
    }

    // ── NIVEL 2 (con categorías): tarjetas de categoría ──
    if (usaCategorias) {
      const cards = [
        ...categoriasJur.map((c) => ({ slug: c.slug, nombre: c.nombre, proximamente: c.proximamente, n: tiposDeCategoria(c.slug).length })),
        ...(tiposSinCat.length > 0 ? [{ slug: OTROS_CAT, nombre: "Otros", proximamente: false, n: tiposSinCat.length }] : []),
      ];
      return (
        <RolEmpresaGuard roles={["JURIDICO"]}>
          <div>
            <Link
              href={hrefNivel1}
              className="mb-3 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              ← Jurisdicciones
            </Link>
            <PageHeader title={nivel1Label} subtitle="Elige una categoría." action={accionNuevo} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => {
                const vacia = c.proximamente || c.n === 0;
                const contenido = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className={`font-medium ${vacia ? "text-muted" : "text-foreground group-hover:text-accent"}`}>
                        {c.nombre}
                      </div>
                      {c.proximamente && (
                        <span className="shrink-0 rounded-full bg-hover px-2 py-0.5 text-[11px] font-medium text-muted">
                          Próximamente
                        </span>
                      )}
                    </div>
                    <div className="mt-1 h-5 text-sm text-muted">
                      {vacia ? "" : `${c.n} ${c.n === 1 ? "tipo" : "tipos"}`}
                    </div>
                  </>
                );
                return vacia ? (
                  <div key={c.slug} className="rounded-xl border border-line bg-bg p-5 opacity-70">
                    {contenido}
                  </div>
                ) : (
                  <Link
                    key={c.slug}
                    href={`/procesos?jurisdiccion=${nivel1Sel}&cat=${c.slug}`}
                    className="lex-card group rounded-xl border border-line bg-surface p-5"
                  >
                    {contenido}
                  </Link>
                );
              })}
            </div>
          </div>
        </RolEmpresaGuard>
      );
    }

    // ── NIVEL 2 (sin categorías): lista plana de tipos ──
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{tiposDeNivel1.map(tipoCard)}</div>
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
        ← {nivel2BackLabel}
      </Link>
      <PageHeader
        title={tipoSelObj ? tipoLabel(tipoSelObj) : "Procesos"}
        subtitle={puedeEditar ? "Procesos legales de tu despacho." : "Procesos de tus clientes (solo lectura)."}
        action={
          puedeEditar ? (
            <NuevoProcesoMenu href={`/procesos/nuevo?tipo=${tipoSel}`} />
          ) : undefined
        }
      />

      <VencimientosBanner />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* "Míos" = procesos donde soy el responsable (mi usuario). Un clic, sin muro:
            "Todos" sigue mostrando los del despacho. Aplica para admin y JURÍDICO. */}
        {u?.id && (
          <div className="inline-flex rounded-lg border border-line p-0.5 text-sm">
            {[
              { mio: true, label: "Míos" },
              { mio: false, label: "Todos" },
            ].map((o) => {
              const activo = o.mio ? responsableId === u.id : responsableId === "";
              return (
                <button
                  key={o.label}
                  onClick={() => setResponsableId(o.mio ? u.id : "")}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${activo ? "bg-indigo-600 text-white" : "text-muted hover:bg-hover"}`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        )}
        {/* P1 — filtrar a los procesos con actuaciones nuevas del juzgado. */}
        <button
          onClick={() => setConNovedades((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            conNovedades
              ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "border-line text-muted hover:bg-hover"
          }`}
        >
          🟢 Con novedades
        </button>
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
              <NuevoProcesoMenu href={`/procesos/nuevo?tipo=${tipoSel}`} />
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
                    {t.actuacionesNuevas > 0 && (
                      <span className="mt-0.5 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        🟢 {t.actuacionesNuevas} nueva{t.actuacionesNuevas > 1 ? "s" : ""} del juzgado
                      </span>
                    )}
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
      ? "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
      : estado === "EN_PROCESO"
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
        : estado === "SUSPENDIDO"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}
