"use client";

import { RolEmpresaGuard } from "@/components/rol-empresa-guard";
import { AgendaComercialView } from "@/components/agenda-comercial-view";

export default function AgendaPage() {
  return (
    <RolEmpresaGuard roles={["COMERCIAL"]}>
      <AgendaComercialView />
    </RolEmpresaGuard>
  );
}
