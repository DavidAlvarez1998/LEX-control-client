// Cliente de la API de Procesos. Reemplaza el mock de localStorage por llamadas
// reales a lex-control-api (Express, :4000). Mantiene el contrato de procesos.ts.

import { api } from "./api";
import type {
  AreaPractica,
  CuantiaTipo,
  EstadoProceso,
  EtapaDef,
  Instancia,
  Jurisdiccion,
  RolParte,
  TipoDocumento,
  TipoPersona,
  TipoProceso,
} from "./procesos";

// --- Catálogo ---
export function getAreas(): Promise<AreaPractica[]> {
  return api.get<AreaPractica[]>("/catalogo/areas");
}

export function getTipos(areaSlug?: string): Promise<TipoProceso[]> {
  const q = areaSlug ? `?area=${encodeURIComponent(areaSlug)}` : "";
  return api.get<TipoProceso[]>(`/catalogo/tipos-proceso${q}`);
}

export function getTipo(id: string): Promise<TipoProceso> {
  return api.get<TipoProceso>(`/catalogo/tipos-proceso/${id}`);
}

// --- Lista de procesos ---
export type ProcesoListItem = {
  id: string;
  codigoInterno: string;
  radicado: string | null;
  titulo: string;
  tipoProcesoNombre: string;
  jurisdiccion: Jurisdiccion;
  areaSlug: string | null;
  estado: EstadoProceso;
  prioridad: string;
  proximaAudiencia: string | null;
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
  page?: number;
} = {}): Promise<ListaProcesos> {
  const qs = new URLSearchParams();
  if (filtros.area) qs.set("area", filtros.area);
  if (filtros.estado) qs.set("estado", filtros.estado);
  if (filtros.page) qs.set("page", String(filtros.page));
  const q = qs.toString();
  return api.get<ListaProcesos>(`/procesos${q ? `?${q}` : ""}`);
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
    tipoDocumento: TipoDocumento | null;
    numeroDocumento: string | null;
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
  casoRelacionadoId: string | null;
  tipoProceso: {
    id: string;
    nombre: string;
    etapas: EtapaDef[];
    jurisdiccion: Jurisdiccion;
    areas: { area: { slug: string; nombre: string } }[];
  };
  partes: ParteDetalle[];
  historial: { etapaKey: string; createdAt: string; nota: string | null }[];
  responsable: { id: string; nombre: string } | null;
  documentos: DocumentoProceso[];
};

// --- Documentos del expediente ---
export type DocumentoProceso = {
  id: string;
  nombre: string;
  url: string | null; // adjunto (enlace)
  contenido: string | null; // borrador generado (editable)
  generadoDePlantilla: string | null;
  createdAt: string;
};

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

export function adjuntarDocumento(
  id: string,
  nombre: string,
  url: string,
): Promise<DocumentoProceso> {
  return api.post<DocumentoProceso>(`/procesos/${id}/documentos`, { nombre, url });
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
  partes: {
    litigante: {
      tipoPersona: TipoPersona;
      nombre: string;
      tipoDocumento?: TipoDocumento;
      numeroDocumento?: string;
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
