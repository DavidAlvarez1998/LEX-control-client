"use client";

// Botón "Actualizar con la Rama" reutilizable: aparece cuando el radicado tiene los 23
// dígitos del CPNU y, al hacer clic, consulta la Rama Judicial (validarRadicado) y entrega
// al `onAutollenar` lo encontrado (despacho, fecha de radicación y las partes parseadas de
// `sujetosProcesales`). Cada llamador decide qué campos llenar (en la ficha son campos del
// esquema; en el form de creación son el estado + datos). Solo consulta y rellena: no
// persiste. Informa "reservado" / "aún no publicado" sin bloquear.

import { useState } from "react";
import { Button } from "./ui";
import { validarRadicado } from "@/lib/procesos-api";

export type RamaAutollenado = {
  despacho: string | null;
  fechaProceso: string | null;
  demandante: string | null;
  demandado: string | null;
};

/**
 * Extrae el primer demandante y el primer demandado del string `sujetosProcesales` que
 * publica la Rama, p. ej. "Demandante: FINOVA SAS | Demandado: ELDER JOVANNY GESAMA".
 * Tolerante a tildes/mayúsculas; ignora otros roles (terceros, apoderados).
 */
export function parseSujetosRama(s: string | null): { demandante: string | null; demandado: string | null } {
  if (!s) return { demandante: null, demandado: null };
  let demandante: string | null = null;
  let demandado: string | null = null;
  for (const parte of s.split("|")) {
    const idx = parte.indexOf(":");
    if (idx < 0) continue;
    const rol = parte.slice(0, idx).trim().toLowerCase();
    const nombre = parte.slice(idx + 1).trim();
    if (!nombre) continue;
    if (!demandante && rol.startsWith("demandante")) demandante = nombre;
    else if (!demandado && rol.startsWith("demandado")) demandado = nombre;
  }
  return { demandante, demandado };
}

export function BotonActualizarRadicado({
  radicado,
  onAutollenar,
  className = "mt-1.5 mb-4",
}: {
  radicado: string;
  onAutollenar: (datos: RamaAutollenado) => void;
  className?: string;
}) {
  const [cargando, setCargando] = useState(false);
  const [feedback, setFeedback] = useState<{ texto: string; warn: boolean } | null>(null);
  const digitos = radicado.replace(/\D/g, "").length;
  if (digitos !== 23) return null;

  async function actualizar() {
    setCargando(true);
    setFeedback(null);
    try {
      const r = await validarRadicado(radicado.trim());
      if (r.esPrivado) {
        setFeedback({ texto: "El proceso figura como reservado en la Rama: no publica datos.", warn: true });
      } else if (!r.encontrado) {
        setFeedback({ texto: "El radicado aún no aparece en la Rama (puede tardar días en publicarse).", warn: true });
      } else {
        const { demandante, demandado } = parseSujetosRama(r.sujetosProcesales);
        onAutollenar({ despacho: r.despacho, fechaProceso: r.fechaProceso, demandante, demandado });
        const trajo = [r.despacho ? "juzgado" : null, (demandante || demandado) ? "partes" : null].filter(Boolean).join(" y ");
        setFeedback({ texto: `✓ Datos de la Rama traídos${trajo ? ` (${trajo})` : ""}. Revisa y guarda.`, warn: false });
      }
    } catch {
      setFeedback({ texto: "No se pudo consultar la Rama Judicial. Intenta más tarde.", warn: true });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className={className}>
      <Button variant="ghost" onClick={actualizar} disabled={cargando}>
        {cargando ? "Consultando la Rama…" : "Actualizar con la Rama Judicial"}
      </Button>
      {feedback && (
        <p className={`mt-1 text-xs ${feedback.warn ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {feedback.texto}
        </p>
      )}
    </div>
  );
}
