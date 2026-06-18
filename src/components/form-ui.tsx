"use client";

// Primitivas de formulario del portal del cliente. El portal solo tenía
// componentes de presentación (ui.tsx); estos son los inputs interactivos que
// usa <FormularioDinamico> y las pantallas de procesos. Regla del proyecto:
// todo campo requerido marca su label con un asterisco rojo (*).

import { useState, type ReactNode } from "react";

const base =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";

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
      <span className={`mb-1 block text-sm text-slate-700 dark:text-slate-200 ${negrita ? "font-bold" : "font-medium"}`}>
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
  placeholder = "Selecciona…",
  etiquetas,
}: {
  value: string;
  onChange: (v: string) => void;
  opciones: string[];
  placeholder?: string;
  // Etiqueta a MOSTRAR por valor (el value guardado no cambia). Opcional.
  etiquetas?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={base}
    >
      <option value="">{placeholder}</option>
      {opciones.map((o) => (
        <option key={o} value={o}>
          {etiquetas?.[o] ?? o}
        </option>
      ))}
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
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-slate-50 py-1 shadow-lg dark:border-slate-600 dark:bg-slate-700">
          {filtradas.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">Sin resultados</li>
          ) : (
            filtradas.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onChange(o.id); setAbierto(false); }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 dark:hover:bg-indigo-500/10 ${o.id === value ? "font-medium text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-200"}`}
                >
                  {o.nombre}
                  {o.sub && (
                    <span className="block text-xs text-slate-400 dark:text-slate-500">{o.sub}</span>
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
              className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-400 transition-colors hover:border-red-300 hover:text-red-500 dark:border-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...filas, ""])}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
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
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
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
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
      />
      {label}
    </label>
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
  onClick,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full flex-col rounded-xl border p-4 text-left shadow-sm transition-colors ${
        selected
          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
          : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600"
      }`}
    >
      <span className="font-medium text-slate-800 dark:text-slate-100">{title}</span>
      {subtitle && (
        <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</span>
      )}
    </button>
  );
}
