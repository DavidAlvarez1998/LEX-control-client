"use client";

// Módulo Contable — shell con pestañas. Cada pestaña es un componente en
// components/contable/. El shell carga las listas auxiliares (clientes, procesos,
// cuentas) una sola vez y las inyecta como `lookups` a las pestañas que las usan.

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui";
import { AdminEmpresaGuard } from "@/components/admin-empresa-guard";
import { ResumenTab } from "@/components/contable/resumen";
import { IngresosTab } from "@/components/contable/ingresos";
import { EgresosTab } from "@/components/contable/egresos";
import { NominaTab } from "@/components/contable/nomina";
import { CajaTab } from "@/components/contable/caja";
import { ServiciosFijosTab } from "@/components/contable/servicios-fijos";
import { CuentasTab } from "@/components/contable/cuentas";
import { CarteraTab } from "@/components/contable/cartera";
import {
  contableApi, periodoActual,
  type ClienteMin, type Cuenta, type Lookups, type ProcesoMin,
} from "@/lib/contable";

const TABS = ["Resumen", "Ingresos", "Egresos", "Nómina", "Caja menor", "Servicios fijos", "Cuentas", "Cartera"] as const;
type Tab = (typeof TABS)[number];

export default function ContablePage() {
  const [tab, setTab] = useState<Tab>("Resumen");
  const [clientes, setClientes] = useState<ClienteMin[]>([]);
  const [procesos, setProcesos] = useState<ProcesoMin[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const periodo = periodoActual();

  const cargarLookups = useCallback(async () => {
    const [cl, pr, cu] = await Promise.all([contableApi.clientes(), contableApi.procesos(), contableApi.cuentas()]);
    setClientes(cl); setProcesos(pr); setCuentas(cu);
  }, []);

  useEffect(() => { cargarLookups(); }, [cargarLookups]);

  const recargarCuentas = useCallback(async () => { setCuentas(await contableApi.cuentas()); }, []);

  const lookups: Lookups = useMemo(() => ({
    clientes, procesos, cuentas,
    nombreCliente: (id) => clientes.find((c) => c.id === id)?.nombre ?? (id ? id.slice(0, 8) : "—"),
    tituloProceso: (id) => {
      const p = procesos.find((x) => x.id === id);
      return p ? p.codigoInterno : (id ? id.slice(0, 8) : "—");
    },
    nombreCuenta: (id) => cuentas.find((c) => c.id === id)?.nombreBolsa ?? (id ? id.slice(0, 8) : "—"),
  }), [clientes, procesos, cuentas]);

  return (
    <AdminEmpresaGuard>
      <div>
        <PageHeader title="Contable" subtitle={`Gestión financiera del despacho · ${periodo}`} />

        <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Resumen" && <ResumenTab periodo={periodo} />}
        {tab === "Ingresos" && <IngresosTab lookups={lookups} />}
        {tab === "Egresos" && <EgresosTab lookups={lookups} />}
        {tab === "Nómina" && <NominaTab lookups={lookups} />}
        {tab === "Caja menor" && <CajaTab lookups={lookups} />}
        {tab === "Servicios fijos" && <ServiciosFijosTab lookups={lookups} />}
        {tab === "Cuentas" && <CuentasTab onCuentasChange={recargarCuentas} />}
        {tab === "Cartera" && <CarteraTab lookups={lookups} />}
      </div>
    </AdminEmpresaGuard>
  );
}
