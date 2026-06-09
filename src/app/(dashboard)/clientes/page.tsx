"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, EmptyState, PageHeader, PlusIcon } from "@/components/ui";
import { Field, Input, Select, Textarea } from "@/components/form-ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { api, ApiError } from "@/lib/api";
import { RolEmpresaGuard } from "@/components/rol-empresa-guard";

type Estado = "PROSPECTO" | "CLIENTE" | "DESCARTADO";

type Cliente = {
  id: string;
  estado: Estado;
  nombre: string;
  tipoPersona: string;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  telefono: string | null;
  email: string | null;
  ciudad: string | null;
  canalIngreso: string | null;
  tipoCaso: string | null;
  viabilidad: string | null;
  resumenCaso: string | null;
  observaciones: string | null;
  fechaIngreso: string;
};

type FormState = {
  nombre: string;
  tipoPersona: string;
  tipoDocumento: string;
  numeroDocumento: string;
  telefono: string;
  email: string;
  ciudad: string;
  canalIngreso: string;
  tipoCaso: string;
  viabilidad: string;
  resumenCaso: string;
  observaciones: string;
};

const EMPTY: FormState = {
  nombre: "", tipoPersona: "NATURAL", tipoDocumento: "", numeroDocumento: "",
  telefono: "", email: "", ciudad: "", canalIngreso: "", tipoCaso: "",
  viabilidad: "EN_ESTUDIO", resumenCaso: "", observaciones: "",
};

const TIPO_DOC = ["CC", "CE", "NIT", "TI", "PASAPORTE", "PEP_PPT"];
const CANAL = ["REFERIDO", "INSTAGRAM", "FACEBOOK", "WHATSAPP", "WEB", "LLAMADA", "OTRO"];
const TIPO_CASO = ["CIVIL", "LABORAL", "PENAL", "ADMINISTRATIVO", "DISCIPLINARIO", "CONSTITUCIONAL", "FAMILIA", "COMERCIAL", "TRANSITO", "AMBIENTAL", "OTRO"];
const VIABILIDAD = ["VIABLE", "NO_VIABLE", "EN_ESTUDIO"];

const ESTADO_STYLES: Record<Estado, string> = {
  PROSPECTO: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  CLIENTE: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  DESCARTADO: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
};

