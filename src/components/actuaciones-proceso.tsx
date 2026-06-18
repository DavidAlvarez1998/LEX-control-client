"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { getActuaciones, sincronizarActuaciones, type Actuacion } from "@/lib/integraciones-api";

/** Fecha ISO → "12 jun 2026" (o "—"). */
function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Actuaciones del juzgado sincronizadas para un proceso (por su radicado).
 * Botón "Actualizar desde el juzgado" → POST sincronizar; lista las actuaciones.
 * Si el proceso no tiene radicado, guía a registrarlo. El botón solo se habilita
 * para quien puede editar (puedeSincronizar).
 */
export function ActuacionesProceso({
  procesoId,
  radicado,
  puedeSincronizar,
}: {
  procesoId: string;
  radicado?: string | null;
  puedeSincronizar: boolean;
}) {
  const [actuaciones, setActuaciones] = useState<Actuacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "info" | "error"; texto: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    getActuaciones(procesoId)
      .then((r) => vivo && setActuaciones(r.actuaciones))
      .catch(() => vivo && setActuaciones([]))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [procesoId]);

  async function sincronizar() {
    setSincronizando(true);
    setMensaje(null);
    try {
      const r = await sincronizarActuaciones(procesoId, true);
      if (r.estado === "SIN_RADICADO") {
        setMensaje({ tipo: "info", texto: "Este proceso no tiene radicado; regístralo para consultar el juzgado." });
      } else if (r.estado === "SIN_PROVEEDOR") {
        setMensaje({ tipo: "info", texto: "Aún no hay un proveedor de consulta judicial configurado para tu despacho." });
      } else if (r.estado === "ERROR") {
        setMensaje({ tipo: "error", texto: r.error ?? "El proveedor no respondió. Intenta más tarde." });
      } else {
        const nuevas = r.itemsNew;
        setMensaje({
          tipo: "ok",
          texto:
            nuevas > 0
              ? `${nuevas} actuación${nuevas === 1 ? "" : "es"} nueva${nuevas === 1 ? "" : "s"} desde ${r.proveedor}.`
              : r.fromCache
                ? "Sin novedades (mostrando lo último sincronizado)."
                : "Sin actuaciones nuevas.",
        });
        const refrescado = await getActuaciones(procesoId);
        setActuaciones(refrescado.actuaciones);
      }
    } catch (err) {
      setMensaje({ tipo: "error", texto: errorMessage(err, "No se pudo sincronizar.") });
    } finally {
      setSincronizando(false);
    }
  }

  const colorMsg =
    mensaje?.tipo === "ok"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
      : mensaje?.tipo === "error"
        ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
        : "bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Actuaciones del juzgado</h3>
        {puedeSincronizar && (
          <Button variant="ghost" onClick={sincronizar} disabled={sincronizando || !radicado}>
            {sincronizando ? "Consultando…" : "Actualizar desde el juzgado"}
          </Button>
        )}
      </div>

      {!radicado && (
        <p className="rounded-md bg-slate-200 px-3 py-2 text-xs text-slate-500 dark:bg-slate-600 dark:text-slate-400">
          Registra el número de radicado para consultar las actuaciones del proceso ante el juzgado.
        </p>
      )}

      {mensaje && <p className={`mb-3 rounded-md px-3 py-2 text-xs ${colorMsg}`}>{mensaje.texto}</p>}

      {cargando ? (
        <p className="text-xs text-slate-400">Cargando…</p>
      ) : actuaciones.length === 0 ? (
        radicado && (
          <p className="text-xs text-slate-400">
            Sin actuaciones sincronizadas. Usa “Actualizar desde el juzgado”.
          </p>
        )
      ) : (
        <ol className="space-y-2">
          {actuaciones.map((a) => (
            <li key={a.id} className="rounded-md border border-slate-100 px-3 py-2 dark:border-slate-600">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.actuacion}</span>
                <span className="shrink-0 text-xs text-slate-400">{fmtFecha(a.fechaActuacion)}</span>
              </div>
              {a.anotacion && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{a.anotacion}</p>}
              <p className="mt-0.5 text-[11px] text-slate-400">{a.fuente}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
