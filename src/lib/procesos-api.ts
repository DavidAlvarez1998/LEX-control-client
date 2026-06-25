// Cliente de la API de Procesos. Reemplaza el mock de localStorage por llamadas
// reales a lex-control-api (Express, :4000). Mantiene el contrato de procesos.ts.

import { api, uploadFile } from "./api";
import type {
  AreaPractica,
  CampoEsquema,
  CategoriaProceso,
  CuantiaTipo,
  EstadoProceso,
  EtapaDef,
  GrupoProceso,
  Instancia,
  Jurisdiccion,
  NaturalezaJuridica,
  RolParte,
  TipoDocumento,
  TipoPersona,
  TipoProceso,
} from "./procesos";

// --- Catálogo ---
export function getAreas(): Promise<AreaPractica[]> {
  return api.get<AreaPractica[]>("/catalogo/areas");
}

export function getCategorias(): Promise<CategoriaProceso[]> {
  return api.get<CategoriaProceso[]>("/catalogo/categorias");
}

export function getTipos(areaSlug?: string): Promise<TipoProceso[]> {
  const q = areaSlug ? `?area=${encodeURIComponent(areaSlug)}` : "";
  return api.get<TipoProceso[]>(`/catalogo/tipos-proceso${q}`);
}

export function getTipo(id: string): Promise<TipoProceso> {
  return api.get<TipoProceso>(`/catalogo/tipos-proceso/${id}`);
}

// --- Clientes y equipo (para asignar dueño y abogado al crear un proceso) ---
export type ClienteOption = {
  id: string;
  nombre: string;
  estado: string;
  tipoDocumento: TipoDocumento | null;
  numeroDocumento: string | null;
  telefono: string | null;
  email: string | null;
  correos: string[] | null;
};

/** Clientes del despacho (CRM): para elegir el dueño del proceso. */
export function listClientes(): Promise<ClienteOption[]> {
  return api.get<ClienteOption[]>("/clientes");
}

export type MiembroOption = { id: string; nombre: string; roles: string[]; activo: boolean };

/** Equipo del despacho con sus roles: para elegir el abogado responsable. */
export function listMiembros(): Promise<MiembroOption[]> {
  return api.get<MiembroOption[]>("/mi-empresa/usuarios");
}

// --- Lista de procesos ---
export type ProcesoListItem = {
  id: string;
  codigoInterno: string;
  radicado: string | null;
  titulo: string;
  tipoProcesoNombre: string;
  esJudicial: boolean; // controla los campos judiciales del formulario
  grupo: GrupoProceso; // sección del portal (rutaProceso): JUDICIAL | PETICION | CONSTITUCIONAL
  jurisdiccion: Jurisdiccion;
  areaSlug: string | null;
  estado: EstadoProceso;
  prioridad: string;
  proximaAudiencia: string | null;
  // Deadline-first + caso (change procesos-ux-ddp-tutela)
  etapaActual: string;
  etapaNombre: string;
  fechaLimite: string | null;
  semaforo: "vencido" | "por_vencer" | "al_dia";
  responsableId: string | null;
  responsableNombre: string | null;
  clienteNombre: string | null;
  casoRelacionadoId: string | null;
  tieneDerivados: boolean;
  actuacionesNuevas: number; // novedades del juzgado no leídas (P1)
};

export type ListaProcesos = {
  total: number;
  page: number;
  pageSize: number;
  items: ProcesoListItem[];
};

export function listProcesos(filtros: {
  area?: string;
  estado?: string;
  q?: string;
  responsableId?: string;
  clienteId?: string;
  page?: number;
  conNovedades?: boolean;
  orden?: "vencimiento"; // ordena vencidos→por vencer→al día→sin fecha→cerrados (server-side)
} = {}): Promise<ListaProcesos> {
  const qs = new URLSearchParams();
  if (filtros.area) qs.set("area", filtros.area);
  if (filtros.estado) qs.set("estado", filtros.estado);
  if (filtros.q) qs.set("q", filtros.q);
  if (filtros.responsableId) qs.set("responsableId", filtros.responsableId);
  if (filtros.clienteId) qs.set("clienteId", filtros.clienteId);
  if (filtros.page) qs.set("page", String(filtros.page));
  if (filtros.conNovedades) qs.set("conNovedades", "1");
  if (filtros.orden) qs.set("orden", filtros.orden);
  const q = qs.toString();
  return api.get<ListaProcesos>(`/procesos${q ? `?${q}` : ""}`);
}

