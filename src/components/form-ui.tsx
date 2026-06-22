"use client";

// Primitivas de formulario del portal del cliente. El portal solo tenía
// componentes de presentación (ui.tsx); estos son los inputs interactivos que
// usa <FormularioDinamico> y las pantallas de procesos. Regla del proyecto:
// todo campo requerido marca su label con un asterisco rojo (*).

import { useState, type ReactNode } from "react";

const base =
  "w-full rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20";

/** Envuelve un campo con su label (asterisco rojo si es requerido) y error. */
export function Field({
  label,
  requerido = false,
  error,
  negrita = false,
  children,
}: {
  label: string;
  requerido?: boolean;
  error?: string;
  negrita?: boolean; // resalta el label en negrita
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={`mb-1 block text-sm text-foreground ${negrita ? "font-bold" : "font-medium"}`}>
        {label}
        {requerido && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "date";
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={base}
    />
  );
}

export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`${base} resize-y`}
    />
  );
}

/** Solo dígitos; devuelve el texto crudo (el llamador parsea a número). */
export function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.-]/g, ""))}
      placeholder={placeholder}
      className={base}
    />
  );
}

export function Select({
  value,
  onChange,
  opciones,
  grupos,
  placeholder = "Selecciona…",
  etiquetas,
}: {
  value: string;
  onChange: (v: string) => void;
  opciones?: string[];
  // Opciones agrupadas (optgroups). Si se pasa, tiene prioridad sobre `opciones`.
  grupos?: { label: string; opciones: string[] }[];
  placeholder?: string;
  // Etiqueta a MOSTRAR por valor (el value guardado no cambia). Opcional.
  etiquetas?: Record<string, string>;
}) {
  const opcion = (o: string) => (
    <option key={o} value={o}>
      {etiquetas?.[o] ?? o}
    </option>
  );
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={base}
    >
      <option value="">{placeholder}</option>
      {grupos
        ? grupos.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.opciones.map(opcion)}
            </optgroup>
          ))
        : (opciones ?? []).map(opcion)}
    </select>
  );
}

/**
 * Select con BÚSQUEDA por nombre (combobox). `value` = id seleccionado; en el
 * input se muestra el nombre. Al enfocar/escribir filtra las opciones por nombre.
 */
