"use client";

// Renderizador genérico de formularios: dibuja CUALQUIER formulario a partir de
// su esquema (lista de campos). Un solo componente sirve para todos los tipos de
// proceso de todas las áreas. Ver lib/procesos.ts (CampoEsquema).

import { type ReactNode } from "react";
import type { CampoEsquema } from "@/lib/procesos";
import { campoEfectivamenteRequerido, campoVisible, camposDeCondicion } from "@/lib/procesos";
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
  slotAntesDe,
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
  // Igual que `slotDespuesDe` pero ANTES del campo (p. ej. subir la notificación
  // arriba de su fecha: primero el documento, luego se fecha).
  slotAntesDe?: Partial<Record<string, ReactNode>>;
  // Etiquetas de opción a MOSTRAR por campo (value→label), p. ej. el tipo de
  // petición con su plazo. El valor guardado no cambia.
  etiquetasOpcion?: Record<string, Record<string, string>>;
}) {
  // Nivel de indentación de cada campo = profundidad de su cadena de `mostrarSi`.
  // Sin `mostrarSi` → 0; si su condición referencia un campo de nivel N → N+1. Así los
  // campos que se despliegan al elegir una opción quedan indentados bajo ella (jerarquía
  // visual, solo presentación). Memoizado y anti-ciclos.
  const porKey = new Map(esquema.map((c) => [c.key, c]));
  const nivelCache = new Map<string, number>();
  const nivelDe = (key: string, visitando: Set<string> = new Set()): number => {
    if (nivelCache.has(key)) return nivelCache.get(key)!;
    const campo = porKey.get(key);
    if (!campo?.mostrarSi || visitando.has(key)) return 0;
    visitando.add(key);
    // Solo cuentan los campos que están EN ESTE formulario: si el `mostrarSi` apunta a
    // un campo de otra sección (p. ej. la instancia), aquí es un campo raíz (nivel 0).
    const refs = camposDeCondicion(campo.mostrarSi).filter((r) => porKey.has(r));
    const nivel = refs.length ? 1 + Math.max(...refs.map((r) => nivelDe(r, visitando))) : 0;
    visitando.delete(key);
    nivelCache.set(key, nivel);
    return nivel;
  };

  // Indentación EFECTIVA: la sangría solo tiene sentido si el campo aparece pegado a
  // aquello de lo que depende. Recorriendo los campos visibles en orden, un campo
  // condicional se indenta solo si el campo inmediatamente anterior es su padre (lo
  // referencia su `mostrarSi`) o un hermano/descendiente del mismo grupo (nivel ≥).
  // Si entre el padre y el campo se cuela otro campo no relacionado (p. ej. "Fecha de
  // radicación" depende de `rol`, pero la separan "instancia" y "requiere poder"), NO
  // se indenta: dibujarla escalonada bajo el campo de arriba haría creer que depende de él.
  const visibles = esquema.filter((c) => campoVisible(c, datos));
  const effDe = new Map<string, number>();
  let prevKey: string | null = null;
  for (const campo of visibles) {
    const nivel = nivelDe(campo.key);
    let eff = 0;
    if (nivel > 0 && prevKey && campo.mostrarSi) {
      const refs = camposDeCondicion(campo.mostrarSi).filter((r) => porKey.has(r));
      const prevEff = effDe.get(prevKey) ?? 0;
      const conectado = refs.includes(prevKey) || prevEff >= nivel;
      eff = conectado ? nivel : 0;
    }
    effDe.set(campo.key, eff);
    prevKey = campo.key;
  }

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
              className="w-full rounded-lg border border-slate-200 bg-slate-200 px-3 py-2 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-600/50 dark:text-slate-400"
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
              <span className={`mb-1 block text-sm text-slate-700 dark:text-slate-200 ${campo.negrita ? "font-bold" : "font-medium"}`}>
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
            <Field label={campo.label} requerido={requerido} error={error} negrita={campo.negrita}>
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
        const slotAntes = slotAntesDe?.[campo.key];
        // Ocupan la fila completa: (a) los chips (multiselect, correos), que necesitan
        // el ancho; y (b) TODO campo que se despliega por una condición (`mostrarSi`).
        // Lo segundo evita que, en grillas de 2 columnas, las opciones reveladas (p. ej.
        // las de la medida cautelar al elegir "Sí") salten a la columna de al lado: así
        // quedan SIEMPRE apiladas justo debajo del campo que las disparó.
        const anchoCompleto =
          campo.tipo === "multiselect" || campo.tipo === "listaCorreos" || !!campo.mostrarSi;
        // Indentación: los campos que aparecen por una condición quedan escalonados bajo
        // el campo que los desprende (borde guía + sangría proporcional al nivel), pero
        // solo si están pegados a su padre (ver `effDe`).
        const nivel = effDe.get(campo.key) ?? 0;
        return (
          <div
            key={campo.key}
            data-campo={campo.key}
            className={[
              anchoCompleto ? "sm:col-span-2" : "",
              nivel > 0 ? "border-l-2 border-indigo-100 pl-3 dark:border-indigo-500/20" : "",
              // Campos que se despliegan por una condición entran con un fade suave
              // (solo al montar). Los campos base no se animan al cargar el form.
              campo.mostrarSi ? "lex-campo-reveal" : "",
            ].filter(Boolean).join(" ") || undefined}
            style={nivel > 0 ? { marginLeft: `${nivel * 0.85}rem` } : undefined}
          >
            {slotAntes && <div className="mb-2">{slotAntes}</div>}
            {elemento}
            {slot && <div className="mt-2">{slot}</div>}
          </div>
        );
      })}
    </div>
  );
}
