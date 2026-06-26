"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Card, Modal, PageHeader } from "@/components/ui";
import { BuscadorSelect, CorreosInput, Field, Input, MoneyInput, NATURALEZA_LABEL, Notificaciones, Select, SelectableCard } from "@/components/form-ui";
import { FormularioDinamico } from "@/components/formulario-dinamico";
import { BotonActualizarRadicado } from "@/components/boton-actualizar-radicado";
import { VencimientoHint } from "@/components/vencimiento-hint";
import { BotonSubirDoc } from "@/components/boton-subir-doc";
import { DocumentosUploader } from "@/components/documentos-uploader";
import { errorMessage } from "@/lib/api";
import { getUser, type AuthUser } from "@/lib/auth";
import {
  esCurado,
  documentosRequeridosDeEtapas,
  documentosOpcionalesDeEtapas,
  etapasDeCreacion,
  etiquetaDoc,
  etiquetasPlazoOpciones,
  JURISDICCION_LABEL,
  rutaProceso,
  SECCION_RUTA,
  SECCION_LABEL,
  validarDatos,
  type CuantiaTipo,
  type Jurisdiccion,
  type NaturalezaJuridica,
  type ParteProceso,
  type RolParte,
  type TipoDocumento,
  type TipoPersona,
  type TipoProceso,
} from "@/lib/procesos";
import {
  crearProceso,
  getTipos,
  listClientes,
  listMiembros,
  subirArchivoProceso,
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
// El proceso laboral (Ley 2452/2025) es un ordinario entre dos partes: solo aplican
// demandante/demandado. Los demás roles (ejecutante, víctima, acusado…) son de otras
// jurisdicciones, así que se acota el selector cuando el tipo es de grupo LABORAL.
const ROLES_LABORAL: RolParte[] = ["DEMANDANTE", "DEMANDADO"];
const rolesDisponibles = (tipo: TipoProceso): RolParte[] =>
  tipo.grupo === "LABORAL" ? ROLES_LABORAL : ROLES;
const TIPOS_DOC: TipoDocumento[] = ["CC", "CE", "NIT", "TI", "PASAPORTE", "PEP_PPT"];

// Datos del cliente nuevo creado al vuelo (se crea junto con el proceso).
type ClienteNuevo = {
  nombre: string;
  tipoPersona: TipoPersona;
  naturalezaJuridica?: NaturalezaJuridica | null;
  tipoDocumento?: TipoDocumento;
  numeroDocumento?: string;
  telefono?: string;
  direccion?: string;
  correos?: string[]; // varios correos; el primero es el principal
  correoDesconocido?: boolean;
  direccionDesconocida?: boolean;
  telefonoDesconocido?: boolean;
};
const CLIENTE_NUEVO_VACIO: ClienteNuevo = { nombre: "", tipoPersona: "NATURAL" };

// Las partes de esta sección son la contraparte y terceros (nunca el cliente).
function parteVacia(rol: RolParte = "DEMANDADO"): ParteProceso {
  return {
    litigante: { id: `tmp-${Math.floor(performance.now())}`, tipoPersona: "NATURAL", nombre: "", correos: [] },
    rol,
    esNuestroCliente: false,
  };
}

// Peticionario adicional (co-peticionario) de una petición: se materializa como
// una parte con rol OTRO + etiqueta "Peticionario" (esNuestroCliente=true), igual
// que el cliente principal. No entra al CRM; vive solo en el proceso.
function peticionarioVacio(): ParteProceso {
  return {
    litigante: { id: `pet-${Math.floor(performance.now())}`, tipoPersona: "NATURAL", nombre: "", correos: [] },
    rol: "OTRO",
    rolEtiqueta: "Peticionario",
    esNuestroCliente: true,
  };
}

const esEjecutivo = (tipo: TipoProceso) =>
  tipo.nombre === "Proceso ejecutivo de mínima cuantía";

// Procesos de LITIGIO con título "Activo vs. Pasivo": el laboral, los verbales civiles
// (CGP) y el ejecutivo de mínima cuantía. Comparten el patrón "Tipo — X vs. Y" (a diferencia
// de DdP/tutela = "Tipo — Entidad", y del resto de judiciales que va con título manual).
const esLitigioVs = (tipo: TipoProceso) =>
  tipo.grupo === "LABORAL" ||
  ["Proceso verbal", "Proceso verbal sumario"].includes(tipo.nombre) ||
  esEjecutivo(tipo);

// Roles de las dos partes del litigio: el ejecutivo usa ejecutante/ejecutado; el resto
// (laboral, verbales) demandante/demandado. El activo va primero en el título.
const rolesLitigio = (tipo: TipoProceso): { activo: RolParte; pasivo: RolParte } =>
  esEjecutivo(tipo)
    ? { activo: "EJECUTANTE", pasivo: "EJECUTADO" }
    : { activo: "DEMANDANTE", pasivo: "DEMANDADO" };

// Título auto-generado para trámites ante entidad (DdP) y acciones constitucionales
// (tutela): "Tipo — Entidad" (p. ej. "Derecho de Petición — Colpensiones",
// "Acción de tutela — Colpensiones"). La entidad sale de `entidad` (DdP) o de
// `entidadAccionada` (tutela). Si aún no hay entidad, usa solo el tipo.
function tituloGenerado(tipo: TipoProceso, datos: Record<string, unknown>): string {
  const entidad = String(datos.entidad ?? datos.entidadAccionada ?? "").trim();
  return [tipo.nombre, entidad].filter(Boolean).join(" — ");
}

export default function NuevoProcesoPage() {
  const router = useRouter();
  // Se lee tras montar (localStorage) para no romper la hidratación.
  const [yo, setYo] = useState<AuthUser | null>(null);
  const roles = yo?.roles ?? [];
  const esAdmin = !!yo?.esAdminEmpresa || roles.includes("ADMINISTRADOR");
  const esAbogado = roles.includes("JURIDICO");

  // El catálogo se trae completo una vez y se agrupa por jurisdicción (6 fijas),
  // igual que el portal admin. El área de práctica queda como metadata/filtro.
  const [tipos, setTipos] = useState<TipoProceso[] | null>(null);
  const [jurisdiccion, setJurisdiccion] = useState<Jurisdiccion | "">("");
  const [tipo, setTipo] = useState<TipoProceso | null>(null);
  // Tipo pre-seleccionado por ?tipo=ID (p. ej. al crear una petición desde /peticiones):
  // salta los pasos de jurisdicción/tipo y oculta los botones "Cambiar".
  const [tipoBloqueado, setTipoBloqueado] = useState(false);

  // Documentos del proceso (peticion.pdf, poder.pdf, etc.): se eligen aquí y se
  // suben tras crear el proceso (la subida necesita el id).
  const [archivos, setArchivos] = useState<Record<string, File>>({});
  const [docsError, setDocsError] = useState<string | null>(null);
  // Documentos de prueba con nombre libre (anexos): se recogen aquí (lista repetible)
  // y se suben tras crear el proceso, igual que `archivos`. El proceso aún no existe.
  const [pruebasDocs, setPruebasDocs] = useState<{ id: string; nombre: string; file: File | null }[]>([]);
  // Documentos de la solicitud de medidas cautelares (ejecutivo): lista repetible,
  // N archivos cada uno con su nombre; se suben tras crear, igual que `pruebasDocs`.
  const [cautelaresDocs, setCautelaresDocs] = useState<{ id: string; nombre: string; file: File | null }[]>([]);

  const [titulo, setTitulo] = useState("");
  const [datos, setDatos] = useState<Record<string, unknown>>({});
  const [errores, setErrores] = useState<string[]>([]);
  const [tituloError, setTituloError] = useState(false);

  const [radicado, setRadicado] = useState("");
  const [despachoJuzgado, setDespachoJuzgado] = useState("");
  const [cuantiaLabel, setCuantiaLabel] = useState("");
  const [cuantiaValor, setCuantiaValor] = useState("");
  const [partes, setPartes] = useState<ParteProceso[]>([]);
  // Peticionarios adicionales (co-peticionarios) en una petición/DdP.
  const [peticionarios, setPeticionarios] = useState<ParteProceso[]>([]);

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
  // Ruta de la ficha del proceso recién creado, para ofrecer un link cuando algún
  // documento NO se pudo subir (el proceso ya existe; los docs se reintentan ahí).
  const [creadoRuta, setCreadoRuta] = useState<string | null>(null);

  useEffect(() => {
    setYo(getUser());
    getTipos()
      .then((ts) => {
        setTipos(ts);
        // Pre-selección por ?tipo=ID (sin useSearchParams para no exigir Suspense).
        const q = new URLSearchParams(window.location.search).get("tipo");
        const pre = q ? ts.find((t) => t.id === q) : undefined;
        if (pre) {
          setTipo(pre);
          setJurisdiccion(pre.jurisdiccion);
          setTipoBloqueado(true);
        }
      })
      .catch(() => setTipos([]));
    listClientes().then(setClientes).catch(() => {});
  }, []);

  // Equipo solo para el admin (asigna abogado); un abogado se autoasigna.
  // Por defecto el responsable es uno mismo (el admin o el creador), editable.
  useEffect(() => {
    if (esAdmin) listMiembros().then(setAbogados).catch(() => {});
    if (yo) setResponsableId((prev) => prev || yo.id);
  }, [esAdmin, yo]);

  function setCampo(key: string, value: unknown) {
    setDatos((d) => ({ ...d, [key]: value }));
  }

  // Lista de adjuntos: `requeridos` se marcan con * (rojo si faltan y ya se
  // intentó crear); los demás van como "(opcional)". `docsError` se setea al
  // intentar crear sin los obligatorios.
  const listaDocs = (docs: string[], requeridos: string[]) => (
    <ul className="space-y-2">
      {docs.map((nombre) => {
        const file = archivos[nombre];
        const req = requeridos.includes(nombre);
        const falta = req && !file && !!docsError;
        return (
          <li
            key={nombre}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${falta ? "border-red-300 dark:border-red-500/40" : "border-slate-200 dark:border-slate-600"} bg-slate-50 dark:bg-slate-700`}
          >
            <span className={`text-sm font-medium ${file ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"}`}>
              {file ? "✓ " : "• "}
              {etiquetaDoc(nombre)}
              {req ? <span className="ml-0.5 text-red-500">*</span> : <span className="ml-1 font-normal text-slate-400">(opcional)</span>}
              {file && <span className="ml-1 font-normal text-slate-400">· {file.name}</span>}
            </span>
            <BotonSubirDoc
              etiqueta={etiquetaDoc(nombre)}
              yaSubido={!!file}
              onSubir={(f) => setArchivos((prev) => ({ ...prev, [nombre]: f }))}
            />
          </li>
        );
      })}
    </ul>
  );
  // Bloque de adjuntos INLINE: para anclar los documentos justo debajo del campo
  // que genera su necesidad (vía slotDespuesDe), en vez de agruparlos al final.
  const slotDocs = (docs: string[], requeridos: string[] = []) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700/60">
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Documentos a adjuntar</p>
      {listaDocs(docs, requeridos)}
    </div>
  );
  // Uploaders de N documentos con nombre libre (componente estándar DocumentosUploader).
  // Recogen los File en estado local; se suben tras crear el proceso (loops abajo).
  const pruebasUploader = (
    <DocumentosUploader
      value={pruebasDocs}
      onChange={setPruebasDocs}
      titulo="Documentos de prueba"
      descripcion="Cada documento que aportas como prueba (el título ejecutivo, certificaciones, etc.)."
    />
  );
  const cautelaresUploader = (
    <DocumentosUploader
      value={cautelaresDocs}
      onChange={setCautelaresDocs}
      titulo="Documentos de medidas cautelares"
      descripcion="La solicitud de cautelares y sus soportes."
    />
  );
  function actualizarParte(i: number, patch: Partial<ParteProceso>) {
    setPartes((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function actualizarLitigante(i: number, patch: Partial<ParteProceso["litigante"]>) {
    setPartes((ps) =>
      ps.map((p, idx) => (idx === i ? { ...p, litigante: { ...p.litigante, ...patch } } : p)),
    );
  }
  function actualizarPeticionario(i: number, patch: Partial<ParteProceso["litigante"]>) {
    setPeticionarios((ps) =>
      ps.map((p, idx) => (idx === i ? { ...p, litigante: { ...p.litigante, ...patch } } : p)),
    );
  }

  // Los verbales civiles anclan sus adjuntos de creación INLINE bajo el campo que
  // los pide (Demanda/Pruebas/Anexos bajo "Síntesis", Soporte bajo "Medio de
  // radicación", Poder bajo "Calidad") en vez del bloque agrupado del final.
  // Data-driven: reparte los documentos REALES de las etapas de creación por campo,
  // así sirve igual para "Proceso verbal" y "Proceso verbal sumario" (que no lleva
  // demanda.pdf → su slot de Síntesis solo mostrará Pruebas/Anexos).
  const esVerbal =
    !!tipo && ["Proceso verbal", "Proceso verbal sumario"].includes(tipo.nombre);

  const slotsVerbal: Record<string, ReactNode> = {};
  const ancladosVerbal = new Set<string>();
  if (esVerbal && tipo) {
    const etapasCrea = etapasDeCreacion(tipo.etapas);
    const req = documentosRequeridosDeEtapas(etapasCrea, datos);
    const todos = [...req, ...documentosOpcionalesDeEtapas(etapasCrea, datos)];
    const tomar = (...nombres: string[]) =>
      todos.filter((d) => nombres.includes(d.toLowerCase()));
    const anclar = (campo: string, docs: string[]) => {
      if (!docs.length) return;
      slotsVerbal[campo] = slotDocs(docs, req);
      docs.forEach((d) => ancladosVerbal.add(d.toLowerCase()));
    };
    anclar("sintesis", tomar("demanda.pdf", "pruebas.pdf", "anexos.pdf"));
    anclar("medioRadicacion", tomar("soporte-radicacion.pdf"));
    anclar("calidad", tomar("poder.pdf"));
  }

  // Ejecutivo de mínima cuantía: la "Solicitud de medidas cautelares" se ancla
  // INLINE bajo "Tipo(s) de medida cautelar" (solo aparece si pidió cautelares), en
  // vez de quedar en el bloque "Documentos del proceso" del final. Data-driven:
  // el doc es el opcional que surge solo al poner solicitaCautelares=Sí.
  const slotsEjecutivo: Record<string, ReactNode> = {};
  const ancladosEjecutivo = new Set<string>();
  if (tipo && esEjecutivo(tipo)) {
    const etapasCrea = etapasDeCreacion(tipo.etapas);
    const req = documentosRequeridosDeEtapas(etapasCrea, datos);
    const sinCautelares = { ...datos, solicitaCautelares: "" };
    const docsCautelares = documentosOpcionalesDeEtapas(etapasCrea, datos).filter(
      (d) => !documentosOpcionalesDeEtapas(etapasCrea, sinCautelares).includes(d),
    );
    if (docsCautelares.length) {
      // Lista repetible (N archivos con nombre), no el slot de un único doc fijo.
      slotsEjecutivo.tipoCautelares = cautelaresUploader;
      docsCautelares.forEach((d) => ancladosEjecutivo.add(d.toLowerCase()));
    }
    // La demanda y el poder se anclan INLINE en torno a "Pruebas a solicitar":
    // la demanda justo debajo de ese campo, y el poder bajo los datos del poder
    // ("Nombre del representante legal"), en vez de quedar juntos en el bloque
    // "Documentos del proceso" del final.
    const anclarEj = (campo: string, ...nombres: string[]) => {
      const docs = req.filter((d) => nombres.includes(d.toLowerCase()));
      if (!docs.length) return;
      slotsEjecutivo[campo] = slotDocs(docs, req);
      docs.forEach((d) => ancladosEjecutivo.add(d.toLowerCase()));
    };
    anclarEj("pruebas", "demanda.pdf");
    anclarEj("repLegalNombre", "poder.pdf");
  }

  const clienteSeleccionado = clienteNuevo
    ? `${clienteNuevo.nombre} (nuevo)`
    : clientes.find((c) => c.id === clienteId)?.nombre ?? "";

  // Título auto del proceso laboral: "Proceso Laboral — Demandante vs. Demandado".
  // Como es un litigio entre dos partes, se ordena siempre demandante-primero usando el
  // campo `rol` (a quién representamos): si representamos al demandado, el cliente va de
  // segundo. La contraparte sale de las partes (la marcada DEMANDADO, o la primera).
  // Si aún no hay contraparte (es opcional al crear), queda solo el cliente.
  function tituloLaboral(tipo: TipoProceso, datos: Record<string, unknown>): string {
    const nombreCliente = clienteNuevo
      ? clienteNuevo.nombre.trim()
      : clientes.find((c) => c.id === clienteId)?.nombre.trim() ?? "";
    const { pasivo } = rolesLitigio(tipo);
    const contraparte = (
      partes.find((p) => p.rol === pasivo) ?? partes[0]
    )?.litigante.nombre.trim() ?? "";
    // El ejecutivo no pregunta lado (el despacho ejecuta) → el cliente es la parte activa.
    const clienteEsPasivo = !esEjecutivo(tipo) && String(datos.rol ?? "") === "Demandado";
    const nomActivo = clienteEsPasivo ? contraparte : nombreCliente;
    const nomPasivo = clienteEsPasivo ? nombreCliente : contraparte;
    const partesTit = [nomActivo, nomPasivo].filter(Boolean).join(" vs. ");
    return [tipo.nombre, partesTit].filter(Boolean).join(" — ");
  }

  function limpiarCliente() {
    setClienteId("");
    setClienteNuevo(null);
  }
  function guardarClienteNuevo() {
    if (!nuevoForm.nombre.trim()) {
      setNuevoError(true);
      return;
    }
    const correos = (nuevoForm.correos ?? []).map((c) => c.trim()).filter(Boolean);
    setClienteNuevo({ ...nuevoForm, nombre: nuevoForm.nombre.trim(), correos });
    setClienteId("");
    setModalCliente(false);
  }

  // Elegibles como responsable: abogados del despacho (rol JURIDICO) + el propio
  // admin (para poder quedar él por defecto aunque no tenga el rol JURIDICO).
  const abogadosElegibles = abogados.filter(
    (m) => m.activo && (m.roles.includes("JURIDICO") || m.id === yo?.id),
  );

  async function guardar() {
    if (!tipo) return;
    // En no-judiciales (DdP) el cliente es el "peticionario": no hay rol procesal →
    // se guarda "OTRO" con etiqueta "Peticionario". En la tutela ofensiva el cliente es
    // el accionante (rol fijo, sin selector). En el resto de judiciales, el rol elegido.
    const esTutelaOfensiva = tipo.grupo === "CONSTITUCIONAL" && !tipo.clienteOpcional;
    // En el laboral el lado se elige UNA sola vez en "Rol en el proceso" (datos.rol);
    // el rol procesal del cliente se deriva de ahí (no se pregunta dos veces).
    const rolCliente: RolParte = esTutelaOfensiva
      ? "ACCIONANTE"
      : esLitigioVs(tipo)
        ? (String(datos.rol) === "Demandado" ? rolesLitigio(tipo).pasivo : rolesLitigio(tipo).activo)
        : tipo.esJudicial
          ? clienteRol
          : "OTRO";
    const etiquetaCliente = tipo.esJudicial ? undefined : "Peticionario";
    // Trámites ante entidad (DdP) y acciones constitucionales (tutela): el título se
    // auto-genera "Tipo — Entidad" y el campo va oculto. Los procesos laborales también
    // se auto-generan, pero como litigio entre dos partes: "Proceso Laboral — Demandante
    // vs. Demandado" (ver tituloLaboral). El resto de judiciales (civil…) sigue manual.
    const tituloAuto = !tipo.esJudicial || tipo.grupo === "CONSTITUCIONAL" || esLitigioVs(tipo);
    const tituloFinal = esLitigioVs(tipo)
      ? tituloLaboral(tipo, datos)
      : tituloAuto
        ? tituloGenerado(tipo, datos)
        : titulo.trim();
    const tituloOk = tituloFinal.length > 0;
    setTituloError(!tituloOk);
    // El cliente puede ser opcional para trámites dirigidos al despacho (p. ej. DdP
    // recibido): ahí no bloquea si va vacío. En el resto, sigue siendo obligatorio.
    const clienteRequerido = !tipo.clienteOpcional;
    const hayCliente = !!clienteId || !!clienteNuevo;
    setClienteError(clienteRequerido && !hayCliente);
    const hayResponsable = esAdmin ? !!responsableId : true;
    setResponsableError(!hayResponsable);
    // Solo los campos visibles al CREAR; los `soloFicha` (radicación, contestación)
    // se llenan después en la ficha al avanzar de etapa.
    const esquemaCreacion = tipo.esquemaFormulario.filter((c) => !c.soloFicha);
    const { ok, faltantes } = validarDatos(esquemaCreacion, datos);
    const keysFaltantes = esquemaCreacion
      .filter((c) => faltantes.includes(c.label))
      .map((c) => c.key);
    setErrores(keysFaltantes);
    // Documentos OBLIGATORIOS (petición, poder si requiere, respuesta si contestó):
    // deben estar adjuntos para crear. Los opcionales (reiteración) no bloquean.
    const docsFaltan = documentosRequeridosDeEtapas(etapasDeCreacion(tipo.etapas), datos).filter((d) => !archivos[d]);
    setDocsError(docsFaltan.length ? `Faltan documentos obligatorios: ${docsFaltan.map(etiquetaDoc).join(", ")}.` : null);
    if (!ok || !tituloOk || (clienteRequerido && !hayCliente) || !hayResponsable || docsFaltan.length > 0) {
      // Sube/baja al PRIMER campo inválido (en orden del DOM) y lo enfoca, para que el
      // usuario lo vea sin tener que buscarlo. Cada campo lleva un ancla `data-campo`.
      const invalidos = new Set<string>([
        ...(!tituloOk ? ["titulo"] : []),
        ...(clienteRequerido && !hayCliente ? ["clienteId"] : []),
        ...(!hayResponsable ? ["responsableId"] : []),
        ...keysFaltantes,
        ...(docsFaltan.length ? ["__docs"] : []),
      ]);
      requestAnimationFrame(() => {
        const nodos = Array.from(document.querySelectorAll<HTMLElement>("[data-campo]"));
        const primero = nodos.find((n) => invalidos.has(n.dataset.campo ?? ""));
        if (!primero) return;
        primero.scrollIntoView({ behavior: "smooth", block: "center" });
        primero.querySelector<HTMLElement>("input, select, textarea, button")?.focus({ preventScroll: true });
      });
      return;
    }

    setGuardando(true);
    setApiError(null);
    try {
      const body: CrearProcesoBody = {
        tipoProcesoId: tipo.id,
        titulo: tituloFinal,
        datos,
        cuantiaTipo: CUANTIAS.find((c) => c.label === cuantiaLabel)?.v,
        cuantiaValor: cuantiaValor || undefined,
        radicado: radicado.trim() || undefined,
        despachoJuzgado: despachoJuzgado.trim() || undefined,
        responsableId: (esAdmin ? responsableId : yo?.id) || undefined,
        // Sin cliente (trámite dirigido al despacho) → no se envía `cliente`.
        cliente: clienteNuevo
          ? { nuevo: clienteNuevo, rol: rolCliente, rolEtiqueta: etiquetaCliente }
          : clienteId
            ? { clienteId, rol: rolCliente, rolEtiqueta: etiquetaCliente }
            : undefined,
        partes: [
          ...partes
            .filter((p) => p.litigante.nombre.trim().length > 0)
            .map((p) => ({
              litigante: {
                tipoPersona: p.litigante.tipoPersona,
                naturalezaJuridica: p.litigante.naturalezaJuridica,
                nombre: p.litigante.nombre.trim(),
                tipoDocumento: p.litigante.tipoDocumento,
                numeroDocumento: p.litigante.numeroDocumento,
                telefono: p.litigante.telefono,
                direccion: p.litigante.direccion,
                correos: (p.litigante.correos ?? []).map((c) => c.trim()).filter(Boolean),
                correoDesconocido: p.litigante.correoDesconocido,
                direccionDesconocida: p.litigante.direccionDesconocida,
                telefonoDesconocido: p.litigante.telefonoDesconocido,
              },
              rol: p.rol,
              rolEtiqueta: p.rolEtiqueta,
              esNuestroCliente: false,
            })),
          // Co-peticionarios (DdP) → parte OTRO + etiqueta "Peticionario"; co-accionantes
          // (tutela, litisconsorcio) → parte ACCIONANTE. Ambos son "nuestros".
          ...peticionarios
            .filter((p) => p.litigante.nombre.trim().length > 0)
            .map((p) => ({
              litigante: {
                tipoPersona: p.litigante.tipoPersona,
                nombre: p.litigante.nombre.trim(),
                tipoDocumento: p.litigante.tipoDocumento,
                numeroDocumento: p.litigante.numeroDocumento,
                telefono: p.litigante.telefono,
                correos: (p.litigante.correos ?? []).map((c) => c.trim()).filter(Boolean),
              },
              // Tutela → ACCIONANTE; laboral → mismo lado que el cliente (litisconsorcio:
              // co-demandante/co-demandado); DdP → OTRO con etiqueta "Peticionario".
              rol: (esTutelaOfensiva ? "ACCIONANTE" : esLitigioVs(tipo) ? rolCliente : "OTRO") as RolParte,
              rolEtiqueta: (esTutelaOfensiva || esLitigioVs(tipo)) ? undefined : "Peticionario",
              esNuestroCliente: true,
            })),
        ],
      };
      const creado = await crearProceso(body);
      // Los documentos solo se pueden vincular una vez existe el proceso: se suben TODOS
      // los que el usuario adjuntó. Si alguno falla, el proceso ya quedó creado → NO se
      // traga el error en silencio: se juntan los fallidos y se avisa con link a la ficha
      // para reintentarlos (antes se perdían sin que el usuario se enterara).
      const fallidos: string[] = [];
      const subir = async (file: File, nombre: string, etiqueta: string) => {
        try {
          await subirArchivoProceso(creado.id, file, nombre);
        } catch {
          fallidos.push(etiqueta);
        }
      };
      for (const [nombre, file] of Object.entries(archivos)) {
        if (file) await subir(file, nombre, nombre);
      }
      // Pruebas (prefijo "Prueba: ") y cautelares ("Solicitud cautelar: "): nombre libre.
      for (const p of pruebasDocs) {
        if (p.file) await subir(p.file, `Prueba: ${p.nombre.trim() || p.file.name}`, `Prueba: ${p.nombre.trim() || p.file.name}`);
      }
      for (const c of cautelaresDocs) {
        if (c.file) await subir(c.file, `Solicitud cautelar: ${c.nombre.trim() || c.file.name}`, `Cautelar: ${c.nombre.trim() || c.file.name}`);
      }
      const ruta = rutaProceso({ id: creado.id, grupo: tipo.grupo });
      if (fallidos.length) {
        // El proceso existe, pero faltaron docs: NO redirigir en silencio; avisar + link.
        setApiError(`El proceso se creó, pero ${fallidos.length} documento(s) no se subieron: ${fallidos.join(", ")}. Abrí la ficha y adjuntalos de nuevo.`);
        setCreadoRuta(ruta);
        setGuardando(false);
        return;
      }
      // Una petición (no judicial) abre su ficha bajo /peticiones; un proceso
      // judicial bajo /procesos → el sidebar resalta la sección correcta.
      router.push(ruta);
    } catch (e) {
      setApiError(errorMessage(e, "No se pudo crear el proceso"));
      setGuardando(false);
    }
  }

  // Catálogo del wizard genérico: TODOS los tipos (procesos unificados por jurisdicción).
  // Antes se acotaba a grupo JUDICIAL; ahora peticiones, acciones y laborales también se
  // crean desde aquí, agrupados por su jurisdicción.
  const tiposCatalogo = tipos ?? [];

  // Sección a la que pertenece el tipo pre-bloqueado (peticiones / acciones / laborales):
  // los enlaces "volver" y "cancelar" apuntan ahí en vez de a /procesos.
  const seccionBloqueada = tipo ? SECCION_RUTA[tipo.grupo] : "/procesos";
  const seccionBloqueadaLabel = tipo ? SECCION_LABEL[tipo.grupo] : "Procesos";

  // --- Paso 1: jurisdicción (6 fijas; solo las que tienen tipos en el catálogo) ---
  if (!jurisdiccion) {
    const conteo = tiposCatalogo.reduce<Record<string, number>>((acc, t) => {
      acc[t.jurisdiccion] = (acc[t.jurisdiccion] ?? 0) + 1;
      return acc;
    }, {});
    const jurisdicciones = (Object.keys(JURISDICCION_LABEL) as Jurisdiccion[]).filter((j) => conteo[j]);
    return (
      <div>
        <PageHeader
          title="Nuevo proceso"
          subtitle="Paso 1 de 3 · Elige la jurisdicción."
          action={
            <Link href={seccionBloqueada}>
              <Button variant="ghost">← {seccionBloqueadaLabel}</Button>
            </Link>
          }
        />
        {tipos === null ? (
          <Card className="text-sm text-slate-500">Cargando catálogo…</Card>
        ) : jurisdicciones.length === 0 ? (
          <Card className="text-sm text-slate-500">No hay tipos de proceso en el catálogo todavía.</Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {jurisdicciones.map((j) => (
              <SelectableCard
                key={j}
                title={JURISDICCION_LABEL[j]}
                subtitle={`${conteo[j]} tipo${conteo[j] === 1 ? "" : "s"}`}
                onClick={() => setJurisdiccion(j)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Paso 2: tipo de proceso (filtrado por la jurisdicción elegida) ---
  if (!tipo) {
    const tiposJur = tiposCatalogo.filter((t) => t.jurisdiccion === jurisdiccion);
    return (
      <div>
        <PageHeader
          title="Nuevo proceso"
          subtitle={`Paso 2 de 3 · ${JURISDICCION_LABEL[jurisdiccion]}`}
          action={
            <Button variant="ghost" onClick={() => setJurisdiccion("")}>
              ← Cambiar jurisdicción
            </Button>
          }
        />
        {tiposJur.length === 0 ? (
          <Card className="text-sm text-slate-500">
            No hay tipos de proceso en esta jurisdicción todavía.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tiposJur.map((t) => (
              <SelectableCard
                key={t.id}
                title={t.nombre}
                subtitle={t.descripcion}
                badge={esCurado(t) ? undefined : "No actualizado"}
                onClick={() => setTipo(t)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Paso 3: formulario ---
  // Tutela ofensiva = la "Acción de tutela" que presentamos (grupo CONSTITUCIONAL, con
  // cliente obligatorio). Su formulario sigue el doc Juan David: sin rol procesal (el
  // cliente es el accionante), sin datos judiciales (no hay cuantía; el "radicado de la
  // tutela" es seguimiento) y sin contraparte (el accionado va en `entidadAccionada`).
  // Deja fuera la "Acción de Tutela (Recibida)" defensiva (clienteOpcional).
  const esTutelaOfensiva = tipo.grupo === "CONSTITUCIONAL" && !tipo.clienteOpcional;
  // Laboral: puede haber litisconsorcio (varios demandantes o demandados que
  // representamos). Se reusa la sección de co-peticionarios, con el sustantivo según
  // el rol elegido.
  const esLaboral = tipo.grupo === "LABORAL";
  const coParteNoun = esTutelaOfensiva
    ? "accionante"
    : esLaboral
      ? (String(datos.rol) === "Demandado" ? "demandado" : "demandante")
      : "peticionario";
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={tipo.nombre}
        subtitle={tipoBloqueado ? seccionBloqueadaLabel : `Paso 3 de 3 · ${JURISDICCION_LABEL[tipo.jurisdiccion]}`}
        action={
          tipoBloqueado ? (
            <Link href={seccionBloqueada}>
              <Button variant="ghost">← {seccionBloqueadaLabel}</Button>
            </Link>
          ) : (
            <Button variant="ghost" onClick={() => setTipo(null)}>
              ← Cambiar tipo
            </Button>
          )
        }
      />

      <div className="space-y-5">
        {/* Título manual solo en judiciales NO constitucionales NI laborales ("Pérez vs. XYZ").
            En trámites ante entidad (DdP), acciones constitucionales (tutela) y procesos
            laborales se auto-genera y se oculta; queda editable luego en la ficha. */}
        {tipo.esJudicial && tipo.grupo !== "CONSTITUCIONAL" && !esLitigioVs(tipo) && (
        <div data-campo="titulo">
        <Card>
          <Field label="Título del caso" requerido error={tituloError ? "Obligatorio" : undefined}>
            <Input value={titulo} onChange={setTitulo} placeholder="Ej. Pérez vs. Aseguradora XYZ" />
          </Field>
        </Card>
        </div>
        )}

        {/* Cliente dueño del proceso. Oculto en trámites dirigidos al despacho (DdP
            recibido, clienteOpcional): por defecto van hacia la propia empresa, sin
            cliente del CRM (se crea con clienteId nulo). */}
        {!tipo.clienteOpcional && (
        <div data-campo="clienteId">
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
              {/* El rol procesal solo aplica a procesos judiciales; en un DdP el
                  cliente es el peticionario (sin rol de parte). En la tutela el cliente
                  es siempre el accionante → tampoco se ofrece elegir rol. En los procesos de
                  LITIGIO (laboral y verbales civiles) el lado se elige en "Rol en el proceso"
                  (datos.rol) → no se pregunta acá el rol procesal genérico. */}
              {tipo.esJudicial && !esTutelaOfensiva && !esLitigioVs(tipo) && (
                <Field label="Rol procesal del cliente">
                  <Select
                    value={clienteRol}
                    onChange={(v) => setClienteRol(v as RolParte)}
                    opciones={rolesDisponibles(tipo)}
                    placeholder="Rol"
                  />
                </Field>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="Elegir cliente existente">
                <BuscadorSelect
                  value={clienteId}
                  onChange={(id) => {
                    setClienteId(id);
                    setClienteNuevo(null);
                  }}
                  placeholder="Buscar por nombre, identificación, celular o correo…"
                  opciones={clientes.map((c) => ({
                    id: c.id,
                    nombre: c.nombre,
                    sub: [c.numeroDocumento, c.telefono, c.email].filter(Boolean).join(" · ") || undefined,
                    buscar: [c.numeroDocumento, c.telefono, c.email].filter(Boolean).join(" "),
                  }))}
                />
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
        </div>
        )}

        {/* Otros peticionarios / accionantes: en peticiones (trámite ante entidad) son
            co-peticionarios; en la tutela son co-accionantes (litisconsorcio: varias
            personas presentan UNA tutela). El cliente de arriba es el principal; aquí van
            los demás (cada uno con sus correos). No entran al CRM. */}
        {((!tipo.esJudicial && !tipo.clienteOpcional) || esTutelaOfensiva || esLaboral) && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Otros {coParteNoun}s <span className="font-normal text-slate-400">(opcional)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {esLaboral
                    ? `Si ${String(datos.rol) === "Demandado" ? "son varios demandados" : "demandan varias personas"} (litisconsorcio), agrégalas aquí — el cliente de arriba es el ${coParteNoun} principal.`
                    : esTutelaOfensiva
                      ? "Si la tutela la presentan varias personas (litisconsorcio), agrégalas aquí — el cliente de arriba es el accionante principal."
                      : "Si la petición la presentan varias personas, agrégalas aquí — el cliente de arriba es el peticionario principal."}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setPeticionarios((p) => [...p, peticionarioVacio()])}>
                + Agregar {coParteNoun}
              </Button>
            </div>
            {peticionarios.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Sin {coParteNoun}s adicionales.
              </p>
            ) : (
              <div className="space-y-4">
                {peticionarios.map((p, i) => (
                  <div key={p.litigante.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-600">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Nombre / razón social">
                        <Input
                          value={p.litigante.nombre}
                          onChange={(v) => actualizarPeticionario(i, { nombre: v })}
                          placeholder="Nombre del peticionario"
                        />
                      </Field>
                      <Field label="Tipo de persona">
                        <Select
                          value={p.litigante.tipoPersona}
                          onChange={(v) => actualizarPeticionario(i, { tipoPersona: v as TipoPersona })}
                          opciones={["NATURAL", "JURIDICA"]}
                        />
                      </Field>
                      <Field label="Tipo de documento">
                        <Select
                          value={p.litigante.tipoDocumento ?? ""}
                          onChange={(v) => actualizarPeticionario(i, { tipoDocumento: (v as TipoDocumento) || undefined })}
                          opciones={TIPOS_DOC}
                          placeholder="Tipo"
                        />
                      </Field>
                      <Field label="Número de documento">
                        <Input
                          value={p.litigante.numeroDocumento ?? ""}
                          onChange={(v) => actualizarPeticionario(i, { numeroDocumento: v })}
                        />
                      </Field>
                      <Field label="Teléfono">
                        <Input
                          value={p.litigante.telefono ?? ""}
                          onChange={(v) => actualizarPeticionario(i, { telefono: v })}
                          placeholder="Teléfono"
                        />
                      </Field>
                    </div>
                    <div className="mt-3">
                      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Correos</span>
                      <CorreosInput
                        value={p.litigante.correos ?? []}
                        onChange={(v) => actualizarPeticionario(i, { correos: v })}
                      />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setPeticionarios((ps) => ps.filter((_, idx) => idx !== i))}
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
        )}

        {/* Abogado responsable */}
        <div data-campo="responsableId">
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Abogado responsable
          </h3>
          {esAdmin ? (
            <Field label="Asignar abogado" error={responsableError ? "Obligatorio" : undefined}>
              <BuscadorSelect
                opciones={abogadosElegibles.map((m) => ({
                  id: m.id,
                  nombre: m.id === yo?.id ? `${m.nombre} (tú)` : m.nombre,
                }))}
                value={responsableId}
                onChange={setResponsableId}
                placeholder="Buscar abogado por nombre…"
              />
            </Field>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Quedará asignado a ti{esAbogado ? "" : " (creador)"}:{" "}
              <span className="font-medium text-slate-800 dark:text-slate-100">{yo?.nombre}</span>
            </p>
          )}
        </Card>
        </div>

        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Datos del proceso
          </h3>
          <FormularioDinamico
            esquema={tipo.esquemaFormulario.filter((c) => !c.soloFicha)}
            datos={datos}
            onChange={setCampo}
            errores={errores}
            // Decora las opciones que definen plazo (p. ej. tipo de petición → "(15 días hábiles)").
            etiquetasOpcion={etiquetasPlazoOpciones(tipo.etapas)}
            // Slots: vencimiento tras la fecha de radicación; y los documentos a
            // adjuntar JUSTO debajo de "¿Requiere poder?" — la petición siempre y el
            // poder desplegándose al marcar Sí. (El slot solo se pinta si el tipo tiene
            // ese campo; para los que no, va la sección de fallback de abajo.)
            slotDespuesDe={{
              // Verbal civil: cada adjunto justo debajo del campo que lo pide
              // (mapeo confirmado con el usuario; ver slotsVerbal arriba).
              ...slotsVerbal,
              // Ejecutivo: la solicitud de cautelares bajo "Otras medidas cautelares".
              ...slotsEjecutivo,
              // En el laboral, bajo "Fecha de radicación" va el adjunto de la radicación
              // (no el hint de vencimiento: el plazo laboral no corre desde aquí).
              fechaRadicacion: tipo.grupo === "LABORAL"
                ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="mb-2 text-sm font-medium text-amber-900 dark:text-amber-200">Documento de radicación</p>
                    {listaDocs(["radicacion.pdf"], [])}
                  </div>
                )
                : <VencimientoHint tipoProcesoId={tipo.id} datos={datos} />,
              // DdP recibido: el plazo corre desde la fecha de recepción, así que el
              // preview de vencimiento va debajo de ese campo (equivale a fechaRadicacion).
              fechaRecepcion: <VencimientoHint tipoProcesoId={tipo.id} datos={datos} />,
              // Bajo "¿Requiere poder?": documentos de la radicación (petición * +
              // poder * si requiere), que NO dependen de la respuesta.
              requierePoder: (() => {
                const neutro = { ...datos, contestaron: "" };
                const etapasCrea = etapasDeCreacion(tipo.etapas);
                const req = documentosRequeridosDeEtapas(etapasCrea, neutro);
                // En laboral, la radicación se adjunta bajo "Fecha de radicación" (arriba),
                // así que no se repite en este bloque.
                const opc = documentosOpcionalesDeEtapas(etapasCrea, neutro).filter(
                  (d) => tipo.grupo !== "LABORAL" || d.toLowerCase() !== "radicacion.pdf",
                );
                const docs = [...req, ...opc];
                if (docs.length === 0) return null;
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="mb-2 text-sm font-medium text-amber-900 dark:text-amber-200">Documentos a adjuntar</p>
                    {listaDocs(docs, req)}
                  </div>
                );
              })(),
              // Bajo "¿Contestaron?": los documentos que aparecen POR la respuesta
              // (respuesta * en Sí/Parcial; reiteración opcional en Parcial) — la
              // diferencia entre los docs con la respuesta actual y sin ella.
              contestaron: (() => {
                const neutro = { ...datos, contestaron: "" };
                const reqResp = documentosRequeridosDeEtapas(tipo.etapas, datos).filter((d) => !documentosRequeridosDeEtapas(tipo.etapas, neutro).includes(d));
                const optResp = documentosOpcionalesDeEtapas(tipo.etapas, datos).filter((d) => !documentosOpcionalesDeEtapas(tipo.etapas, neutro).includes(d));
                const docs = [...reqResp, ...optResp];
                if (docs.length === 0) return null;
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="mb-2 text-sm font-medium text-amber-900 dark:text-amber-200">Documentos de la respuesta</p>
                    {listaDocs(docs, reqResp)}
                  </div>
                );
              })(),
              // Igual que `contestaron`, pero para los tipos que usan `contestada`
              // (p. ej. Tutela/DdP recibidos): bajo "¿Se contestó la tutela?" = Sí
              // se despliega el cuadro para subir la contestación.
              contestada: (() => {
                const neutro = { ...datos, contestada: "" };
                const reqResp = documentosRequeridosDeEtapas(tipo.etapas, datos).filter((d) => !documentosRequeridosDeEtapas(tipo.etapas, neutro).includes(d));
                const optResp = documentosOpcionalesDeEtapas(tipo.etapas, datos).filter((d) => !documentosOpcionalesDeEtapas(tipo.etapas, neutro).includes(d));
                const docs = [...reqResp, ...optResp];
                if (docs.length === 0) return null;
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="mb-2 text-sm font-medium text-amber-900 dark:text-amber-200">Documentos de la respuesta</p>
                    {listaDocs(docs, reqResp)}
                  </div>
                );
              })(),
            }}
            // Arriba del campo de texto "Pruebas a solicitar": el uploader de documentos
            // de prueba (nombre libre, N archivos). Solo en el ejecutivo de mínima cuantía.
            slotAntesDe={esEjecutivo(tipo) ? { pruebas: pruebasUploader } : undefined}
          />
        </Card>

        {/* Laboral: # radicado + juzgado en el orden del doc (justo tras la demanda),
            no en el bloque "Datos judiciales" del fondo. Sin cuantía (la instancia se
            elige directo). Mapean a las columnas reales radicado/despachoJuzgado. */}
        {tipo.grupo === "LABORAL" && (
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Radicación <span className="font-normal text-slate-400">(opcional al crear)</span>
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="# Radicado de la demanda">
                <Input value={radicado} onChange={setRadicado} placeholder="Aún sin radicar" />
                {/* Con los 23 dígitos, consulta la Rama y rellena juzgado + agrega la
                    contraparte como sujeto procesal. Igual que en los verbales. */}
                <BotonActualizarRadicado
                  radicado={radicado}
                  className="mt-1.5"
                  onAutollenar={({ despacho, demandante, demandado }) => {
                    if (despacho) setDespachoJuzgado(despacho);
                    const clienteEsPasivo = String(datos.rol ?? "") === "Demandado";
                    const nombre = (clienteEsPasivo ? demandante : demandado)?.trim();
                    if (!nombre) return;
                    const { activo, pasivo } = rolesLitigio(tipo);
                    const base = parteVacia(clienteEsPasivo ? activo : pasivo);
                    setPartes((ps) =>
                      ps.some((p) => p.litigante.nombre.trim().toLowerCase() === nombre.toLowerCase())
                        ? ps
                        : [...ps, { ...base, litigante: { ...base.litigante, nombre } }],
                    );
                  }}
                />
              </Field>
              <Field label="Juzgado o corporación">
                <Input value={despachoJuzgado} onChange={setDespachoJuzgado} placeholder="Ej. Juzgado 5º Laboral del Circuito" />
              </Field>
            </div>
          </Card>
        )}

        {/* Fallback: tipos SIN campo "¿Requiere poder?" muestran los documentos en
            sección aparte (los que sí lo tienen los muestran inline bajo el check).
            En el verbal/sumario los anclados ya van inline; aquí solo quedarían los
            que no se anclaron a ningún campo (normalmente ninguno). */}
        {!tipo.esquemaFormulario.some((c) => c.key === "requierePoder") && (() => {
          const etapasCrea = etapasDeCreacion(tipo.etapas);
          const req = documentosRequeridosDeEtapas(etapasCrea, datos);
          let docs = [...req, ...documentosOpcionalesDeEtapas(etapasCrea, datos)];
          if (esVerbal) docs = docs.filter((d) => !ancladosVerbal.has(d.toLowerCase()));
          if (esEjecutivo(tipo)) docs = docs.filter((d) => !ancladosEjecutivo.has(d.toLowerCase()));
          if (docs.length === 0) return null;
          return (
            <Card>
              <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Documentos del proceso</h3>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Los marcados con <span className="text-red-500">*</span> son obligatorios para crear. Se guardan al crearlo; también puedes subirlos después desde la ficha.
              </p>
              {listaDocs(docs, req)}
            </Card>
          );
        })()}

        {docsError && (
          <p data-campo="__docs" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{docsError}</p>
        )}

        {/* Datos judiciales: solo para procesos que van ante un juez (no en trámites
            ante entidad como el derecho de petición). La tutela ofensiva no tiene cuantía
            ni radicado de 23 dígitos (su radicado es seguimiento), así que se omite. El
            laboral los muestra arriba, en el orden del doc (radicado + juzgado), así que
            aquí se excluye. El ejecutivo de mínima cuantía define radicado/juzgado/cuantía
            en su propio esquema (fuente única `datos.*`), así que también se excluye. */}
        {tipo.esJudicial && !esTutelaOfensiva && tipo.grupo !== "LABORAL" && !esEjecutivo(tipo) && (
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Datos judiciales <span className="font-normal text-slate-400">(opcional)</span>
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Radicado (23 dígitos)">
                <Input value={radicado} onChange={setRadicado} placeholder="Aún sin radicar" />
                {/* Con los 23 dígitos, consulta la Rama y rellena despacho/juzgado y, si el
                    tipo tiene esos campos, demandante/demandado. Misma fuente que la ficha. */}
                <BotonActualizarRadicado
                  radicado={radicado}
                  className="mt-1.5"
                  onAutollenar={({ despacho, demandante, demandado }) => {
                    if (despacho) setDespachoJuzgado(despacho);
                    // El sujeto CONTRARIO (el que no es nuestro cliente) se agrega como
                    // parte real en "Agregar sujeto procesal": si nuestro cliente es el
                    // demandado, la contraparte es el demandante; si no, el demandado.
                    // No duplica si ya existe una parte con ese nombre.
                    const clienteEsPasivo = String(datos.rol ?? "") === "Demandado";
                    const nombre = (clienteEsPasivo ? demandante : demandado)?.trim();
                    if (!nombre) return;
                    const { activo, pasivo } = rolesLitigio(tipo);
                    const base = parteVacia(clienteEsPasivo ? activo : pasivo);
                    setPartes((ps) =>
                      ps.some((p) => p.litigante.nombre.trim().toLowerCase() === nombre.toLowerCase())
                        ? ps
                        : [...ps, { ...base, litigante: { ...base.litigante, nombre } }],
                    );
                  }}
                />
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
        )}

        {/* Partes (litigantes con rol procesal) solo para procesos judiciales;
            un trámite ante una entidad (DdP) no tiene contraparte. En la tutela ofensiva
            el accionado se captura en el campo "Autoridad o particular accionado". */}
        {tipo.esJudicial && !esTutelaOfensiva && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Agregar sujeto procesal <span className="font-normal text-slate-400">(opcional)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Demandado, terceros, etc. — el cliente ya está arriba.
              </p>
            </div>
            <Button variant="ghost" onClick={() => setPartes((p) => [...p, parteVacia(rolesLitigio(tipo).pasivo)])}>
              + Agregar parte
            </Button>
          </div>
          {partes.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Sin otras partes.</p>
          ) : (
            <div className="space-y-4">
              {partes.map((p, i) => (
                <div key={p.litigante.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-600">
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
                        opciones={rolesDisponibles(tipo)}
                        placeholder="Rol"
                      />
                    </Field>
                    <Field label="Tipo de persona">
                      <Select
                        value={p.litigante.tipoPersona}
                        onChange={(v) =>
                          actualizarLitigante(
                            i,
                            v === "JURIDICA"
                              ? { tipoPersona: "JURIDICA", tipoDocumento: "NIT" }
                              : { tipoPersona: "NATURAL", naturalezaJuridica: null },
                          )
                        }
                        opciones={["NATURAL", "JURIDICA"]}
                      />
                    </Field>
                    {p.litigante.tipoPersona === "JURIDICA" && (
                      <Field label="Naturaleza">
                        <Select
                          value={p.litigante.naturalezaJuridica ?? ""}
                          onChange={(v) => actualizarLitigante(i, { naturalezaJuridica: (v as NaturalezaJuridica) || null })}
                          opciones={["PUBLICA", "PRIVADA", "MIXTA"]}
                          etiquetas={NATURALEZA_LABEL}
                          placeholder="Selecciona…"
                        />
                      </Field>
                    )}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                  <div className="mt-3">
                    <Notificaciones
                      value={{
                        correos: p.litigante.correos ?? [],
                        correoDesconocido: p.litigante.correoDesconocido ?? false,
                        direccion: p.litigante.direccion ?? "",
                        direccionDesconocida: p.litigante.direccionDesconocida ?? false,
                        telefono: p.litigante.telefono ?? "",
                        telefonoDesconocido: p.litigante.telefonoDesconocido ?? false,
                      }}
                      onChange={(patch) => actualizarLitigante(i, patch)}
                    />
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
        )}

        {(errores.length > 0 || tituloError) && (
          <Card className="border-red-200 bg-red-50 text-sm text-red-700">
            Faltan campos obligatorios. Revisa los marcados en rojo antes de guardar.
          </Card>
        )}
        {apiError && (
          <Card className="border-red-200 bg-red-50 text-sm text-red-700">
            {apiError}
            {creadoRuta && (
              <button onClick={() => router.push(creadoRuta)} className="ml-2 font-medium underline">
                Abrir la ficha del proceso
              </button>
            )}
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => router.push(tipoBloqueado ? seccionBloqueada : "/procesos")}>
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
            onChange={(v) =>
              setNuevoForm((f) =>
                v === "JURIDICA"
                  ? { ...f, tipoPersona: "JURIDICA", tipoDocumento: "NIT" }
                  : { ...f, tipoPersona: "NATURAL", naturalezaJuridica: null },
              )
            }
            opciones={["NATURAL", "JURIDICA"]}
          />
        </Field>
        {nuevoForm.tipoPersona === "JURIDICA" && (
          <Field label="Naturaleza">
            <Select
              value={nuevoForm.naturalezaJuridica ?? ""}
              onChange={(v) => setNuevoForm((f) => ({ ...f, naturalezaJuridica: (v as NaturalezaJuridica) || null }))}
              opciones={["PUBLICA", "PRIVADA", "MIXTA"]}
              etiquetas={NATURALEZA_LABEL}
              placeholder="Selecciona…"
            />
          </Field>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
        <Notificaciones
          value={{
            correos: nuevoForm.correos ?? [],
            correoDesconocido: nuevoForm.correoDesconocido ?? false,
            direccion: nuevoForm.direccion ?? "",
            direccionDesconocida: nuevoForm.direccionDesconocida ?? false,
            telefono: nuevoForm.telefono ?? "",
            telefonoDesconocido: nuevoForm.telefonoDesconocido ?? false,
          }}
          onChange={(patch) => setNuevoForm((f) => ({ ...f, ...patch }))}
        />
      </Modal>
    </div>
  );
}
