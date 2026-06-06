"use client";

// Pestaña Cartera (cuentas por cobrar): una fila por contrato. El total se toma
// como SNAPSHOT del plan de cobro comercial; pagado/saldo son DERIVADOS de los
// ingresos. Abrir cartera desde un contrato firmado + re-sincronizar el total.

import { useState } from "react";
import { Button, Modal, PlusIcon } from "@/components/ui";
import { Field } from "@/components/form-ui";
import { Badge, Banda, SectionCard, Tabla, fmtFecha, humaniza, money, useCargar } from "./bits";
import { ApiError } from "@/lib/api";
import { contableApi, type CarteraRow, type ContratoMin, type Lookups } from "@/lib/contable";

export function CarteraTab({ lookups }: { lookups: Lookups }) {
  const { data, loading, error, recargar } = useCargar(() => contableApi.cartera());
  const [contratos, setContratos] = useState<ContratoMin[]>([]);
  const [open, setOpen] = useState(false);
  const [contratoId, setContratoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const cls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";

  async function abrirModal() {
    setFormError(null); setContratoId(""); setOpen(true);
    setContratos(await contableApi.contratos());
  }

  // Solo contratos firmados que aún no tienen cartera.
  const conCartera = new Set((data ?? []).map((c) => c.contratoId).filter(Boolean));
  const disponibles = contratos.filter((c) => c.estadoContrato === "FIRMADO" && !conCartera.has(c.id));

  async function abrir() {
    setFormError(null);
    if (!contratoId) { setFormError("Selecciona un contrato firmado."); return; }
    setSaving(true);
    try {
      await contableApi.abrirCartera({ contratoId });
      setOpen(false);
      await recargar();
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : "Error al abrir cartera.");
    } finally {
      setSaving(false);
    }
  }

  async function resync(c: CarteraRow) {
    setBusyId(c.id);
    try { await contableApi.resyncCartera(c.id); await recargar(); }
    finally { setBusyId(null); }
  }

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">
      {error && <Banda tone="rojo" onRetry={recargar}>{error}</Banda>}
      <SectionCard title="Cartera (cuentas por cobrar)" action={<Button onClick={abrirModal}><PlusIcon />Abrir cartera</Button>}>
        <Tabla<CarteraRow>
          filas={data ?? []}
          vacio="Sin cartera. Se abre desde un contrato firmado."
          cols={[
            { h: "Cliente", cell: (c) => <span className="font-medium text-slate-800 dark:text-slate-100">{lookups.nombreCliente(c.clienteId)}</span> },
            { h: "Modalidad", cell: (c) => humaniza(c.tipoCobro) },
            { h: "Total acordado", cell: (c) => money(c.valorTotalAcordado) },
            { h: "Pagado", cell: (c) => <span className="text-emerald-700 dark:text-emerald-400">{money(c.valorPagado)}</span> },
            { h: "Saldo", cell: (c) => <span className="font-medium text-slate-800 dark:text-slate-100">{money(c.saldoPendiente)}</span> },
            { h: "Próximo pago", cell: (c) => fmtFecha(c.fechaProximoPago) },
            { h: "Estado", cell: (c) => <Badge>{c.estadoCartera}</Badge> },
            { h: "", right: true, cell: (c) => (
              <button onClick={() => resync(c)} disabled={busyId === c.id} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50">
                {busyId === c.id ? "…" : "Re-sincronizar"}
              </button>
            ) },
          ]}
        />
      </SectionCard>

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Abrir cartera"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={abrir} disabled={saving || !contratoId}>{saving ? "Abriendo…" : "Abrir"}</Button>
          </>
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          La cartera toma el total del plan de cobro del contrato. Solo aparecen contratos firmados sin cartera.
        </p>
        <Field label="Contrato" requerido>
          <select value={contratoId} onChange={(e) => setContratoId(e.target.value)} className={cls}>
            <option value="">Selecciona un contrato…</option>
            {disponibles.map((c) => (
              <option key={c.id} value={c.id}>
                {lookups.nombreCliente(c.clienteId)} · {money(c.valorAcordado)} · {humaniza(c.tipoCobroAcordado)}
              </option>
            ))}
          </select>
        </Field>
        {disponibles.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-500">No hay contratos firmados disponibles para abrir cartera.</p>}
        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
      </Modal>
    </div>
  );
}
