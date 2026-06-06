"use client";

// Piezas compartidas por las pestañas del módulo Contable: tabla genérica,
// badge de estado con tonos, tarjeta de sección, y un hook de carga de listas.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/format";

/** Dinero para mostrar: null/"" -> "—", si no "$1.000.000". */
export const money = (v: string | number | null | undefined): string =>
  v == null || v === "" ? "—" : `$${formatMoney(v)}`;

/** Fecha ISO -> corta local, o "—" si falta. */
export const fmtFecha = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString() : "—";

/** Día de hoy en formato yyyy-mm-dd (para <input type="date">). */
export const hoyISO = (): string => new Date().toISOString().slice(0, 10);

/** Etiqueta legible para un valor de enum SCREAMING_SNAKE. */
export const humaniza = (s: string): string =>
  s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

type Tone = "verde" | "ambar" | "rojo" | "gris" | "azul";
const TONOS: Record<Tone, string> = {
  verde: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  ambar: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  rojo: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  gris: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  azul: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
};

/** Mapea estados conocidos a un tono; default gris. */
const TONO_ESTADO: Record<string, Tone> = {
  PAGADO: "verde", AL_DIA: "verde", ACTIVA: "verde",
  PARCIAL: "ambar", PENDIENTE: "ambar", CONCILIACION_PENDIENTE: "ambar",
  VENCIDO: "rojo",
  INACTIVA: "gris", CERRADA: "gris",
};

export function Badge({ children, tone }: { children: string; tone?: Tone }) {
  const t = tone ?? TONO_ESTADO[children] ?? "gris";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TONOS[t]}`}>{humaniza(children)}</span>;
}

/** Tarjeta de sección con cabecera (título + acción opcional) y cuerpo. */
export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Una columna de la tabla: encabezado + cómo renderizar la celda de cada fila. */
export type Col<T> = { h: string; cell: (fila: T) => ReactNode; right?: boolean };

/** Tabla genérica definida por columnas (cada celda es un ReactNode con su key). */
export function Tabla<T extends { id?: string }>({
  cols,
  filas,
  vacio,
}: {
  cols: Col<T>[];
  filas: T[];
  vacio: string;
}) {
  if (filas.length === 0)
    return <p className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">{vacio}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-slate-500 dark:text-slate-400">
          <tr>
            {cols.map((c) => (
              <th key={c.h} className={`px-5 py-2 font-medium whitespace-nowrap ${c.right ? "text-right" : ""}`}>{c.h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={f.id ?? i} className="border-t border-slate-100 dark:border-slate-800">
              {cols.map((c) => (
                <td key={c.h} className={`px-5 py-2 text-slate-600 dark:text-slate-300 ${c.right ? "text-right" : ""}`}>{c.cell(f)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Carga una lista con estado loading/error y un recargar() estable. */
export function useCargar<T>(fetcher: () => Promise<T>) {
  const ref = useRef(fetcher);
  useEffect(() => { ref.current = fetcher; });
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await ref.current());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { recargar(); }, [recargar]);
  return { data, loading, error, recargar };
}

/** Banda de error reintentar / banda de aviso. */
export function Banda({ tone, children, onRetry }: { tone: "rojo" | "verde"; children: ReactNode; onRetry?: () => void }) {
  const cls = tone === "rojo"
    ? "border-red-200 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
    : "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300";
  return (
    <Card className={`mb-4 text-sm ${cls}`}>
      {children}
      {onRetry && <button onClick={onRetry} className="ml-2 font-medium underline">reintentar</button>}
    </Card>
  );
}
