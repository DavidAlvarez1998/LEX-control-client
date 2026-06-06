"use client";

// Pestaña Servicios fijos: recurrentes por periodo (arriendo, servicios públicos,
// software…). Lista + crear + editar + marcar pagado. @@unique (proveedor, periodo).

import { useState } from "react";
import { Button, Modal, PlusIcon } from "@/components/ui";
import { Field, Input, MoneyInput, Select } from "@/components/form-ui";
import { Badge, Banda, SectionCard, Tabla, fmtFecha, humaniza, money, useCargar } from "./bits";
import { ApiError } from "@/lib/api";
import {
  contableApi, ESTADO_SERVICIO, TIPO_SERVICIO_FIJO,
  periodoActual, type Lookups, type ServicioFijo,
} from "@/lib/contable";

const vacio = { periodo: periodoActual(), tipoServicio: "ARRIENDO", proveedor: "", valorFacturado: "", fechaVencimiento: "", fechaPago: "", estadoPago: "PENDIENTE", cuentaId: "" };
type Form = typeof vacio;

export function ServiciosFijosTab({ lookups }: { lookups: Lookups }) {
  const { data, loading, error, recargar } = useCargar(() => contableApi.serviciosFijos());
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(vacio);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const cls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";

  function abrirNuevo() { setEditId(null); setForm(vacio); setFormError(null); setOpen(true); }
  function abrirEdicion(s: ServicioFijo) {
    setEditId(s.id);
    setForm({
      periodo: s.periodo, tipoServicio: s.tipoServicio, proveedor: s.proveedor,
      valorFacturado: String(Math.round(Number(s.valorFacturado))),
      fechaVencimiento: s.fechaVencimiento ? s.fechaVencimiento.slice(0, 10) : "",
      fechaPago: s.fechaPago ? s.fechaPago.slice(0, 10) : "",
      estadoPago: s.estadoPago, cuentaId: s.cuentaId ?? "",
    });
    setFormError(null); setOpen(true);
  }

  function payload(f: Form) {
    return {
      periodo: f.periodo, tipoServicio: f.tipoServicio, proveedor: f.proveedor.trim(),
      valorFacturado: Number(f.valorFacturado),
      fechaVencimiento: f.fechaVencimiento || undefined,
      fechaPago: f.fechaPago || undefined,
      estadoPago: f.estadoPago, cuentaId: f.cuentaId || undefined,
    };
  }

  async function guardar() {
    setFormError(null);
    if (!form.proveedor.trim() || !form.valorFacturado) { setFormError("Proveedor y valor son obligatorios."); return; }
    if (!/^\d{4}-\d{2}$/.test(form.periodo)) { setFormError("Periodo debe ser 'YYYY-MM'."); return; }
    setSaving(true);
    try {
      if (editId) await contableApi.editarServicioFijo(editId, payload(form));
      else await contableApi.crearServicioFijo(payload(form));
      setOpen(false);
      await recargar();
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function marcarPagado(s: ServicioFijo) { await contableApi.editarServicioFijo(s.id, { estadoPago: "PAGADO" }); await recargar(); }

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">
      {error && <Banda tone="rojo" onRetry={recargar}>{error}</Banda>}
      <SectionCard title="Servicios fijos" action={<Button onClick={abrirNuevo}><PlusIcon />Registrar servicio</Button>}>
        <Tabla<ServicioFijo>
          filas={data ?? []}
          vacio="Aún no hay servicios fijos registrados."
          cols={[
            { h: "Servicio", cell: (s) => <span className="font-medium text-slate-800 dark:text-slate-100">{humaniza(s.tipoServicio)}</span> },
            { h: "Proveedor", cell: (s) => s.proveedor },
            { h: "Periodo", cell: (s) => s.periodo },
            { h: "Valor", cell: (s) => <span className="text-rose-600 dark:text-rose-400">{money(s.valorFacturado)}</span> },
            { h: "Vence", cell: (s) => fmtFecha(s.fechaVencimiento) },
            { h: "Estado", cell: (s) => <Badge>{s.estadoPago}</Badge> },
            { h: "", right: true, cell: (s) => (
              <span className="flex justify-end gap-3 text-xs">
                {s.estadoPago !== "PAGADO" && <button onClick={() => marcarPagado(s)} className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Marcar pagado</button>}
                <button onClick={() => abrirEdicion(s)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Editar</button>
              </span>
            ) },
          ]}
        />
      </SectionCard>

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={editId ? "Editar servicio fijo" : "Registrar servicio fijo"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : editId ? "Guardar" : "Registrar"}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de servicio"><Select value={form.tipoServicio} onChange={(v) => set("tipoServicio", v)} opciones={[...TIPO_SERVICIO_FIJO]} placeholder="—" /></Field>
          <Field label="Proveedor" requerido><Input value={form.proveedor} onChange={(v) => set("proveedor", v)} placeholder="Ej. Claro, EPM…" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Periodo" requerido><Input value={form.periodo} onChange={(v) => set("periodo", v)} placeholder="YYYY-MM" /></Field>
          <Field label="Valor facturado" requerido><MoneyInput value={form.valorFacturado} onChange={(v) => set("valorFacturado", v)} placeholder="0" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vencimiento"><Input type="date" value={form.fechaVencimiento} onChange={(v) => set("fechaVencimiento", v)} /></Field>
          <Field label="Estado"><Select value={form.estadoPago} onChange={(v) => set("estadoPago", v)} opciones={[...ESTADO_SERVICIO]} placeholder="—" /></Field>
        </div>
        <Field label="Cuenta / bolsa">
          <select value={form.cuentaId} onChange={(e) => set("cuentaId", e.target.value)} className={cls}>
            <option value="">Ninguna</option>
            {lookups.cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombreBolsa}</option>)}
          </select>
        </Field>
        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
      </Modal>
    </div>
  );
}
