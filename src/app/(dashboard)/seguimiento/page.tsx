"use client";

// Cockpit "Para hoy": la vista diaria del comercial. Tres bloques accionables
// (Vencidas / Hoy / Sin contacto) con acciones de 1 clic por fila: llamar,
// WhatsApp, registrar gestión (cerrar ciclo) y abrir la ficha.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, PageHeader } from "@/components/ui";
import { RolEmpresaGuard } from "@/components/rol-empresa-guard";
import { RegistrarGestion } from "@/components/registrar-gestion";
import { comercialApi, type HoyBuckets, type HoyItem } from "@/lib/comercial-api";

const wa = (tel: string | null) => (tel ? `https://wa.me/${tel.replace(/\D/g, "")}` : null);
const horaFecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

function Fila({ it, onGestion }: { it: HoyItem; onGestion: (c: { id: string; nombre: string }) => void }) {
  const whats = wa(it.telefono);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{it.nombre ?? "—"}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {it.tarea ?? "Sin contacto reciente"}
          {it.fechaProximaTarea ? ` · ${horaFecha(it.fechaProximaTarea)}` : ""}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
        {it.telefono && (
          <a href={`tel:${it.telefono}`} className="text-slate-600 hover:text-indigo-600 dark:text-slate-300">Llamar</a>
        )}
        {whats && (
          <a href={whats} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">WhatsApp</a>
        )}
        {it.clienteId && (
          <>
            <button onClick={() => onGestion({ id: it.clienteId!, nombre: it.nombre ?? "" })} className="text-indigo-600 hover:underline">
              Registrar
            </button>
            <Link href={`/clientes/${it.clienteId}`} className="text-slate-500 hover:text-indigo-600">Ficha →</Link>
          </>
        )}
      </div>
    </li>
  );
}

function Seccion({ titulo, color, items, onGestion }: { titulo: string; color: string; items: HoyItem[]; onGestion: (c: { id: string; nombre: string }) => void }) {
  return (
    <Card>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span className={`inline-block h-2 w-2 rounded-full ${color}`} /> {titulo}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Nada por aquí 🎉</p>
      ) : (
        <ul className="space-y-2">{items.map((it, i) => <Fila key={(it.id ?? it.clienteId ?? "") + i} it={it} onGestion={onGestion} />)}</ul>
      )}
    </Card>
  );
}

function Cockpit() {
  const [buckets, setBuckets] = useState<HoyBuckets | null>(null);
  const [mios, setMios] = useState(true);
  const [gestion, setGestion] = useState<{ id: string; nombre: string } | null>(null);

  const cargar = useCallback(() => {
    comercialApi.hoy({ mios }).then(setBuckets).catch(() => setBuckets({ vencidas: [], hoy: [], frios: [] }));
  }, [mios]);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <PageHeader
        title="Para hoy"
        subtitle="Tu seguimiento del día: a quién contactar ahora."
        action={
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-700">
            <button onClick={() => setMios(true)} className={`rounded-md px-3 py-1 ${mios ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>Míos</button>
            <button onClick={() => setMios(false)} className={`rounded-md px-3 py-1 ${!mios ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>Todos</button>
          </div>
        }
      />
      {buckets === null ? (
        <Card className="text-sm text-slate-500">Cargando…</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Seccion titulo="Vencidas" color="bg-red-500" items={buckets.vencidas} onGestion={setGestion} />
          <Seccion titulo="Hoy" color="bg-amber-500" items={buckets.hoy} onGestion={setGestion} />
          <Seccion titulo="Sin contacto" color="bg-slate-400" items={buckets.frios} onGestion={setGestion} />
        </div>
      )}
      {gestion && (
        <RegistrarGestion clienteId={gestion.id} clienteNombre={gestion.nombre} onClose={() => setGestion(null)} onSaved={cargar} />
      )}
    </div>
  );
}

export default function SeguimientoPage() {
  return (
    <RolEmpresaGuard roles={["COMERCIAL", "JURIDICO"]}>
      <Cockpit />
    </RolEmpresaGuard>
  );
}
