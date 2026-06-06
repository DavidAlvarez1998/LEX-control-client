"use client";

import { Button, Card } from "./ui";

/** Modal de confirmación acorde al portal (reemplaza window.confirm). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirmar",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <Card className="w-full max-w-md">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          {/* Botón crudo para controlar el color (rojo en acciones destructivas). */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
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
  );
}
