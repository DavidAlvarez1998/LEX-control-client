"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, EmptyState, ModalPortal, PageHeader, PlusIcon, Tooltip } from "@/components/ui";
import { CorreosInput, Field, Input, placeholderDocumento, Select, Textarea } from "@/components/form-ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { api, errorMessage } from "@/lib/api";
import { RolEmpresaGuard } from "@/components/rol-empresa-guard";
import { getUser } from "@/lib/auth";
import { comercialApi, DISPOSICION_LABEL, type PipelineItem } from "@/lib/comercial-api";
import { JURISDICCION_LABEL, type AreaPractica, type Jurisdiccion } from "@/lib/procesos";

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
  correos: string[] | null;
  ciudad: string | null;
  canalIngreso: string | null;
  tipoCaso: string | null;
  viabilidad: string | null;
  resumenCaso: string | null;
  observaciones: string | null;
  fechaIngreso: string;
  responsableComercialId: string | null;
  responsableComercial: { id: string; nombre: string } | null;
};

type FormState = {
  nombre: string;
  tipoPersona: string;
  tipoDocumento: string;
  numeroDocumento: string;
  telefono: string;
  correos: string[]; // varios correos; el primero es el principal
  ciudad: string;
  canalIngreso: string;
  tipoCaso: string;
  viabilidad: string;
  resumenCaso: string;
  observaciones: string;
};

const EMPTY: FormState = {
  nombre: "", tipoPersona: "NATURAL", tipoDocumento: "", numeroDocumento: "",
  telefono: "", correos: [], ciudad: "", canalIngreso: "", tipoCaso: "",
  viabilidad: "EN_ESTUDIO", resumenCaso: "", observaciones: "",
};

const TIPO_DOC = ["CC", "CE", "NIT", "TI", "PASAPORTE", "PEP_PPT"];
const CANAL = ["REFERIDO", "INSTAGRAM", "FACEBOOK", "WHATSAPP", "WEB", "LLAMADA", "OTRO"];
const VIABILIDAD = ["VIABLE", "NO_VIABLE", "EN_ESTUDIO"];

const ESTADO_STYLES: Record<Estado, string> = {
  PROSPECTO: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  CLIENTE: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  DESCARTADO: "bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400",
};