// --- Sincronización masiva on-demand (P16) ---
export type SyncMisResp = { procesos: number; conNovedad: number; nuevasTotal: number; errores: number };
/** Sincroniza mis procesos con radicado (los no sincronizados en las últimas 6 h). */
export function sincronizarMisProcesos(): Promise<SyncMisResp> {
  return api.post<SyncMisResp>(`/procesos/rama/sincronizar-mis`, {});
}

// --- Detalle de un proceso ---
export type ParteDetalle = {
  id: string;
  rol: RolParte;
  rolEtiqueta: string | null;
  esNuestroCliente: boolean;
  litigante: {
    id: string;
    nombre: string;
    tipoPersona: TipoPersona;
    naturalezaJuridica: NaturalezaJuridica | null;
    tipoDocumento: TipoDocumento | null;
    numeroDocumento: string | null;
    telefono: string | null;
    direccion: string | null;
    email: string | null;
    correos: string[];
    correoDesconocido: boolean;
    direccionDesconocida: boolean;
    telefonoDesconocido: boolean;
  };
};

export type ProcesoDetalle = {
  id: string;
  codigoInterno: string;
  radicado: string | null;
  jurisdiccion: Jurisdiccion;
  instancia: Instancia;
  cuantiaTipo: CuantiaTipo | null;
  cuantiaValor: string | null;
  despachoJuzgado: string | null;
  titulo: string;
  datos: Record<string, unknown>;
  etapaActual: string;
  estado: EstadoProceso;
  proximaAudiencia: string | null;
  fechaLimite: string | null;
  actuacionesSyncAt: string | null; // última sincronización con la Rama (frescura, P5)
  ramaEstado: string | null; // OK | RESERVADO | NO_PUBLICADO (P6)
  camposRamaCsv: string | null; // campos que llenó la Rama (P8)
  casoRelacionadoId: string | null;
  tipoProceso: {
    id: string;
    nombre: string;
    esJudicial: boolean;
    grupo: GrupoProceso;
    esquemaFormulario: CampoEsquema[];
    etapas: EtapaDef[];
    jurisdiccion: Jurisdiccion;
    areas: { area: { slug: string; nombre: string } }[];
  };
  partes: ParteDetalle[];
  historial: { etapaKey: string; createdAt: string; nota: string | null }[];
  responsable: { id: string; nombre: string } | null;
  cliente: { id: string; nombre: string; estado: string } | null;
  documentos: DocumentoProceso[];
};

// --- Documentos del expediente ---
export type DocumentoProceso = {
  id: string;
  nombre: string;
  url: string | null; // adjunto (enlace)
  contenido: string | null; // borrador generado (editable)
  generadoDePlantilla: string | null;
  origenRamaIdReg: string | null; // si se importó del expediente de la Rama (P15)
  createdAt: string;
};

// --- Actuaciones de la Rama Judicial (CPNU) ---
export type ActuacionItem = {
  id: string;
  fechaActuacion: string;
  actuacion: string;
  anotacion: string | null;
  fechaRegistro: string | null;
  createdAt: string;
  nueva: boolean; // no leída desde la última visita (#3)
};
export type SugerenciaHito = {
  etapaKey: string;
  etapaNombre: string;
  campoFecha: string | null;
  fechaSugerida: string | null;
  campoValor: string | null; // campo de decisión a pre-llenar (p. ej. decisionCalificacion)
  valorSugerido: string | null; // valor para campoValor (p. ej. "Admite" / "Inadmite")
  actuacion: string;
};
export type ValidarRadicadoResp = {
  encontrado: boolean;
  idProceso: number | null;
  despacho: string | null;
  departamento: string | null;
  sujetosProcesales: string | null;
  fechaProceso: string | null;
  fechaUltimaActuacion: string | null;
  esPrivado: boolean;
};
export type SyncActuacionesResp = { encontrado: boolean; reservado: boolean; nuevas: number; total: number };

