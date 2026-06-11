// Contrato del módulo Contable del portal: tipos de respuesta, enums (espejo de
// contable.schemas.ts en la API) y funciones de acceso. Los campos de dinero
// vuelven como string (Prisma Decimal serializado); usa money() para mostrarlos.

import { api } from "./api";

// ===================== Enums (espejo de la API) =====================
export const METODO_PAGO = ["EFECTIVO", "TRANSFERENCIA", "CONSIGNACION", "TARJETA", "OTRO"] as const;
export const TIPO_COBRO = ["ANTICIPO", "CUOTA_INICIAL", "HONORARIOS", "PRIMA_EXITO", "COSTAS", "ABONO", "OTRO"] as const;
export const ESTADO_PAGO_INGRESO = ["PAGADO", "PENDIENTE", "PARCIAL"] as const;
export const TIPO_GASTO = ["GENERAL", "POR_PROCESO"] as const;
export const CATEGORIA_EGRESO = ["NOMINA", "SERVICIOS", "PAPELERIA", "CAJA_MENOR", "COSTAS", "ARRIENDO", "IMPUESTOS", "HONORARIOS_TERCEROS", "OTRO"] as const;
export const ESTADO_GASTO = ["PAGADO", "PENDIENTE"] as const;
export const TIPO_VINCULACION = ["LABORAL", "PRESTACION_SERVICIOS", "OTRO"] as const;
export const ESTADO_PAGO_NOMINA = ["PAGADO", "PENDIENTE"] as const;
export const TIPO_MOV_CAJA = ["SALIDA", "REPOSICION"] as const;
export const CATEGORIA_CAJA = ["TRANSPORTE", "PAPELERIA", "MENSAJERIA", "ALIMENTACION", "OTRO"] as const;
export const TIPO_SERVICIO_FIJO = ["AGUA", "LUZ", "GAS", "INTERNET", "TELEFONO", "ARRIENDO", "SOFTWARE", "MANTENIMIENTO", "VIGILANCIA", "OTRO"] as const;
export const ESTADO_SERVICIO = ["PAGADO", "PENDIENTE", "VENCIDO"] as const;
export const FRECUENCIA_SERVICIO = ["MENSUAL", "ANUAL"] as const;
export const TIPO_CUENTA = ["AHORROS", "CORRIENTE", "CAJA"] as const;
export const ESTADO_CUENTA = ["ACTIVA", "INACTIVA", "CONCILIACION_PENDIENTE"] as const;

// ===================== Tipos de respuesta =====================
export type Reporte = {
  periodo: string;
  totalIngresos: number;
  totalEgresos: number;
  utilidadNeta: number;
  desglose: { egresosGenerales: number; nomina: number; serviciosFijos: number; cajaMenor: number };
};

export type Ingreso = {
  id: string; clienteId: string; procesoId: string | null; conceptoPago: string;
  tipoCobro: string; valorRecibido: string; metodoPago: string; estadoPago: string;
  fechaIngreso: string; numeroComprobante: string | null; radicado: string | null; cuentaId: string | null;
};

export type Egreso = {
  id: string; tipoGasto: string; clienteId: string | null; procesoId: string | null;
  categoriaGasto: string; subcategoria: string | null; descripcionGasto: string;
  valorGasto: string; medioPago: string; estadoGasto: string; fechaGasto: string;
  radicado: string | null; cuentaId: string | null;
};

export type Nomina = {
  id: string; empleadoId: string | null; nombreEmpleado: string; cargo: string | null;
  tipoVinculacion: string; periodo: string; salarioHonorarios: string;
  auxilioTransporte: string | null; bonificaciones: string | null; descuentos: string | null;
  valorNetoPagar: string; estadoPago: string; fechaPago: string | null; cuentaId: string | null;
};

// Proyección mínima de un Contrato (HR) para prellenar la nómina. NO es el
// contrato completo: solo lo necesario para pagar (segregación de funciones).
export type Empleable = {
  contratoId: string; usuarioId: string | null; nombre: string;
  cargo: string | null; honorarios: string | null; tipoContrato: string | null;
  fechaInicio: string | null; estado: string; // ACTIVO | FINALIZADO | SUSPENDIDO
};

export type CajaMenor = {
  id: string; nombre: string; montoInicial: string; estado: string;
  responsableId: string | null; observaciones: string | null; createdAt: string;
};
export type Movimiento = {
  id: string; cajaId: string; tipoMovimiento: string; fechaMovimiento: string;
  concepto: string; categoria: string; valor: string; medioSalida: string;
  procesoId: string | null; radicado: string | null;
};
export type CajaDetalle = CajaMenor & { saldoActual: number; movimientos: Movimiento[] };

export type ServicioFijo = {
  id: string; periodo: string; tipoServicio: string; proveedor: string; valorFacturado: string;
  fechaVencimiento: string | null; fechaPago: string | null; estadoPago: string; cuentaId: string | null;
  recurrenteId?: string | null;
  soporteFacturaUrl?: string | null;
  vencido?: boolean; // derivado por la API: fechaVencimiento < ahora y no PAGADO
};

export type ServicioFijoRecurrente = {
  id: string; tipoServicio: string; proveedor: string; valorEstimado: string;
  frecuencia: string; diaPago: number; mesPago: number | null; cuentaId: string | null;
  activo: boolean; observaciones: string | null;
};

