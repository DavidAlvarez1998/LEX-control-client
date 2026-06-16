"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Reveal } from "@/components/reveal";
import { formatMoney } from "@/lib/format";
import { getUser, type AuthUser } from "@/lib/auth";
import { getPlanesPublicos, solicitudCuenta, type PlanPublico } from "@/lib/publico-api";

// Módulos de la plataforma (los mismos del portal). Icono = SVG inline minimal.
const MODULOS: { titulo: string; desc: string; icon: React.ReactNode }[] = [
  { titulo: "Procesos & Derecho de Petición", desc: "Procesos judiciales, tutelas, DdP y acciones constitucionales con términos y etapas guiadas.", icon: <path d="M9 12h6M9 16h6M9 8h6M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" /> },
  { titulo: "CRM Comercial", desc: "Clientes y prospectos, embudo de ventas, seguimiento y cotizaciones en un solo lugar.", icon: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /> },
  { titulo: "Contable", desc: "Ingresos, egresos, nómina, caja, servicios fijos y cartera con saldos derivados.", icon: <path d="M3 3v18h18M7 14l4-4 3 3 5-6" /> },
  { titulo: "Contratos", desc: "Contratos del personal del despacho con documentos, cláusulas y vencimientos.", icon: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M9 13h6M9 17h6" /> },
  { titulo: "Facturación", desc: "Facturas con IVA, pagos vinculados y estado de cuenta por cliente.", icon: <path d="M4 2h16v20l-3-2-2 2-2-2-2 2-2-2-3 2V2ZM8 7h8M8 11h8M8 15h5" /> },
  { titulo: "Agenda", desc: "Calendario mensual, recordatorios y tareas para todo el equipo.", icon: <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /> },
  { titulo: "Consulta judicial", desc: "Actuaciones del juzgado sincronizadas al expediente, al día.", icon: <path d="M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" /> },
];

const BENEFICIOS: { titulo: string; desc: string }[] = [
  { titulo: "Nunca pierdas un término", desc: "Vencimientos calculados en días hábiles, semáforo y panel de lo que vence hoy." },
  { titulo: "Multi-rol por despacho", desc: "Cada quien ve lo suyo: jurídico, comercial y contable, con permisos por rol." },
  { titulo: "Todo en un lugar", desc: "Procesos, clientes, dinero y agenda conectados, sin saltar entre herramientas." },
  { titulo: "Datos del juzgado al día", desc: "Trae las actuaciones por radicado y las proyecta en la línea de tiempo del caso." },
];

function Icono({ children }: { children: React.ReactNode }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export default function LandingPage() {
  const [planes, setPlanes] = useState<PlanPublico[] | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [demo, setDemo] = useState({
    nombreEmpresa: "", nit: "", emailEmpresa: "", telefonoEmpresa: "",
    nombreContacto: "", email: "", telefono: "", planClave: "", website: "",
  });
  const [demoEstado, setDemoEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const [demoError, setDemoError] = useState<string | null>(null);

  // Pre-selecciona un plan (desde una tarjeta) y baja al formulario.
  function elegirPlan(clave: string) {
    setDemo((d) => ({ ...d, planClave: clave }));
    document.getElementById("cuenta")?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    setUser(getUser());
    getPlanesPublicos().then(setPlanes).catch(() => setPlanes([]));
  }, []);

  async function enviarDemo(e: React.FormEvent) {
    e.preventDefault();
    setDemoEstado("enviando");
    setDemoError(null);
    try {
      await solicitudCuenta(demo);
      setDemoEstado("ok");
    } catch {
      setDemoEstado("error");
      setDemoError("No pudimos enviar tu solicitud. Revisa los datos e intenta de nuevo.");
    }
  }

  const set = (k: keyof typeof demo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setDemo((d) => ({ ...d, [k]: e.target.value }));

  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      {/* ───────── Header ───────── */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white">LX</div>
            <span className="text-sm font-semibold">LEX Control</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30">
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        {/* Blobs de gradiente flotantes (decorativos). */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="lex-blob absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-400/30 blur-3xl dark:bg-indigo-600/20" />
          <div className="lex-blob-slow absolute -right-24 top-10 h-80 w-80 rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-600/20" />
          <div className="lex-blob absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-600/15" />
        </div>
        <div className="mx-auto max-w-3xl text-center">
          <span className="lex-fade-up inline-block rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
            Software de gestión para despachos jurídicos
          </span>
          <h1 className="lex-fade-up mt-5 text-4xl font-bold tracking-tight sm:text-5xl" style={{ animationDelay: "90ms" }}>
            Gestiona tu despacho <span className="lex-gradient-text">sin perder un término</span>
          </h1>
          <p className="lex-fade-up mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-400" style={{ animationDelay: "180ms" }}>
            Procesos, derecho de petición, clientes, contabilidad y agenda en una sola plataforma —
            con vencimientos al día y permisos por rol.
          </p>
          <div className="lex-fade-up mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "270ms" }}>
            <Link
              href={user ? "/inicio" : "/login"}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-600/30 active:translate-y-0"
            >
              {user ? "Ir a mi portal" : "Ingresar"}
            </Link>
            <a href="#cuenta" className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
              Crear cuenta
            </a>
          </div>
        </div>
      </section>

      {/* ───────── Módulos ───────── */}
      <section className="border-t border-slate-100 bg-slate-50/60 py-16 dark:border-slate-900 dark:bg-slate-900/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">Todo lo que tu despacho necesita</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600 dark:text-slate-400">
              Módulos que trabajan juntos sobre la misma información del cliente y el proceso.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS.map((m, i) => (
              <Reveal key={m.titulo} delay={i * 70}>
                <div className="lex-card group h-full rounded-xl border border-slate-200 bg-white p-5 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-transform duration-300 group-hover:scale-110 dark:bg-indigo-500/10 dark:text-indigo-300">
                    <Icono>{m.icon}</Icono>
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{m.titulo}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{m.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Beneficios ───────── */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">Pensado para la operación real</h2>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFICIOS.map((b, i) => (
              <Reveal key={b.titulo} delay={i * 90}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/30">{i + 1}</div>
                <h3 className="mt-3 text-base font-semibold">{b.titulo}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{b.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Planes ───────── */}
      <section className="border-t border-slate-100 bg-slate-50/60 py-16 dark:border-slate-900 dark:bg-slate-900/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">Planes para cada tamaño de despacho</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600 dark:text-slate-400">
              Desde abogado independiente hasta bufete. Paga por lo que tu equipo necesita.
            </p>
          </Reveal>

          {planes && planes.length > 0 ? (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {planes.map((p, i) => {
                const cupos = Object.entries(p.cuotas).filter(([, v]) => v !== 0);
                return (
                  <Reveal key={p.clave} delay={i * 80}>
                    <div className="lex-card lex-sheen relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-6 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40">
                      <h3 className="text-base font-semibold">{p.nombre}</h3>
                      {p.descripcion && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{p.descripcion}</p>}
                      <p className="mt-4 text-2xl font-bold">
                        ${formatMoney(p.precioMensual)}
                        <span className="text-sm font-normal text-slate-500 dark:text-slate-400"> /mes</span>
                      </p>
                      <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                        {cupos.map(([rol, lim]) => (
                          <li key={rol}>· {lim === null ? "Ilimitados" : lim} {rol.toLowerCase()}</li>
                        ))}
                        {p.modulos.length > 0 && <li>· Módulos: {p.modulos.join(", ")}</li>}
                      </ul>
                      <button type="button" onClick={() => elegirPlan(p.clave)} className="mt-6 rounded-lg border border-indigo-600 px-4 py-2 text-center text-sm font-medium text-indigo-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500/20 dark:hover:text-white">
                        Quiero este plan
                      </button>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          ) : (
            <p className="mt-10 text-center text-slate-500 dark:text-slate-400">
              {planes === null ? "Cargando planes…" : "Escríbenos y armamos un plan a la medida de tu despacho."}
            </p>
          )}
        </div>
      </section>

      {/* ───────── Crear cuenta ───────── */}
      <section id="cuenta" className="border-t border-slate-100 bg-slate-50/60 py-16 dark:border-slate-900 dark:bg-slate-900/30">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Reveal>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">Crea tu cuenta</h2>
            <p className="mt-3 text-center text-slate-600 dark:text-slate-400">
              Déjanos los datos de tu despacho y del administrador. Revisamos la solicitud y activamos tu cuenta.
            </p>
          </Reveal>

          {demoEstado === "ok" ? (
            <div className="lex-fade-up mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              <p className="font-semibold">¡Gracias! Recibimos tu solicitud.</p>
              <p className="mt-1 text-sm">La revisaremos y te avisaremos al correo del administrador para activar tu cuenta.</p>
            </div>
          ) : (
            <form onSubmit={enviarDemo} className="mt-8 space-y-6">
              {/* Honeypot: oculto a humanos; los bots lo llenan. */}
              <input type="text" name="website" value={demo.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

              {/* Datos del despacho */}
              <fieldset className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <legend className="px-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">Datos del despacho</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo label="Nombre del despacho / empresa" value={demo.nombreEmpresa} onChange={set("nombreEmpresa")} required />
                  <Campo label="NIT" value={demo.nit} onChange={set("nit")} />
                  <Campo label="Correo de la empresa" type="email" value={demo.emailEmpresa} onChange={set("emailEmpresa")} />
                  <Campo label="Teléfono de la empresa" value={demo.telefonoEmpresa} onChange={set("telefonoEmpresa")} />
                </div>
              </fieldset>

              {/* Usuario administrador */}
              <fieldset className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <legend className="px-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">Usuario administrador</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo label="Nombre del administrador" value={demo.nombreContacto} onChange={set("nombreContacto")} required />
                  <Campo label="Correo del administrador" type="email" value={demo.email} onChange={set("email")} required />
                  <Campo label="Celular del administrador" value={demo.telefono} onChange={set("telefono")} />
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Este correo será el acceso del administrador cuando se active la cuenta.</p>
              </fieldset>

              {/* Plan */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Plan de interés</label>
                <select value={demo.planClave} onChange={set("planClave")}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900">
                  <option value="">Sin definir / que me asesoren</option>
                  {(planes ?? []).map((p) => (
                    <option key={p.clave} value={p.clave}>{p.nombre} — ${formatMoney(p.precioMensual)}/mes</option>
                  ))}
                </select>
              </div>

              {demoError && <p className="text-sm text-red-600 dark:text-red-400">{demoError}</p>}
              <button type="submit" disabled={demoEstado === "enviando"}
                className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-600/30 active:translate-y-0 disabled:opacity-60">
                {demoEstado === "enviando" ? "Enviando…" : "Crear cuenta"}
              </button>
              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                ¿Ya tienes cuenta? <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">Ingresar</Link>
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-slate-200 py-10 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">LX</div>
            <span className="text-sm font-semibold">LEX Control</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">© {new Date().getFullYear()} LEX Control. Todos los derechos reservados.</p>
          <Link href="/login" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">Ingresar →</Link>
        </div>
      </footer>
    </div>
  );
}

function Campo({ label, value, onChange, type = "text", required }: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input type={type} value={value} onChange={onChange} required={required}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900" />
    </div>
  );
}
