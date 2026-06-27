"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui";
import { errorMessage, getActivationInfo, isApiError, setPassword } from "@/lib/api";
import { clearSession } from "@/lib/auth";

const MIN_LEN = 8;

function ActivarForm() {
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword_] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Correo dueño del token (se muestra no editable). null = aún no resuelto.
  const [email, setEmail] = useState<string | null>(null);
  const [tokenInvalido, setTokenInvalido] = useState(false);
  const [cargandoInfo, setCargandoInfo] = useState(true);

  // Activar es para una cuenta NUEVA: descarta cualquier sesión previa en este
  // navegador (p. ej. otro usuario ya logueado) para no completar la activación
  // ni redirigir montado sobre la cuenta de otra persona.
  useEffect(() => {
    clearSession();
  }, []);

  // Resuelve el correo del token para mostrarlo (no editable). Un 400 = token
  // inválido/expirado → se muestra el aviso temprano. Otros errores (red) no
  // bloquean: se deja seguir y el submit revalidará.
  useEffect(() => {
    if (!token) {
      setCargandoInfo(false);
      return;
    }
    let vivo = true;
    getActivationInfo(token)
      .then((info) => {
        if (vivo) setEmail(info.email);
      })
      .catch((err) => {
        if (vivo && isApiError(err) && err.status === 400) setTokenInvalido(true);
      })
      .finally(() => {
        if (vivo) setCargandoInfo(false);
      });
    return () => {
      vivo = false;
    };
  }, [token]);

  // Sin token en la URL no hay nada que activar.
  if (!token) {
    return (
      <Message
        title="Enlace inválido"
        tone="error"
        body="Este enlace de activación no es válido. Pídele a tu administrador uno nuevo."
      />
    );
  }

  if (cargandoInfo) {
    return <Card className="w-full max-w-sm text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>;
  }

  if (tokenInvalido) {
    return (
      <Message
        title="Enlace inválido o expirado"
        tone="error"
        body="Este enlace de activación ya no es válido. Pídele a tu administrador uno nuevo."
      />
    );
  }

  if (done) {
    return (
      <Message
        title="¡Cuenta activada!"
        tone="success"
        body="Tu contraseña quedó configurada. Inicia sesión con tu correo y tu nueva contraseña."
        action={
          <Link
            href={email ? `/login?email=${encodeURIComponent(email)}` : "/login"}
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Iniciar sesión
          </Link>
        }
      />
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_LEN) {
      setError(`La contraseña debe tener al menos ${MIN_LEN} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await setPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(
        errorMessage(err, "No se pudo activar la cuenta."),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Activa tu cuenta</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Define una contraseña para acceder al portal.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        {email && (
          <label className="block">
            <span className="text-sm text-slate-600 dark:text-slate-300">Correo</span>
            <input
              type="email"
              value={email}
              readOnly
              disabled
              autoComplete="username"
              className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
            />
          </label>
        )}

        <PasswordField
          label="Contraseña"
          value={password}
          onChange={setPassword_}
          placeholder="Mínimo 8 caracteres"
        />

        <PasswordField
          label="Repetir contraseña"
          value={confirm}
          onChange={setConfirm}
          placeholder="Repite la contraseña"
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Activando…" : "Activar cuenta"}
        </button>
      </form>
    </Card>
  );
}

/** Campo de contraseña con botón para mostrar/ocultar lo que se está digitando. */
function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <div className="relative mt-1">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 pr-10 text-sm outline-none focus:border-indigo-400"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}

function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function Message({
  title,
  body,
  tone,
  action,
}: {
  title: string;
  body: string;
  tone: "success" | "error";
  action?: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-sm text-center">
      <h1
        className={`text-lg font-semibold ${
          tone === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
        }`}
      >
        {title}
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
  );
}

export default function ActivarPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-300 dark:bg-slate-800 p-4">
      <Suspense fallback={<Card className="w-full max-w-sm text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>}>
        <ActivarForm />
      </Suspense>
    </main>
  );
}
