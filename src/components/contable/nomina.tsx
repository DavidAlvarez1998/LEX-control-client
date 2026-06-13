"use client";

// Pestaña Nómina: lista por periodo + crear + editar. El neto a pagar se calcula
// (salario + auxilio + bonificaciones − descuentos) y se envía a la API.

import { useEffect, useState } from "react";
import { Button, Modal, PlusIcon } from "@/components/ui";
import { Field, Input, MoneyInput, Select } from "@/components/form-ui";
import { Badge, Banda, SectionCard, Tabla, money, useCargar } from "./bits";
import { errorMessage } from "@/lib/api";
import {
  contableApi, ESTADO_PAGO_NOMINA, TIPO_VINCULACION,
  periodoActual, type Empleable, type Lookups, type Nomina,
} from "@/lib/contable";

// empleadoId / fechaIngreso son portadores: se copian del contrato al elegirlo y
// viajan en el payload, aunque no tengan input propio (la antigüedad se muestra).
const vacio = { nombreEmpleado: "", cargo: "", tipoVinculacion: "LABORAL", periodo: periodoActual(), salarioHonorarios: "", auxilioTransporte: "", bonificaciones: "", descuentos: "", estadoPago: "PENDIENTE", cuentaId: "", empleadoId: "", fechaIngreso: "" };
type Form = typeof vacio;
const num = (s: string) => (s ? Number(s) : 0);
const neto = (f: Form) => num(f.salarioHonorarios) + num(f.auxilioTransporte) + num(f.bonificaciones) - num(f.descuentos);

// El contrato HR guarda el tipo como texto libre; la nómina usa un enum cerrado.
// Mapeo best-effort con fallback OTRO (LABORAL ≠ PRESTACION_SERVICIOS importa para
// prestaciones/seguridad social en la vida real).
function mapVinculacion(tc: string | null): string {
  const s = (tc ?? "").toLowerCase();
  if (s.includes("laboral")) return "LABORAL";
  if (s.includes("prestaci")) return "PRESTACION_SERVICIOS";
  return "OTRO";
}
const MANUAL = "__manual__"; // opción "sin contrato" (excepción)

