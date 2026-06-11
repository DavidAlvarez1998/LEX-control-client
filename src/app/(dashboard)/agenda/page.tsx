"use client";

import { AgendaComercialView } from "@/components/agenda-comercial-view";

// La agenda está disponible para todo usuario del despacho (sin guard de rol).
export default function AgendaPage() {
  return <AgendaComercialView />;
}
