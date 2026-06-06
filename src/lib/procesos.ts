// Contrato del módulo de Procesos (Colombia). Estos tipos son la "fuente única"
// del prototipo UX y se convierten en el contrato de la API en la Fase 2.
// Ver openspec/changes/legal-procesos/.

// --- Taxonomía (valores del enum Jurisdiccion de la API/Prisma) ---
export type Jurisdiccion =
  | "ORDINARIA_CIVIL"
  | "ORDINARIA_LABORAL"
  | "CONTENCIOSO_ADMIN"
  | "PENAL"
  | "CONSTITUCIONAL"
  | "FAMILIA";

export type TipoAreaPractica = "JURISDICCION" | "ESPECIALIDAD" | "PRACTICA";

export type AreaPractica = {
  slug: string;
  nombre: string;
  tipo: TipoAreaPractica;
  jurisdiccion: Jurisdiccion;
  activo: boolean;
};

// --- Formulario dinámico ---
export type CampoTipo =
  | "texto"
  | "textoLargo"
  | "numero"
  | "fecha"
  | "boolean"
  | "select"
  | "multiselect";

export type CampoEsquema = {
  key: string;
  label: string;
  tipo: CampoTipo;
  requerido: boolean;
  opciones?: string[]; // requerido para select | multiselect
  ayuda?: string;
};

// --- Flujo / etapas ---
export type ReglasEtapa = {
  camposRequeridos?: string[];
  documentosRequeridos?: string[];
  plazoDias?: number;
};

export type EtapaDef = {
  key: string;
  nombre: string;
  orden: number;
  terminal?: boolean;
  resultado?: string;
  reglas?: ReglasEtapa;
};

// --- Catálogo: tipo de proceso ---
export type TipoProceso = {
  id: string;
  nombre: string;
  descripcion?: string;
  jurisdiccion: Jurisdiccion;
  areaSlugs: string[]; // etiquetas de área de práctica
  esquemaFormulario: CampoEsquema[];
  etapas: EtapaDef[];
  empresaId: string | null; // null = global; set = del despacho
};

// --- Litigantes / partes ---
export type TipoPersona = "NATURAL" | "JURIDICA";
export type TipoDocumento = "CC" | "CE" | "NIT" | "TI" | "PASAPORTE" | "PEP_PPT";

export type Litigante = {
  id: string;
  tipoPersona: TipoPersona;
  nombre: string;
  tipoDocumento?: TipoDocumento;
  numeroDocumento?: string;
};

export type RolParte =
  | "DEMANDANTE"
  | "DEMANDADO"
  | "EJECUTANTE"
  | "EJECUTADO"
  | "ACCIONANTE"
  | "ACCIONADO"
  | "IMPUTADO"
  | "ACUSADO"
  | "VICTIMA"
  | "TERCERO"
  | "APODERADO"
  | "OTRO";

export type ParteProceso = {
  litigante: Litigante;
  rol: RolParte;
  rolEtiqueta?: string;
  esNuestroCliente: boolean;
};

// --- Proceso (expediente) ---
export type Instancia = "PRIMERA" | "SEGUNDA" | "UNICA" | "CASACION" | "REVISION";
export type CuantiaTipo = "MINIMA" | "MENOR" | "MAYOR" | "SIN_CUANTIA";
export type EstadoProceso =
  | "ABIERTO"
  | "EN_PROCESO"
  | "SUSPENDIDO"
  | "CERRADO"
  | "ARCHIVADO";

export type Proceso = {
  id: string;
  codigoInterno: string; // número de caso del despacho (siempre presente)
  radicado?: string; // 23 dígitos del juzgado (nulo hasta radicar)
  tipoProcesoId: string;
  tipoProcesoNombre: string;
  jurisdiccion: Jurisdiccion;
  areaSlug: string;
  instancia: Instancia;
  cuantiaTipo?: CuantiaTipo;
  cuantiaValor?: string; // dígitos crudos (COP)
  despachoJuzgado?: string;
  casoRelacionadoId?: string;
  titulo: string;
  datos: Record<string, unknown>;
  etapaActual: string;
  estado: EstadoProceso;
  proximaAudiencia?: string;
  partes: ParteProceso[];
  historial: { etapaKey: string; nota?: string; fecha: string }[];
  createdAt: string;
};

// --- Validación del formulario dinámico (misma lógica que usará el server) ---
export type ResultadoValidacion = { ok: boolean; faltantes: string[] };

/** Verifica que los campos requeridos del esquema estén presentes en `datos`. */
export function validarDatos(
  esquema: CampoEsquema[],
  datos: Record<string, unknown>,
): ResultadoValidacion {
  const faltantes: string[] = [];
  for (const campo of esquema) {
    if (!campo.requerido) continue;
    // Un boolean siempre tiene valor (true/false); no se exige.
    if (campo.tipo === "boolean") continue;
    const v = datos[campo.key];
    const vacio =
      v === undefined ||
      v === null ||
      v === "" ||
      (Array.isArray(v) && v.length === 0);
    if (vacio) faltantes.push(campo.label);
  }
  return { ok: faltantes.length === 0, faltantes };
}

/** Etiqueta legible de una jurisdicción (para la UI). */
export const JURISDICCION_LABEL: Record<Jurisdiccion, string> = {
  ORDINARIA_CIVIL: "Jurisdicción Ordinaria · Civil",
  ORDINARIA_LABORAL: "Jurisdicción Ordinaria · Laboral",
  CONTENCIOSO_ADMIN: "Contencioso-Administrativa",
  PENAL: "Penal",
  CONSTITUCIONAL: "Constitucional",
  FAMILIA: "Familia",
};

export const ESTADO_LABEL: Record<EstadoProceso, string> = {
  ABIERTO: "Abierto",
  EN_PROCESO: "En proceso",
  SUSPENDIDO: "Suspendido",
  CERRADO: "Cerrado",
  ARCHIVADO: "Archivado",
};
