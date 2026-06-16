"use client";

// Renderizador genérico de formularios: dibuja CUALQUIER formulario a partir de
// su esquema (lista de campos). Un solo componente sirve para todos los tipos de
// proceso de todas las áreas. Ver lib/procesos.ts (CampoEsquema).

import { type ReactNode } from "react";
import type { CampoEsquema } from "@/lib/procesos";
import { campoEfectivamenteRequerido, campoVisible } from "@/lib/procesos";
import {
  Checkbox,
  CorreosInput,
  Field,
  Input,
  MultiSelect,
  NumberInput,
  Select,
  Textarea,
} from "./form-ui";

export function FormularioDinamico({
  esquema,
  datos,
  onChange,
  errores = [],
  className = "space-y-4",
  slotDespuesDe,
  etiquetasOpcion,
}: {
  esquema: CampoEsquema[];
  datos: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  errores?: string[]; // keys con error
  className?: string; // contenedor: por defecto una columna; el detalle pasa un grid
  // Contenido extra a insertar JUSTO DESPUÉS de un campo (por su key). P. ej. el
  // uploader del poder tras "requierePoder". Mantiene el componente genérico.
  slotDespuesDe?: Partial<Record<string, ReactNode>>;
  // Etiquetas de opción a MOSTRAR por campo (value→label), p. ej. el tipo de
  // petición con su plazo. El valor guardado no cambia.
  etiquetasOpcion?: Record<string, Record<string, string>>;
}) {
  return (
    <div className={className}>
      {esquema.map((campo) => {
        // Campos ocultos (mostrarSi no se cumple) no se renderizan.
        if (!campoVisible(campo, datos)) return null;
        const v = datos[campo.key];
        const requerido = campoEfectivamenteRequerido(campo, datos);
        const error = errores.includes(campo.key) ? "Este campo es obligatorio" : undefined;

        let control;
        if (campo.auto) {
          // Campo autogenerado por el servidor (p. ej. radicado de ingreso): solo
          // lectura. Vacío al crear ("Se generará automáticamente"); con valor luego.
          control = (
            <input
              type="text"
              value={(v as string) ?? ""}
              disabled
              placeholder="Se generará automáticamente"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
            />
          );
        } else
        switch (campo.tipo) {
          case "textoLargo":
            control = (
              <Textarea value={(v as string) ?? ""} onChange={(x) => onChange(campo.key, x)} />
            );
            break;
          case "numero":
            control = (
              <NumberInput value={(v as string) ?? ""} onChange={(x) => onChange(campo.key, x)} />
            );
            break;
          case "fecha":
            control = (
              <Input type="date" value={(v as string) ?? ""} onChange={(x) => onChange(campo.key, x)} />
            );
            break;
          case "boolean":
            control = (
              <Checkbox
                checked={Boolean(v)}
                onChange={(x) => onChange(campo.key, x)}
                label={campo.ayuda ?? "Sí"}
              />
            );
            break;
          case "select":
            control = (
              <Select
                value={(v as string) ?? ""}
                onChange={(x) => onChange(campo.key, x)}
                opciones={campo.opciones ?? []}
                etiquetas={etiquetasOpcion?.[campo.key]}
              />
            );
            break;
          case "multiselect":
            control = (
              <MultiSelect
                value={(v as string[]) ?? []}
                onChange={(x) => onChange(campo.key, x)}
                opciones={campo.opciones ?? []}
              />
            );
            break;
          case "listaCorreos":
            // Datos viejos pueden traer un solo correo como string: se coerciona a lista.
            control = (
              <CorreosInput
                value={Array.isArray(v) ? (v as string[]) : v ? [String(v)] : []}
                onChange={(x) => onChange(campo.key, x)}
              />
            );
            break;
          default:
            control = (
              <Input value={(v as string) ?? ""} onChange={(x) => onChange(campo.key, x)} />
            );
        }

        // Checkbox y multiselect NO usan <Field>: este envuelve en un <label>, y
        // un <label> que contiene varios controles (las pastillas del multiselect)
        // se asocia al PRIMERO → al pasar el mouse/clic por el campo se activa la
        // primera opción ("Información"). Se renderizan con un <div> propio.
        const sinLabelWrap =
          campo.tipo === "boolean" || campo.tipo === "multiselect" || campo.tipo === "listaCorreos";
        const elemento =
          sinLabelWrap ? (
            <div className="pt-1">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {campo.label}
                {requerido && <span className="ml-0.5 text-red-500">*</span>}
              </span>
              {control}
              {(campo.tipo === "multiselect" || campo.tipo === "listaCorreos") && campo.ayuda && (
                <span className="mt-1 block text-xs text-slate-400">{campo.ayuda}</span>
              )}
              {campo.tipo === "multiselect" && error && (
                <span className="mt-1 block text-xs text-red-600">{error}</span>
              )}
            </div>
          ) : (
            <Field label={campo.label} requerido={requerido} error={error}>
              {control}
              {campo.ayuda && (
                <span className="mt-1 block text-xs text-slate-400">{campo.ayuda}</span>
              )}
            </Field>
          );

        // Campo + su slot van JUNTOS en una sola celda del grid, para que el slot
        // (uploader del poder, hint de vencimiento…) quede DEBAJO del campo y con el
        // ancho de su columna — no como otra celda a la derecha ni a fila completa.
        const slot = slotDespuesDe?.[campo.key];
        // Solo los controles de chips (multiselect, correos) ocupan la fila completa:
        // de verdad necesitan el ancho. El resto (fecha, select, texto, texto largo)
        // queda compacto en una columna para no verse estirado.
        const anchoCompleto = campo.tipo === "multiselect" || campo.tipo === "listaCorreos";
        return (
          <div key={campo.key} data-campo={campo.key} className={anchoCompleto ? "sm:col-span-2" : undefined}>
            {elemento}
            {slot && <div className="mt-2">{slot}</div>}
          </div>
        );
      })}
    </div>
  );
}
