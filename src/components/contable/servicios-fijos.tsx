"use client";

// Pestaña Servicios fijos. Dos bloques:
//  1) Plantillas recurrentes: definen la regla una vez (frecuencia + día/mes de
//     pago) y desde ahí se GENERAN/causan las instancias del periodo.
//  2) Instancias por periodo (arriendo, públicos, software…): lista + crear +
//     editar + marcar pagado. @@unique (tipo, proveedor, periodo).

import { useState } from "react";
import { Button, Modal, PlusIcon } from "@/components/ui";
import { Field, Input, MoneyInput, NumberInput, Select } from "@/components/form-ui";
import { Badge, Banda, SectionCard, Tabla, fmtFecha, humaniza, money, useCargar } from "./bits";
import { errorMessage } from "@/lib/api";
import {
  contableApi, ESTADO_SERVICIO, FRECUENCIA_SERVICIO, TIPO_SERVICIO_FIJO,
  periodoActual, type Lookups, type ServicioFijo, type ServicioFijoRecurrente,
} from "@/lib/contable";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const vacio = { periodo: periodoActual(), tipoServicio: "ARRIENDO", proveedor: "", valorFacturado: "", fechaVencimiento: "", fechaPago: "", estadoPago: "PENDIENTE", cuentaId: "", soporteFacturaUrl: "" };
type Form = typeof vacio;

const vacioRec = { tipoServicio: "ARRIENDO", proveedor: "", valorEstimado: "", frecuencia: "MENSUAL", diaPago: "1", mesPago: "1", cuentaId: "", activo: true };
type FormRec = typeof vacioRec;

