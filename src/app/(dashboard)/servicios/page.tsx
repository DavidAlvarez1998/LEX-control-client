"use client";

import { useEffect, useState } from "react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { AdminEmpresaGuard } from "@/components/admin-empresa-guard";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";

type ServicioContratado = {
  id: string;
  precioBase: string;
  precioPorUnidad: string;
  incluidos: number;
  activo: boolean;
  servicio: { nombre: string; descripcion: string | null; unidad: string | null };
};

type MiEmpresa = { servicios: ServicioContratado[] };

const money = (v: string) => `$${formatMoney(v)}`;

export default function ServiciosPage() {
  // El guard solo monta el contenido (y dispara el fetch) si es admin de empresa.
  return (
    <AdminEmpresaGuard>
      <ServiciosContent />
    </AdminEmpresaGuard>
  );
}

function ServiciosContent() {
  const [servicios, setServicios] = useState<ServicioContratado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    setLoading(true);
    setError(null);
    api
      .get<MiEmpresa>("/mi-empresa")
      .then((e) => setServicios(e.servicios))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Error al cargar tus servicios"),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div>
      <PageHeader
        title="Mis Servicios"
        subtitle="Servicios que tienes contratados con LEX Control."
      />

      {loading ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
          {error}{" "}
          <button onClick={cargar} className="font-medium underline">
            reintentar
          </button>
        </Card>
      ) : servicios.length === 0 ? (
        <EmptyState
          title="Aún no tienes servicios"
          description="Cuando contrates un servicio aparecerá aquí su estado y detalle."
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Servicio</th>
                <th className="px-5 py-3 font-medium">Precio base</th>
                <th className="px-5 py-3 font-medium">Por unidad</th>
                <th className="px-5 py-3 font-medium">Incluidos</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {servicios.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-800 dark:text-slate-100">
                      {s.servicio.nombre}
                    </div>
                    {s.servicio.descripcion && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {s.servicio.descripcion}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{money(s.precioBase)}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {Number(s.precioPorUnidad) > 0
                      ? `${money(s.precioPorUnidad)}${s.servicio.unidad ? ` / ${s.servicio.unidad}` : ""}`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {s.incluidos > 0 ? s.incluidos : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        s.activo
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {s.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
