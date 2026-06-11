"use client";

// "Cerrar el ciclo" del contacto: en UN formulario se registra la gestión
// (tipo + disposición + resultado) Y se agenda el próximo paso (qué + cuándo).
// Si la disposición es NO_VIABLE, ofrece marcar el prospecto como PERDIDO.

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { Field, Input, Select, Textarea } from "@/components/form-ui";
import { api, ApiError } from "@/lib/api";
import { comercialApi, DISPOSICION, DISPOSICION_LABEL, TIPO_GESTION, type Disposicion } from "@/lib/comercial-api";

export function RegistrarGestion({
  clienteId,
  clienteNombre,
  onClose,
  onSaved,
}: {
  clienteId: string;
  clienteNombre?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipoGestion, setTipoGestion] = useState("LLAMADA");
  const [disposicion, setDisposicion] = useState<Disposicion | "">("");
  const [resultado, setResultado] = useState("");
  const [proximaTarea, setProximaTarea] = useState("");
  const [fechaProximaTarea, setFechaProximaTarea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(marcarPerdido = false) {
    setBusy(true);
    setError(null);
    try {
      await comercialApi.addSeguimiento(clienteId, {
        tipoGestion,
        ...(disposicion ? { disposicion } : {}),
        ...(resultado.trim() ? { resultado: resultado.trim() } : {}),
        ...(proximaTarea.trim() ? { proximaTarea: proximaTarea.trim() } : {}),
        ...(fechaProximaTarea ? { fechaProximaTarea: new Date(fechaProximaTarea).toISOString() } : {}),
      });
      if (marcarPerdido) {
        await api.post(`/clientes/${clienteId}/fase`, { fase: "PERDIDO", motivoPerdida: resultado.trim() || "No viable" });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo registrar la gestión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Registrar gestión${clienteNombre ? ` · ${clienteNombre}` : ""}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          {disposicion === "NO_VIABLE" && (
            <Button variant="ghost" onClick={() => guardar(true)} disabled={busy}>
              Registrar y marcar PERDIDO
            </Button>
          )}
          <Button onClick={() => guardar(false)} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tipo de gestión">
            <Select value={tipoGestion} onChange={setTipoGestion} opciones={[...TIPO_GESTION]} />
          </Field>
          <Field label="¿Qué pasó? (disposición)">
            <Select
              value={disposicion}
              onChange={(v) => setDisposicion(v as Disposicion)}
              opciones={[...DISPOSICION]}
              etiquetas={DISPOSICION_LABEL}
              placeholder="Selecciona…"
            />
          </Field>
        </div>
        <Field label="Resultado / nota">
          <Textarea value={resultado} onChange={setResultado} rows={2} />
        </Field>
        {/* Cerrar el ciclo: el próximo paso. */}
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <p className="mb-2 text-xs font-medium text-indigo-700 dark:text-indigo-300">Próximo paso (agéndalo)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Qué">
              <Input value={proximaTarea} onChange={setProximaTarea} placeholder="Ej. Insistir con la propuesta" />
            </Field>
            <Field label="Cuándo">
              <Input type="date" value={fechaProximaTarea} onChange={setFechaProximaTarea} />
            </Field>
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
