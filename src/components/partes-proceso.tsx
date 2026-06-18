"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { CorreosInput, Field, Input, Select } from "@/components/form-ui";
import { errorMessage } from "@/lib/api";
import type { GrupoProceso, RolParte, TipoDocumento, TipoPersona } from "@/lib/procesos";
import {
  agregarParte,
  editarParte,
  eliminarParte,
  type ParteDetalle,
  type ProcesoDetalle,
} from "@/lib/procesos-api";

const ROLES: RolParte[] = [
  "DEMANDANTE", "DEMANDADO", "EJECUTANTE", "EJECUTADO", "ACCIONANTE",
  "ACCIONADO", "IMPUTADO", "ACUSADO", "VICTIMA", "TERCERO", "APODERADO", "OTRO",
];
// En el laboral (Ley 2452/2025), litigio entre dos partes: solo demandante/demandado.
const ROLES_LABORAL: RolParte[] = ["DEMANDANTE", "DEMANDADO"];
const TIPOS_DOC: TipoDocumento[] = ["CC", "CE", "NIT", "TI", "PASAPORTE", "PEP_PPT"];

// Borrador de los campos editables de una parte (litigante + rol).
type Draft = {
  nombre: string;
  rol: RolParte;
  tipoPersona: TipoPersona;
  tipoDocumento: TipoDocumento | "";
  numeroDocumento: string;
  correos: string[];
};

function draftDeParte(p: ParteDetalle): Draft {
  return {
    nombre: p.litigante.nombre,
    rol: p.rol,
    tipoPersona: p.litigante.tipoPersona,
    tipoDocumento: p.litigante.tipoDocumento ?? "",
    numeroDocumento: p.litigante.numeroDocumento ?? "",
    correos: p.litigante.correos ?? [],
  };
}

const DRAFT_VACIO: Draft = {
  nombre: "",
  rol: "DEMANDADO",
  tipoPersona: "NATURAL",
  tipoDocumento: "",
  numeroDocumento: "",
  correos: [],
};

/**
 * Panel "Partes" de la ficha del proceso: lista las partes y permite gestionar la
 * CONTRAPARTE y otros litigantes (terceros, etc.) sin salir de la ficha. Nuestro
 * cliente se define al crear el proceso y aquí solo se muestra (no se edita/quita).
 */
export function PartesProceso({
  proceso,
  onChange,
  readOnly = false,
}: {
  proceso: ProcesoDetalle;
  onChange: (p: ProcesoDetalle) => void;
  readOnly?: boolean;
}) {
  // `editando` = id de la parte en edición, o "nueva" para el alta, o null.
  const [editando, setEditando] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(DRAFT_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roles = proceso.tipoProceso.grupo === "LABORAL" ? ROLES_LABORAL : ROLES;

  function abrirEdicion(p: ParteDetalle) {
    setError(null);
    setDraft(draftDeParte(p));
    setEditando(p.id);
  }
  function abrirAlta() {
    setError(null);
    setDraft({ ...DRAFT_VACIO, rol: proceso.tipoProceso.grupo === "LABORAL" ? "DEMANDADO" : DRAFT_VACIO.rol });
    setEditando("nueva");
  }
  function cancelar() {
    setEditando(null);
    setError(null);
  }

  async function guardar() {
    if (!draft.nombre.trim()) {
      setError("El nombre de la parte es obligatorio.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const litigante = {
        nombre: draft.nombre.trim(),
        tipoPersona: draft.tipoPersona,
        tipoDocumento: draft.tipoDocumento || null,
        numeroDocumento: draft.numeroDocumento.trim() || null,
        correos: draft.correos,
      };
      const actualizado =
        editando === "nueva"
          ? await agregarParte(proceso.id, {
              litigante: { ...litigante, tipoDocumento: draft.tipoDocumento || undefined },
              rol: draft.rol,
            })
          : await editarParte(proceso.id, editando!, { rol: draft.rol, litigante });
      onChange(actualizado);
      setEditando(null);
    } catch (e) {
      setError(errorMessage(e, "No se pudo guardar la parte."));
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(p: ParteDetalle) {
    if (!confirm(`¿Quitar a "${p.litigante.nombre}" del proceso?`)) return;
    setGuardando(true);
    setError(null);
    try {
      const actualizado = await eliminarParte(proceso.id, p.id);
      onChange(actualizado);
    } catch (e) {
      setError(errorMessage(e, "No se pudo quitar la parte."));
    } finally {
      setGuardando(false);
    }
  }

  const formulario = (
    <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/5">
      {/* Una sola columna: el panel "Partes" es estrecho (1/3 en pantallas grandes),
          en dos columnas los campos se ven apretados. */}
      <Field label="Nombre / razón social">
        <Input value={draft.nombre} onChange={(v) => setDraft((d) => ({ ...d, nombre: v }))} placeholder="Nombre de la parte" />
      </Field>
      <Field label="Rol procesal">
        <Select value={draft.rol} onChange={(v) => setDraft((d) => ({ ...d, rol: v as RolParte }))} opciones={roles} />
      </Field>
      <Field label="Tipo de persona">
        <Select
          value={draft.tipoPersona}
          onChange={(v) => setDraft((d) => ({ ...d, tipoPersona: v as TipoPersona }))}
          opciones={["NATURAL", "JURIDICA"]}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Documento">
          <Select
            value={draft.tipoDocumento}
            onChange={(v) => setDraft((d) => ({ ...d, tipoDocumento: (v as TipoDocumento) || "" }))}
            opciones={TIPOS_DOC}
            placeholder="Tipo"
          />
        </Field>
        <Field label="Número">
          <Input value={draft.numeroDocumento} onChange={(v) => setDraft((d) => ({ ...d, numeroDocumento: v }))} />
        </Field>
      </div>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Correos</span>
        <CorreosInput value={draft.correos} onChange={(v) => setDraft((d) => ({ ...d, correos: v }))} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={cancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : editando === "nueva" ? "Agregar" : "Guardar"}
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Partes</h3>
        {!readOnly && editando !== "nueva" && (
          <button type="button" onClick={abrirAlta} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            + Agregar parte
          </button>
        )}
      </div>

      <ul className="space-y-3 text-sm">
        {proceso.partes.map((p) =>
          editando === p.id ? (
            <li key={p.id}>{formulario}</li>
          ) : (
            <li key={p.id} className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-slate-800 dark:text-slate-100">
                  {p.litigante.nombre}
                  {p.esNuestroCliente && (
                    <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                      Nuestro cliente
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {p.rol}
                  {p.litigante.tipoDocumento && ` · ${p.litigante.tipoDocumento} ${p.litigante.numeroDocumento ?? ""}`}
                </div>
              </div>
              {!readOnly && !p.esNuestroCliente && (
                <div className="flex shrink-0 gap-2 text-xs">
                  <button type="button" onClick={() => abrirEdicion(p)} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    editar
                  </button>
                  <button type="button" onClick={() => quitar(p)} disabled={guardando} className="text-red-600 hover:underline disabled:opacity-50">
                    quitar
                  </button>
                </div>
              )}
            </li>
          ),
        )}
        {proceso.partes.length === 0 && editando !== "nueva" && <li className="text-slate-400">Sin partes registradas.</li>}
        {editando === "nueva" && <li>{formulario}</li>}
      </ul>

      {!readOnly && proceso.partes.length > 0 && editando === null && (
        <p className="mt-3 text-xs text-slate-400">Contraparte, terceros, etc. — el cliente se define al crear el proceso.</p>
      )}
    </div>
  );
}
