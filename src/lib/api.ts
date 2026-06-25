// Cliente HTTP del portal del cliente para la API de LEX Control (Express, :4000).
// Por defecto usa el proxy same-origin `/api` (rewrites en next.config.ts): el
// navegador pega al mismo host del front y Next reenvía a la API del lado servidor,
// sin requerir que el navegador alcance localhost:4000 directo (clave en SSH).

import { type AuthUser, clearSession, getToken, updateUser } from "./auth";

// Una URL real (producción) en NEXT_PUBLIC_API_URL se respeta; un valor heredado que
// apunte a localhost:4000 se ignora a favor del proxy `/api`.
const ENV_URL = process.env.NEXT_PUBLIC_API_URL?.trim();
const BASE_URL = ENV_URL && !/localhost:4000/.test(ENV_URL) ? ENV_URL : "/api";
const TIMEOUT_MS = 10_000;

/** Error con el status y el cuerpo { error: { message, issues } } de la API. */
export class ApiError extends Error {
  status: number;
  issues?: unknown;
  constructor(status: number, message: string, issues?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

/**
 * Type-guard de ApiError robusto frente a la duplicación de módulos del bundler.
 * Con Turbopack, importar `lib/api` por alias (`@/lib/api`) en un módulo y por ruta
 * relativa (`./api`) en otro puede crear DOS clases `ApiError` distintas; entonces
 * `err instanceof ApiError` da false aunque el error sea uno nuestro y el `catch`
 * lo traga en silencio. Verificamos por forma (`name` + `status`), no por identidad.
 */
export function isApiError(err: unknown): err is ApiError {
  return (
    err instanceof ApiError ||
    (typeof err === "object" && err !== null && (err as { name?: unknown }).name === "ApiError" && "status" in err)
  );
}

/** Diccionario opcional para traducir nombres de campo técnicos a etiquetas. */
type FieldLabels = Record<string, string>;

/** Humaniza una clave camelCase/snake: "nombreEmpresa" -> "Nombre empresa". */
function humanizaCampo(key: string): string {
  const s = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[._]/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Convierte cualquier error de la API en un mensaje legible para el usuario.
 * Si trae `issues` de zod (400 "Validation failed"), indica QUÉ campo está mal
 * en vez del texto genérico. Opcionalmente recibe un mapa de etiquetas por campo.
 */
export function errorMessage(err: unknown, fallback = "Ocurrió un error", labels?: FieldLabels): string {
  if (isApiError(err) && Array.isArray(err.issues) && err.issues.length > 0) {
    const issues = err.issues as { path?: (string | number)[]; message?: string }[];
    return issues
      .map((i) => {
        const key = i.path?.length ? String(i.path[i.path.length - 1]) : "";
        const campo = key ? labels?.[key] ?? humanizaCampo(key) : "";
        return campo ? `${campo}: ${i.message ?? "valor inválido"}` : i.message ?? "valor inválido";
      })
      .join(" · ");
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();

  // Timeout: sin esto, si la API no responde el fetch cuelga indefinidamente.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    const abortado = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(
      0,
      abortado
        ? "La API no respondió a tiempo. Intenta de nuevo en un momento."
        : "No se pudo conectar con el servidor. Intenta más tarde.",
    );
  } finally {
    clearTimeout(timer);
  }

  // Sesión inválida o expirada: limpia y manda al login (salvo que ya estemos ahí).
  if (res.status === 401 && typeof window !== "undefined") {
    clearSession();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.error?.message ?? `Error ${res.status}`;
    throw new ApiError(res.status, message, data?.error?.issues);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/**
 * Sube un archivo (multipart/form-data) a la API. A diferencia de request(), NO
 * fija Content-Type: el navegador pone el boundary del multipart. Reusa el token
 * y el mismo manejo de errores/401. Timeout más amplio (60s) que una request
 * normal porque un archivo tarda más.
 */
export async function uploadFile<T>(path: string, form: FormData): Promise<T> {
  const token = getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      body: form,
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch (err) {
    const abortado = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(
      0,
      abortado
        ? "La subida tardó demasiado. Intenta de nuevo."
        : "No se pudo conectar con el servidor. Intenta más tarde.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 && typeof window !== "undefined") {
    clearSession();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.message ?? `Error ${res.status}`, data?.error?.issues);
  }
  return data as T;
}

/**
 * Refresca el usuario cacheado con sus datos frescos de BD (/auth/me) y, si
 * cambiaron, notifica a sidebar/porteros. Pensada para correr en cada
 * navegación: si un admin de empresa cambió los roles del usuario, su menú y el
 * acceso a las vistas se actualizan sin re-login. Silenciosa ante errores: un
 * 401 ya lo maneja request() (limpia sesión y va a /login); cualquier otro fallo
 * (red, etc.) simplemente conserva el cache previo.
 */
export async function refreshSession(): Promise<void> {
  try {
    const user = await api.get<AuthUser>("/auth/me");
    updateUser(user);
  } catch {
    // sin cambios: se mantiene la sesión cacheada
  }
}

/**
 * Define la contraseña del usuario usando el token de activación (público,
 * sin sesión). Resuelve si la cuenta quedó activada; lanza ApiError si no.
 */
export async function setPassword(token: string, password: string): Promise<void> {
  await api.post<{ ok: boolean }>("/auth/set-password", { token, password });
}
