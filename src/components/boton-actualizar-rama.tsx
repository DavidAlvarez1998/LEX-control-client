"use client";

// COMPONENTE CANÓNICO de "Actualizar con la Rama" (P16). Encapsula el botón, el estado
// de sincronización y el RESUMEN ACCIONABLE del resultado. Se reutiliza en TODAS las
// vistas de procesos (Jurisdicción/nivel-3, Todos, Míos) y debe ser el único lugar que
// presente el resultado de la sincronización masiva on-demand.
//
// Regla de arquitectura: el resultado de sincronizar con la Rama NUNCA se muestra como
// el toast plano "N con error". Siempre se agrupa por bucket de USUARIO (separando lo
// que NO es error —no publicado/reservado— de las dos causas reales: dato vs fuente) y
// se deja accionar (link a la ficha para arreglar radicados, "Reintentar" para la
// fuente caída). Cualquier nueva vista/jurisdicción reutiliza ESTE componente.
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui";
import { sincronizarMisProcesos, type ItemSyncMis, type SyncMisResp } from "@/lib/procesos-api";

/** Botón + panel de resultado. `onSynced` se llama tras cada sincronización OK para que
 *  la vista recargue la lista (las novedades/estado pudieron cambiar). */
export function BotonActualizarRama({ onSynced }: { onSynced?: () => void }) {
  const [sincronizando, setSincronizando] = useState(false);
  const [resp, setResp] = useState<SyncMisResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Sin args = los pendientes (ventana de 6 h); con `procesoIds` = reintento dirigido
  // (los que fallaron por fuente no disponible).
  async function sincronizar(procesoIds?: string[]) {
    setSincronizando(true);
    setErr(null);
    try {
      const r = await sincronizarMisProcesos(procesoIds);
      setResp(r);
      onSynced?.();
    } catch {
      setErr("No se pudo conectar para sincronizar. Intenta más tarde.");
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <>
      <button
        onClick={() => sincronizar()}
        disabled={sincronizando}
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-hover disabled:opacity-50"
      >
        {sincronizando ? "Sincronizando…" : "↻ Actualizar con la Rama"}
      </button>
      {/* basis-full + order-last: dentro del toolbar (flex flex-wrap) el panel se va a
          su propia fila al final, sin importar qué otros filtros tenga la vista. */}
      {(err || resp) && (
        <div className="order-last basis-full">
          {err && (
            <Card className="border-amber-200 bg-amber-50 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              {err}
            </Card>
          )}
          {resp && (
            <ResumenSync
              resp={resp}
              sincronizando={sincronizando}
              onReintentar={(ids) => sincronizar(ids)}
              onCerrar={() => setResp(null)}
            />
          )}
        </div>
      )}
    </>
  );
}

/** Resumen del resultado: chips por bucket de usuario + drill-down accionable de los
 *  que necesitan atención (radicado a revisar / fuente caída a reintentar). */
function ResumenSync({
  resp, sincronizando, onReintentar, onCerrar,
}: {
  resp: SyncMisResp;
  sincronizando: boolean;
  onReintentar: (procesoIds: string[]) => void;
  onCerrar: () => void;
}) {
  const por = (rs: ItemSyncMis["resultado"][]) => resp.resultados.filter((r) => rs.includes(r.resultado));
  const actualizados = por(["ACTUALIZADO"]);
  const alDia = por(["SIN_NOVEDAD"]).length;
  const noPublicados = por(["NO_PUBLICADO", "RESERVADO"]).length;
  const invalidos = por(["RADICADO_INVALIDO"]);
  const fuente = por(["FUENTE_NO_DISPONIBLE"]);

  const chips: { label: string; n: number; cls: string }[] = [
    { label: "Actualizados", n: actualizados.length, cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
    { label: "Al día", n: alDia, cls: "bg-hover text-muted" },
    { label: "No publicados en la Rama", n: noPublicados, cls: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
    { label: "No se pudieron consultar", n: invalidos.length + fuente.length, cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  ].filter((c) => c.n > 0);

  const nombre = (r: ItemSyncMis) => r.titulo || r.radicado || "Proceso";

  return (
    <Card className="mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {resp.procesos === 0 ? "No hay procesos con radicado para consultar." : `${resp.procesos} consultado(s):`}
          </span>
          {chips.map((c) => (
            <span key={c.label} className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.cls}`}>
              {c.label}: {c.n}
            </span>
          ))}
        </div>
        <button onClick={onCerrar} className="shrink-0 text-muted hover:text-foreground" aria-label="Cerrar">✕</button>
      </div>

      {actualizados.length > 0 && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Con novedades de la Rama ({actualizados.length}) — revisá las nuevas actuaciones.
          </p>
          <ul className="mt-2 space-y-1">
            {actualizados.map((r) => (
              <li key={r.procesoId} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-foreground">{nombre(r)}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {r.radicado && <code className="rounded bg-hover px-1.5 py-0.5 text-xs text-muted">{r.radicado}</code>}
                  <Link href={`/procesos/${r.procesoId}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    Ver novedades
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {invalidos.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Revisá el radicado ({invalidos.length}) — debe tener 23 dígitos.
          </p>
          <ul className="mt-2 space-y-1">
            {invalidos.map((r) => (
              <li key={r.procesoId} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-foreground">{nombre(r)}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <code className="rounded bg-hover px-1.5 py-0.5 text-xs text-muted">{r.radicado || "—"}</code>
                  <Link href={`/procesos/${r.procesoId}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    Abrir ficha
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fuente.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              La Rama no respondió ({fuente.length}) — suele ser temporal.
            </p>
            <button
              onClick={() => onReintentar(fuente.map((r) => r.procesoId))}
              disabled={sincronizando}
              className="shrink-0 rounded-lg border border-amber-300 px-3 py-1 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/15"
            >
              {sincronizando ? "Reintentando…" : "↻ Reintentar"}
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {fuente.map((r) => (
              <li key={r.procesoId} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-foreground">{nombre(r)}</span>
                <Link href={`/procesos/${r.procesoId}`} className="shrink-0 font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  Abrir ficha
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
