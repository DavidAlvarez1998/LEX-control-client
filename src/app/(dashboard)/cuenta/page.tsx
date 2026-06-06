"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
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
  servicios: ServicioContratado[];
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
        setError(e instanceof Error ? e.message : "Error al cargar tu empresa"),
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

      {/* Servicios contratados por la empresa. */}
      {!loading && !error && empresa && (
        <Card className="mt-4 p-0">
          <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-3">
            <h3 className="font-medium text-slate-800 dark:text-slate-100">Servicios contratados</h3>
          </div>
          {empresa.servicios.length === 0 ? (
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
                {empresa.servicios.map((s) => (
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
    </div>
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
