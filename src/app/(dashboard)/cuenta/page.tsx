"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { DocumentosContrato, type DocumentoContrato } from "@/components/documentos-contrato";
import { api, errorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatMoney } from "@/lib/format";

type ServicioContratado = {
  id: string;
  precioBase: string;
  precioPorUnidad: string;
  unidad?: string | null;
  incluidos: number;
  servicio: { nombre: string; unidad: string | null };
};

type MiEmpresa = {
  id: string;
  nombre: string;
  rfc: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  servicios?: ServicioContratado[]; // solo presente para el admin de empresa
};

const money = (v: string) => `$${formatMoney(v)}`;

export default function CuentaPage() {
  const user = getUser();

  // En el portal el "rol" crudo (USUARIO) confunde: mostramos el nivel de acceso
  // dentro de la empresa. Administrador = gestiona su empresa (esAdminEmpresa).
  const acceso =
    user?.rol === "ADMIN"
      ? "Administrador de plataforma"
      : user?.esAdminEmpresa
        ? "Administrador"
        : "Usuario";

  const [empresa, setEmpresa] = useState<MiEmpresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    setLoading(true);
    setError(null);
    api
      .get<MiEmpresa>("/mi-empresa")
      .then(setEmpresa)
      .catch((e) =>
        setError(errorMessage(e, "Error al cargar tu empresa")),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div>
      <PageHeader
        title="Mi Cuenta"
        subtitle="Tus datos de acceso y la información de tu empresa."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Perfil del usuario logueado (desde la sesión). */}
        <Card>
          <h3 className="font-medium text-slate-800 dark:text-slate-100">Datos de perfil</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Nombre" value={user?.nombre ?? "—"} />
            <Row label="Email" value={user?.email ?? "—"} />
            <Row label="Acceso" value={acceso} />
          </dl>
        </Card>

        {/* Empresa del cliente (scoped a su propio usuario). */}
        <Card>
          <h3 className="font-medium text-slate-800 dark:text-slate-100">Mi empresa</h3>
          {loading ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
          ) : error ? (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              {error}{" "}
              <button onClick={cargar} className="font-medium underline">
                reintentar
              </button>
            </p>
          ) : empresa ? (
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Empresa" value={empresa.nombre} />
              <Row label="RFC / NIT" value={empresa.rfc ?? "—"} />
              <Row label="Correo" value={empresa.email ?? "—"} />
              <Row label="Teléfono" value={empresa.telefono ?? "—"} />
              <Row
                label="Estado"
                value={empresa.activo ? "Activa" : "Inactiva"}
              />
            </dl>
          ) : null}
        </Card>
      </div>

      {/* Servicios contratados por la empresa. SOLO el administrador de empresa. */}
      {!loading && !error && empresa && user?.esAdminEmpresa && (
        <Card className="mt-4 p-0">
          <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-3">
            <h3 className="font-medium text-slate-800 dark:text-slate-100">Servicios contratados</h3>
          </div>
          {(empresa.servicios ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
              Tu empresa aún no tiene servicios contratados.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Servicio</th>
                  <th className="px-5 py-3 font-medium">Precio base</th>
                  <th className="px-5 py-3 font-medium">Por unidad</th>
                  <th className="px-5 py-3 font-medium">Incluidos</th>
                </tr>
              </thead>
              <tbody>
                {(empresa.servicios ?? []).map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {s.servicio.nombre}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {money(s.precioBase)}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {Number(s.precioPorUnidad) > 0
                        ? `${money(s.precioPorUnidad)}${s.servicio.unidad ? ` / ${s.servicio.unidad}` : ""}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      {s.incluidos > 0 ? s.incluidos : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Mi contrato: lo que registró el despacho + carga de mis documentos. */}
      <MisContratos />
    </div>
  );
}

// ── Mi contrato ──────────────────────────────────────────────────────────────
type Estado = "ACTIVO" | "FINALIZADO" | "SUSPENDIDO";
type ContratoMio = {
  id: string;
  cargo: string | null;
  tipoContrato: string | null;
  estado: Estado;
  fechaInicio: string | null;
  fechaFin: string | null;
  honorarios: string | null;
  formaPago: string | null;
  area: string | null;
  modalidad: string | null;
  observaciones: string | null;
  documentos: DocumentoContrato[];
};

const ESTADO_STYLES: Record<Estado, string> = {
  ACTIVO: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  FINALIZADO: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  SUSPENDIDO: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
};
const fecha = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

function MisContratos() {
  const [contratos, setContratos] = useState<ContratoMio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ContratoMio[]>("/contratos/mio")
      .then(setContratos)
      .catch((e) => setError(errorMessage(e, "Error al cargar tu contrato")));
  }, []);

  // Actualiza los documentos del contrato `id` tras subir/quitar.
  const setDocs = (id: string, docs: DocumentoContrato[]) =>
    setContratos((cs) => cs?.map((c) => (c.id === id ? { ...c, documentos: docs } : c)) ?? cs);

  if (contratos === null && !error) return null; // aún cargando: no parpadea

  return (
    <Card className="mt-4 p-0">
      <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
        <h3 className="font-medium text-slate-800 dark:text-slate-100">Mi contrato</h3>
      </div>

      {error ? (
        <p className="px-5 py-6 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : contratos!.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
          Tu despacho aún no ha registrado tu contrato. Cuando lo haga, aquí podrás consultarlo y
          subir tus documentos.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {contratos!.map((c) => (
            <div key={c.id} className="space-y-4 px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_STYLES[c.estado]}`}>
                  {c.estado}
                </span>
                <Inline label="Cargo" value={c.cargo ?? "—"} />
                <Inline label="Tipo" value={c.tipoContrato ?? "—"} />
                <Inline label="Inicio" value={fecha(c.fechaInicio)} />
                <Inline label="Fin" value={fecha(c.fechaFin)} />
                {c.honorarios && <Inline label="Honorarios" value={`$${formatMoney(c.honorarios)}`} />}
                {c.formaPago && <Inline label="Pago" value={c.formaPago} />}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Mis documentos</p>
                <DocumentosContrato
                  contratoId={c.id}
                  docs={c.documentos}
                  onChange={(d) => setDocs(c.id, d)}
                  onError={setError}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Inline({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-slate-600 dark:text-slate-300">
      <span className="text-slate-400 dark:text-slate-500">{label}:</span> {value}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800 dark:text-slate-100">{value}</dd>
    </div>
  );
}
