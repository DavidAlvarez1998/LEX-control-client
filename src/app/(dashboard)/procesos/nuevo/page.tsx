"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, Modal, PageHeader } from "@/components/ui";
import { Field, Input, MoneyInput, Select, SelectableCard } from "@/components/form-ui";
import { FormularioDinamico } from "@/components/formulario-dinamico";
import { getUser, type AuthUser } from "@/lib/auth";
import {
  JURISDICCION_LABEL,
  validarDatos,
  type AreaPractica,
  type CuantiaTipo,
  type ParteProceso,
  type RolParte,
  type TipoDocumento,
  type TipoPersona,
  type TipoProceso,
} from "@/lib/procesos";
import {
  crearProceso,
  getAreas,
  getTipos,
  listClientes,
  listMiembros,
  type ClienteOption,
  type CrearProcesoBody,
  type MiembroOption,
} from "@/lib/procesos-api";

const CUANTIAS: { v: CuantiaTipo; label: string }[] = [
  { v: "MINIMA", label: "Mínima (≤ 40 SMLMV)" },
  { v: "MENOR", label: "Menor (40–150 SMLMV)" },
  { v: "MAYOR", label: "Mayor (> 150 SMLMV)" },
  { v: "SIN_CUANTIA", label: "Sin cuantía" },
];

const ROLES: RolParte[] = [
  "DEMANDANTE", "DEMANDADO", "EJECUTANTE", "EJECUTADO", "ACCIONANTE",
  "ACCIONADO", "IMPUTADO", "ACUSADO", "VICTIMA", "TERCERO", "APODERADO", "OTRO",
];
const TIPOS_DOC: TipoDocumento[] = ["CC", "CE", "NIT", "TI", "PASAPORTE", "PEP_PPT"];

// Datos del cliente nuevo creado al vuelo (se crea junto con el proceso).
type ClienteNuevo = {
  nombre: string;
  tipoPersona: TipoPersona;
  tipoDocumento?: TipoDocumento;
  numeroDocumento?: string;
  telefono?: string;
  email?: string;
};
const CLIENTE_NUEVO_VACIO: ClienteNuevo = { nombre: "", tipoPersona: "NATURAL" };

// Las partes de esta sección son la contraparte y terceros (nunca el cliente).
function parteVacia(): ParteProceso {
  return {
    litigante: { id: `tmp-${Math.floor(performance.now())}`, tipoPersona: "NATURAL", nombre: "" },
    rol: "DEMANDADO",
    esNuestroCliente: false,
  };
}

