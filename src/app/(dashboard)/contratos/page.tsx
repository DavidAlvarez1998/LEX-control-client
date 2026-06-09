"use client";

import { useEffect, useState } from "react";
import { Button, Card, EmptyState, Modal, PageHeader, PlusIcon, StatCard } from "@/components/ui";
import { Field, Input, MoneyInput, NumberInput, Select, Textarea } from "@/components/form-ui";
import { AdminEmpresaGuard } from "@/components/admin-empresa-guard";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DocumentosContrato, type DocumentoContrato as Documento } from "@/components/documentos-contrato";
import { api, ApiError } from "@/lib/api";

// ── Tipos (espejo de la API /contratos) ──────────────────────────────────────
type Estado = "ACTIVO" | "FINALIZADO" | "SUSPENDIDO";

type Contrato = {
  id: string;
  usuarioId: string | null;
  nombreCompleto: string;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  fechaNacimiento: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  tipoColaborador: string | null;
  cargo: string | null;
  tipoContrato: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  duracionValor: number | null;
  duracionUnidad: string | null;
  estado: Estado;
  honorarios: string | null;
  formaPago: string | null;
  diaPago: number | null;
  bonificaciones: string | null;
  descuentos: string | null;
  cuentaBancaria: string | null;
  descripcionCargo: string | null;
  funciones: string | null;
  area: string | null;
  supervisor: string | null;
  horario: string | null;
  modalidad: string | null;
  observaciones: string | null;
  clausulas: string | null;
  tipoTerminacion: string | null;
  penalidades: string | null;
  documentos: Documento[];
};

type Reportes = {
  total: number;
  porEstado: Partial<Record<Estado, number>>;
  vencimientos: { id: string; nombreCompleto: string; fechaFin: string }[];
};

// Miembro del equipo (GET /mi-empresa/usuarios) para vincular el contrato.
type Miembro = { id: string; nombre: string; email: string };

const TIPO_DOC = ["CC", "CE", "NIT", "TI", "PASAPORTE", "PEP_PPT"];
const ESTADOS: Estado[] = ["ACTIVO", "FINALIZADO", "SUSPENDIDO"];
const FORMA_PAGO = ["Mensual", "Por caso", "Comisión"];
const MODALIDAD = ["Presencial", "Remoto", "Híbrido"];
const UNIDAD = ["DIA", "MES", "AÑO"];

const ESTADO_STYLES: Record<Estado, string> = {
  ACTIVO: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  FINALIZADO: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  SUSPENDIDO: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
};

const TABS = ["Datos", "Contractual", "Pagos", "Documentos", "Observaciones"] as const;
type Tab = (typeof TABS)[number];

// Form: todos los campos como string para el control de inputs.
type FormState = Record<string, string>;
const EMPTY: FormState = { estado: "ACTIVO" };

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const moneyDigits = (v: string | null) => (v ? String(Math.round(Number(v))) : "");

function toForm(c: Contrato): FormState {
  return {
    usuarioId: c.usuarioId ?? "",
    nombreCompleto: c.nombreCompleto ?? "",
    tipoDocumento: c.tipoDocumento ?? "",
    numeroDocumento: c.numeroDocumento ?? "",
    fechaNacimiento: dateInput(c.fechaNacimiento),
    direccion: c.direccion ?? "",
    telefono: c.telefono ?? "",
    email: c.email ?? "",
    tipoColaborador: c.tipoColaborador ?? "",
    cargo: c.cargo ?? "",
    tipoContrato: c.tipoContrato ?? "",
    fechaInicio: dateInput(c.fechaInicio),
    fechaFin: dateInput(c.fechaFin),
    duracionValor: c.duracionValor != null ? String(c.duracionValor) : "",
    duracionUnidad: c.duracionUnidad ?? "",
    estado: c.estado ?? "ACTIVO",
    honorarios: moneyDigits(c.honorarios),
    formaPago: c.formaPago ?? "",
    diaPago: c.diaPago != null ? String(c.diaPago) : "",
    bonificaciones: c.bonificaciones ?? "",
    descuentos: c.descuentos ?? "",
    cuentaBancaria: c.cuentaBancaria ?? "",
    descripcionCargo: c.descripcionCargo ?? "",
    funciones: c.funciones ?? "",
    area: c.area ?? "",
    supervisor: c.supervisor ?? "",
    horario: c.horario ?? "",
    modalidad: c.modalidad ?? "",
    observaciones: c.observaciones ?? "",
    clausulas: c.clausulas ?? "",
    tipoTerminacion: c.tipoTerminacion ?? "",
    penalidades: c.penalidades ?? "",
  };
}

