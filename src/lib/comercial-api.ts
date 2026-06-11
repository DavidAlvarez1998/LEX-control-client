// Helpers del módulo COMERCIAL del despacho (portal cliente): agenda sobre los
// seguimientos, comisiones internas y resumen de cobro/cartera del cliente.
// Ver openspec/changes/comercial-rol-portal/.
import { api } from "./api";

export const TIPO_GESTION = ["LLAMADA", "WHATSAPP", "REUNION", "VIDEOLLAMADA", "CORREO", "OTRO"] as const;

// Resultado tipificado de una gestión (cierra el ciclo del contacto).
export const DISPOSICION = ["CONTACTADO", "NO_CONTESTA", "INTERESADO", "NO_VIABLE", "OTRO"] as const;
export type Disposicion = (typeof DISPOSICION)[number];
export const DISPOSICION_LABEL: Record<Disposicion, string> = {
  CONTACTADO: "Contactado",
  NO_CONTESTA: "No contesta",
  INTERESADO: "Interesado",
  NO_VIABLE: "No viable",
  OTRO: "Otro",
};

export type ClienteMin = { id: string; nombre: string; telefono: string | null };

// Señal derivada por cliente (pipeline) — calculada on-read en la API.
export type PipelineItem = {
  id: string;
  nombre: string;
  telefono: string | null;
  estado: string;
  viabilidad: string | null;
  canalIngreso: string | null;
  faseActual: string | null;
  diasEnFase: number | null;
  ultimaGestionEn: string | null;
  diasSinGestion: number | null;
  ultimaDisposicion: Disposicion | null;
  proximaTareaEn: string | null;
  proximaTarea: string | null;
  tareaVencida: boolean;
};

// Ítem accionable del cockpit "Para hoy".
export type HoyItem = {
  id: string | null;
  clienteId: string | null;
  nombre: string | null;
  telefono: string | null;
  tipoGestion: string | null;
  tarea: string | null;
  fechaProximaTarea: string | null;
};
export type HoyBuckets = { vencidas: HoyItem[]; hoy: HoyItem[]; frios: HoyItem[] };

// Un seguimiento comercial visto como ítem de agenda (fechaProximaTarea = el slot).
export type AgendaItem = {
  id: string;
  tipoGestion: string;
  titulo: string | null;
  motivoContacto: string | null;
  resultado: string | null;
  fechaProximaTarea: string | null;
  completada: boolean;
  fechaCompletada: string | null;
  canceladaEn: string | null;
  motivoCancelacion: string | null;
  comercialId: string | null;
  cliente: ClienteMin | null; // opcional: la agenda ya no exige cliente
  // Quién creó la actividad (para la vista del admin de empresa).
  registradoPor: { nombre: string; roles: string[]; esAdminEmpresa: boolean } | null;
};

export type Agenda = { desde: string; hasta: string; items: AgendaItem[]; vencidas: AgendaItem[] };

export type ComisionDespacho = {
  id: string;
  clienteId: string;
  comercialId: string;
  contratoId: string | null;
  baseCalculo: string | number;
  porcentaje: string | number | null;
  monto: string | number;
  estado: "PENDIENTE" | "PAGADA" | "ANULADA";
  fechaPago: string | null;
  notas: string | null;
  createdAt: string;
};

export type CarteraResumen = {
  id: string;
  valorTotalAcordado: string | number | null;
  tipoCobro: string | null;
  estadoCartera: string;
  fechaProximoPago: string | null;
  valorPagado: number;
  saldoPendiente: number | null;
};

function qs(params: Record<string, string | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const comercialApi = {
  // --- Agenda (sobre seguimientos comerciales) ---
  agenda: (q: { desde?: string; hasta?: string; comercialId?: string; incluirCompletadas?: boolean }) =>
    api.get<Agenda>(`/comercial/agenda${qs(q)}`),
  addSeguimiento: (
    clienteId: string | undefined,
    body: { tipoGestion: string; titulo?: string; motivoContacto?: string; resultado?: string; disposicion?: Disposicion; proximaTarea?: string; fechaProximaTarea?: string; comercialId?: string },
  ) => api.post<AgendaItem>("/comercial/seguimientos", { ...(clienteId ? { clienteId } : {}), ...body }),

  // --- Pipeline (señales derivadas) + cockpit "Para hoy" ---
  pipeline: (filtros?: { mios?: boolean }) =>
    api.get<PipelineItem[]>(`/comercial/pipeline${qs({ mios: filtros?.mios })}`),
  hoy: (filtros?: { mios?: boolean }) =>
    api.get<HoyBuckets>(`/comercial/hoy${qs({ mios: filtros?.mios })}`),
  editarSeguimiento: (id: string, body: Record<string, unknown>) =>
    api.patch<AgendaItem>(`/comercial/seguimientos/${id}`, body),
  completarSeguimiento: (id: string, body: { resultado?: string }) =>
    api.post<AgendaItem>(`/comercial/seguimientos/${id}/completar`, body),
  cancelarSeguimiento: (id: string, motivo: string) =>
    api.post<AgendaItem>(`/comercial/seguimientos/${id}/cancelar`, { motivo }),
  reabrirSeguimiento: (id: string) => api.post<AgendaItem>(`/comercial/seguimientos/${id}/reabrir`, {}),

  // --- Comisiones internas ---
  comisiones: (filtros?: { clienteId?: string }) =>
    api.get<ComisionDespacho[]>(`/comercial/comisiones${qs({ clienteId: filtros?.clienteId })}`),
  crearComision: (body: {
    clienteId: string; comercialId: string; contratoId?: string;
    baseCalculo: number; porcentaje?: number; monto: number; estado?: string; fechaPago?: string; notas?: string;
  }) => api.post<ComisionDespacho>("/comercial/comisiones", body),
  editarComision: (id: string, body: Record<string, unknown>) =>
    api.patch<ComisionDespacho>(`/comercial/comisiones/${id}`, body),

  // --- Cartera (resumen de cobro en la ficha) ---
  carteraCliente: (clienteId: string) => api.get<CarteraResumen[]>(`/comercial/clientes/${clienteId}/cartera`),
};

// Clientes (para el buscador de la agenda): el endpoint /clientes ya trae el teléfono.
export type ClienteAgenda = { id: string; nombre: string; telefono: string | null; estado: string };
export function listClientesAgenda(): Promise<ClienteAgenda[]> {
  return api.get<ClienteAgenda[]>("/clientes");
}

// Miembros COMERCIAL del despacho (para el selector del admin de empresa).
export type MiembroMin = { id: string; nombre: string; roles: string[]; activo: boolean };
export function listComerciales(): Promise<MiembroMin[]> {
  return api.get<MiembroMin[]>("/mi-empresa/usuarios");
}
