"use client";

// Pestaña Ingresos (append-only): lista + registrar. No hay edición por diseño.

import { useState } from "react";
import { Button, Modal, PlusIcon } from "@/components/ui";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/form-ui";
import { Badge, Banda, SectionCard, Tabla, fmtFecha, money, useCargar } from "./bits";
import { errorMessage } from "@/lib/api";
import {
  contableApi, ESTADO_PAGO_INGRESO, METODO_PAGO, TIPO_COBRO,
  type Ingreso, type Lookups,
} from "@/lib/contable";

const vacio = { clienteId: "", procesoId: "", cuentaId: "", conceptoPago: "", tipoCobro: "ABONO", valorRecibido: "", metodoPago: "TRANSFERENCIA", estadoPago: "PAGADO", numeroComprobante: "", observaciones: "" };

export function IngresosTab({ lookups }: { lookups: Lookups }) {
  const { data, loading, error, recargar } = useCargar(() => contableApi.ingresos());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(vacio);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const set = (k: keyof typeof vacio, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    setFormError(null);
    if (!form.clienteId || !form.conceptoPago.trim() || !form.valorRecibido) {
      setFormError("Cliente, concepto y valor son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await contableApi.crearIngreso({
        clienteId: form.clienteId,
        procesoId: form.procesoId || undefined,
        cuentaId: form.cuentaId || undefined,
        conceptoPago: form.conceptoPago.trim(),
        tipoCobro: form.tipoCobro,
        valorRecibido: Number(form.valorRecibido),
        metodoPago: form.metodoPago,
        estadoPago: form.estadoPago,
        numeroComprobante: form.numeroComprobante.trim() || undefined,
        observaciones: form.observaciones.trim() || undefined,
      });
      setOpen(false);
      setForm(vacio);
      await recargar();
    } catch (err) {
      setFormError(errorMessage(err, "Error al registrar."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">
      {error && <Banda tone="rojo" onRetry={recargar}>{error}</Banda>}
      <SectionCard
        title="Ingresos"
        action={<Button onClick={() => setOpen(true)}><PlusIcon />Registrar ingreso</Button>}
      >
        <Tabla<Ingreso>
          filas={data ?? []}
          vacio="Aún no hay ingresos registrados."
          cols={[
            { h: "Concepto", cell: (i) => <span className="font-medium text-slate-800 dark:text-slate-100">{i.conceptoPago}</span> },
            { h: "Cliente", cell: (i) => lookups.nombreCliente(i.clienteId) },
            { h: "Proceso", cell: (i) => (i.procesoId ? lookups.tituloProceso(i.procesoId) : "—") },
            { h: "Valor", cell: (i) => <span className="text-emerald-700 dark:text-emerald-400">{money(i.valorRecibido)}</span> },
            { h: "Tipo", cell: (i) => i.tipoCobro },
            { h: "Método", cell: (i) => <span className="capitalize">{i.metodoPago.toLowerCase()}</span> },
            { h: "Estado", cell: (i) => <Badge>{i.estadoPago}</Badge> },
            { h: "Fecha", cell: (i) => fmtFecha(i.fechaIngreso) },
          ]}
        />
      </SectionCard>

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Registrar ingreso"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Registrar"}</Button>
          </>
        }
      >
        <SelectCliente lookups={lookups} value={form.clienteId} onChange={(v) => set("clienteId", v)} requerido />
        <Field label="Concepto" requerido>
          <Input value={form.conceptoPago} onChange={(v) => set("conceptoPago", v)} placeholder="Ej. Anticipo honorarios" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tipo de cobro"><Select value={form.tipoCobro} onChange={(v) => set("tipoCobro", v)} opciones={[...TIPO_COBRO]} placeholder="—" /></Field>
          <Field label="Método de pago"><Select value={form.metodoPago} onChange={(v) => set("metodoPago", v)} opciones={[...METODO_PAGO]} placeholder="—" /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Valor" requerido><MoneyInput value={form.valorRecibido} onChange={(v) => set("valorRecibido", v)} placeholder="0" /></Field>
          <Field label="Estado"><Select value={form.estadoPago} onChange={(v) => set("estadoPago", v)} opciones={[...ESTADO_PAGO_INGRESO]} placeholder="—" /></Field>
        </div>
        <ProcesoCuenta lookups={lookups} procesoId={form.procesoId} cuentaId={form.cuentaId}
          onProceso={(v) => set("procesoId", v)} onCuenta={(v) => set("cuentaId", v)} />
        <Field label="N.º de comprobante"><Input value={form.numeroComprobante} onChange={(v) => set("numeroComprobante", v)} placeholder="Opcional" /></Field>
        <Field label="Observaciones"><Textarea value={form.observaciones} onChange={(v) => set("observaciones", v)} placeholder="Opcional" rows={2} /></Field>
        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
      </Modal>
    </div>
  );
}

// --- Selects nativos que muestran nombre pero envían id (el Select genérico solo usa strings sueltos) ---
export function SelectCliente({ lookups, value, onChange, requerido }: { lookups: Lookups; value: string; onChange: (v: string) => void; requerido?: boolean }) {
  const cls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";
  return (
    <Field label="Cliente" requerido={requerido}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        <option value="">Selecciona un cliente…</option>
        {lookups.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
    </Field>
  );
}

export function ProcesoCuenta({ lookups, procesoId, cuentaId, onProceso, onCuenta }: {
  lookups: Lookups; procesoId: string; cuentaId: string; onProceso: (v: string) => void; onCuenta: (v: string) => void;
}) {
  const cls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Proceso (opcional)">
        <select value={procesoId} onChange={(e) => onProceso(e.target.value)} className={cls}>
          <option value="">Ninguno</option>
          {lookups.procesos.map((p) => <option key={p.id} value={p.id}>{p.codigoInterno} · {p.titulo}</option>)}
        </select>
      </Field>
      <Field label="Cuenta / bolsa (opcional)">
        <select value={cuentaId} onChange={(e) => onCuenta(e.target.value)} className={cls}>
          <option value="">Ninguna</option>
          {lookups.cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombreBolsa}</option>)}
        </select>
      </Field>
    </div>
  );
}
