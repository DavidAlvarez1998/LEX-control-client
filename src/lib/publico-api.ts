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
  // Despacho / abogado
  nombreEmpresa: string; // nombre del despacho o abogado
  nit: string; // NIT del despacho o CC del abogado
  tarjeta?: string; // tarjeta profesional (opcional)
  // Usuario administrador
  nombreContacto: string; // nombre del usuario
  email: string; // correo (será su login)
  telefono: string; // teléfono de notificación personal
  website?: string; // honeypot
};

/**
 * "Crea tu cuenta": aprovisiona el despacho de una (Empresa + Usuario admin) y dispara
 * el correo de activación. El plan es trial por defecto (lo decide el servidor).
 */
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
