// Sesión del portal cliente: guarda el JWT y el usuario en localStorage.
// El token se envía en cada request (ver lib/api.ts) como Authorization: Bearer.

export type AuthUser = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  esAdminEmpresa?: boolean; // true = administra su propia empresa
  roles?: string[]; // roles de empresa (RolEmpresa): JURIDICO/COMERCIAL/CONTABLE/ADMINISTRADOR
  empresa?: string | null; // nombre de la empresa a la que pertenece
};

const TOKEN_KEY = "lex_client_token";
const USER_KEY = "lex_client_user";

// Se dispara cuando el usuario cacheado cambia (p. ej. al refrescar roles desde
// /auth/me). Sidebar y porteros lo escuchan para re-renderizar sin re-login.
export const USER_CHANGED_EVENT = "lex:user-changed";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Reemplaza SOLO el usuario cacheado (conserva el token) y notifica a los
 * componentes suscritos. Se usa al refrescar la sesión desde /auth/me. No hace
 * nada si los datos no cambiaron, para evitar re-renders en cada navegación.
 */
export function updateUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  const next = JSON.stringify(user);
  if (window.localStorage.getItem(USER_KEY) === next) return;
  window.localStorage.setItem(USER_KEY, next);
  window.dispatchEvent(new Event(USER_CHANGED_EVENT));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

// --- Caducidad ---
// Lee el `exp` del JWT SIN verificar la firma (solo UX para cerrar sesión de
// forma proactiva). La autoridad real es la API, que verifica la firma y
// responde 401 ante cualquier token vencido o manipulado.

/** Devuelve el vencimiento del token en ms epoch, o null si no se puede leer. */
export function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True si el token no existe, no es legible o ya venció. */
export function isExpired(token: string): boolean {
  const exp = getTokenExpiry(token);
  return exp === null ? true : Date.now() >= exp;
}
