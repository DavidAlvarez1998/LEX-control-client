// Presentación del vencimiento de un proceso: fecha + color + etiqueta de urgencia.
// Compartido por la lista de Procesos (catálogo nivel 3) y las vistas planas
// "Todos"/"Míos". "Vence hoy" se deriva aquí (fechaLimite === hoy); el `semaforo`
// (vencido/por_vencer/al_dia) lo calcula la API.

import type { ProcesoListItem } from "./procesos-api";

const hoyISO = () => new Date().toISOString().slice(0, 10);

// Subconjunto común a ProcesoListItem y VencimientoItem: lo que necesita el mensaje.
type ConPlazo = Pick<
  ProcesoListItem,
  "fechaLimite" | "semaforo" | "etapaNombre" | "plazoEtiqueta" | "plazoDias" | "plazoTipoDias"
>;

const estadoVenc = (item: ConPlazo): string | null => {
  if (!item.fechaLimite) return null;
  if (item.semaforo === "vencido") return "vencido";
  if (item.fechaLimite.slice(0, 10) === hoyISO()) return "vence hoy";
  if (item.semaforo === "por_vencer") return "por vencer";
  return null;
};

/**
 * Mensaje de vencimiento UNIFICADO, igual al de la ficha:
 *   "⏱ Plazo para subsanar: 24 de junio de 2026 (5 días hábiles) — vencido"
 * "qué" = plazoEtiqueta ?? etapaNombre. El detalle "(N días …)" se omite si no se conoce
 * el término estático. Devuelve null si el proceso no tiene fecha límite.
 */
export function vencimientoTexto(
  item: ConPlazo,
): { texto: string; cls: string; estado: string | null } | null {
  if (!item.fechaLimite) return null;
  const fecha = new Date(item.fechaLimite).toLocaleDateString("es-CO", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  const etiqueta = item.plazoEtiqueta || item.etapaNombre;
  const unidad = item.plazoTipoDias === "calendario" ? "días calendario" : "días hábiles";
  const detalle = item.plazoDias != null ? ` (${item.plazoDias} ${unidad})` : "";
  const estado = estadoVenc(item);
  const sufijo = estado ? ` — ${estado}` : "";
  const cls =
    estado === "vencido" || estado === "vence hoy"
      ? "text-rose-600 dark:text-rose-400 font-medium"
      : estado === "por vencer"
        ? "text-amber-600 dark:text-amber-400 font-medium"
        : "text-slate-600 dark:text-slate-300";
  return { texto: `⏱ ${etiqueta}: ${fecha}${detalle}${sufijo}`, cls, estado };
}

export function venceUI(item: ProcesoListItem): { fecha: string; sub: string | null; cls: string } {
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
