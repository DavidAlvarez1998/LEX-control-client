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

// Condición de igualdad sobre otro campo (mostrarSi / requeridoSi / disponibleSi).
export type Condicion = { campo: string; igualA: string | string[] };

export type CampoEsquema = {
  key: string;
  label: string;
  tipo: CampoTipo;
  requerido: boolean;
  opciones?: string[]; // requerido para select | multiselect
  ayuda?: string;
  mostrarSi?: Condicion; // oculto salvo que la condición se cumpla
  requeridoSi?: Condicion; // requerido (además) cuando la condición se cumple
};

// --- Flujo / etapas ---
export type ReglasEtapa = {
  camposRequeridos?: string[];
  documentosRequeridos?: string[];
  documentosOpcionales?: string[]; // ofrecidos para adjuntar, NO bloquean (p. ej. reiteracion.pdf)
  plazoDias?: number;
  requeridosSi?: { si: Condicion; camposRequeridos?: string[]; documentosRequeridos?: string[] }[];
  plazoDesdeCampo?: string;
  plazoTipoDias?: "habiles" | "calendario";
  plazoDiasPorValorDe?: { campo: string; mapa: Record<string, number> };
};

export type AccionEtapa = {
  tipo: "crearDerivado";
  tipoDestinoNombre: string;
  copiarDatos?: string[];
  copiarCliente?: boolean;
};

export type EtapaDef = {
  key: string;
  nombre: string;
  orden: number;
  terminal?: boolean;
  resultado?: string;
  reglas?: ReglasEtapa;
  disponibleSi?: Condicion; // la etapa solo se ofrece como destino si se cumple
  accion?: AccionEtapa; // acción al entrar (p. ej. crear proceso derivado)
};

// --- Catálogo: tipo de proceso ---
export type TipoProceso = {
  id: string;
  nombre: string;
  descripcion?: string;
  jurisdiccion: Jurisdiccion;
  esJudicial: boolean; // true = va ante un juez (radicado 23díg/juzgado/cuantía); false = trámite ante entidad (DdP)
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
  fechaLimite?: string | null; // vencimiento del término de la etapa actual
  partes: ParteProceso[];
  historial: { etapaKey: string; nota?: string; fecha: string }[];
  createdAt: string;
};

// --- Condiciones (mismo evaluador que el server; el server es la fuente de verdad) ---

/** Evalúa una condición de igualdad. `String()` para que los boolean comparen
 *  con `igualA: "true"`. */
export function evaluarCondicion(cond: Condicion, datos: Record<string, unknown>): boolean {
  const actual = String(datos[cond.campo] ?? "");
  return Array.isArray(cond.igualA) ? cond.igualA.includes(actual) : actual === cond.igualA;
}

/** ¿El campo es visible dado el estado actual de `datos`? */
export function campoVisible(campo: CampoEsquema, datos: Record<string, unknown>): boolean {
  return !campo.mostrarSi || evaluarCondicion(campo.mostrarSi, datos);
}

/** ¿El campo es efectivamente requerido? Requerido (fijo o condicional) y visible. */
export function campoEfectivamenteRequerido(
  campo: CampoEsquema,
  datos: Record<string, unknown>,
): boolean {
  if (!campoVisible(campo, datos)) return false;
  return campo.requerido || (campo.requeridoSi != null && evaluarCondicion(campo.requeridoSi, datos));
}

/**
 * Etiquetas de opción decoradas con el plazo, para los selects que determinan un
 * vencimiento por valor (p. ej. "Tipo de petición" → "General (15 días hábiles)").
 * Devuelve `{ [fieldKey]: { [valor]: etiqueta } }`. El VALOR guardado NO cambia
 * (la etiqueta es solo para mostrar). Se deriva de `plazoDiasPorValorDe` de las etapas.
 */
