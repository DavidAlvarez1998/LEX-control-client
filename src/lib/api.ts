// Cliente HTTP del portal del cliente para la API de LEX Control (Express, :4000).
// La URL base sale de NEXT_PUBLIC_API_URL (ver .env.local); default localhost:4000.

import { clearSession, getToken } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
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
 * Define la contraseña del usuario usando el token de activación (público,
 * sin sesión). Resuelve si la cuenta quedó activada; lanza ApiError si no.
 */
export async function setPassword(token: string, password: string): Promise<void> {
  await api.post<{ ok: boolean }>("/auth/set-password", { token, password });
}
