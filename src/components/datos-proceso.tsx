"use client";

// Vista + edición del formulario dinámico de un proceso. Permite completar/
// corregir `datos` después de creado (incl. la tutela derivada que nace vacía).
// Guarda contra PATCH /procesos/:id (validación tolerante: borradores incompletos).

import { useState } from "react";
import { Button } from "./ui";
import { FormularioDinamico } from "./formulario-dinamico";
import { ApiError } from "@/lib/api";
import { campoVisible, type CampoEsquema } from "@/lib/procesos";
import { actualizarDatos } from "@/lib/procesos-api";

export function DatosProceso({
  procesoId,
  esquema,
  datos,
  onSaved,
  readOnly = false,
}: {
  procesoId: string;
  esquema: CampoEsquema[];
  datos: Record<string, unknown>;
  onSaved: (datos: Record<string, unknown>) => void;
  readOnly?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Record<string, unknown>>(datos);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const actualizado = await actualizarDatos(procesoId, borrador);
      onSaved(actualizado.datos);
      setEditando(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message ?? "Error al guardar" : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  if (!editando) {
    const visibles = esquema.filter((c) => campoVisible(c, datos));
    return (
      <div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((c) => (
            <div key={c.key}>
              <dt className="text-xs text-slate-400">{c.label}</dt>
              <dd className="mt-0.5 text-slate-700 dark:text-slate-200">{formatValor(datos[c.key])}</dd>
            </div>
          ))}
          {visibles.length === 0 && <p className="text-slate-400">Sin datos aún.</p>}
        </dl>
        {!readOnly && (
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => {
              setBorrador(datos);
              setEditando(true);
            }}
          >
            Editar datos
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      <FormularioDinamico
        esquema={esquema}
        datos={borrador}
        onChange={(k, v) => setBorrador((d) => ({ ...d, [k]: v }))}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
        <Button variant="ghost" onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function formatValor(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}
