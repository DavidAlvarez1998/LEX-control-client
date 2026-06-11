"use client";

// Muestra EN VIVO la fecha de vencimiento que tendría el proceso con los datos
// actuales (p. ej. derecho de petición: fecha de radicación + 15/10/30 días
// hábiles según el tipo). El cálculo de días hábiles vive en el backend, así que
// se consulta con un pequeño endpoint (debounced). No renderiza nada si aún no
// hay datos suficientes para un vencimiento.

import { useEffect, useState } from "react";
import { calcularVencimiento } from "@/lib/procesos-api";

export function VencimientoHint({
  tipoProcesoId,
  datos,
}: {
  tipoProcesoId: string;
  datos: Record<string, unknown>;
}) {
  const [venc, setVenc] = useState<{ fechaLimite: string | null; dias: number | null; tipoDias: string | null } | null>(null);
  const key = JSON.stringify(datos); // dep estable (evita refetch por identidad de objeto)

  useEffect(() => {
    let cancel = false;
    const t = setTimeout(() => {
      calcularVencimiento(tipoProcesoId, JSON.parse(key))
        .then((r) => { if (!cancel) setVenc(r); })
        .catch(() => { if (!cancel) setVenc(null); });
    }, 350);
    return () => { cancel = true; clearTimeout(t); };
  }, [tipoProcesoId, key]);

  if (!venc?.fechaLimite) return null;
  const fmt = new Date(venc.fechaLimite).toLocaleDateString("es-CO", {
    day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
  });
  const unidad = venc.tipoDias === "calendario" ? "días calendario" : "días hábiles";
  const detalle = venc.dias != null ? ` (${venc.dias} ${unidad})` : "";
  return (
    <p className="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
      ⏱ Vence el {fmt}{detalle}.
    </p>
  );
}
