"use client";

// Pestaña Egresos: lista + crear + editar + marcar pagado.

import { useState } from "react";
import { Button, Modal, PlusIcon } from "@/components/ui";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/form-ui";
import { Badge, Banda, SectionCard, Tabla, fmtFecha, humaniza, money, useCargar } from "./bits";
import { ProcesoCuenta, SelectCliente } from "./ingresos";
import { ApiError } from "@/lib/api";
import {
  contableApi, CATEGORIA_EGRESO, ESTADO_GASTO, METODO_PAGO, TIPO_GASTO,
  type Egreso, type Lookups,
} from "@/lib/contable";

const vacio = { tipoGasto: "GENERAL", categoriaGasto: "SERVICIOS", subcategoria: "", descripcionGasto: "", valorGasto: "", medioPago: "TRANSFERENCIA", estadoGasto: "PAGADO", clienteId: "", procesoId: "", cuentaId: "", observaciones: "" };
type Form = typeof vacio;

export function EgresosTab({ lookups }: { lookups: Lookups }) {
  const { data, loading, error, recargar } = useCargar(() => contableApi.egresos());
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(vacio);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function abrirNuevo() { setEditId(null); setForm(vacio); setFormError(null); setOpen(true); }
  function abrirEdicion(e: Egreso) {
    setEditId(e.id);
    setForm({
      tipoGasto: e.tipoGasto, categoriaGasto: e.categoriaGasto, subcategoria: e.subcategoria ?? "",
      descripcionGasto: e.descripcionGasto, valorGasto: String(Math.round(Number(e.valorGasto))),
      medioPago: e.medioPago, estadoGasto: e.estadoGasto, clienteId: e.clienteId ?? "",
      procesoId: e.procesoId ?? "", cuentaId: e.cuentaId ?? "", observaciones: "",
    });
    setFormError(null);
    setOpen(true);
  }

  function payload(f: Form) {
    return {
      tipoGasto: f.tipoGasto, categoriaGasto: f.categoriaGasto,
      subcategoria: f.subcategoria.trim() || undefined,
      descripcionGasto: f.descripcionGasto.trim(), valorGasto: Number(f.valorGasto),
      medioPago: f.medioPago, estadoGasto: f.estadoGasto,
      clienteId: f.clienteId || undefined, procesoId: f.procesoId || undefined,
      cuentaId: f.cuentaId || undefined, observaciones: f.observaciones.trim() || undefined,
    };
  }

  async function guardar() {
    setFormError(null);
    if (!form.descripcionGasto.trim() || !form.valorGasto) { setFormError("Descripción y valor son obligatorios."); return; }
    setSaving(true);
    try {
      if (editId) await contableApi.editarEgreso(editId, payload(form));
      else await contableApi.crearEgreso(payload(form));
      setOpen(false);
      await recargar();
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function marcarPagado(e: Egreso) {
    await contableApi.editarEgreso(e.id, { estadoGasto: "PAGADO" });
    await recargar();
  }

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">
      {error && <Banda tone="rojo" onRetry={recargar}>{error}</Banda>}
      <SectionCard title="Egresos" action={<Button onClick={abrirNuevo}><PlusIcon />Registrar egreso</Button>}>
        <Tabla<Egreso>
          filas={data ?? []}
          vacio="Aún no hay egresos registrados."
          cols={[
            { h: "Descripción", cell: (e) => <span className="font-medium text-slate-800 dark:text-slate-100">{e.descripcionGasto}</span> },
            { h: "Categoría", cell: (e) => humaniza(e.categoriaGasto) },
            { h: "Proceso", cell: (e) => (e.procesoId ? lookups.tituloProceso(e.procesoId) : (e.tipoGasto === "GENERAL" ? "General" : "—")) },
            { h: "Valor", cell: (e) => <span className="text-rose-600 dark:text-rose-400">{money(e.valorGasto)}</span> },
            { h: "Medio", cell: (e) => <span className="capitalize">{e.medioPago.toLowerCase()}</span> },
            { h: "Estado", cell: (e) => <Badge>{e.estadoGasto}</Badge> },
            { h: "Fecha", cell: (e) => fmtFecha(e.fechaGasto) },
            { h: "", right: true, cell: (e) => (
              <span className="flex justify-end gap-3 text-xs">
                {e.estadoGasto === "PENDIENTE" && <button onClick={() => marcarPagado(e)} className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Marcar pagado</button>}
                <button onClick={() => abrirEdicion(e)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Editar</button>
              </span>
            ) },
          ]}
        />
      </SectionCard>

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={editId ? "Editar egreso" : "Registrar egreso"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : editId ? "Guardar" : "Registrar"}</Button>
          </>
        }
      >
        <Field label="Descripción" requerido><Input value={form.descripcionGasto} onChange={(v) => set("descripcionGasto", v)} placeholder="Ej. Pago de papelería" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de gasto"><Select value={form.tipoGasto} onChange={(v) => set("tipoGasto", v)} opciones={[...TIPO_GASTO]} placeholder="—" /></Field>
          <Field label="Categoría"><Select value={form.categoriaGasto} onChange={(v) => set("categoriaGasto", v)} opciones={[...CATEGORIA_EGRESO]} placeholder="—" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor" requerido><MoneyInput value={form.valorGasto} onChange={(v) => set("valorGasto", v)} placeholder="0" /></Field>
          <Field label="Medio de pago"><Select value={form.medioPago} onChange={(v) => set("medioPago", v)} opciones={[...METODO_PAGO]} placeholder="—" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estado"><Select value={form.estadoGasto} onChange={(v) => set("estadoGasto", v)} opciones={[...ESTADO_GASTO]} placeholder="—" /></Field>
          <Field label="Subcategoría"><Input value={form.subcategoria} onChange={(v) => set("subcategoria", v)} placeholder="Opcional" /></Field>
        </div>
        {form.tipoGasto === "POR_PROCESO" && (
          <SelectCliente lookups={lookups} value={form.clienteId} onChange={(v) => set("clienteId", v)} />
        )}
        <ProcesoCuenta lookups={lookups} procesoId={form.procesoId} cuentaId={form.cuentaId}
          onProceso={(v) => set("procesoId", v)} onCuenta={(v) => set("cuentaId", v)} />
        <Field label="Observaciones"><Textarea value={form.observaciones} onChange={(v) => set("observaciones", v)} placeholder="Opcional" rows={2} /></Field>
        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
      </Modal>
    </div>
  );
}
