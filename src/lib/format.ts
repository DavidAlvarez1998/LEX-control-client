// Utilidades de formato de números/precios.
// Formato de la plataforma: separador de miles con punto y sin decimales,
// p. ej. 1.000.000 (estilo es-CO / COP). Es el formato único para precios.

/** Formatea un valor como precio agrupado: 1000000 -> "1.000.000". */
export function formatMoney(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

/** Quita todo lo que no sea dígito del texto de un input de precio. */
export function parseMoneyInput(text: string): string {
  return text.replace(/\D/g, "");
}
