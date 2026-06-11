"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Modal, PageHeader, PlusIcon } from "@/components/ui";
import { Field, Input, MoneyInput, NumberInput, Select } from "@/components/form-ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RolEmpresaGuard } from "@/components/rol-empresa-guard";
import { api, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";

type EstadoPago = "BORRADOR" | "PENDIENTE" | "PARCIAL" | "PAGADA" | "VENCIDA" | "ANULADA";

type ItemAPI = { id: string; descripcion: string; cantidad: number; valorUnitario: string; total: string };
type Pago = { id: string; fechaIngreso: string; valorRecibido: string; metodoPago: string; conceptoPago: string };

type Factura = {
  id: string;
  numero: string | null;
  estado: "BORRADOR" | "EMITIDA" | "ANULADA";
  clienteId: string;
  cliente?: { nombre: string; email?: string | null; numeroDocumento?: string | null };
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  subtotal: string;
  porcentajeIva: string;
  valorIva: string;
  total: string;
  pagado: number;
  saldo: number;
  estadoPago: EstadoPago;
  items?: ItemAPI[];
  pagos?: Pago[];
};

type ClienteOption = { id: string; nombre: string };

const ESTADO_STYLES: Record<EstadoPago, string> = {
  BORRADOR: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  PENDIENTE: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  PARCIAL: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  PAGADA: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  VENCIDA: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  ANULADA: "bg-slate-100 dark:bg-slate-800 text-slate-400 line-through",
};

const METODOS = ["EFECTIVO", "TRANSFERENCIA", "CONSIGNACION", "TARJETA", "OTRO"];
const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100";

type FormItem = { descripcion: string; cantidad: string; valorUnitario: string };
const ITEM_VACIO: FormItem = { descripcion: "", cantidad: "1", valorUnitario: "" };

function fecha(s: string | null): string {
  return s ? new Date(s).toLocaleDateString("es-CO") : "—";
}

export default function FacturacionPage() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Crear borrador
  const [crearOpen, setCrearOpen] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [items, setItems] = useState<FormItem[]>([{ ...ITEM_VACIO }]);
  const [iva, setIva] = useState("19");
  const [vencimiento, setVencimiento] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Detalle
  const [detalle, setDetalle] = useState<Factura | null>(null);

  // Pago
  const [pagoOpen, setPagoOpen] = useState(false);
  const [pagoValor, setPagoValor] = useState("");
  const [pagoMetodo, setPagoMetodo] = useState("TRANSFERENCIA");

  // Confirmaciones (emitir / anular)
  const [confirm, setConfirm] = useState<{ title: string; message: string; confirmText: string; danger: boolean; input?: { label: string; placeholder?: string; required?: boolean }; onConfirm: (motivo: string) => Promise<void> } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [fs, cs] = await Promise.all([
        api.get<Factura[]>("/facturacion/facturas"),
        api.get<ClienteOption[]>("/clientes"),
      ]);
      setFacturas(fs);
      setClientes(cs.map((c) => ({ id: c.id, nombre: c.nombre })));
    } catch (err) {
      setError(errorMessage(err, "Error al cargar"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  // Totales en vivo del borrador.
  const preview = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.valorUnitario) || 0), 0);
    const pct = Number(iva) || 0;
    const valorIva = Math.round(subtotal * pct) / 100;
    return { subtotal, valorIva, total: subtotal + valorIva };
  }, [items, iva]);

  function abrirCrear() {
    setClienteId("");
    setItems([{ ...ITEM_VACIO }]);
    setIva("19");
    setVencimiento("");
    setFormError(null);
    setCrearOpen(true);
  }

  async function crear() {
    setFormError(null);
    const faltan: string[] = [];
    if (!clienteId) faltan.push("Cliente");
    const itemsLlenos = items.filter((it) => it.descripcion.trim() && Number(it.valorUnitario) > 0);
    if (itemsLlenos.length === 0) faltan.push("al menos un ítem con descripción y valor");
    if (faltan.length) { setFormError(`Completa: ${faltan.join(", ")}`); return; }

    setSaving(true);
    try {
      await api.post("/facturacion/facturas", {
        clienteId,
        porcentajeIva: Number(iva) || 0,
        ...(vencimiento ? { fechaVencimiento: vencimiento } : {}),
        items: itemsLlenos.map((it) => ({
          descripcion: it.descripcion.trim(),
          cantidad: Number(it.cantidad) || 1,
          valorUnitario: Number(it.valorUnitario),
        })),
      });
      setCrearOpen(false);
      await cargar();
      setAviso("Borrador de factura creado.");
    } catch (err) {
      setFormError(errorMessage(err, "Error al crear la factura"));
    } finally {
      setSaving(false);
    }
  }

  async function abrirDetalle(id: string) {
    setError(null);
    try {
      setDetalle(await api.get<Factura>(`/facturacion/facturas/${id}`));
    } catch (err) {
      setError(errorMessage(err, "Error al abrir la factura"));
    }
  }

  async function ejecutarConfirm() {
    if (!confirm) return;
    if (confirm.input?.required && !confirmInput.trim()) return;
    setConfirmBusy(true);
    setError(null);
    try {
      await confirm.onConfirm(confirmInput.trim());
      setConfirm(null);
      setConfirmInput("");
    } catch (err) {
      setConfirm(null);
      setConfirmInput("");
      setError(errorMessage(err, "Error"));
    } finally {
      setConfirmBusy(false);
    }
  }

  function pedirEmitir(f: Factura) {
    setConfirm({
      title: "Emitir factura",
      message: `Se asignará el consecutivo y la factura quedará en firme (no se podrá editar). ¿Emitir la factura de "${f.cliente?.nombre ?? ""}"?`,
      confirmText: "Emitir",
      danger: false,
      onConfirm: async () => {
        await api.post(`/facturacion/facturas/${f.id}/emitir`, {});
        await cargar();
        await abrirDetalle(f.id);
        setAviso("Factura emitida.");
      },
    });
  }

  function pedirAnular(f: Factura) {
    setConfirmInput("");
    setConfirm({
      title: "Anular factura",
      message: `Se anulará la factura ${f.numero ?? ""}. Esta acción no se puede deshacer.`,
      confirmText: "Anular factura",
      danger: true,
      input: { label: "Motivo de la anulación", placeholder: "Ej: error en el valor facturado", required: true },
      onConfirm: async (motivo) => {
        await api.post(`/facturacion/facturas/${f.id}/anular`, { motivo });
        await cargar();
        await abrirDetalle(f.id);
        setAviso("Factura anulada.");
      },
    });
  }

  function eliminarBorrador(f: Factura) {
    setConfirm({
      title: "Eliminar borrador",
      message: `Se eliminará el borrador de factura de "${f.cliente?.nombre ?? "—"}". Esta acción no se puede deshacer.`,
      confirmText: "Eliminar borrador",
      danger: true,
      onConfirm: async () => {
        await api.del(`/facturacion/facturas/${f.id}`);
        setDetalle(null);
        await cargar();
        setAviso("Borrador eliminado.");
      },
    });
  }

  function abrirPago() {
    setPagoValor("");
    setPagoMetodo("TRANSFERENCIA");
    setPagoOpen(true);
  }

  async function registrarPago() {
    if (!detalle) return;
    const valor = Number(pagoValor);
    if (!valor || valor <= 0) { setError("Indica un valor de pago válido"); return; }
    setSaving(true);
    setError(null);
    try {
      const actualizada = await api.post<Factura>(`/facturacion/facturas/${detalle.id}/pagos`, {
        valorRecibido: valor,
        metodoPago: pagoMetodo,
      });
      setPagoOpen(false);
      await cargar();
      await abrirDetalle(actualizada.id);
      setAviso("Pago registrado.");
    } catch (err) {
      setError(errorMessage(err, "Error al registrar el pago"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <RolEmpresaGuard roles={["CONTABLE"]}>
      <div>
        <PageHeader
          title="Facturación"
          subtitle="Emite facturas a tus clientes y registra sus pagos."
          action={<Button onClick={abrirCrear}><PlusIcon />Nueva factura</Button>}
        />

        {error && (
          <Card className="mb-4 border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
            {error} <button onClick={cargar} className="font-medium underline">reintentar</button>
          </Card>
        )}
        {aviso && (
          <Card className="mb-4 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 text-sm text-emerald-700 dark:text-emerald-300">
            {aviso}
          </Card>
        )}

        {loading ? (
          <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
        ) : facturas.length === 0 ? (
          <EmptyState
            title="Sin facturas todavía"
            description="Crea tu primera factura. Quedará como borrador hasta que la emitas."
            action={<Button onClick={abrirCrear}><PlusIcon />Nueva factura</Button>}
          />
        ) : (
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Número</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Emisión</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Saldo</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr key={f.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{f.numero ?? "Borrador"}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{f.cliente?.nombre ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{fecha(f.fechaEmision)}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-200">${formatMoney(f.total)}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-200">${formatMoney(f.saldo)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[f.estadoPago]}`}>{f.estadoPago}</span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button onClick={() => abrirDetalle(f.id)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* --- Crear borrador --- */}
        <Modal
          open={crearOpen}
          onClose={() => !saving && setCrearOpen(false)}
          title="Nueva factura"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCrearOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={crear} disabled={saving}>{saving ? "Creando…" : "Crear borrador"}</Button>
            </>
          }
        >
          <Field label="Cliente" requerido>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={inputCls}>
              <option value="">Selecciona un cliente…</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Field>

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Ítems <span className="text-red-500">*</span></span>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <div className="col-span-6">
                    <Input value={it.descripcion} onChange={(v) => setItems((xs) => xs.map((x, j) => j === i ? { ...x, descripcion: v } : x))} placeholder="Descripción" />
                  </div>
                  <div className="col-span-2">
                    <NumberInput value={it.cantidad} onChange={(v) => setItems((xs) => xs.map((x, j) => j === i ? { ...x, cantidad: v } : x))} placeholder="Cant." />
                  </div>
                  <div className="col-span-3">
                    <MoneyInput value={it.valorUnitario} onChange={(v) => setItems((xs) => xs.map((x, j) => j === i ? { ...x, valorUnitario: v } : x))} placeholder="Valor unit." />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    {items.length > 1 && (
                      <button onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500" title="Quitar">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setItems((xs) => [...xs, { ...ITEM_VACIO }])} className="mt-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
              + Agregar ítem
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="IVA (%)"><NumberInput value={iva} onChange={setIva} placeholder="19" /></Field>
            <Field label="Vencimiento">
              <input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>Subtotal</span><span>${formatMoney(preview.subtotal)}</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>IVA ({iva || 0}%)</span><span>${formatMoney(preview.valorIva)}</span></div>
            <div className="mt-1 flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1 font-semibold text-slate-800 dark:text-slate-100"><span>Total</span><span>${formatMoney(preview.total)}</span></div>
          </div>

          {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
        </Modal>

        {/* --- Detalle --- */}
        <Modal
          open={!!detalle}
          onClose={() => setDetalle(null)}
          title={detalle ? `Factura ${detalle.numero ?? "(borrador)"}` : ""}
          size="lg"
          footer={detalle ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                {detalle.estado === "BORRADOR" && (
                  <>
                    <Button onClick={() => pedirEmitir(detalle)}>Emitir</Button>
                    <Button variant="ghost" onClick={() => eliminarBorrador(detalle)}>Eliminar</Button>
                  </>
                )}
                {detalle.estado === "EMITIDA" && detalle.saldo > 0 && <Button onClick={abrirPago}>Registrar pago</Button>}
                {detalle.estado === "EMITIDA" && <Button variant="ghost" onClick={() => pedirAnular(detalle)}>Anular</Button>}
              </div>
              <Button variant="ghost" onClick={() => setDetalle(null)}>Cerrar</Button>
            </div>
          ) : undefined}
        >
          {detalle && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800 dark:text-slate-100">{detalle.cliente?.nombre}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Emisión {fecha(detalle.fechaEmision)} · Vence {fecha(detalle.fechaVencimiento)}
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[detalle.estadoPago]}`}>{detalle.estadoPago}</span>
              </div>

              <table className="w-full">
                <thead className="text-left text-xs text-slate-400">
                  <tr><th className="py-1">Descripción</th><th className="py-1 text-right">Cant.</th><th className="py-1 text-right">V. unit.</th><th className="py-1 text-right">Total</th></tr>
                </thead>
                <tbody>
                  {detalle.items?.map((it) => (
                    <tr key={it.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 text-slate-700 dark:text-slate-200">{it.descripcion}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-300">{it.cantidad}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-300">${formatMoney(it.valorUnitario)}</td>
                      <td className="py-1.5 text-right text-slate-700 dark:text-slate-200">${formatMoney(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="ml-auto w-56 space-y-1">
                <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>Subtotal</span><span>${formatMoney(detalle.subtotal)}</span></div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>IVA ({detalle.porcentajeIva}%)</span><span>${formatMoney(detalle.valorIva)}</span></div>
                <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-100"><span>Total</span><span>${formatMoney(detalle.total)}</span></div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>Pagado</span><span>${formatMoney(detalle.pagado)}</span></div>
                <div className="flex justify-between font-medium text-slate-800 dark:text-slate-100"><span>Saldo</span><span>${formatMoney(detalle.saldo)}</span></div>
              </div>

              {detalle.pagos && detalle.pagos.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Pagos</div>
                  <div className="space-y-1">
                    {detalle.pagos.map((p) => (
                      <div key={p.id} className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>{fecha(p.fechaIngreso)} · {p.metodoPago}</span>
                        <span>${formatMoney(p.valorRecibido)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* --- Pago --- */}
        <Modal
          open={pagoOpen}
          onClose={() => !saving && setPagoOpen(false)}
          title="Registrar pago"
          footer={
            <>
              <Button variant="ghost" onClick={() => setPagoOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={registrarPago} disabled={saving}>{saving ? "Guardando…" : "Registrar"}</Button>
            </>
          }
        >
          {detalle && <p className="text-sm text-slate-500 dark:text-slate-400">Saldo pendiente: ${formatMoney(detalle.saldo)}</p>}
          <Field label="Valor recibido" requerido><MoneyInput value={pagoValor} onChange={setPagoValor} placeholder="0" /></Field>
          <Field label="Método de pago"><Select value={pagoMetodo} onChange={setPagoMetodo} opciones={METODOS} /></Field>
        </Modal>

        <ConfirmDialog
          open={!!confirm}
          title={confirm?.title ?? ""}
          message={confirm?.message ?? ""}
          confirmText={confirm?.confirmText}
          danger={confirm?.danger}
          busy={confirmBusy}
          input={confirm?.input}
          inputValue={confirmInput}
          onInputChange={setConfirmInput}
          onConfirm={ejecutarConfirm}
          onCancel={() => {
            setConfirm(null);
            setConfirmInput("");
          }}
        />
      </div>
    </RolEmpresaGuard>
  );
}
