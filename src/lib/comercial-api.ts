// Helpers del módulo COMERCIAL del despacho (portal cliente): agenda sobre los
// seguimientos, comisiones internas y resumen de cobro/cartera del cliente.
// Ver openspec/changes/comercial-rol-portal/.
import { api } from "./api";

export const TIPO_GESTION = ["LLAMADA", "WHATSAPP", "REUNION", "VIDEOLLAMADA", "CORREO", "OTRO"] as const;

export type ClienteMin = { id: string; nombre: string; telefono: string | null };

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
    body: { tipoGestion: string; titulo?: string; motivoContacto?: string; fechaProximaTarea?: string; comercialId?: string },
  ) => api.post<AgendaItem>("/comercial/seguimientos", { ...(clienteId ? { clienteId } : {}), ...body }),
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
