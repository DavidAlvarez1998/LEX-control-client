"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  action,
  titleStyle,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  // Opcional: estilo del <h2> del título. Se usa para el morph de View Transitions
  // (view-transition-name compartido con la fila de la lista). Ver lib/view-transition.ts.
  titleStyle?: CSSProperties;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground" style={titleStyle}>{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Spinner reutilizable (indicador de carga). */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

export function Button({
  children,
  variant = "primary",
  type = "button",
  onClick,
  disabled = false,
  cargando = false,
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "ghost";
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
  cargando?: boolean; // muestra un spinner y deshabilita el botón mientras dura la acción
  className?: string;
}) {
  const styles =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent-hover"
      : "border border-line bg-subtle text-foreground hover:bg-hover";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || cargando}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {cargando && <Spinner />}
      {children}
    </button>
  );
}

/** Botón "copiar al portapapeles": copia `texto` y muestra un ✓ por un instante. */
export function CopiarBtn({ texto, className = "" }: { texto: string; className?: string }) {
  const [copiado, setCopiado] = useState(false);
  if (!texto) return null;
  return (
    <button
      type="button"
      aria-label="Copiar"
      title={copiado ? "¡Copiado!" : "Copiar"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        } catch { /* clipboard no disponible (http/permiso): no-op */ }
      }}
      className={`inline-flex items-center align-middle text-muted transition-colors hover:text-foreground ${copiado ? "text-emerald-600 dark:text-emerald-400" : ""} ${className}`}
    >
      {copiado ? (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      ) : (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </button>
  );
}

/** Placeholder gris animado para estados de carga (mejor que un "Cargando…" pelado). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-hover ${className}`} aria-hidden="true" />;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface p-4 sm:p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Tooltip reutilizable (estándar del proyecto — preferir sobre el atributo `title`).
 * Envuelve cualquier `children` y muestra `content` al hacer hover o al enfocar con
 * teclado (accesible: `role="tooltip"`). Se renderiza en un PORTAL a `document.body`
 * con `position: fixed` + z-index alto para que NO quede tapado por el sidebar/topbar
 * (escapa el stacking context del contenido). No bloquea clics. Aparece tras un breve
 * retardo (~700ms) como un tooltip nativo. `side` controla la posición (default arriba).
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className = "",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; transform: string } | null>(null);

  function place() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const gap = 8;
    const map = {
      top: { top: r.top - gap, left: r.left + r.width / 2, transform: "translate(-50%, -100%)" },
      bottom: { top: r.bottom + gap, left: r.left + r.width / 2, transform: "translate(-50%, 0)" },
      left: { top: r.top + r.height / 2, left: r.left - gap, transform: "translate(-100%, -50%)" },
      right: { top: r.top + r.height / 2, left: r.right + gap, transform: "translate(0, -50%)" },
    } as const;
    setPos(map[side]);
  }
  function open() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      place();
      setShow(true);
    }, 700);
  }
  function close() {
    if (timer.current) clearTimeout(timer.current);
    setShow(false);
  }

  const estilo: CSSProperties = pos
    ? { position: "fixed", top: pos.top, left: pos.left, transform: pos.transform, zIndex: 1000 }
    : {};

  return (
    <span
      ref={ref}
      className={`relative inline-flex ${className}`}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      {children}
      {show && pos && typeof document !== "undefined" &&
        createPortal(
          <span
            role="tooltip"
            style={estilo}
            className="pointer-events-none w-max max-w-xs whitespace-normal rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-normal leading-snug text-white shadow-lg dark:bg-slate-700"
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  // Si está, la tarjeta navega (afordancia hover). Sin href = tarjeta estática.
  href?: string;
}) {
  const cuerpo = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{hint}</p>}
    </>
  );
  if (!href) return <Card>{cuerpo}</Card>;
  return (
    <Link href={href} className="group block">
      <Card className="transition-colors hover:border-accent/40 hover:bg-subtle">
        {cuerpo}
        <span className="mt-2 inline-block text-xs font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
          Ver →
        </span>
      </Card>
    </Link>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-hover text-muted">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      </div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

/** Portalea su contenido a <body>. Úsalo para envolver overlays `fixed`: si se
 *  renderizan dentro del árbol de la página, un ancestro con `transform` (p. ej.
 *  la animación de aparición `.lex-page` en navegadores sin View Transitions —
 *  Firefox/Safari) los confina a su caja en vez del viewport, recortando el modal
 *  bajo el topbar/sidebar. El portal los mide siempre contra el viewport. */
export function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  // Esc cierra el modal (atajo estándar).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  // Foco automático en el primer campo al abrir (no hay que tocar el mouse para escribir).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      overlayRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])",
      )?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  const max = size === "lg" ? "max-w-2xl" : "max-w-md";
  // Portal a <body>: el overlay `fixed` debe medirse contra el viewport. Si se
  // renderiza dentro del árbol, cualquier ancestro con `transform`/`will-change`
  // (p. ej. una animación de aparición) lo confinaría a su caja (recuadro gris sobre
  // el campo en vez de pantalla completa).
  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className={`max-h-[90vh] w-full ${max} overflow-y-auto`}>
        <h3 className="mb-4 text-lg font-semibold text-foreground">{title}</h3>
        <div className="space-y-3">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </Card>
    </div>,
    document.body,
  );
}

export function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
