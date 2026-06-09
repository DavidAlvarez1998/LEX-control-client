"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui";
import { DocumentosProceso } from "@/components/documentos-proceso";
import { ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { ESTADO_LABEL, JURISDICCION_LABEL, type EtapaDef } from "@/lib/procesos";
import { getProceso, moverEtapa, type ProcesoDetalle } from "@/lib/procesos-api";

export default function ExpedientePage() {
  const { id } = useParams<{ id: string }>();
  const [proceso, setProceso] = useState<ProcesoDetalle | null | undefined>(undefined);
  const [bloqueo, setBloqueo] = useState<{ etapa: string; faltantes: string[] } | null>(null);

  useEffect(() => {
    getProceso(id)
      .then(setProceso)
      .catch(() => setProceso(null));
  }, [id]);

  if (proceso === undefined) {
    return <Card className="text-sm text-slate-500">Cargando…</Card>;
  }
  if (proceso === null) {
    return (
      <Card className="text-sm text-slate-500">
        Proceso no encontrado.{" "}
        <Link href="/procesos" className="font-medium text-indigo-600 hover:underline">
          Volver
        </Link>
      </Card>
    );
  }

  const etapas = (proceso.tipoProceso.etapas ?? []).slice().sort((a, b) => a.orden - b.orden);
  const idxActual = etapas.findIndex((e) => e.key === proceso.etapaActual);

  async function irAEtapa(key: string) {
    try {
      const actualizado = await moverEtapa(proceso!.id, key);
      setProceso(actualizado);
      setBloqueo(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        const faltantes = (e.issues as { faltantes?: string[] })?.faltantes ?? [];
        setBloqueo({ etapa: key, faltantes });
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={proceso.titulo}
        subtitle={`${proceso.tipoProceso.nombre} · ${JURISDICCION_LABEL[proceso.jurisdiccion]}`}
        action={
          <Link href="/procesos">
            <Button variant="ghost">← Procesos</Button>
          </Link>
        }
      />

      <Card className="mb-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
          <Dato label="Código interno" value={proceso.codigoInterno} />
          <Dato label="Radicado" value={proceso.radicado ?? "Sin radicar"} />
          <Dato label="Estado" value={ESTADO_LABEL[proceso.estado]} />
          <Dato label="Despacho / juzgado" value={proceso.despachoJuzgado ?? "—"} />
          <Dato label="Cuantía" value={proceso.cuantiaValor ? `$${formatMoney(proceso.cuantiaValor)}` : "—"} />
          <Dato label="Próxima audiencia" value={fecha(proceso.proximaAudiencia)} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Etapas del proceso
          </h3>
          <ol className="space-y-1">
            {etapas.map((e: EtapaDef, i: number) => {
              const done = i < idxActual;
              const current = i === idxActual;
              return (
                <li key={e.key}>
                  <button
                    type="button"
                    onClick={() => irAEtapa(e.key)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      current ? "bg-indigo-50 dark:bg-indigo-500/10" : ""
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                        done
                          ? "bg-emerald-500 text-white"
                          : current
                            ? "bg-indigo-600 text-white"
                            : "border border-slate-300 text-slate-400 dark:border-slate-700"
                      }`}
                    >
                      {done ? "✓" : e.orden}
                    </span>
                    <span className={current ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}>
                      {e.nombre}
                      {e.terminal && <span className="ml-2 text-xs text-slate-400">(final)</span>}
                    </span>
                    {e.reglas?.plazoDias && (
                      <span className="ml-auto text-xs text-slate-400">{e.reglas.plazoDias} días</span>
                    )}
                  </button>
                  {bloqueo?.etapa === e.key && (
                    <div className="ml-9 mt-1 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                      No puedes avanzar a esta etapa. Faltan: {bloqueo.faltantes.join(", ")}.
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-slate-400">
            Haz clic en una etapa para mover el proceso. Las etapas con reglas se bloquean si faltan datos.
          </p>
        </Card>

        <div className="space-y-5">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Partes</h3>
            <ul className="space-y-3 text-sm">
              {proceso.partes.map((p) => (
                <li key={p.id}>
                  <div className="font-medium text-slate-800 dark:text-slate-100">
                    {p.litigante.nombre}
                    {p.esNuestroCliente && (
                      <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                        Nuestro cliente
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {p.rol}
                    {p.litigante.tipoDocumento &&
                      ` · ${p.litigante.tipoDocumento} ${p.litigante.numeroDocumento ?? ""}`}
                  </div>
                </li>
              ))}
              {proceso.partes.length === 0 && (
                <li className="text-slate-400">Sin partes registradas.</li>
              )}
            </ul>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Documentos</h3>
            <DocumentosProceso procesoId={proceso.id} inicial={proceso.documentos ?? []} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  );
}

function fecha(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}
