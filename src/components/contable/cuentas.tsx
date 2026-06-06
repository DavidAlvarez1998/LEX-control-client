"use client";

// Pestaña Cuentas / bolsas: cuentas bancarias y cajas-bolsa. El saldo actual es
// DERIVADO por la API (saldoInicial + ingresos PAGADO − egresos PAGADO) y se
// consulta al ver el detalle. Lista + crear + editar + ver saldo.

import { useState } from "react";
import { Button, Modal, PlusIcon } from "@/components/ui";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/form-ui";
import { Badge, Banda, SectionCard, Tabla, humaniza, money, useCargar } from "./bits";
import { ApiError } from "@/lib/api";
import {
  contableApi, ESTADO_CUENTA, TIPO_CUENTA,
  type Cuenta, type CuentaDetalle,
} from "@/lib/contable";

const vacio = { entidadBancaria: "", tipoCuenta: "AHORROS", numeroCuenta: "", nombreBolsa: "", saldoInicial: "", estadoCuenta: "ACTIVA", observaciones: "" };
type Form = typeof vacio;

export function CuentasTab({ onCuentasChange }: { onCuentasChange: () => void }) {
  const { data, loading, error, recargar } = useCargar(() => contableApi.cuentas());
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(vacio);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<CuentaDetalle | null>(null);
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function abrirNuevo() { setEditId(null); setForm(vacio); setFormError(null); setOpen(true); }
  function abrirEdicion(c: Cuenta) {
    setEditId(c.id);
    setForm({
      entidadBancaria: c.entidadBancaria, tipoCuenta: c.tipoCuenta, numeroCuenta: c.numeroCuenta ?? "",
      nombreBolsa: c.nombreBolsa, saldoInicial: String(Math.round(Number(c.saldoInicial))),
      estadoCuenta: c.estadoCuenta, observaciones: "",
    });
    setFormError(null); setOpen(true);
  }

  function payload(f: Form) {
    return {
      entidadBancaria: f.entidadBancaria.trim(), tipoCuenta: f.tipoCuenta,
      numeroCuenta: f.numeroCuenta.trim() || undefined, nombreBolsa: f.nombreBolsa.trim(),
      saldoInicial: f.saldoInicial ? Number(f.saldoInicial) : undefined,
      estadoCuenta: f.estadoCuenta, observaciones: f.observaciones.trim() || undefined,
    };
  }

  async function guardar() {
    setFormError(null);
    if (!form.entidadBancaria.trim() || !form.nombreBolsa.trim()) { setFormError("Entidad y nombre de la bolsa son obligatorios."); return; }
    setSaving(true);
    try {
      if (editId) await contableApi.editarCuenta(editId, payload(form));
      else await contableApi.crearCuenta(payload(form));
      setOpen(false);
      await recargar();
      onCuentasChange();
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function verSaldo(c: Cuenta) { setDetalle(await contableApi.cuenta(c.id)); }

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">
      {error && <Banda tone="rojo" onRetry={recargar}>{error}</Banda>}
      <SectionCard title="Cuentas y bolsas" action={<Button onClick={abrirNuevo}><PlusIcon />Nueva cuenta</Button>}>
        <Tabla<Cuenta>
          filas={data ?? []}
          vacio="Aún no hay cuentas ni bolsas."
          cols={[
            { h: "Bolsa", cell: (c) => <span className="font-medium text-slate-800 dark:text-slate-100">{c.nombreBolsa}</span> },
            { h: "Entidad", cell: (c) => c.entidadBancaria },
            { h: "Tipo", cell: (c) => humaniza(c.tipoCuenta) },
            { h: "Saldo inicial", cell: (c) => money(c.saldoInicial) },
            { h: "Estado", cell: (c) => <Badge>{c.estadoCuenta}</Badge> },
            { h: "", right: true, cell: (c) => (
              <span className="flex justify-end gap-3 text-xs">
                <button onClick={() => verSaldo(c)} className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Ver saldo</button>
                <button onClick={() => abrirEdicion(c)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Editar</button>
              </span>
            ) },
          ]}
        />
      </SectionCard>

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={editId ? "Editar cuenta" : "Nueva cuenta / bolsa"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : editId ? "Guardar" : "Crear"}</Button>
          </>
        }
      >
        <Field label="Nombre de la bolsa" requerido><Input value={form.nombreBolsa} onChange={(v) => set("nombreBolsa", v)} placeholder="Ej. Cuenta principal" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Entidad bancaria" requerido><Input value={form.entidadBancaria} onChange={(v) => set("entidadBancaria", v)} placeholder="Ej. Bancolombia" /></Field>
          <Field label="Tipo de cuenta"><Select value={form.tipoCuenta} onChange={(v) => set("tipoCuenta", v)} opciones={[...TIPO_CUENTA]} placeholder="—" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="N.º de cuenta"><Input value={form.numeroCuenta} onChange={(v) => set("numeroCuenta", v)} placeholder="Opcional" /></Field>
          <Field label="Saldo inicial"><MoneyInput value={form.saldoInicial} onChange={(v) => set("saldoInicial", v)} placeholder="0" /></Field>
        </div>
        <Field label="Estado"><Select value={form.estadoCuenta} onChange={(v) => set("estadoCuenta", v)} opciones={[...ESTADO_CUENTA]} placeholder="—" /></Field>
        <Field label="Observaciones"><Textarea value={form.observaciones} onChange={(v) => set("observaciones", v)} placeholder="Opcional" rows={2} /></Field>
        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
      </Modal>

      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={detalle?.nombreBolsa ?? ""}
        footer={<Button onClick={() => setDetalle(null)}>Cerrar</Button>}>
        {detalle && (
          <div className="space-y-3 text-sm">
            <Dato k="Entidad" v={`${detalle.entidadBancaria} · ${humaniza(detalle.tipoCuenta)}`} />
            {detalle.numeroCuenta && <Dato k="N.º de cuenta" v={detalle.numeroCuenta} />}
            <Dato k="Saldo inicial" v={money(detalle.saldoInicial)} />
            <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/40">
              <span className="text-slate-500 dark:text-slate-400">Saldo actual (derivado): </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{money(detalle.saldoActual)}</span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">= saldo inicial + ingresos PAGADO − egresos PAGADO asociados a esta cuenta.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><span className="text-slate-500 dark:text-slate-400">{k}</span><span className="text-slate-800 dark:text-slate-100">{v}</span></div>;
}