const bonito = (s: string | null) => (s ? s.replace(/_/g, " ").toLowerCase() : "—");

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirmación (modal acorde al portal, en vez de window.confirm).
  const [confirm, setConfirm] = useState<{ title: string; message: string; confirmText: string; danger: boolean; onConfirm: () => void } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  async function ejecutar(fn: () => Promise<unknown>, ok: string) {
    setConfirmBusy(true);
    setError(null);
    try {
      await fn();
      setConfirm(null);
      await cargar();
      setAviso(ok);
    } catch (err) {
      setConfirm(null);
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setConfirmBusy(false);
    }
  }

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      setClientes(await api.get<Cliente[]>("/clientes"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
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
    setFormError(null);
    setFormOpen(true);
  }

  function abrirEditar(c: Cliente) {
    setEditId(c.id);
    setForm({
      nombre: c.nombre, tipoPersona: c.tipoPersona,
      tipoDocumento: c.tipoDocumento ?? "", numeroDocumento: c.numeroDocumento ?? "",
      telefono: c.telefono ?? "", email: c.email ?? "", ciudad: c.ciudad ?? "",
      canalIngreso: c.canalIngreso ?? "", tipoCaso: c.tipoCaso ?? "",
      viabilidad: c.viabilidad ?? "EN_ESTUDIO", resumenCaso: c.resumenCaso ?? "",
      observaciones: c.observaciones ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  /** Arma el payload omitiendo strings vacíos (la API rechaza "" en opcionales). */
  function payload(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) if (v.trim() !== "") out[k] = v.trim();
    return out;
  }

  async function guardar() {
    setFormError(null);
    if (!form.nombre.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (editId) await api.patch(`/clientes/${editId}`, payload());
      else await api.post("/clientes", payload());
      setFormOpen(false);
      await cargar();
      setAviso(editId ? "Cliente actualizado." : "Prospecto creado.");
    } catch (err) {
      setFormError(err instanceof ApiError || err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function pedirConvertir(c: Cliente) {
    setConfirm({
      title: "Convertir en cliente",
      message: `Se convertirá a "${c.nombre}" en CLIENTE y se vinculará su expediente (litigante). ¿Continuar?`,
      confirmText: "Convertir",
      danger: false,
      onConfirm: () => ejecutar(() => api.post(`/clientes/${c.id}/convertir`, {}), `${c.nombre} ahora es CLIENTE.`),
    });
  }

  function pedirDescartar(c: Cliente) {
    setConfirm({
      title: "Descartar prospecto",
      message: `Se marcará a "${c.nombre}" como DESCARTADO. Seguirá visible en la lista, pero fuera del embudo.`,
      confirmText: "Descartar",
      danger: true,
      onConfirm: () => ejecutar(() => api.patch(`/clientes/${c.id}`, { estado: "DESCARTADO" }), `${c.nombre} fue descartado.`),
    });
  }

  return (
    <RolEmpresaGuard roles={["COMERCIAL"]}>
      <div>
      <PageHeader
        title="Clientes"
        subtitle="Prospectos y clientes de tu despacho."
        action={
          <Button onClick={abrirCrear}>
            <PlusIcon />
            Nuevo prospecto
          </Button>
        }
      />

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
          {error}{" "}
          <button onClick={cargar} className="font-medium underline">reintentar</button>
        </Card>
      )}
      {aviso && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 text-sm text-emerald-700 dark:text-emerald-300">
          {aviso}
        </Card>
      )}

      {loading ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
      ) : clientes.length === 0 ? (
        <EmptyState
          title="Sin clientes todavía"
          description="Crea el primer prospecto. Podrás hacerle seguimiento y convertirlo en cliente."
          action={<Button onClick={abrirCrear}><PlusIcon />Nuevo prospecto</Button>}
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Documento</th>
                <th className="px-5 py-3 font-medium">Canal</th>
                <th className="px-5 py-3 font-medium">Viabilidad</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="px-5 py-3">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                      {c.nombre}
                    </Link>
                    {c.email && <div className="text-xs text-slate-500 dark:text-slate-400">{c.email}</div>}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {c.numeroDocumento ? `${c.tipoDocumento ?? ""} ${c.numeroDocumento}` : "—"}
                  </td>
                  <td className="px-5 py-3 capitalize text-slate-600 dark:text-slate-300">{bonito(c.canalIngreso)}</td>
                  <td className="px-5 py-3 capitalize text-slate-600 dark:text-slate-300">{bonito(c.viabilidad)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[c.estado]}`}>{c.estado}</span>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => abrirEditar(c)} className="mr-4 font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">Editar</button>
                    {c.estado === "PROSPECTO" && (
                      <>
                        <button onClick={() => pedirConvertir(c)} className="mr-4 font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500">Convertir</button>
                        <button onClick={() => pedirDescartar(c)} className="font-medium text-slate-500 hover:text-red-500">Descartar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget && !saving) setFormOpen(false); }}
        >
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {editId ? "Editar cliente" : "Nuevo prospecto"}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Nombre" requerido>
                  <Input value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} placeholder="Nombre y apellido / razón social" />
                </Field>
              </div>
              <Field label="Tipo de persona">
                <Select value={form.tipoPersona} onChange={(v) => setForm({ ...form, tipoPersona: v })} opciones={["NATURAL", "JURIDICA"]} placeholder="—" />
              </Field>
              <Field label="Canal de ingreso">
                <Select value={form.canalIngreso} onChange={(v) => setForm({ ...form, canalIngreso: v })} opciones={CANAL} />
              </Field>
              <Field label="Tipo de documento">
                <Select value={form.tipoDocumento} onChange={(v) => setForm({ ...form, tipoDocumento: v })} opciones={TIPO_DOC} />
              </Field>
              <Field label="Número de documento">
                <Input value={form.numeroDocumento} onChange={(v) => setForm({ ...form, numeroDocumento: v })} placeholder="Documento" />
              </Field>
              <Field label="Teléfono">
                <Input value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} placeholder="Teléfono" />
              </Field>
              <Field label="Correo">
                <Input value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="correo@ejemplo.com" />
              </Field>
              <Field label="Ciudad">
                <Input value={form.ciudad} onChange={(v) => setForm({ ...form, ciudad: v })} placeholder="Ciudad" />
              </Field>
              <Field label="Tipo de caso">
                <Select value={form.tipoCaso} onChange={(v) => setForm({ ...form, tipoCaso: v })} opciones={TIPO_CASO} />
              </Field>
              <Field label="Viabilidad">
                <Select value={form.viabilidad} onChange={(v) => setForm({ ...form, viabilidad: v })} opciones={VIABILIDAD} placeholder="—" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Resumen del caso">
                  <Textarea value={form.resumenCaso} onChange={(v) => setForm({ ...form, resumenCaso: v })} placeholder="Breve descripción del caso" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Observaciones">
                  <Textarea value={form.observaciones} onChange={(v) => setForm({ ...form, observaciones: v })} rows={2} />
                </Field>
              </div>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : editId ? "Guardar" : "Crear prospecto"}</Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmText={confirm?.confirmText}
        danger={confirm?.danger}
        busy={confirmBusy}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
      </div>
    </RolEmpresaGuard>
  );
}