export function BuscadorSelect({
  opciones,
  value,
  onChange,
  placeholder = "Buscar por nombre…",
}: {
  // `sub`: segunda línea (p. ej. documento/celular/correo). `buscar`: texto extra
  // que también filtra (nombre siempre filtra). Ambos opcionales → uso retro intacto.
  opciones: { id: string; nombre: string; sub?: string; buscar?: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const sel = opciones.find((o) => o.id === value);
  const filtro = q.trim().toLowerCase();
  const filtradas = filtro
    ? opciones.filter((o) => `${o.nombre} ${o.buscar ?? ""}`.toLowerCase().includes(filtro))
    : opciones;
  return (
    <div className="relative">
      <input
        type="text"
        value={abierto ? q : sel?.nombre ?? ""}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setAbierto(true); }}
        onFocus={() => { setQ(""); setAbierto(true); }}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        className={base}
      />
      {abierto && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg">
          {filtradas.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">Sin resultados</li>
          ) : (
            filtradas.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onChange(o.id); setAbierto(false); }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 dark:hover:bg-indigo-500/10 ${o.id === value ? "font-medium text-accent" : "text-foreground"}`}
                >
                  {o.nombre}
                  {o.sub && (
                    <span className="block text-xs text-muted">{o.sub}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Lista editable de correos: una fila por correo con botón de quitar (×) y un
 * enlace "+ Agregar otro correo". Siempre muestra al menos una fila para escribir.
 * `value` = string[] (el primero es el principal). Reutilizada en el cliente del
 * CRM, el modal de "crear cliente", los peticionarios y los campos `listaCorreos`
 * del formulario dinámico (p. ej. correos de la entidad del DdP).
 */
export function CorreosInput({
  value,
  onChange,
  placeholder = "correo@ejemplo.com",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  // Defensa: datos heredados podrían no ser un array (un solo correo en string).
  const lista = Array.isArray(value) ? value : value ? [String(value)] : [];
  const filas = lista.length > 0 ? lista : [""];
  const setEn = (i: number, v: string) => onChange(filas.map((c, idx) => (idx === i ? v : c)));
  return (
    <div className="space-y-2">
      {filas.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="email"
            value={c}
            onChange={(e) => setEn(i, e.target.value)}
            placeholder={placeholder}
            className={base}
          />
          {filas.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(filas.filter((_, idx) => idx !== i))}
              aria-label="Quitar correo"
              className="shrink-0 rounded-lg border border-line px-2.5 py-2 text-sm text-muted transition-colors hover:border-red-300 hover:text-red-500"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...filas, ""])}
        className="text-xs font-medium text-accent hover:text-accent-hover"
      >
        + Agregar otro correo
      </button>
    </div>
  );
}

/** Selección múltiple con chips (no hay control nativo para esto). */
export function MultiSelect({
  value,
  onChange,
  opciones,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  opciones: string[];
}) {
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              on
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                : "border-line bg-subtle text-muted hover:bg-hover"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 dark:border-slate-600"
      />
      {label}
    </label>
  );
}

// Etiquetas amables para la naturaleza de una persona jurídica.
export const NATURALEZA_LABEL: Record<string, string> = {
  PUBLICA: "Pública",
  PRIVADA: "Privada",
  MIXTA: "Mixta",
};

/**
 * Bloque "Notificaciones" de un sujeto procesal / cliente: correo(s), dirección y
 * teléfono, cada uno con un check "Se desconocen los datos" que deshabilita y limpia
 * el campo (la marca se persiste; es relevante para emplazamiento). `value` agrupa los
 * 6 campos; `onChange` recibe un patch parcial. Reutilizado en nuevo proceso (partes y
 * cliente nuevo) y en el panel Partes de la ficha.
 */
export type DatosNotificacion = {
  correos: string[];
  correoDesconocido: boolean;
  direccion: string;
  direccionDesconocida: boolean;
  telefono: string;
  telefonoDesconocido: boolean;
};

export function Notificaciones({
  value,
  onChange,
}: {
  value: DatosNotificacion;
  onChange: (patch: Partial<DatosNotificacion>) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-line bg-subtle p-3">
      <span className="block text-sm font-semibold text-foreground">Notificaciones</span>

      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">Correo</span>
          <Checkbox
            checked={value.correoDesconocido}
            onChange={(v) => onChange(v ? { correoDesconocido: true, correos: [] } : { correoDesconocido: false })}
            label="Se desconocen los datos"
          />
        </div>
        {!value.correoDesconocido && (
          <CorreosInput value={value.correos} onChange={(v) => onChange({ correos: v })} />
        )}
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">Dirección</span>
          <Checkbox
            checked={value.direccionDesconocida}
            onChange={(v) => onChange(v ? { direccionDesconocida: true, direccion: "" } : { direccionDesconocida: false })}
            label="Se desconocen los datos"
          />
        </div>
        {!value.direccionDesconocida && (
          <Input value={value.direccion} onChange={(v) => onChange({ direccion: v })} placeholder="Dirección de notificación" />
        )}
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">Teléfono</span>
          <Checkbox
            checked={value.telefonoDesconocido}
            onChange={(v) => onChange(v ? { telefonoDesconocido: true, telefono: "" } : { telefonoDesconocido: false })}
            label="Se desconocen los datos"
          />
        </div>
        {!value.telefonoDesconocido && (
          <Input value={value.telefono} onChange={(v) => onChange({ telefono: v })} placeholder="Teléfono de contacto" />
        )}
      </div>
    </div>
  );
}

/** Input de dinero con formato 1.000.000 (convención de precios del proyecto). */
export function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string; // dígitos crudos
  onChange: (digits: string) => void;
  placeholder?: string;
}) {
  const display =
    value === "" ? "" : Number(value).toLocaleString("es-CO", { maximumFractionDigits: 0 });
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      placeholder={placeholder}
      className={base}
    />
  );
}

/** Tarjeta seleccionable/clicable (para la grilla de áreas y tipos). */
export function SelectableCard({
  title,
  subtitle,
  selected = false,
  badge,
  onClick,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  // Píldora gris arriba a la derecha (p. ej. "No actualizado" en tipos sin curar).
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full flex-col rounded-xl border p-4 text-left shadow-sm transition-colors ${
        selected
          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
          : "border-line bg-subtle hover:border-accent/40 hover:bg-hover"
      }`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="font-medium text-foreground">{title}</span>
        {badge && (
          <span className="shrink-0 rounded-full bg-hover px-2 py-0.5 text-[11px] font-medium text-muted">
            {badge}
          </span>
        )}
      </span>
      {subtitle && (
        <span className="mt-1 text-xs text-muted">{subtitle}</span>
      )}
    </button>
  );
}
