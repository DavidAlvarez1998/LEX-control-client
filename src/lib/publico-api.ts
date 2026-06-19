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

export type SolicitudCuenta = {
  // Empresa / despacho
  nombreEmpresa: string;
  nit?: string;
  emailEmpresa?: string;
  telefonoEmpresa?: string;
  // Usuario administrador
  nombreContacto: string;
  email: string;
  telefono?: string;
  // Plan elegido (clave) + honeypot
  planClave?: string;
  website?: string;
};

/** Solicita crear una cuenta (genera un Prospecto pendiente de aprobación). */
export function solicitudCuenta(body: SolicitudCuenta): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>("/publico/solicitud-cuenta", body);
}

export type Contacto = {
  nombreContacto: string;
  email?: string;
  telefono?: string;
  nombreEmpresa?: string;
  mensaje?: string;
  website?: string; // honeypot
};

/** "Habla con un asesor": crea un Prospecto WEB sin asignar para que un comercial lo contacte. */
export function enviarContacto(body: Contacto): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>("/publico/contacto", body);
}
