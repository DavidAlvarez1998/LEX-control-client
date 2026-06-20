"use client";

import { Button, Card, ModalPortal } from "./ui";

/** Modal de confirmación acorde al portal (reemplaza window.confirm). Opcional:
 *  un campo de texto (`input`) para capturar un motivo, reemplazando window.prompt. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirmar",
  danger = false,
  busy = false,
  input,
  inputValue = "",
  onInputChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  busy?: boolean;
  input?: { label: string; placeholder?: string; required?: boolean };
  inputValue?: string;
  onInputChange?: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  const faltaMotivo = !!input?.required && !inputValue.trim();
  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <Card className="w-full max-w-md">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
        {input && (
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {input.label}
              {input.required && <span className="ml-0.5 text-red-500">*</span>}
            </label>
            <textarea
              autoFocus
              rows={2}
              value={inputValue}
              onChange={(e) => onInputChange?.(e.target.value)}
              placeholder={input.placeholder}
              disabled={busy}
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-600 dark:text-slate-100"
            />
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          {/* Botón crudo para controlar el color (rojo en acciones destructivas). */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || faltaMotivo}
            className={[
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              danger ? "bg-red-600 hover:bg-red-500" : "bg-indigo-600 hover:bg-indigo-500",
            ].join(" ")}
          >
            {busy ? "…" : confirmText}
          </button>
        </div>
      </Card>
    </div>
    </ModalPortal>
  );
}
