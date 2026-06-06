"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui";
import { Field, Input, MoneyInput, Select, SelectableCard } from "@/components/form-ui";
import { FormularioDinamico } from "@/components/formulario-dinamico";
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
import { crearProceso, getAreas, getTipos, type CrearProcesoBody } from "@/lib/procesos-api";

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

function parteVacia(): ParteProceso {
  return {
    litigante: { id: `tmp-${Math.floor(performance.now())}`, tipoPersona: "NATURAL", nombre: "" },
    rol: "DEMANDANTE",
    esNuestroCliente: true,
  };
}

export default function NuevoProcesoPage() {
  const router = useRouter();
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
  const [partes, setPartes] = useState<ParteProceso[]>([parteVacia()]);

  const [guardando, setGuardando] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    getAreas().then((a) => setAreas(a.filter((x) => x.activo))).catch(() => {});
  }, []);

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

  async function guardar() {
    if (!tipo) return;
    const tituloOk = titulo.trim().length > 0;
    setTituloError(!tituloOk);
    const { ok, faltantes } = validarDatos(tipo.esquemaFormulario, datos);
    const keysFaltantes = tipo.esquemaFormulario
      .filter((c) => faltantes.includes(c.label))
      .map((c) => c.key);
    setErrores(keysFaltantes);
    if (!ok || !tituloOk) return;

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
            esNuestroCliente: p.esNuestroCliente,
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
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Partes</h3>
            <Button variant="ghost" onClick={() => setPartes((p) => [...p, parteVacia()])}>
              + Agregar parte
            </Button>
          </div>
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
                <div className="mt-3 flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={p.esNuestroCliente}
                      onChange={(e) => actualizarParte(i, { esNuestroCliente: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                    />
                    Es nuestro cliente
                  </label>
                  {partes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPartes((ps) => ps.filter((_, idx) => idx !== i))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
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
    </div>
  );
}
