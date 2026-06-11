"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api";
import { setSession, type AuthUser } from "@/lib/auth";

type LoginResponse = { token: string; user: AuthUser };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // audience: "USUARIO" → la API rechaza a quien no sea usuario del portal.
      const { token, user } = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
        audience: "USUARIO",
      });
      setSession(token, user);
      router.replace("/");
    } catch (err) {
      setError(
        errorMessage(err, "No se pudo iniciar sesión. Verifica tu conexión."),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500 font-bold text-white">
            LX
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">LEX Control</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Portal Cliente</p>
          </div>
        </div>

        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Ingresa tu correo y contraseña para continuar.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm text-slate-600 dark:text-slate-300">Correo</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              placeholder="usuario@empresa.com"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-600 dark:text-slate-300">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              placeholder="••••••••"
            />
          </label>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
