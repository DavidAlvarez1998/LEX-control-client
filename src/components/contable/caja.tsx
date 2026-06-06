"use client";

// Pestaña Caja menor: fondos (cajas) + sus movimientos. El saldo es DERIVADO por
// la API (montoInicial − salidas + reposiciones). Lista → detalle con movimientos.

import { useState } from "react";
import { Button, Modal, PlusIcon } from "@/components/ui";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/form-ui";
import { Badge, Banda, SectionCard, Tabla, fmtFecha, humaniza, money, useCargar } from "./bits";
import { ApiError } from "@/lib/api";
import {
  contableApi, CATEGORIA_CAJA, METODO_PAGO, TIPO_MOV_CAJA,
  type CajaDetalle, type CajaMenor, type Lookups, type Movimiento,
} from "@/lib/contable";

export function CajaTab({ lookups }: { lookups: Lookups }) {
  const { data, loading, error, recargar } = useCargar(() => contableApi.cajas());

  // Crear caja
  const [openCaja, setOpenCaja] = useState(false);
  const [cajaForm, setCajaForm] = useState({ nombre: "", montoInicial: "", observaciones: "" });
  const [savingCaja, setSavingCaja] = useState(false);
  const [cajaError, setCajaError] = useState<string | null>(null);

  // Detalle
  const [detalle, setDetalle] = useState<CajaDetalle | null>(null);

  async function crearCaja() {
    setCajaError(null);
    if (!cajaForm.nombre.trim() || !cajaForm.montoInicial) { setCajaError("Nombre y monto inicial son obligatorios."); return; }
    setSavingCaja(true);
    try {
      await contableApi.crearCaja({ nombre: cajaForm.nombre.trim(), montoInicial: Number(cajaForm.montoInicial), observaciones: cajaForm.observaciones.trim() || undefined });
      setOpenCaja(false);
      setCajaForm({ nombre: "", montoInicial: "", observaciones: "" });
      await recargar();
    } catch (err) {
      setCajaError(err instanceof ApiError || err instanceof Error ? err.message : "Error al crear.");
    } finally {
      setSavingCaja(false);
    }
  }

  async function abrirDetalle(c: CajaMenor) { setDetalle(await contableApi.caja(c.id)); }
  async function refrescarDetalle(id: string) { setDetalle(await contableApi.caja(id)); await recargar(); }

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">
      {error && <Banda tone="rojo" onRetry={recargar}>{error}</Banda>}
      <SectionCard title="Cajas menores" action={<Button onClick={() => setOpenCaja(true)}><PlusIcon />Nueva caja</Button>}>
        <Tabla<CajaMenor>
          filas={data ?? []}
          vacio="Aún no hay cajas menores."
          cols={[
            { h: "Caja", cell: (c) => <span className="font-medium text-slate-800 dark:text-slate-100">{c.nombre}</span> },
            { h: "Monto inicial", cell: (c) => money(c.montoInicial) },
            { h: "Estado", cell: (c) => <Badge>{c.estado}</Badge> },
            { h: "Creada", cell: (c) => fmtFecha(c.createdAt) },
            { h: "", right: true, cell: (c) => (
              <button onClick={() => abrirDetalle(c)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Ver movimientos</button>
            ) },
          ]}
        />
      </SectionCard>

      {/* Crear caja */}
      <Modal
        open={openCaja}
        onClose={() => !savingCaja && setOpenCaja(false)}
        title="Nueva caja menor"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenCaja(false)} disabled={savingCaja}>Cancelar</Button>
            <Button onClick={crearCaja} disabled={savingCaja}>{savingCaja ? "Creando…" : "Crear"}</Button>
          </>
        }
      >
        <Field label="Nombre" requerido><Input value={cajaForm.nombre} onChange={(v) => setCajaForm((f) => ({ ...f, nombre: v }))} placeholder="Ej. Caja recepción" /></Field>
        <Field label="Monto inicial" requerido><MoneyInput value={cajaForm.montoInicial} onChange={(v) => setCajaForm((f) => ({ ...f, montoInicial: v }))} placeholder="0" /></Field>
        <Field label="Observaciones"><Textarea value={cajaForm.observaciones} onChange={(v) => setCajaForm((f) => ({ ...f, observaciones: v }))} placeholder="Opcional" rows={2} /></Field>
        {cajaError && <p className="text-sm text-red-600 dark:text-red-400">{cajaError}</p>}
      </Modal>

      {/* Detalle con movimientos */}
      {detalle && (
        <DetalleCaja
          detalle={detalle}
          lookups={lookups}
          onClose={() => setDetalle(null)}
          onChange={() => refrescarDetalle(detalle.id)}
        />
      )}
    </div>
  );
}

