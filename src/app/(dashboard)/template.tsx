import { ViewTransition } from "react";

/**
 * Template del grupo (dashboard): a diferencia de layout.tsx, `template.tsx` se RE-MONTA
 * en cada navegación, por lo que envolver el contenido en <ViewTransition> activa el
 * crossfade de ruta automáticamente (las navegaciones del App Router son transiciones).
 *
 * Queda DENTRO del <main> del layout → la transición se acota al área de contenido;
 * sidebar y topbar permanecen fijos. Cualquier página nueva bajo (dashboard)/ hereda
 * esto sin tocar nada. Ver convención en CLAUDE.md (Frontends) y lib/view-transition.ts.
 *
 * El <div className="lex-page"> sirve de portador para el fade de respaldo (fallback CSS)
 * en navegadores sin View Transitions; ahí entra @supports en globals.css.
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewTransition>
      <div className="lex-page">{children}</div>
    </ViewTransition>
  );
}