// Construye el payload: solo campos con valor, con los números convertidos.
function toPayload(f: FormState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const numeros = new Set(["duracionValor", "diaPago", "honorarios"]);
  for (const [k, raw] of Object.entries(f)) {
    const v = raw.trim();
    if (v === "") continue;
    out[k] = numeros.has(k) ? Number(v) : v;
  }
  out.nombreCompleto = (f.nombreCompleto ?? "").trim(); // siempre presente (requerido)
  return out;
}

export default function ContratosPage() {
  return (
    <AdminEmpresaGuard>
      <ContratosContent />
    </AdminEmpresaGuard>
  );
}

function ContratosContent() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [reportes, setReportes] = useState<Reportes | null>(null);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Modal de crear/editar.
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [tab, setTab] = useState<Tab>("Datos");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [docs, setDocs] = useState<Documento[]>([]);

  // Confirmación de borrado.
  const [confirm, setConfirm] = useState<{ id: string; nombre: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Vincular un miembro del equipo: rellena nombre (editable) y correo (queda
  // bloqueado mientras siga vinculado). "Sin vincular" libera el correo.
  const vincular = (id: string) => {
    const m = miembros.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      usuarioId: id,
      ...(m ? { nombreCompleto: m.nombre, email: m.email } : {}),
    }));
  };

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [cs, rep, eq] = await Promise.all([
        api.get<Contrato[]>("/contratos"),
        api.get<Reportes>("/contratos/reportes"),
        api.get<Miembro[]>("/mi-empresa/usuarios"),
      ]);
      setContratos(cs);
      setReportes(rep);
      setMiembros(eq);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function abrirCrear() {
    setEditId(null);
    setForm(EMPTY);
    setDocs([]);
    setTab("Datos");
    setFormError(null);
    setOpen(true);
  }

  function abrirEditar(c: Contrato) {
    setEditId(c.id);
    setForm(toForm(c));
    setDocs(c.documentos);
    setTab("Datos");
    setFormError(null);
    setOpen(true);
  }

  async function guardar() {
    if (!form.nombreCompleto?.trim()) {
      setTab("Datos");
      setFormError("El nombre completo es obligatorio");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = toPayload(form);
      if (editId) await api.patch(`/contratos/${editId}`, payload);
      else await api.post("/contratos", payload);
      setOpen(false);
      setAviso(editId ? "Contrato actualizado" : "Contrato creado");
      await cargar();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await api.del(`/contratos/${confirm.id}`);
      setConfirm(null);
      setAviso("Contrato eliminado");
      await cargar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al eliminar");
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos"
        subtitle="Gestiona el ciclo contractual del personal del despacho."
        action={
          <Button onClick={abrirCrear}>
            <PlusIcon /> Nuevo contrato
          </Button>
        }
      />

      {reportes && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Contratos" value={String(reportes.total)} />
          <StatCard label="Activos" value={String(reportes.porEstado.ACTIVO ?? 0)} />
          <StatCard
            label="Vencen pronto (≤60 días)"
            value={String(reportes.vencimientos.length)}
            hint={reportes.vencimientos[0] ? `Próximo: ${reportes.vencimientos[0].nombreCompleto}` : undefined}
          />
        </div>
      )}

      {aviso && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {aviso}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
      ) : contratos.length === 0 ? (
        <EmptyState
          title="Aún no hay contratos"
          description="Crea el primer contrato del personal del despacho."
          action={
            <Button onClick={abrirCrear}>
              <PlusIcon /> Nuevo contrato
            </Button>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Fin</th>
                <th className="px-4 py-3 font-medium">Docs</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{c.nombreCompleto}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.cargo ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.tipoContrato ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_STYLES[c.estado]}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{dateInput(c.fechaFin) || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{c.documentos.length}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => abrirEditar(c)} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                      Editar
                    </button>
                    <button
                      onClick={() => setConfirm({ id: c.id, nombre: c.nombreCompleto })}
                      className="ml-4 text-sm font-medium text-red-600 hover:text-red-500"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modal crear/editar */}
      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={editId ? "Editar contrato" : "Nuevo contrato"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cerrar
            </Button>
            <Button onClick={guardar} disabled={saving}>
              {saving ? "Guardando…" : editId ? "Guardar cambios" : "Crear"}
            </Button>
          </>
        }
      >
        {/* Pestañas */}
        <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 dark:border-slate-800">
          {TABS.map((t) => {
            const disabled = t === "Documentos" && !editId;
            return (
              <button
                key={t}
                type="button"
                disabled={disabled}
                onClick={() => setTab(t)}
                title={disabled ? "Guarda el contrato primero" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
                  tab === t
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        {tab === "Datos" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Vincular solo al CREAR; al editar el contrato ya existe. */}
            {!editId && (
              <div className="sm:col-span-2">
                <Field label="Vincular usuario del equipo (opcional)">
                  <select
                    value={form.usuarioId ?? ""}
                    onChange={(e) => vincular(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">— Sin vincular (personal externo) —</option>
                    {miembros.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre} · {m.email}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            <div className="sm:col-span-2">
              <Field label="Nombre completo" requerido>
                <Input value={form.nombreCompleto ?? ""} onChange={(v) => set("nombreCompleto", v)} />
              </Field>
            </div>
            <Field label="Tipo de documento">
              <Select value={form.tipoDocumento ?? ""} onChange={(v) => set("tipoDocumento", v)} opciones={TIPO_DOC} />
            </Field>
            <Field label="Número de documento">
              <Input value={form.numeroDocumento ?? ""} onChange={(v) => set("numeroDocumento", v)} />
            </Field>
            <Field label="Fecha de nacimiento">
              <Input type="date" value={form.fechaNacimiento ?? ""} onChange={(v) => set("fechaNacimiento", v)} />
            </Field>
            <Field label="Teléfono">
              <Input value={form.telefono ?? ""} onChange={(v) => set("telefono", v)} />
            </Field>
            <Field label="Correo electrónico">
              {form.usuarioId ? (
                // Vinculado a un usuario: el correo lo manda su cuenta, no se edita.
                <input
                  value={form.email ?? ""}
                  readOnly
                  disabled
                  title="Tomado del usuario vinculado"
                  className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
                />
              ) : (
                <Input value={form.email ?? ""} onChange={(v) => set("email", v)} />
              )}
            </Field>
            <Field label="Dirección">
              <Input value={form.direccion ?? ""} onChange={(v) => set("direccion", v)} />
            </Field>
          </div>
        )}

        {tab === "Contractual" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de colaborador">
              <Input value={form.tipoColaborador ?? ""} onChange={(v) => set("tipoColaborador", v)} placeholder="Abogado, Dependiente, Contador, Comercial, otro…" />
            </Field>
            <Field label="Cargo">
              <Input value={form.cargo ?? ""} onChange={(v) => set("cargo", v)} />
            </Field>
            <Field label="Tipo de contrato">
              <Input value={form.tipoContrato ?? ""} onChange={(v) => set("tipoContrato", v)} placeholder="Prestación de servicios, Laboral, Freelance, otro…" />
            </Field>
            <Field label="Estado">
              <Select value={form.estado ?? "ACTIVO"} onChange={(v) => set("estado", v)} opciones={ESTADOS} placeholder="" />
            </Field>
            <Field label="Fecha de inicio">
              <Input type="date" value={form.fechaInicio ?? ""} onChange={(v) => set("fechaInicio", v)} />
            </Field>
            <Field label="Fecha de terminación">
              <Input type="date" value={form.fechaFin ?? ""} onChange={(v) => set("fechaFin", v)} />
            </Field>
            <Field label="Duración (valor)">
              <NumberInput value={form.duracionValor ?? ""} onChange={(v) => set("duracionValor", v)} placeholder="Ej. 12" />
            </Field>
            <Field label="Duración (unidad)">
              <Select value={form.duracionUnidad ?? ""} onChange={(v) => set("duracionUnidad", v)} opciones={UNIDAD} />
            </Field>
          </div>
        )}

        {tab === "Pagos" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Honorarios / salario (COP)">
              <MoneyInput value={form.honorarios ?? ""} onChange={(v) => set("honorarios", v)} placeholder="0" />
            </Field>
            <Field label="Forma de pago">
              <Select value={form.formaPago ?? ""} onChange={(v) => set("formaPago", v)} opciones={FORMA_PAGO} />
            </Field>
            <Field label="Día de pago (1-31)">
              <NumberInput value={form.diaPago ?? ""} onChange={(v) => set("diaPago", v)} placeholder="Ej. 30" />
            </Field>
            <Field label="Cuenta bancaria">
              <Input value={form.cuentaBancaria ?? ""} onChange={(v) => set("cuentaBancaria", v)} />
            </Field>
            <Field label="Bonificaciones">
              <Input value={form.bonificaciones ?? ""} onChange={(v) => set("bonificaciones", v)} />
            </Field>
            <Field label="Descuentos">
              <Input value={form.descuentos ?? ""} onChange={(v) => set("descuentos", v)} />
            </Field>
          </div>
        )}

        {tab === "Documentos" && editId && (
          <DocumentosContrato
            contratoId={editId}
            docs={docs}
            onChange={setDocs}
            onError={setFormError}
          />
        )}

        {tab === "Observaciones" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Área">
              <Input value={form.area ?? ""} onChange={(v) => set("area", v)} placeholder="Jurídica, contable, comercial, administrativa, otro…" />
            </Field>
            <Field label="Supervisor / jefe directo">
              <Input value={form.supervisor ?? ""} onChange={(v) => set("supervisor", v)} />
            </Field>
            <Field label="Horario">
              <Input value={form.horario ?? ""} onChange={(v) => set("horario", v)} />
            </Field>
            <Field label="Modalidad">
              <Select value={form.modalidad ?? ""} onChange={(v) => set("modalidad", v)} opciones={MODALIDAD} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Descripción del cargo">
                <Textarea value={form.descripcionCargo ?? ""} onChange={(v) => set("descripcionCargo", v)} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Funciones principales">
                <Textarea value={form.funciones ?? ""} onChange={(v) => set("funciones", v)} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Cláusulas especiales (confidencialidad, no competencia…)">
                <Textarea value={form.clausulas ?? ""} onChange={(v) => set("clausulas", v)} />
              </Field>
            </div>
            <Field label="Tipo de terminación">
              <Input value={form.tipoTerminacion ?? ""} onChange={(v) => set("tipoTerminacion", v)} />
            </Field>
            <Field label="Penalidades">
              <Input value={form.penalidades ?? ""} onChange={(v) => set("penalidades", v)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Observaciones">
                <Textarea value={form.observaciones ?? ""} onChange={(v) => set("observaciones", v)} />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Eliminar contrato"
        message={`¿Eliminar el contrato de ${confirm?.nombre}? Se borrarán también sus documentos registrados.`}
        confirmText="Eliminar"
        danger
        busy={confirmBusy}
        onConfirm={eliminar}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
