/**
 * Nombre de View Transition único y saneado para el patrón "elemento compartido"
 * (una fila/tarjeta de una lista que "morfea" hacia su vista de detalle).
 *
 * Uso (mismo `scope` + `id` en lista y detalle):
 *   import { ViewTransition } from "react";
 *   <ViewTransition name={vtName("proceso", t.id)}>…</ViewTransition>
 * o como valor CSS directo:
 *   <h1 style={{ viewTransitionName: vtName("proceso", id) }}>…</h1>
 *
 * Convención del repo: ver CLAUDE.md (Frontends). El crossfade de ruta ya se hereda
 * por el template.tsx del grupo (dashboard); este helper es solo para el morph opcional.
 */
export function vtName(scope: string, id: string | number): string {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, "-");
  return `${scope}-${safe}`;
}