export function NominaTab({ lookups }: { lookups: Lookups }) {
  const { data, loading, error, recargar } = useCargar(() => contableApi.nominas());
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(vacio);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Contratos del despacho (fuente de verdad de la nómina) + opción "sin contrato".
  const [empleables, setEmpleables] = useState<Empleable[]>([]);
  const [contratoSel, setContratoSel] = useState<string>(""); // "" = sin elegir, MANUAL = excepción
  const [verFinalizados, setVerFinalizados] = useState(false); // mostrar no-activos (liquidación)
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const cls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";

  // Los contratos son confidenciales: el contable solo recibe la proyección mínima.
  useEffect(() => { contableApi.empleables().then(setEmpleables).catch(() => setEmpleables([])); }, []);

  // Por defecto solo vigentes; los finalizados/suspendidos se muestran a pedido
  // (un contrato terminado aún recibe liquidación).
  const empleablesVisibles = empleables.filter((e) => verFinalizados || e.estado === "ACTIVO");
  const elegido = contratoSel && contratoSel !== MANUAL
    ? empleables.find((e) => e.contratoId === contratoSel) ?? null : null;
  const esManual = contratoSel === MANUAL; // registro sin contrato (excepción)

  function abrirNuevo() { setEditId(null); setForm(vacio); setContratoSel(""); setVerFinalizados(false); setFormError(null); setOpen(true); }
  function abrirEdicion(n: Nomina) {
    setEditId(n.id);
    const m = (v: string | null) => (v ? String(Math.round(Number(v))) : "");
    setForm({
      nombreEmpleado: n.nombreEmpleado, cargo: n.cargo ?? "", tipoVinculacion: n.tipoVinculacion,
      periodo: n.periodo, salarioHonorarios: m(n.salarioHonorarios), auxilioTransporte: m(n.auxilioTransporte),
      bonificaciones: m(n.bonificaciones), descuentos: m(n.descuentos), estadoPago: n.estadoPago, cuentaId: n.cuentaId ?? "",
      empleadoId: n.empleadoId ?? "", fechaIngreso: "",
    });
    setContratoSel(""); setVerFinalizados(false); setFormError(null); setOpen(true);
  }

  // Elegir un contrato PRELLENA copiando valores (snapshot): nombre, cargo,
  // vinculación (mapeada), antigüedad y salario. NO toca bonificaciones/descuentos
  // (texto libre en el contrato) ni la cuenta/bolsa (concepto distinto).
  function elegirContrato(id: string) {
    setContratoSel(id);
    if (id === "" || id === MANUAL) { setForm((f) => ({ ...f, empleadoId: "", fechaIngreso: "" })); return; }
    const e = empleables.find((x) => x.contratoId === id);
    if (!e) return;
    setForm((f) => ({
      ...f,
      empleadoId: e.usuarioId ?? "", // null si es personal sin login (login-less)
      nombreEmpleado: e.nombre,
      cargo: e.cargo ?? "",
      tipoVinculacion: mapVinculacion(e.tipoContrato),
      salarioHonorarios: e.honorarios ? String(Math.round(Number(e.honorarios))) : "",
      fechaIngreso: e.fechaInicio ?? "",
    }));
  }

  function payload(f: Form) {
    return {
      nombreEmpleado: f.nombreEmpleado.trim(), cargo: f.cargo.trim() || undefined,
      tipoVinculacion: f.tipoVinculacion, periodo: f.periodo,
      salarioHonorarios: num(f.salarioHonorarios),
      auxilioTransporte: f.auxilioTransporte ? num(f.auxilioTransporte) : undefined,
      bonificaciones: f.bonificaciones ? num(f.bonificaciones) : undefined,
      descuentos: f.descuentos ? num(f.descuentos) : undefined,
      valorNetoPagar: neto(f), estadoPago: f.estadoPago, cuentaId: f.cuentaId || undefined,
      empleadoId: f.empleadoId || undefined, fechaIngreso: f.fechaIngreso || undefined,
    };
  }

  async function guardar() {
    setFormError(null);
    if (!form.nombreEmpleado.trim() || !form.salarioHonorarios) { setFormError("Nombre y salario son obligatorios."); return; }
    if (!/^\d{4}-\d{2}$/.test(form.periodo)) { setFormError("Periodo debe ser 'YYYY-MM'."); return; }
    setSaving(true);
    try {
      if (editId) await contableApi.editarNomina(editId, payload(form));
      else await contableApi.crearNomina(payload(form));
      setOpen(false);
      await recargar();
    } catch (err) {
      setFormError(errorMessage(err, "Error al guardar."));
    } finally {
      setSaving(false);
    }
  }

  async function marcarPagado(n: Nomina) { await contableApi.editarNomina(n.id, { estadoPago: "PAGADO" }); await recargar(); }

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  return (
    <div className="space-y-4">
      {error && <Banda tone="rojo" onRetry={recargar}>{error}</Banda>}
      <SectionCard title="Nómina" action={<Button onClick={abrirNuevo}><PlusIcon />Registrar nómina</Button>}>
        <Tabla<Nomina>
          filas={data ?? []}
          vacio="Aún no hay nómina registrada."
          cols={[
            { h: "Empleado", cell: (n) => <span className="font-medium text-slate-800 dark:text-slate-100">{n.nombreEmpleado}</span> },
            { h: "Cargo", cell: (n) => n.cargo ?? "—" },
            { h: "Vinculación", cell: (n) => n.tipoVinculacion === "PRESTACION_SERVICIOS" ? "Prest. servicios" : (n.tipoVinculacion === "LABORAL" ? "Laboral" : "Otro") },
            { h: "Periodo", cell: (n) => n.periodo },
            { h: "Neto", cell: (n) => <span className="font-medium text-slate-800 dark:text-slate-100">{money(n.valorNetoPagar)}</span> },
            { h: "Estado", cell: (n) => <Badge>{n.estadoPago}</Badge> },
            { h: "", right: true, cell: (n) => (
              <span className="flex justify-end gap-3 text-xs">
                {n.estadoPago === "PENDIENTE" && <button onClick={() => marcarPagado(n)} className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline">Marcar pagado</button>}
                <button onClick={() => abrirEdicion(n)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Editar</button>
              </span>
            ) },
          ]}
        />
      </SectionCard>

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={editId ? "Editar nómina" : "Registrar nómina"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : editId ? "Guardar" : "Registrar"}</Button>
          </>
        }
      >
        <Field label="Colaborador (contrato)">
          <select value={contratoSel} onChange={(e) => elegirContrato(e.target.value)} className={cls}>
            <option value="">— Elegir colaborador con contrato —</option>
            {empleablesVisibles.map((e) => (
              <option key={e.contratoId} value={e.contratoId}>
                {e.nombre}{e.cargo ? ` · ${e.cargo}` : ""}{e.estado !== "ACTIVO" ? ` (${e.estado.toLowerCase()})` : ""}
              </option>
            ))}
            <option value={MANUAL}>Otro — sin contrato registrado (excepción)</option>
          </select>
        </Field>
        <div className="flex items-center justify-between -mt-1">
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <input type="checkbox" checked={verFinalizados} onChange={(e) => setVerFinalizados(e.target.checked)} />
            Incluir finalizados / suspendidos (liquidación)
          </label>
          {elegido?.fechaInicio && <span className="text-xs text-slate-500 dark:text-slate-400">Ingreso: {String(elegido.fechaInicio).slice(0, 10)}</span>}
        </div>
        {esManual && <p className="-mt-1 text-xs text-amber-600 dark:text-amber-400">Registro sin contrato registrado — excepción. Verifica nombre y salario.</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Empleado" requerido><Input value={form.nombreEmpleado} onChange={(v) => set("nombreEmpleado", v)} placeholder="Nombre completo" /></Field>
          <Field label="Cargo"><Input value={form.cargo} onChange={(v) => set("cargo", v)} placeholder="Opcional" /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Vinculación"><Select value={form.tipoVinculacion} onChange={(v) => set("tipoVinculacion", v)} opciones={[...TIPO_VINCULACION]} placeholder="—" /></Field>
          <Field label="Periodo" requerido><Input value={form.periodo} onChange={(v) => set("periodo", v)} placeholder="YYYY-MM" /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Salario / honorarios" requerido><MoneyInput value={form.salarioHonorarios} onChange={(v) => set("salarioHonorarios", v)} placeholder="0" /></Field>
          <Field label="Auxilio de transporte"><MoneyInput value={form.auxilioTransporte} onChange={(v) => set("auxilioTransporte", v)} placeholder="0" /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Bonificaciones"><MoneyInput value={form.bonificaciones} onChange={(v) => set("bonificaciones", v)} placeholder="0" /></Field>
          <Field label="Descuentos"><MoneyInput value={form.descuentos} onChange={(v) => set("descuentos", v)} placeholder="0" /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Estado"><Select value={form.estadoPago} onChange={(v) => set("estadoPago", v)} opciones={[...ESTADO_PAGO_NOMINA]} placeholder="—" /></Field>
          <Field label="Cuenta / bolsa">
            <select value={form.cuentaId} onChange={(e) => set("cuentaId", e.target.value)} className={cls}>
              <option value="">Ninguna</option>
              {lookups.cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombreBolsa}</option>)}
            </select>
          </Field>
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/40">
          <span className="text-slate-500 dark:text-slate-400">Neto a pagar: </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">{money(neto(form))}</span>
        </div>
        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
      </Modal>
    </div>
  );
}
