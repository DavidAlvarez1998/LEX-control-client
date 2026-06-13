"use client";

import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { RolEmpresaGuard } from "@/components/rol-empresa-guard";

// Tipos de petición (trámites ante entidad, no judiciales). Por ahora solo el
// Derecho de Petición está implementado; los otros dos quedan como placeholders
// "Próximamente" hasta que se modele su flujo en el catálogo.
type Peticion = {
  titulo: string;
  descripcion: string;
  href?: string; // sin href ⇒ deshabilitada (Próximamente)
};

const PETICIONES: Peticion[] = [
  {
    titulo: "Derecho de Petición",
    descripcion:
      "Peticiones que envías a una entidad o que recibes y debes responder (art. 23 C.P., Ley 1755/2015).",
    href: "/peticiones/derecho-peticion",
  },
  {
    titulo: "Reclamación Administrativa",
    descripcion: "Reclamo previo ante la administración antes de acudir a la jurisdicción.",
  },
  {
    titulo: "Constitución de Renuencia",
    descripcion:
      "Requisito de procedibilidad de la acción de cumplimiento (art. 8 Ley 393/1997).",
  },
];

function Flecha() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function PeticionesPage() {
  return (
    <RolEmpresaGuard roles={["JURIDICO"]}>
      <div>
        <PageHeader
          title="Peticiones"
          subtitle="Trámites ante entidades: derechos de petición y reclamaciones (separados de los procesos judiciales)."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PETICIONES.map((p) =>
            p.href ? (
              <Link key={p.titulo} href={p.href} className="group">
                <Card className="flex h-full flex-col transition-colors hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">{p.titulo}</h3>
                    <span className="text-indigo-500 transition-transform group-hover:translate-x-0.5 dark:text-indigo-400">
                      <Flecha />
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{p.descripcion}</p>
                </Card>
              </Link>
            ) : (
              <Card
                key={p.titulo}
                className="flex h-full cursor-not-allowed flex-col opacity-60"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{p.titulo}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    Próximamente
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{p.descripcion}</p>
              </Card>
            ),
          )}
        </div>
      </div>
    </RolEmpresaGuard>
  );
}