/** Valida un radicado contra la Rama Judicial (feedback al pegarlo). */
export function validarRadicado(radicado: string): Promise<ValidarRadicadoResp> {
  return api.get<ValidarRadicadoResp>(`/procesos/validar-radicado?radicado=${encodeURIComponent(radicado)}`);
}

/** Actuaciones guardadas del proceso (más reciente primero). */
export function listActuaciones(procesoId: string): Promise<ActuacionItem[]> {
  return api.get<ActuacionItem[]>(`/procesos/${procesoId}/actuaciones`);
}

/** Dispara la sincronización con la Rama (inserta solo las nuevas). */
export function sincronizarActuaciones(procesoId: string): Promise<SyncActuacionesResp> {
  return api.post<SyncActuacionesResp>(`/procesos/${procesoId}/actuaciones/sincronizar`, {});
}

/** Marca las actuaciones del proceso como vistas (resetea las "nuevas"). */
export function marcarActuacionesVistas(procesoId: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/procesos/${procesoId}/actuaciones/marcar-vistas`, {});
}

/** Sugerencias de avance de etapa derivadas de los hitos de las actuaciones (#1). */
export function getSugerenciasActuaciones(procesoId: string): Promise<SugerenciaHito[]> {
  return api.get<SugerenciaHito[]>(`/procesos/${procesoId}/actuaciones/sugerencias`);
}

// --- Detalle del proceso en el juzgado (Rama, P11) ---
export type DetalleRama = {
  tipoProceso: string | null;
  claseProceso: string | null;
  subclaseProceso: string | null;
  ponente: string | null;
  recurso: string | null;
  ubicacion: string | null;
  contenidoRadicacion: string | null;
  ultimaActualizacion: string | null;
};
export function getDetalleRama(procesoId: string): Promise<DetalleRama | null> {
  return api.get<DetalleRama | null>(`/procesos/${procesoId}/rama/detalle`);
}

// --- Partes según la Rama (P10) ---
export type SujetoRamaItem = {
  tipoSujeto: string | null;
  nombreRazonSocial: string | null;
  identificacion: string | null;
  rol: string;
  yaExiste: boolean;
};
export type ListaSujetosRama = { encontrado: boolean; sujetos: SujetoRamaItem[] };
export function sugerirPartesRama(procesoId: string): Promise<ListaSujetosRama> {
  return api.get<ListaSujetosRama>(`/procesos/${procesoId}/rama/partes`);
}
export function importarPartesRama(procesoId: string, nombres?: string[]): Promise<{ importadas: number }> {
  return api.post<{ importadas: number }>(`/procesos/${procesoId}/rama/partes/importar`, { nombres });
}

// --- Documentos del expediente (Rama, P9) ---
export type DocumentoRamaItem = {
  idRegDocumento: number;
  descripcion: string | null;
  fechaCarga: string | null;
  consActuacion: number | null;
  yaImportado: boolean;
};
export type ListaDocumentosRama = { encontrado: boolean; documentos: DocumentoRamaItem[] };
export type ImportarDocsResp = { importados: number; omitidos: number; fallidos: number };

/** Lista los documentos del expediente disponibles en la Rama (marca los ya importados). */
export function listarDocumentosRama(procesoId: string): Promise<ListaDocumentosRama> {
  return api.get<ListaDocumentosRama>(`/procesos/${procesoId}/rama/documentos`);
}

/** Descarga e importa al proceso los documentos seleccionados (o todos si no se pasa idRegs). */
export function importarDocumentosRama(procesoId: string, idRegs?: number[]): Promise<ImportarDocsResp> {
  return api.post<ImportarDocsResp>(`/procesos/${procesoId}/rama/documentos/importar`, { idRegs });
}

export type PlantillaItem = { id: string; nombre: string };

export function getPlantillasDeProceso(id: string): Promise<PlantillaItem[]> {
  return api.get<PlantillaItem[]>(`/procesos/${id}/plantillas`);
}

export function generarDocumento(
  id: string,
  plantillaId: string,
  nombre?: string,
): Promise<DocumentoProceso> {
  return api.post<DocumentoProceso>(`/procesos/${id}/documentos/generar`, { plantillaId, nombre });
}

/** Renderiza una plantilla SIN persistirla (para "generar y descargar"). */
export function renderDocumento(
  id: string,
  plantillaId: string,
  nombre?: string,
): Promise<{ nombre: string; contenido: string }> {
  return api.post<{ nombre: string; contenido: string }>(
    `/procesos/${id}/documentos/render`,
    { plantillaId, nombre },
  );
}

export function adjuntarDocumento(
  id: string,
  nombre: string,
  url: string,
): Promise<DocumentoProceso> {
  return api.post<DocumentoProceso>(`/procesos/${id}/documentos`, { nombre, url });
}

/** Calcula (sin crear nada) la fecha de vencimiento que tendría un proceso de este
 *  tipo con estos datos — para mostrarla en vivo en el formulario. */
export function calcularVencimiento(
  tipoProcesoId: string,
  datos: Record<string, unknown>,
  desdeCampo?: string, // etapa cuyo plazo corre desde ese campo (p. ej. fechaNotificacion)
): Promise<{ fechaLimite: string | null; dias: number | null; tipoDias: "habiles" | "calendario" | null; etapaKey: string | null }> {
  return api.post(`/procesos/calcular-vencimiento`, { tipoProcesoId, datos, desdeCampo });
}

/** Sube un archivo real (multipart) al expediente; el binario va a tecnovapp y en
 *  BD queda su ruta. `nombre` fija el nombre del documento (p. ej. "poder.pdf"). */
export function subirArchivoProceso(
  id: string,
  file: File,
  nombre?: string,
): Promise<DocumentoProceso> {
  const fd = new FormData();
  fd.append("file", file);
  if (nombre) fd.append("nombre", nombre);
  return uploadFile<DocumentoProceso>(`/procesos/${id}/documentos/subir`, fd);
}

export function editarDocumento(
  id: string,
  docId: string,
  body: { nombre?: string; contenido?: string },
): Promise<DocumentoProceso> {
  return api.patch<DocumentoProceso>(`/procesos/${id}/documentos/${docId}`, body);
}

export function eliminarDocumento(id: string, docId: string): Promise<void> {
  return api.del<void>(`/procesos/${id}/documentos/${docId}`);
}

export function getProceso(id: string): Promise<ProcesoDetalle> {
  return api.get<ProcesoDetalle>(`/procesos/${id}`);
}

/** Un proceso de la cadena del caso (DdP → DdP reiteración → Tutela). */
export type CasoNodo = {
  id: string;
  codigoInterno: string;
  radicado: string | null;
  titulo: string;
  tipoProcesoNombre: string;
  esJudicial: boolean;
  grupo: GrupoProceso;
  estado: EstadoProceso;
  etapaActual: string;
  etapaNombre: string;
  fechaLimite: string | null;
  casoRelacionadoId: string | null;
  createdAt: string;
};

/** Cadena completa del caso (raíz → hojas) al que pertenece el proceso. */
export function getCasoChain(id: string): Promise<CasoNodo[]> {
  return api.get<CasoNodo[]>(`/procesos/${id}/caso`);
}

// --- Crear / mover etapa ---
export type CrearProcesoBody = {
  tipoProcesoId: string;
  titulo: string;
  datos: Record<string, unknown>;
  radicado?: string;
  despachoJuzgado?: string;
  instancia?: Instancia;
  cuantiaTipo?: CuantiaTipo;
  cuantiaValor?: string;
  casoRelacionadoId?: string;
  responsableId?: string; // abogado responsable del caso
  // Cliente (CRM) dueño del proceso: o existente (clienteId) o nuevo inline.
  // `rol` = rol procesal que juega nuestro cliente (DEMANDANTE, ACCIONANTE…).
  cliente?: {
    clienteId?: string;
    nuevo?: {
      nombre: string;
      tipoPersona?: TipoPersona;
      naturalezaJuridica?: NaturalezaJuridica | null;
      tipoDocumento?: TipoDocumento;
      numeroDocumento?: string;
      telefono?: string;
      direccion?: string;
      email?: string;
      correos?: string[];
      ciudad?: string;
      correoDesconocido?: boolean;
      direccionDesconocida?: boolean;
      telefonoDesconocido?: boolean;
    };
    rol: RolParte;
    rolEtiqueta?: string;
  };
  partes: {
    litigante: {
      tipoPersona: TipoPersona;
      naturalezaJuridica?: NaturalezaJuridica | null;
      nombre: string;
      tipoDocumento?: TipoDocumento;
      numeroDocumento?: string;
      telefono?: string;
      direccion?: string;
      email?: string;
      correos?: string[];
      correoDesconocido?: boolean;
      direccionDesconocida?: boolean;
      telefonoDesconocido?: boolean;
    };
    rol: RolParte;
    rolEtiqueta?: string;
    esNuestroCliente: boolean;
  }[];
};

export function crearProceso(body: CrearProcesoBody): Promise<ProcesoDetalle> {
  return api.post<ProcesoDetalle>("/procesos", body);
}

export function moverEtapa(
  id: string,
  etapaKey: string,
  nota?: string,
): Promise<ProcesoDetalle> {
  return api.patch<ProcesoDetalle>(`/procesos/${id}/etapa`, { etapaKey, nota });
}

/** Ejecuta la acción crearDerivado de la etapa actual (p. ej. DdP → tutela). */
export function escalarProceso(id: string): Promise<ProcesoDetalle> {
  return api.post<ProcesoDetalle>(`/procesos/${id}/derivar`, {});
}

/** Edita el formulario dinámico del proceso (validado contra el esquema; permite
 *  guardar incompleto — los requeridos se exigen al avanzar de etapa). */
export function actualizarDatos(
  id: string,
  datos: Record<string, unknown>,
): Promise<ProcesoDetalle> {
  return api.patch<ProcesoDetalle>(`/procesos/${id}`, { datos });
}

/** Edita atributos estructurales del proceso (p. ej. el radicado real — la
 *  columna canónica que usan facturación y contable, no un campo del formulario). */
export function actualizarProceso(
  id: string,
  body: { radicado?: string | null; titulo?: string; datos?: Record<string, unknown> },
): Promise<ProcesoDetalle> {
  return api.patch<ProcesoDetalle>(`/procesos/${id}`, body);
}

// --- Partes del proceso (contraparte / terceros, desde la ficha) ---
// Datos de un litigante al agregar/editar una parte (mismo contrato del create).
export type LitiganteInput = {
  tipoPersona?: TipoPersona;
  naturalezaJuridica?: NaturalezaJuridica | null;
  nombre?: string;
  tipoDocumento?: TipoDocumento | null;
  numeroDocumento?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  email?: string | null;
  correos?: string[];
  correoDesconocido?: boolean;
  direccionDesconocida?: boolean;
  telefonoDesconocido?: boolean;
};

/** Agrega una contraparte/tercero a un proceso ya creado. */
export function agregarParte(
  id: string,
  body: { litigante: LitiganteInput & { nombre: string; tipoPersona: TipoPersona }; rol: RolParte; rolEtiqueta?: string },
): Promise<ProcesoDetalle> {
  return api.post<ProcesoDetalle>(`/procesos/${id}/partes`, body);
}

/** Edita el rol/etiqueta y/o los datos del litigante de una parte. */
export function editarParte(
  id: string,
  parteId: string,
  body: { rol?: RolParte; rolEtiqueta?: string | null; litigante?: LitiganteInput },
): Promise<ProcesoDetalle> {
  return api.patch<ProcesoDetalle>(`/procesos/${id}/partes/${parteId}`, body);
}

/** Quita una parte del proceso (no aplica a nuestro cliente). */
export function eliminarParte(id: string, parteId: string): Promise<ProcesoDetalle> {
  return api.del<ProcesoDetalle>(`/procesos/${id}/partes/${parteId}`);
}

// --- Vencimientos (semáforo) ---
export type VencimientoItem = {
  id: string;
  codigoInterno: string;
  radicado: string | null;
  titulo: string;
  etapaActual: string;
  estado: EstadoProceso;
  fechaLimite: string | null;
  semaforo: "vencido" | "por_vencer" | "al_dia";
};

export type Vencimientos = {
  vencido: VencimientoItem[];
  por_vencer: VencimientoItem[];
  al_dia: VencimientoItem[];
};

export function getVencimientos(): Promise<Vencimientos> {
  return api.get<Vencimientos>("/procesos/vencimientos");
}