const movVacio = { tipoMovimiento: "SALIDA", concepto: "", categoria: "TRANSPORTE", valor: "", medioSalida: "EFECTIVO", procesoId: "" };

function DetalleCaja({ detalle, lookups, onClose, onChange }: { detalle: CajaDetalle; lookups: Lookups; onClose: () => void; onChange: () => void }) {
  const [form, setForm] = useState(movVacio);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [agregar, setAgregar] = useState(false);
  const cerrada = detalle.estado === "CERRADA";
  const set = (k: keyof typeof movVacio, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const cls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";

  async function guardarMov() {
    setErr(null);
    if (!form.concepto.trim() || !form.valor) { setErr("Concepto y valor son obligatorios."); return; }
    setSaving(true);
    try {
      await contableApi.crearMovimiento(detalle.id, {
        tipoMovimiento: form.tipoMovimiento, concepto: form.concepto.trim(), categoria: form.categoria,
        valor: Number(form.valor), medioSalida: form.medioSalida, procesoId: form.procesoId || undefined,
      });
      setForm(movVacio); setAgregar(false); onChange();
    } catch (e) {
      setErr(e instanceof ApiError || e instanceof Error ? e.message : "Error al registrar.");
    } finally {
      setSaving(false);
    }
  }

  async function cerrarCaja() {
    await contableApi.editarCaja(detalle.id, { estado: "CERRADA" });
    onChange();
  }

  return (
    <Modal open onClose={onClose} title={detalle.nombre} size="lg"
      footer={
        <>
          {!cerrada && <Button variant="ghost" onClick={cerrarCaja}>Cerrar caja</Button>}
          <Button onClick={onClose}>Cerrar</Button>
        </>
      }
    >
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/40">
        <div>
          <span className="text-sm text-slate-500 dark:text-slate-400">Saldo actual</span>
          <p className="text-xl font-semibold text-slate-800 dark:text-slate-100">{money(detalle.saldoActual)}</p>
        </div>
        <div className="text-right text-xs text-slate-400 dark:text-slate-500">
          <Badge>{detalle.estado}</Badge>
          <p className="mt-1">Inicial: {money(detalle.montoInicial)}</p>
        </div>
      </div>

      {!cerrada && (
        agregar ? (
          <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo"><Select value={form.tipoMovimiento} onChange={(v) => set("tipoMovimiento", v)} opciones={[...TIPO_MOV_CAJA]} placeholder="—" /></Field>
              <Field label="Categoría"><Select value={form.categoria} onChange={(v) => set("categoria", v)} opciones={[...CATEGORIA_CAJA]} placeholder="—" /></Field>
            </div>
            <Field label="Concepto" requerido><Input value={form.concepto} onChange={(v) => set("concepto", v)} placeholder="Ej. Taxi a juzgado" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor" requerido><MoneyInput value={form.valor} onChange={(v) => set("valor", v)} placeholder="0" /></Field>
              <Field label="Medio"><Select value={form.medioSalida} onChange={(v) => set("medioSalida", v)} opciones={[...METODO_PAGO]} placeholder="—" /></Field>
            </div>
            <Field label="Proceso (opcional)">
              <select value={form.procesoId} onChange={(e) => set("procesoId", e.target.value)} className={cls}>
                <option value="">Ninguno</option>
                {lookups.procesos.map((p) => <option key={p.id} value={p.id}>{p.codigoInterno} · {p.titulo}</option>)}
              </select>
            </Field>
            {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAgregar(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={guardarMov} disabled={saving}>{saving ? "Guardando…" : "Agregar"}</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setAgregar(true)} className="w-full"><PlusIcon />Agregar movimiento</Button>
        )
      )}

      <div className="-mx-5">
        <Tabla<Movimiento>
          filas={detalle.movimientos}
          vacio="Sin movimientos."
          cols={[
            { h: "Fecha", cell: (m) => fmtFecha(m.fechaMovimiento) },
            { h: "Concepto", cell: (m) => <span className="font-medium text-slate-800 dark:text-slate-100">{m.concepto}</span> },
            { h: "Categoría", cell: (m) => humaniza(m.categoria) },
            { h: "Tipo", cell: (m) => <Badge tone={m.tipoMovimiento === "REPOSICION" ? "verde" : "ambar"}>{m.tipoMovimiento}</Badge> },
            { h: "Valor", cell: (m) => (
              <span className={m.tipoMovimiento === "REPOSICION" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                {m.tipoMovimiento === "REPOSICION" ? "+" : "−"}{money(m.valor)}
              </span>
            ) },
          ]}
        />
      </div>
    </Modal>
  );
}