export function ServiciosFijosTab({ lookups }: { lookups: Lookups }) {
  const { data, loading, error, recargar } = useCargar(() => contableApi.serviciosFijos());
  const rec = useCargar(() => contableApi.serviciosFijosRecurrentes());

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(vacio);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const cls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";

  // --- plantillas recurrentes ---
  const [openRec, setOpenRec] = useState(false);
  const [editRecId, setEditRecId] = useState<string | null>(null);
  const [formRec, setFormRec] = useState<FormRec>(vacioRec);
  const [savingRec, setSavingRec] = useState(false);
  const [formRecError, setFormRecError] = useState<string | null>(null);
  const setR = (k: keyof FormRec, v: string | boolean) => setFormRec((f) => ({ ...f, [k]: v }));

  // --- generar periodo ---
  const [genPeriodo, setGenPeriodo] = useState(periodoActual());
  const [generando, setGenerando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  function abrirNuevo() { setEditId(null); setForm(vacio); setFormError(null); setOpen(true); }
  function abrirEdicion(s: ServicioFijo) {
    setEditId(s.id);
    setForm({
      periodo: s.periodo, tipoServicio: s.tipoServicio, proveedor: s.proveedor,
      valorFacturado: String(Math.round(Number(s.valorFacturado))),
      fechaVencimiento: s.fechaVencimiento ? s.fechaVencimiento.slice(0, 10) : "",
      fechaPago: s.fechaPago ? s.fechaPago.slice(0, 10) : "",
      estadoPago: s.estadoPago, cuentaId: s.cuentaId ?? "", soporteFacturaUrl: s.soporteFacturaUrl ?? "",
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
      soporteFacturaUrl: f.soporteFacturaUrl.trim() || undefined,
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
      setFormError(errorMessage(err, "Error al guardar."));
    } finally {
      setSaving(false);
    }
  }

  async function marcarPagado(s: ServicioFijo) { await contableApi.editarServicioFijo(s.id, { estadoPago: "PAGADO" }); await recargar(); }

  // ---- plantillas ----
  function abrirNuevoRec() { setEditRecId(null); setFormRec(vacioRec); setFormRecError(null); setOpenRec(true); }
  function abrirEdicionRec(p: ServicioFijoRecurrente) {
    setEditRecId(p.id);
    setFormRec({
      tipoServicio: p.tipoServicio, proveedor: p.proveedor,
      valorEstimado: String(Math.round(Number(p.valorEstimado))),
      frecuencia: p.frecuencia, diaPago: String(p.diaPago), mesPago: String(p.mesPago ?? 1),
      cuentaId: p.cuentaId ?? "", activo: p.activo,
    });
    setFormRecError(null); setOpenRec(true);
  }
  function payloadRec(f: FormRec) {
    return {
      tipoServicio: f.tipoServicio, proveedor: f.proveedor.trim(),
      valorEstimado: Number(f.valorEstimado), frecuencia: f.frecuencia,
      diaPago: Number(f.diaPago), mesPago: f.frecuencia === "ANUAL" ? Number(f.mesPago) : undefined,
      cuentaId: f.cuentaId || undefined, activo: f.activo,
    };
  }
  async function guardarRec() {
    setFormRecError(null);
    if (!formRec.proveedor.trim() || !formRec.valorEstimado) { setFormRecError("Proveedor y valor son obligatorios."); return; }
    const dia = Number(formRec.diaPago);
    if (!(dia >= 1 && dia <= 31)) { setFormRecError("El día de pago debe ser 1–31."); return; }
    setSavingRec(true);
    try {
      if (editRecId) await contableApi.editarServicioFijoRecurrente(editRecId, payloadRec(formRec));
      else await contableApi.crearServicioFijoRecurrente(payloadRec(formRec));
      setOpenRec(false);
      await rec.recargar();
    } catch (err) {
      setFormRecError(errorMessage(err, "Error al guardar."));
    } finally {
      setSavingRec(false);
    }
  }
  async function alternarActivo(p: ServicioFijoRecurrente) {
    await contableApi.editarServicioFijoRecurrente(p.id, { activo: !p.activo });
    await rec.recargar();
  }

  async function generar() {
    setAviso(null);
    if (!/^\d{4}-\d{2}$/.test(genPeriodo)) { setAviso("Periodo debe ser 'YYYY-MM'."); return; }
    setGenerando(true);
    try {
      const r = await contableApi.generarServiciosFijos(genPeriodo);
      setAviso(`Periodo ${r.periodo}: ${r.generadas} generadas · ${r.omitidas} ya existían (de ${r.candidatas} plantillas que aplican).`);
      await recargar();
    } catch (err) {
      setAviso(errorMessage(err, "Error al generar."));
    } finally {
      setGenerando(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">
      {error && <Banda tone="rojo" onRetry={recargar}>{error}</Banda>}
      {rec.error && <Banda tone="rojo" onRetry={rec.recargar}>{rec.error}</Banda>}
      {aviso && <Banda tone="verde">{aviso}</Banda>}

      {/* ---- Plantillas recurrentes ---- */}
      <SectionCard title="Plantillas recurrentes" action={<Button onClick={abrirNuevoRec}><PlusIcon />Nueva plantilla</Button>}>
        <Tabla<ServicioFijoRecurrente>
          filas={rec.data ?? []}
          vacio="Aún no hay plantillas. Crea una para que el sistema sepa qué se paga cada mes/año y en qué día."
          cols={[
            { h: "Servicio", cell: (p) => <span className="font-medium text-slate-800 dark:text-slate-100">{humaniza(p.tipoServicio)}</span> },
            { h: "Proveedor", cell: (p) => p.proveedor },
            { h: "Frecuencia", cell: (p) => p.frecuencia === "ANUAL" ? `Anual · ${MESES[p.mesPago ?? 0]} ${p.diaPago}` : `Mensual · día ${p.diaPago}` },
            { h: "Valor estimado", cell: (p) => <span className="text-rose-600 dark:text-rose-400">{money(p.valorEstimado)}</span> },
            { h: "Bolsa", cell: (p) => lookups.cuentas.find((c) => c.id === p.cuentaId)?.nombreBolsa ?? "—" },
            { h: "Estado", cell: (p) => <Badge>{p.activo ? "ACTIVA" : "INACTIVA"}</Badge> },
            { h: "", right: true, cell: (p) => (
              <span className="flex justify-end gap-3 text-xs">
                <button onClick={() => alternarActivo(p)} className="font-medium text-slate-500 hover:underline dark:text-slate-400">{p.activo ? "Desactivar" : "Activar"}</button>
                <button onClick={() => abrirEdicionRec(p)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Editar</button>
              </span>
            ) },
          ]}
        />
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Field label="Generar instancias del periodo">
            <Input value={genPeriodo} onChange={setGenPeriodo} placeholder="YYYY-MM" />
          </Field>
          <Button variant="ghost" onClick={generar} disabled={generando}>{generando ? "Generando…" : "Generar periodo"}</Button>
        </div>
      </SectionCard>

      {/* ---- Instancias por periodo ---- */}
      <SectionCard title="Servicios fijos del periodo" action={<Button onClick={abrirNuevo}><PlusIcon />Registrar servicio</Button>}>
        <Tabla<ServicioFijo>
          filas={data ?? []}
          vacio="Aún no hay servicios fijos registrados."
          cols={[
            { h: "Servicio", cell: (s) => <span className="font-medium text-slate-800 dark:text-slate-100">{humaniza(s.tipoServicio)}</span> },
            { h: "Proveedor", cell: (s) => s.proveedor },
            { h: "Periodo", cell: (s) => s.periodo },
            { h: "Valor", cell: (s) => <span className="text-rose-600 dark:text-rose-400">{money(s.valorFacturado)}</span> },
            { h: "Vence", cell: (s) => fmtFecha(s.fechaVencimiento) },
            { h: "Estado", cell: (s) => <Badge>{s.vencido ? "VENCIDO" : s.estadoPago}</Badge> },
            { h: "", right: true, cell: (s) => (
              <span className="flex justify-end gap-3 text-xs">
                {s.estadoPago !== "PAGADO" && <button onClick={() => marcarPagado(s)} className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Marcar pagado</button>}
                <button onClick={() => abrirEdicion(s)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Editar</button>
              </span>
            ) },
          ]}
        />
      </SectionCard>

      {/* ---- Modal instancia ---- */}
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
        <Field label="Soporte de factura (URL)">
          <Input value={form.soporteFacturaUrl} onChange={(v) => set("soporteFacturaUrl", v)} placeholder="https://… (enlace al soporte)" />
        </Field>
        {form.soporteFacturaUrl.trim() && (
          <a href={form.soporteFacturaUrl} target="_blank" rel="noopener noreferrer" className="-mt-1 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Abrir soporte ↗</a>
        )}
        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
      </Modal>

      {/* ---- Modal plantilla ---- */}
      <Modal
        open={openRec}
        onClose={() => !savingRec && setOpenRec(false)}
        title={editRecId ? "Editar plantilla recurrente" : "Nueva plantilla recurrente"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenRec(false)} disabled={savingRec}>Cancelar</Button>
            <Button onClick={guardarRec} disabled={savingRec}>{savingRec ? "Guardando…" : editRecId ? "Guardar" : "Crear"}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de servicio"><Select value={formRec.tipoServicio} onChange={(v) => setR("tipoServicio", v)} opciones={[...TIPO_SERVICIO_FIJO]} placeholder="—" /></Field>
          <Field label="Proveedor" requerido><Input value={formRec.proveedor} onChange={(v) => setR("proveedor", v)} placeholder="Ej. Claro, EPM…" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor estimado" requerido><MoneyInput value={formRec.valorEstimado} onChange={(v) => setR("valorEstimado", v)} placeholder="0" /></Field>
          <Field label="Frecuencia"><Select value={formRec.frecuencia} onChange={(v) => setR("frecuencia", v)} opciones={[...FRECUENCIA_SERVICIO]} placeholder="—" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Día de pago" requerido><NumberInput value={formRec.diaPago} onChange={(v) => setR("diaPago", v)} placeholder="1–31" /></Field>
          {formRec.frecuencia === "ANUAL" && (
            <Field label="Mes de pago" requerido>
              <select value={formRec.mesPago} onChange={(e) => setR("mesPago", e.target.value)} className={cls}>
                {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </Field>
          )}
        </div>
        <p className="-mt-1 text-xs text-slate-400 dark:text-slate-500">
          {formRec.frecuencia === "ANUAL"
            ? `Vence cada año el ${formRec.diaPago} de ${MESES[Number(formRec.mesPago) || 0]}.`
            : `Vence el día ${formRec.diaPago} de cada mes.`}
        </p>
        <Field label="Cuenta / bolsa por defecto">
          <select value={formRec.cuentaId} onChange={(e) => setR("cuentaId", e.target.value)} className={cls}>
            <option value="">Ninguna</option>
            {lookups.cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombreBolsa}</option>)}
          </select>
        </Field>
        {formRecError && <p className="text-sm text-red-600 dark:text-red-400">{formRecError}</p>}
      </Modal>
    </div>
  );
}
