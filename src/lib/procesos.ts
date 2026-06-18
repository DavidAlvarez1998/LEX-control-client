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
  | "multiselect"
  | "listaCorreos"; // varios correos (string[]); p. ej. correos de la entidad

// Condición sobre los datos (mostrarSi / requeridoSi / disponibleSi). Tres formas:
//  - Hoja `{campo, igualA}`: igualdad (array-aware para multiselect).
//  - AND `{todas:[...]}`: todas las sub-condiciones se cumplen.
//  - OR  `{alguna:[...]}`: alguna sub-condición se cumple.
// Las hojas son retro-compatibles con el formato anterior.
export type Condicion =
  | { campo: string; igualA: string | string[] }
  | { todas: Condicion[] }
  | { alguna: Condicion[] };

export type CampoEsquema = {
  key: string;
  label: string;
  tipo: CampoTipo;
  requerido: boolean;
  opciones?: string[]; // requerido para select | multiselect
  ayuda?: string;
  mostrarSi?: Condicion; // oculto salvo que la condición se cumpla
  requeridoSi?: Condicion; // requerido (además) cuando la condición se cumple
  auto?: boolean; // lo genera el servidor al crear; en el form se muestra solo lectura
  soloFicha?: boolean; // no se muestra al CREAR; se llena en la ficha al avanzar de etapa
  negrita?: boolean; // resalta el label en negrita
};

// --- Flujo / etapas ---
export type ReglasEtapa = {
  camposRequeridos?: string[];
  documentosRequeridos?: string[];
  documentosOpcionales?: string[]; // ofrecidos para adjuntar, NO bloquean (p. ej. reiteracion.pdf)
  plazoDias?: number;
  requeridosSi?: { si: Condicion; camposRequeridos?: string[]; documentosRequeridos?: string[] }[];
  opcionalesSi?: { si: Condicion; documentosOpcionales?: string[] }[]; // opcionales condicionales (p. ej. recurso.pdf si parcial)
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
  fase?: number; // agrupación de alto nivel (1..6) para el stepper laboral; no afecta el motor
  disponibleSi?: Condicion; // la etapa solo se ofrece como destino si se cumple
  accion?: AccionEtapa; // acción al entrar (p. ej. crear proceso derivado)
};

// Sección del portal: Procesos (judicial), Peticiones (DdP/reclamaciones),
// Acciones Constitucionales (tutela, popular, grupo, cumplimiento) o
// Procesos Laborales (ordinario laboral, Ley 2452/2025).
export type GrupoProceso = "JUDICIAL" | "PETICION" | "CONSTITUCIONAL" | "LABORAL";