export default function NuevoProcesoPage() {
  const router = useRouter();
  // Se lee tras montar (localStorage) para no romper la hidratación.
  const [yo, setYo] = useState<AuthUser | null>(null);
  const roles = yo?.roles ?? [];
  const esAdmin = !!yo?.esAdminEmpresa || roles.includes("ADMINISTRADOR");
  const esAbogado = roles.includes("JURIDICO");

  const [areas, setAreas] = useState<AreaPractica[]>([]);
  const [areaSlug, setAreaSlug] = useState("");
  const [tipos, setTipos] = useState<TipoProceso[] | null>(null);
  const [tipo, setTipo] = useState<TipoProceso | null>(null);

  const [titulo, setTitulo] = useState("");
  const [datos, setDatos] = useState<Record<string, unknown>>({});
  const [errores, setErrores] = useState<string[]>([]);
  const [tituloError, setTituloError] = useState(false);

  const [radicado, setRadicado] = useState("");
  const [despachoJuzgado, setDespachoJuzgado] = useState("");
  const [cuantiaLabel, setCuantiaLabel] = useState("");
  const [cuantiaValor, setCuantiaValor] = useState("");
  const [partes, setPartes] = useState<ParteProceso[]>([]);

  // --- Cliente dueño del proceso ---
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clienteId, setClienteId] = useState(""); // cliente existente elegido
  const [clienteNuevo, setClienteNuevo] = useState<ClienteNuevo | null>(null);
  const [clienteRol, setClienteRol] = useState<RolParte>("DEMANDANTE");
  const [clienteError, setClienteError] = useState(false);
  const [modalCliente, setModalCliente] = useState(false);
  const [nuevoForm, setNuevoForm] = useState<ClienteNuevo>(CLIENTE_NUEVO_VACIO);
  const [nuevoError, setNuevoError] = useState(false);

  // --- Abogado responsable ---
  const [abogados, setAbogados] = useState<MiembroOption[]>([]);
  const [responsableId, setResponsableId] = useState("");
  const [responsableError, setResponsableError] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    setYo(getUser());
    getAreas().then((a) => setAreas(a.filter((x) => x.activo))).catch(() => {});
    listClientes().then(setClientes).catch(() => {});
  }, []);

  // Equipo solo para el admin (asigna abogado); un abogado se autoasigna.
  useEffect(() => {
    if (esAdmin) listMiembros().then(setAbogados).catch(() => {});
    if (yo && !esAdmin) setResponsableId(yo.id);
  }, [esAdmin, yo]);

  useEffect(() => {
    if (!areaSlug) return;
    setTipos(null);
    getTipos(areaSlug).then(setTipos).catch(() => setTipos([]));
  }, [areaSlug]);

  function setCampo(key: string, value: unknown) {
    setDatos((d) => ({ ...d, [key]: value }));
  }
  function actualizarParte(i: number, patch: Partial<ParteProceso>) {
    setPartes((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function actualizarLitigante(i: number, patch: Partial<ParteProceso["litigante"]>) {
    setPartes((ps) =>
      ps.map((p, idx) => (idx === i ? { ...p, litigante: { ...p.litigante, ...patch } } : p)),
    );
  }

  const clienteSeleccionado = clienteNuevo
    ? `${clienteNuevo.nombre} (nuevo)`
    : clientes.find((c) => c.id === clienteId)?.nombre ?? "";

  function limpiarCliente() {
    setClienteId("");
    setClienteNuevo(null);
  }
  function guardarClienteNuevo() {
    if (!nuevoForm.nombre.trim()) {
      setNuevoError(true);
      return;
    }
    setClienteNuevo({ ...nuevoForm, nombre: nuevoForm.nombre.trim() });
    setClienteId("");
    setModalCliente(false);
  }

  // Abogados del despacho (rol JURIDICO) elegibles como responsables.
  const abogadosElegibles = abogados.filter((m) => m.activo && m.roles.includes("JURIDICO"));

  async function guardar() {
    if (!tipo) return;
    const tituloOk = titulo.trim().length > 0;
    setTituloError(!tituloOk);
    const hayCliente = !!clienteId || !!clienteNuevo;
    setClienteError(!hayCliente);
    const hayResponsable = esAdmin ? !!responsableId : true;
    setResponsableError(!hayResponsable);
    const { ok, faltantes } = validarDatos(tipo.esquemaFormulario, datos);
    const keysFaltantes = tipo.esquemaFormulario
      .filter((c) => faltantes.includes(c.label))
      .map((c) => c.key);
    setErrores(keysFaltantes);
    if (!ok || !tituloOk || !hayCliente || !hayResponsable) return;

    setGuardando(true);
    setApiError(null);
    try {
      const body: CrearProcesoBody = {
        tipoProcesoId: tipo.id,
        titulo: titulo.trim(),
        datos,
        cuantiaTipo: CUANTIAS.find((c) => c.label === cuantiaLabel)?.v,
        cuantiaValor: cuantiaValor || undefined,
        radicado: radicado.trim() || undefined,
        despachoJuzgado: despachoJuzgado.trim() || undefined,
        responsableId: (esAdmin ? responsableId : yo?.id) || undefined,
        cliente: clienteNuevo
          ? { nuevo: clienteNuevo, rol: clienteRol }
          : { clienteId, rol: clienteRol },
        partes: partes
          .filter((p) => p.litigante.nombre.trim().length > 0)
          .map((p) => ({
            litigante: {
              tipoPersona: p.litigante.tipoPersona,
              nombre: p.litigante.nombre.trim(),
              tipoDocumento: p.litigante.tipoDocumento,
              numeroDocumento: p.litigante.numeroDocumento,
            },
            rol: p.rol,
            rolEtiqueta: p.rolEtiqueta,
            esNuestroCliente: false,
          })),
      };
      const creado = await crearProceso(body);
      router.push(`/procesos/${creado.id}`);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "No se pudo crear el proceso");
      setGuardando(false);
    }
  }

  // --- Paso 1: área ---
  if (!areaSlug) {
    return (
      <div>
        <PageHeader title="Nuevo proceso" subtitle="Paso 1 de 3 · Elige el área de práctica." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {areas.map((a) => (
            <SelectableCard
              key={a.slug}
              title={a.nombre}
              subtitle={JURISDICCION_LABEL[a.jurisdiccion]}
              onClick={() => setAreaSlug(a.slug)}
            />
          ))}
        </div>
      </div>
    );
  }

  // --- Paso 2: tipo de proceso ---
  if (!tipo) {
    return (
      <div>
        <PageHeader
          title="Nuevo proceso"
          subtitle="Paso 2 de 3 · Elige el tipo de proceso."
          action={
            <Button variant="ghost" onClick={() => setAreaSlug("")}>
              ← Cambiar área
            </Button>
          }
        />
        {tipos === null ? (
          <Card className="text-sm text-slate-500">Cargando tipos…</Card>
        ) : tipos.length === 0 ? (
          <Card className="text-sm text-slate-500">
            No hay tipos de proceso para esta área todavía.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tipos.map((t) => (
              <SelectableCard
                key={t.id}
                title={t.nombre}
                subtitle={t.descripcion}
                onClick={() => setTipo(t)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Paso 3: formulario ---
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={tipo.nombre}
        subtitle={`Paso 3 de 3 · ${JURISDICCION_LABEL[tipo.jurisdiccion]}`}
        action={
          <Button variant="ghost" onClick={() => setTipo(null)}>
            ← Cambiar tipo
          </Button>
        }
      />

      <div className="space-y-5">
        <Card>
          <Field label="Título del caso" requerido error={tituloError ? "Obligatorio" : undefined}>
            <Input value={titulo} onChange={setTitulo} placeholder="Ej. Pérez vs. Aseguradora XYZ" />
          </Field>
        </Card>

        {/* Cliente dueño del proceso */}
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Cliente <span className="font-normal text-red-500">*</span>
          </h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            La persona o empresa que representas en este caso.
          </p>
          {clienteSeleccionado ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/40">
                <span className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                  {clienteSeleccionado}
                </span>
                <button
                  type="button"
                  onClick={limpiarCliente}
                  className="text-xs font-medium text-slate-500 hover:text-red-500"
                >
                  Cambiar
                </button>
              </div>
              <Field label="Rol procesal del cliente">
                <Select
                  value={clienteRol}
                  onChange={(v) => setClienteRol(v as RolParte)}
                  opciones={ROLES}
                  placeholder="Rol"
                />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="Elegir cliente existente">
                <select
                  value={clienteId}
                  onChange={(e) => {
                    setClienteId(e.target.value);
                    setClienteNuevo(null);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">Selecciona…</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {c.numeroDocumento ? ` · ${c.numeroDocumento}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                variant="ghost"
                onClick={() => {
                  setNuevoForm(CLIENTE_NUEVO_VACIO);
                  setNuevoError(false);
                  setModalCliente(true);
                }}
              >
                + Crear cliente nuevo
              </Button>
            </div>
          )}
          {clienteError && (
            <p className="mt-2 text-xs text-red-600">Elige o crea un cliente para el proceso.</p>
          )}
        </Card>

        {/* Abogado responsable */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Abogado responsable
          </h3>
          {esAdmin ? (
            <Field label="Asignar abogado" error={responsableError ? "Obligatorio" : undefined}>
              <select
                value={responsableId}
                onChange={(e) => setResponsableId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Selecciona un abogado…</option>
                {abogadosElegibles.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Quedará asignado a ti{esAbogado ? "" : " (creador)"}:{" "}
              <span className="font-medium text-slate-800 dark:text-slate-100">{yo?.nombre}</span>
            </p>
          )}
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Datos del proceso
          </h3>
          <FormularioDinamico
            esquema={tipo.esquemaFormulario}
            datos={datos}
            onChange={setCampo}
            errores={errores}
          />
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Datos judiciales <span className="font-normal text-slate-400">(opcional)</span>
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Radicado (23 dígitos)">
              <Input value={radicado} onChange={setRadicado} placeholder="Aún sin radicar" />
            </Field>
            <Field label="Despacho / juzgado">
              <Input value={despachoJuzgado} onChange={setDespachoJuzgado} placeholder="Ej. Juzgado 5º Civil del Circuito" />
            </Field>
            <Field label="Cuantía">
              <Select value={cuantiaLabel} onChange={setCuantiaLabel} opciones={CUANTIAS.map((c) => c.label)} />
            </Field>
            <Field label="Valor de la cuantía (COP)">
              <MoneyInput value={cuantiaValor} onChange={setCuantiaValor} placeholder="0" />
            </Field>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Contraparte y otras partes <span className="font-normal text-slate-400">(opcional)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Demandado, terceros, etc. — el cliente ya está arriba.
              </p>
            </div>
            <Button variant="ghost" onClick={() => setPartes((p) => [...p, parteVacia()])}>
              + Agregar parte
            </Button>
          </div>
          {partes.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Sin otras partes.</p>
          ) : (
            <div className="space-y-4">
              {partes.map((p, i) => (
                <div key={p.litigante.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Nombre / razón social">
                      <Input
                        value={p.litigante.nombre}
                        onChange={(v) => actualizarLitigante(i, { nombre: v })}
                        placeholder="Nombre de la parte"
                      />
                    </Field>
                    <Field label="Rol procesal">
                      <Select
                        value={p.rol}
                        onChange={(v) => actualizarParte(i, { rol: v as RolParte })}
                        opciones={ROLES}
                        placeholder="Rol"
                      />
                    </Field>
                    <Field label="Tipo de persona">
                      <Select
                        value={p.litigante.tipoPersona}
                        onChange={(v) => actualizarLitigante(i, { tipoPersona: v as TipoPersona })}
                        opciones={["NATURAL", "JURIDICA"]}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Documento">
                        <Select
                          value={p.litigante.tipoDocumento ?? ""}
                          onChange={(v) => actualizarLitigante(i, { tipoDocumento: (v as TipoDocumento) || undefined })}
                          opciones={TIPOS_DOC}
                          placeholder="Tipo"
                        />
                      </Field>
                      <Field label="Número">
                        <Input
                          value={p.litigante.numeroDocumento ?? ""}
                          onChange={(v) => actualizarLitigante(i, { numeroDocumento: v })}
                        />
                      </Field>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setPartes((ps) => ps.filter((_, idx) => idx !== i))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {(errores.length > 0 || tituloError) && (
          <Card className="border-red-200 bg-red-50 text-sm text-red-700">
            Faltan campos obligatorios. Revisa los marcados en rojo antes de guardar.
          </Card>
        )}
        {apiError && (
          <Card className="border-red-200 bg-red-50 text-sm text-red-700">{apiError}</Card>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => router.push("/procesos")}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Creando…" : "Crear proceso"}
          </Button>
        </div>
      </div>

      {/* Modal: crear cliente nuevo (se crea junto con el proceso) */}
      <Modal
        open={modalCliente}
        onClose={() => setModalCliente(false)}
        title="Nuevo cliente"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalCliente(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarClienteNuevo}>Usar este cliente</Button>
          </>
        }
      >
        <Field label="Nombre / razón social" requerido error={nuevoError ? "Obligatorio" : undefined}>
          <Input
            value={nuevoForm.nombre}
            onChange={(v) => setNuevoForm((f) => ({ ...f, nombre: v }))}
            placeholder="Nombre y apellido / razón social"
          />
        </Field>
        <Field label="Tipo de persona">
          <Select
            value={nuevoForm.tipoPersona}
            onChange={(v) => setNuevoForm((f) => ({ ...f, tipoPersona: v as TipoPersona }))}
            opciones={["NATURAL", "JURIDICA"]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tipo de documento">
            <Select
              value={nuevoForm.tipoDocumento ?? ""}
              onChange={(v) => setNuevoForm((f) => ({ ...f, tipoDocumento: (v as TipoDocumento) || undefined }))}
              opciones={TIPOS_DOC}
              placeholder="Tipo"
            />
          </Field>
          <Field label="Número de documento">
            <Input
              value={nuevoForm.numeroDocumento ?? ""}
              onChange={(v) => setNuevoForm((f) => ({ ...f, numeroDocumento: v }))}
            />
          </Field>
        </div>
        <Field label="Teléfono">
          <Input
            value={nuevoForm.telefono ?? ""}
            onChange={(v) => setNuevoForm((f) => ({ ...f, telefono: v }))}
            placeholder="Teléfono"
          />
        </Field>
        <Field label="Correo">
          <Input
            value={nuevoForm.email ?? ""}
            onChange={(v) => setNuevoForm((f) => ({ ...f, email: v }))}
            placeholder="correo@ejemplo.com"
          />
        </Field>
      </Modal>
    </div>
  );
}