export function etiquetasPlazoOpciones(etapas: EtapaDef[]): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const e of etapas) {
    const p = e.reglas?.plazoDiasPorValorDe;
    if (!p) continue;
    const unidad = e.reglas?.plazoTipoDias === "calendario" ? "días calendario" : "días hábiles";
    out[p.campo] = { ...(out[p.campo] ?? {}) };
    for (const [valor, dias] of Object.entries(p.mapa)) {
      out[p.campo][valor] = `${valor} (${dias} ${unidad})`;
    }
  }
  return out;
}

/**
 * Nombres de documento que exigen las etapas dado el estado actual de `datos`:
 * los `documentosRequeridos` fijos + los `requeridosSi` que apliquen, SALTANDO
 * las etapas-rama cuyo `disponibleSi` no se cumple (p. ej. `reiteracion.pdf`
 * solo si contestaron=PARCIAL). Dedup case-insensitive conservando el original.
 * Lo usan el panel de la ficha y la sección de documentos de la creación.
 */
export function documentosRequeridosDeEtapas(
  etapas: EtapaDef[],
  datos: Record<string, unknown>,
): string[] {
  const porNombre = new Map<string, string>(); // lower → nombre original
  for (const e of etapas) {
    if (e.disponibleSi && !evaluarCondicion(e.disponibleSi, datos)) continue;
    const r = e.reglas;
    if (!r) continue;
    const nombres = [
      ...(r.documentosRequeridos ?? []),
      ...(r.requeridosSi ?? [])
        .filter((x) => evaluarCondicion(x.si, datos))
        .flatMap((x) => x.documentosRequeridos ?? []),
    ];
    for (const n of nombres) porNombre.set(n.trim().toLowerCase(), n);
  }
  return [...porNombre.values()];
}

/** Documentos OPCIONALES (ofrecidos para adjuntar, no bloquean) según `datos`,
 *  respetando `disponibleSi` igual que los requeridos. */
export function documentosOpcionalesDeEtapas(
  etapas: EtapaDef[],
  datos: Record<string, unknown>,
): string[] {
  const porNombre = new Map<string, string>();
  for (const e of etapas) {
    if (e.disponibleSi && !evaluarCondicion(e.disponibleSi, datos)) continue;
    for (const n of e.reglas?.documentosOpcionales ?? []) porNombre.set(n.trim().toLowerCase(), n);
  }
  return [...porNombre.values()];
}

/**
 * Etiqueta amable de un documento para MOSTRAR (sin extensión: el nombre interno
 * "poder.pdf" es solo la clave del gate, el archivo real puede ser cualquier
 * formato). Ej: "poder.pdf" → "Poder", "respuesta.pdf" → "Respuesta",
 * "auto_admisorio.pdf" → "Auto admisorio".
 */
const DOC_ETIQUETAS: Record<string, string> = {
  peticion: "Petición",
  reiteracion: "Reiteración",
  respuesta: "Respuesta",
  poder: "Poder",
  demanda: "Demanda",
  tutela: "Tutela",
  sentencia: "Sentencia",
  impugnacion: "Impugnación",
};
export function etiquetaDoc(nombre: string): string {
  const base = nombre.replace(/\.[^.]+$/, "").trim();
  const clave = base.toLowerCase();
  if (DOC_ETIQUETAS[clave]) return DOC_ETIQUETAS[clave];
  const legible = base.replace(/[_-]+/g, " ").trim();
  return legible.charAt(0).toUpperCase() + legible.slice(1);
}

// --- Validación del formulario dinámico (misma lógica que usará el server) ---
export type ResultadoValidacion = { ok: boolean; faltantes: string[] };

/** Verifica que los campos requeridos y visibles del esquema estén en `datos`.
 *  Ignora por completo los campos ocultos (mostrarSi no se cumple). */
export function validarDatos(
  esquema: CampoEsquema[],
  datos: Record<string, unknown>,
): ResultadoValidacion {
  const faltantes: string[] = [];
  for (const campo of esquema) {
    if (!campoVisible(campo, datos)) continue;
    // Un boolean siempre tiene valor (true/false); no se exige.
    if (campo.tipo === "boolean") continue;
    if (!campoEfectivamenteRequerido(campo, datos)) continue;
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
