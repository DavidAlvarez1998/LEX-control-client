"use client";

import type { CSSProperties, ReactNode } from "react";
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

export function Button({
  children,
  variant = "primary",
  type = "button",
  onClick,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "ghost";
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
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
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
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
  if (!open || typeof document === "undefined") return null;
  const max = size === "lg" ? "max-w-2xl" : "max-w-md";
  // Portal a <body>: el overlay `fixed` debe medirse contra el viewport. Si se
  // renderiza dentro del árbol, cualquier ancestro con `transform`/`will-change`
  // (p. ej. una animación de aparición) lo confinaría a su caja (recuadro gris sobre
  // el campo en vez de pantalla completa).
  return createPortal(
    <div
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