// --- Catálogo: tipo de proceso ---
export type TipoProceso = {
  id: string;
  nombre: string;
  descripcion?: string;
  jurisdiccion: Jurisdiccion;
  esJudicial: boolean; // true = va ante un juez (radicado 23díg/juzgado/cuantía); false = trámite ante entidad (DdP)
  grupo: GrupoProceso; // sección del portal donde vive el tipo
  actualizado?: boolean; // ¿el flujo ya fue curado? false → badge "No actualizado". Default API: no-judiciales = true
  clienteOpcional?: boolean; // true = dirigido al despacho (DdP recibido): el cliente no se exige
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
  telefono?: string;
  correos?: string[]; // varios correos; el primero es el principal
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
 *  con `igualA: "true"`. Si el campo es un multiselect (array), se cumple cuando
 *  el array CONTIENE alguno de los objetivos (p. ej. "Otro" entre lo elegido). */
export function evaluarCondicion(cond: Condicion, datos: Record<string, unknown>): boolean {
  if ("todas" in cond) return cond.todas.every((c) => evaluarCondicion(c, datos));
  if ("alguna" in cond) return cond.alguna.some((c) => evaluarCondicion(c, datos));
  const objetivos = Array.isArray(cond.igualA) ? cond.igualA : [cond.igualA];
  const valor = datos[cond.campo];
  if (Array.isArray(valor)) return valor.some((v) => objetivos.includes(String(v)));
  return objetivos.includes(String(valor ?? ""));
}

/** ¿La condición PODRÍA volverse verdadera llenando los campos hoy vacíos? Un campo
 *  vacío es comodín (podría tomar cualquier valor); uno lleno ya está decidido. Sirve
 *  para distinguir "rama aún posible" (mostrar) de "rama N/A definitiva" (ocultar). */
export function puedeSerVerdad(cond: Condicion, datos: Record<string, unknown>): boolean {
  if ("todas" in cond) return cond.todas.every((c) => puedeSerVerdad(c, datos));
  if ("alguna" in cond) return cond.alguna.some((c) => puedeSerVerdad(c, datos));
  const v = datos[cond.campo];
  const vacio = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  return vacio ? true : evaluarCondicion(cond, datos);
}

/** Campos que referencia una condición (hoja o compuesta), recursivamente. */
export function camposDeCondicion(cond: Condicion): string[] {
  if ("todas" in cond) return cond.todas.flatMap(camposDeCondicion);
  if ("alguna" in cond) return cond.alguna.flatMap(camposDeCondicion);
  return [cond.campo];
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
  if (campo.auto) return false; // lo llena el servidor; nunca se le exige al usuario
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
 * Etapas de CREACIÓN: las del nivel de entrada (orden mínimo). Al crear, los
 * documentos que se adjuntan son los de la(s) etapa(s) de entrada (p. ej. la
 * demanda/pruebas/anexos), NO los de todo el flujo — las posteriores se suben en
 * la ficha al avanzar. Para tipos cuyas etapas posteriores están bloqueadas por
 * campos vacíos (DdP/tutela) el resultado es el mismo que considerar todas.
 */
export function etapasDeCreacion(etapas: EtapaDef[]): EtapaDef[] {
  if (etapas.length === 0) return [];
  const min = Math.min(...etapas.map((e) => e.orden));
  return etapas.filter((e) => e.orden === min);
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
    const nombres = [
      ...(e.reglas?.documentosOpcionales ?? []),
      ...(e.reglas?.opcionalesSi ?? [])
        .filter((x) => evaluarCondicion(x.si, datos))
        .flatMap((x) => x.documentosOpcionales ?? []),
    ];
    for (const n of nombres) porNombre.set(n.trim().toLowerCase(), n);
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
  recurso: "Recurso",
  "acuse-correo": "Acuse de correo",
  "constancia-envio": "Constancia de envío",
  tutela: "Tutela",
  sentencia: "Sentencia",
  impugnacion: "Impugnación",
  // Laboral
  "auto-calificacion": "Auto de calificación de la demanda",
  "auto-recurso-rechazo": "Auto que resuelve el recurso",
  "auto-citacion": "Auto de citación a audiencia",
  "auto-silencio": "Constancia de silencio (no contestó)",
  notificacion: "Notificación de la demanda",
  subsanacion: "Escrito de subsanación",
  "demanda-reformada": "Demanda reformada",
  reconvencion: "Demanda de reconvención",
  "auto-reconvencion": "Auto sobre la reconvención",
  "subsanacion-reconvencion": "Subsanación de la reconvención",
  "auto-admision-reconvencion": "Auto de admisión de la reconvención",
  "auto-rechazo-reconvencion": "Auto de rechazo de la reconvención",
  "notificacion-reconvencion": "Notificación de la reconvención",
  "contestacion-reconvencion": "Contestación de la reconvención",
  "auto-silencio-reconvencion": "Constancia de silencio (reconvención)",
  contestacion: "Contestación de la demanda",
  "documentos-audiencia": "Documentos para la audiencia",
  "acta-audiencia": "Acta de la audiencia",
  "acta-art77": "Acta audiencia art. 77",
  "acta-art80": "Acta audiencia art. 80",
  pruebas: "Pruebas",
  anexos: "Anexos",
  radicacion: "Radicación",
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
  ORDINARIA_CIVIL: "Ordinaria · Civil",
  ORDINARIA_LABORAL: "Ordinaria · Laboral",
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

/** Ruta base de cada sección del portal. */
// Procesos unificado: todo grupo vive bajo /procesos (la ficha es /procesos/[id]).
export const SECCION_RUTA: Record<GrupoProceso, string> = {
  JUDICIAL: "/procesos",
  PETICION: "/procesos",
  CONSTITUCIONAL: "/procesos",
  LABORAL: "/procesos",
};

/** Etiqueta de la sección (todo es "Procesos" tras la unificación). */
export const SECCION_LABEL: Record<GrupoProceso, string> = {
  JUDICIAL: "Procesos",
  PETICION: "Procesos",
  CONSTITUCIONAL: "Procesos",
  LABORAL: "Procesos",
};

/** Ruta de la ficha de un proceso según su `grupo`: judicial → /procesos,
 *  petición → /peticiones, constitucional → /acciones-constitucionales. Mismas
 *  pantallas, distinta URL → el sidebar resalta la sección correcta. */
export const rutaProceso = (p: { id: string; grupo: GrupoProceso }) =>
  `${SECCION_RUTA[p.grupo]}/${p.id}`;