export type Cuenta = {
  id: string; entidadBancaria: string; tipoCuenta: string; numeroCuenta: string | null;
  nombreBolsa: string; saldoInicial: string; estadoCuenta: string; createdAt: string;
  saldoActual?: number; // derivado por la API también en el listado
};
export type CuentaDetalle = Cuenta & { saldoActual: number };

export type CarteraRow = {
  id: string; clienteId: string; contratoId: string | null; procesoId: string | null;
  valorTotalAcordado: string | null; valorPagado: number; saldoPendiente: number | null;
  estadoCartera: string; tipoCobro: string; fechaProximoPago: string | null;
};

/** Listas auxiliares + buscadores por id, inyectadas a cada pestaña por el shell. */
export type Lookups = {
  clientes: ClienteMin[];
  procesos: ProcesoMin[];
  cuentas: Cuenta[];
  nombreCliente: (id: string | null | undefined) => string;
  tituloProceso: (id: string | null | undefined) => string;
  nombreCuenta: (id: string | null | undefined) => string;
};

export type ClienteMin = { id: string; nombre: string };
export type ProcesoMin = { id: string; codigoInterno: string; titulo: string; radicado: string | null };
export type ContratoMin = {
  id: string; clienteId: string; estadoContrato: string; estadoPoder: string;
  valorAcordado: string | null; tipoCobroAcordado: string;
};

// ===================== API =====================
export const contableApi = {
  reporte: (periodo: string) => api.get<Reporte>(`/contable/reportes?periodo=${periodo}`),

  ingresos: () => api.get<Ingreso[]>("/contable/ingresos"),
  crearIngreso: (body: Record<string, unknown>) => api.post<Ingreso>("/contable/ingresos", body),

  egresos: () => api.get<Egreso[]>("/contable/egresos"),
  crearEgreso: (body: Record<string, unknown>) => api.post<Egreso>("/contable/egresos", body),
  editarEgreso: (id: string, body: Record<string, unknown>) => api.patch<Egreso>(`/contable/egresos/${id}`, body),

  nominas: () => api.get<Nomina[]>("/contable/nominas"),
  empleables: () => api.get<Empleable[]>("/contable/nominas/empleables"),
  crearNomina: (body: Record<string, unknown>) => api.post<Nomina>("/contable/nominas", body),
  editarNomina: (id: string, body: Record<string, unknown>) => api.patch<Nomina>(`/contable/nominas/${id}`, body),

  cajas: () => api.get<CajaMenor[]>("/contable/cajas"),
  crearCaja: (body: Record<string, unknown>) => api.post<CajaMenor>("/contable/cajas", body),
  caja: (id: string) => api.get<CajaDetalle>(`/contable/cajas/${id}`),
  crearMovimiento: (id: string, body: Record<string, unknown>) => api.post<Movimiento>(`/contable/cajas/${id}/movimientos`, body),
  editarCaja: (id: string, body: Record<string, unknown>) => api.patch<CajaMenor>(`/contable/cajas/${id}`, body),

  serviciosFijos: () => api.get<ServicioFijo[]>("/contable/servicios-fijos"),
  crearServicioFijo: (body: Record<string, unknown>) => api.post<ServicioFijo>("/contable/servicios-fijos", body),
  editarServicioFijo: (id: string, body: Record<string, unknown>) => api.patch<ServicioFijo>(`/contable/servicios-fijos/${id}`, body),

  serviciosFijosRecurrentes: () => api.get<ServicioFijoRecurrente[]>("/contable/servicios-fijos-recurrentes"),
  crearServicioFijoRecurrente: (body: Record<string, unknown>) => api.post<ServicioFijoRecurrente>("/contable/servicios-fijos-recurrentes", body),
  editarServicioFijoRecurrente: (id: string, body: Record<string, unknown>) => api.patch<ServicioFijoRecurrente>(`/contable/servicios-fijos-recurrentes/${id}`, body),
  generarServiciosFijos: (periodo: string) => api.post<{ periodo: string; candidatas: number; generadas: number; omitidas: number }>("/contable/servicios-fijos-recurrentes/generar", { periodo }),

  cuentas: () => api.get<Cuenta[]>("/contable/cuentas"),
  crearCuenta: (body: Record<string, unknown>) => api.post<Cuenta>("/contable/cuentas", body),
  cuenta: (id: string) => api.get<CuentaDetalle>(`/contable/cuentas/${id}`),
  editarCuenta: (id: string, body: Record<string, unknown>) => api.patch<Cuenta>(`/contable/cuentas/${id}`, body),
  borrarCuenta: (id: string) => api.del<void>(`/contable/cuentas/${id}`),

  cartera: () => api.get<CarteraRow[]>("/contable/cartera"),
  abrirCartera: (body: Record<string, unknown>) => api.post<CarteraRow>("/contable/cartera", body),
  resyncCartera: (id: string) => api.post<CarteraRow>(`/contable/cartera/${id}/resync`, {}),

  // Fuentes auxiliares (otros módulos) para selects de los formularios.
  clientes: () => api.get<ClienteMin[]>("/clientes").catch(() => [] as ClienteMin[]),
  procesos: () =>
    api
      .get<{ items: ProcesoMin[] }>("/procesos")
      .then((r) => r.items ?? [])
      .catch(() => [] as ProcesoMin[]),
  contratos: () => api.get<ContratoMin[]>("/comercial/contratos").catch(() => [] as ContratoMin[]),
};

// ===================== Helpers =====================
export const periodoActual = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
