// Cliente de los endpoints PÚBLICOS (sin auth) que alimentan la landing.
// Ver lex-control-api src/modules/publico. Reusa el `api` base (los endpoints
// públicos nunca devuelven 401, así que no dispara el redirect a /login).
import { api } from "./api";

export type PlanPublico = {
  clave: string;
  nombre: string;
  descripcion: string | null;
  precioMensual: number;
  modulos: string[];
  cuotas: Record<string, number | null>;
};

export function getPlanesPublicos(): Promise<PlanPublico[]> {
  return api.get<PlanPublico[]>("/publico/planes");
}

export type SolicitudDemo = {
  nombreEmpresa: string;
  nombreContacto: string;
  email: string;
  telefono?: string;
  mensaje?: string;
  website?: string; // honeypot
};

export function solicitarDemo(body: SolicitudDemo): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>("/publico/solicitar-demo", body);
}
