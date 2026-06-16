// Cliente de la API de Integraciones estatales (Fase B): actuaciones judiciales
// sincronizadas de un proceso por su radicado. Ver lex-control-api
// src/modules/integraciones. Mantiene el estilo de procesos-api.ts.
import { api } from "./api";

export type Actuacion = {
  id: string;
  radicado: string;
  fechaActuacion: string | null;
  actuacion: string;
  anotacion: string | null;
  fuente: string;
  createdAt: string;
};

export type SyncResumen = {
  proveedor: string | null;
  estado: "OK" | "ERROR" | "SIN_RADICADO" | "SIN_PROVEEDOR";
  itemsFetched: number;
  itemsNew: number;
  fromCache: boolean;
  error?: string;
};

/** Actuaciones ya sincronizadas (servidas del caché/BD; no llama al proveedor). */
export function getActuaciones(procesoId: string): Promise<{ total: number; actuaciones: Actuacion[] }> {
  return api.get(`/integraciones/procesos/${procesoId}/actuaciones`);
}

/** Dispara la sincronización on-demand. `forzar` ignora el caché TTL. */
export function sincronizarActuaciones(procesoId: string, forzar = false): Promise<SyncResumen> {
  return api.post(`/integraciones/procesos/${procesoId}/sincronizar${forzar ? "?forzar=true" : ""}`, {});
}