const bonito = (s: string | null) => (s ? s.replace(/_/g, " ").toLowerCase() : "—");

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pipe, setPipe] = useState<Record<string, PipelineItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // "Tipo de caso" = área de práctica del catálogo (data-driven), agrupada por jurisdicción.
  const [areas, setAreas] = useState<AreaPractica[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDueño, setEditDueño] = useState<string | null>(null); // responsable si edito el de otro
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
      setError(errorMessage(err, "Error"));
    } finally {
      setConfirmBusy(false);
    }
  }

  // Vista "Míos" vs "Todos": siempre ves toda la cartera del despacho; el filtro
  // solo cambia el enfoque inicial (responsable comercial o abogado responsable
  // de algún proceso). No es un muro. Default por rol: un abogado (JURIDICO)
  // arranca en "Todos" (cobertura + chequeo de conflictos de interés); los demás
  // roles arrancan en "Míos" (su propio pipeline).
  const [mios, setMios] = useState(() => !(getUser()?.roles ?? []).includes("JURIDICO"));

  async function cargar(soloMios = mios) {
    setLoading(true);
    setError(null);
    try {
      const [cs, pipeArr] = await Promise.all([
        api.get<Cliente[]>(`/clientes${soloMios ? "?mios=true" : ""}`),
        comercialApi.pipeline({ mios: soloMios }).catch(() => [] as PipelineItem[]),
      ]);
      setClientes(cs);
      setPipe(Object.fromEntries(pipeArr.map((p) => [p.id, p])));
    } catch (err) {
      setError(errorMessage(err, "Error al cargar"));
    } finally {
      setLoading(false);
    }
  }

  function cambiarVista(soloMios: boolean) {
    setMios(soloMios);
    cargar(soloMios);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Áreas de práctica (activas) para el campo "Tipo de caso".
  useEffect(() => {
    api.get<AreaPractica[]>("/catalogo/areas").then(setAreas).catch(() => {});
  }, []);

  // "Tipo de caso" = áreas del catálogo, agrupadas por jurisdicción (optgroups: el
  // título de la jurisdicción con sus áreas debajo), en el orden de JURISDICCION_LABEL.
  // El desplegable nativo scrollea solo cuando la lista crece. Conserva un valor legado.
  const ordenJur = Object.keys(JURISDICCION_LABEL) as Jurisdiccion[];
  const tipoCasoGrupos = ordenJur
    .map((j) => ({
      label: JURISDICCION_LABEL[j],
      opciones: areas.filter((a) => a.jurisdiccion === j).map((a) => a.slug),
    }))
    .filter((g) => g.opciones.length > 0);
  const tipoCasoEtiquetas = Object.fromEntries(areas.map((a) => [a.slug, a.nombre]));

  function abrirCrear() {
    setEditId(null);
    setEditDueño(null);
    setForm(EMPTY);
    setFormError(null);
    setFormOpen(true);
  }

  function abrirEditar(c: Cliente) {
    setEditId(c.id);
    setEditDueño(deOtro(c));
    setForm({
      nombre: c.nombre, tipoPersona: c.tipoPersona,
      tipoDocumento: c.tipoDocumento ?? "", numeroDocumento: c.numeroDocumento ?? "",
      telefono: c.telefono ?? "",
      correos: c.correos ?? (c.email ? [c.email] : []),
      ciudad: c.ciudad ?? "",
      canalIngreso: c.canalIngreso ?? "", tipoCaso: c.tipoCaso ?? "",
      viabilidad: c.viabilidad ?? "EN_ESTUDIO", resumenCaso: c.resumenCaso ?? "",
      observaciones: c.observaciones ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  /** Arma el payload omitiendo strings vacíos (la API rechaza "" en opcionales).
   *  `correos` es lista: se recorta y se descartan vacíos. */
  function payload(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      if (k === "correos") continue;
      if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
    }
    const correos = form.correos.map((c) => c.trim()).filter(Boolean);
    // Siempre se envía (incluso []) para poder limpiar correos al editar.
    out.correos = correos;
    return out;
  }

  async function guardar() {
    setFormError(null);
    // Campos obligatorios para identificar y contactar al cliente/prospecto.
    const faltan: string[] = [];
    if (!form.nombre.trim()) faltan.push("Nombre");
    if (!form.tipoPersona) faltan.push("Tipo de persona");
    if (!form.tipoDocumento) faltan.push("Tipo de documento");
    if (!form.numeroDocumento.trim()) faltan.push("Número de documento");
    if (!form.telefono.trim()) faltan.push("Teléfono");
    if (!form.correos.some((c) => c.trim())) faltan.push("Correo");
    if (!form.tipoCaso) faltan.push("Tipo de caso");
    if (faltan.length > 0) {
      setFormError(`Completa los campos obligatorios: ${faltan.join(", ")}.`);
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
      setFormError(errorMessage(err, "Error al guardar"));
    } finally {
      setSaving(false);
    }
  }

  // "De otro": tiene responsable asignado y NO soy yo. No bloquea (estándar bufete:
  // cobertura + conflictos), solo avisa de quién es para que la acción no sea ciega.
  const deOtro = (c: Cliente) =>
    c.responsableComercial && c.responsableComercial.id !== getUser()?.id
      ? c.responsableComercial.nombre
      : null;

  function pedirConvertir(c: Cliente) {
    const dueño = deOtro(c);
    setConfirm({
      title: "Convertir en cliente",
      message: `${dueño ? `Este prospecto es de ${dueño}. ` : ""}Se convertirá a "${c.nombre}" en CLIENTE y se vinculará su expediente (litigante). ¿Continuar?`,
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
    <RolEmpresaGuard roles={["COMERCIAL", "JURIDICO"]}>
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
          <button onClick={() => cargar()} className="font-medium underline">reintentar</button>
        </Card>
      )}
      {aviso && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 text-sm text-emerald-700 dark:text-emerald-300">
          {aviso}
        </Card>
      )}

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 p-0.5 text-sm dark:border-slate-600">
        {[
          { v: true, label: "Míos", tip: "Clientes que llevas tú: eres su responsable comercial o el responsable jurídico de alguno de sus procesos (al crear un cliente quedas como su responsable)." },
          { v: false, label: "Todos", tip: "Toda la cartera del despacho. No hay muro: puedes ver y abrir cualquier cliente (útil para cobertura y conflictos de interés)." },
        ].map((o) => (
          <Tooltip key={o.label} content={o.tip}>
            <button
              onClick={() => cambiarVista(o.v)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                mios === o.v
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {o.label}
            </button>
          </Tooltip>
        ))}
      </div>

      {loading ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
      ) : clientes.length === 0 ? (
        <EmptyState
          title={mios ? "No llevas clientes todavía" : "Sin clientes todavía"}
          description={
            mios
              ? "Aquí ves los clientes que llevas tú. Cambia a “Todos” para ver la cartera del despacho, o crea un prospecto."
              : "Crea el primer prospecto. Podrás hacerle seguimiento y convertirlo en cliente."
          }
          action={<Button onClick={abrirCrear}><PlusIcon />Nuevo prospecto</Button>}
        />
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-600 text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Documento</th>
                <th className="px-5 py-3 font-medium">Canal</th>
                <th className="px-5 py-3 font-medium">Seguimiento</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 dark:border-slate-600 last:border-0">
                  <td className="px-5 py-3">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                      {c.nombre}
                    </Link>
                    {c.email && <div className="text-xs text-slate-500 dark:text-slate-400">{c.email}</div>}
                    {c.responsableComercial && (
                      <div className="text-xs text-slate-400 dark:text-slate-500">Responsable: {c.responsableComercial.nombre}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {c.numeroDocumento ? `${c.tipoDocumento ?? ""} ${c.numeroDocumento}` : "—"}
                  </td>
                  <td className="px-5 py-3 capitalize text-slate-600 dark:text-slate-300">{bonito(c.canalIngreso)}</td>
                  <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300">
                    {(() => {
                      const s = pipe[c.id];
                      if (!s) return <span className="text-slate-400">—</span>;
                      return (
                        <div className="space-y-0.5">
                          {s.faseActual && <div className="font-medium capitalize text-slate-700 dark:text-slate-200">{bonito(s.faseActual)}</div>}
                          <div className={s.diasSinGestion != null && s.diasSinGestion >= 7 ? "text-amber-600 dark:text-amber-400" : ""}>
                            {s.diasSinGestion == null ? "Sin gestión" : s.diasSinGestion === 0 ? "Hoy" : `Hace ${s.diasSinGestion}d`}
                            {s.ultimaDisposicion ? ` · ${DISPOSICION_LABEL[s.ultimaDisposicion]}` : ""}
                          </div>
                          {s.proximaTareaEn && (
                            <div className={s.tareaVencida ? "font-medium text-red-600 dark:text-red-400" : "text-slate-400"}>
                              {s.tareaVencida ? "⚠ Tarea vencida" : `Próx: ${new Date(s.proximaTareaEn).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}`}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
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
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget && !saving) setFormOpen(false); }}
        >
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {editId ? "Editar cliente" : "Nuevo prospecto"}
            </h3>
            {editId && editDueño && (
              <p className="-mt-2 mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                Este cliente es de <b>{editDueño}</b>. Puedes editarlo (cobertura del despacho), pero ten en cuenta que no es tuyo.
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Nombre" requerido>
                  <Input value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} placeholder="Nombre y apellido / razón social" />
                </Field>
              </div>
              <Field label="Tipo de persona" requerido>
                <Select value={form.tipoPersona} onChange={(v) => setForm({ ...form, tipoPersona: v })} opciones={["NATURAL", "JURIDICA"]} placeholder="—" />
              </Field>
              <Field label="Canal de ingreso">
                <Select value={form.canalIngreso} onChange={(v) => setForm({ ...form, canalIngreso: v })} opciones={CANAL} />
              </Field>
              <Field label="Tipo de documento" requerido>
                <Select value={form.tipoDocumento} onChange={(v) => setForm({ ...form, tipoDocumento: v })} opciones={TIPO_DOC} />
              </Field>
              <Field label="Número de documento" requerido>
                <Input value={form.numeroDocumento} onChange={(v) => setForm({ ...form, numeroDocumento: v })} placeholder={placeholderDocumento(form.tipoDocumento)} />
              </Field>
              <Field label="Teléfono" requerido>
                <Input value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} placeholder="Teléfono" />
              </Field>
              <div>
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Correos<span className="ml-0.5 text-red-500">*</span>
                </span>
                <CorreosInput value={form.correos} onChange={(v) => setForm({ ...form, correos: v })} />
              </div>
              <Field label="Ciudad">
                <Input value={form.ciudad} onChange={(v) => setForm({ ...form, ciudad: v })} placeholder="Ciudad" />
              </Field>
              <Field label="Tipo de caso" requerido>
                {/* Área de práctica del catálogo, agrupada por jurisdicción (optgroups);
                    conserva un valor legado fuera del catálogo. */}
                <Select
                  value={form.tipoCaso}
                  onChange={(v) => setForm({ ...form, tipoCaso: v })}
                  grupos={
                    form.tipoCaso && !areas.some((a) => a.slug === form.tipoCaso)
                      ? [{ label: "Actual", opciones: [form.tipoCaso] }, ...tipoCasoGrupos]
                      : tipoCasoGrupos
                  }
                  etiquetas={tipoCasoEtiquetas}
                  placeholder="—"
                />
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
        </ModalPortal>
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
