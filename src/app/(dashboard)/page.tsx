import { Card, StatCard } from "@/components/ui";

export default function InicioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">
          Bienvenido a tu portal
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Resumen de tus servicios y facturación.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Servicios activos" value="0" />
        <StatCard label="Pendiente de pago" value="$0" />
        <StatCard label="Facturas (mes)" value="0" />
        <StatCard label="Tickets abiertos" value="0" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="font-medium text-slate-800">Actividad reciente</h3>
          <p className="mt-4 text-sm text-slate-500">
            Aún no hay actividad registrada.
          </p>
        </Card>
        <Card>
          <h3 className="font-medium text-slate-800">Accesos rápidos</h3>
          <ul className="mt-4 space-y-2 text-sm text-indigo-600">
            <li><a href="/servicios" className="hover:underline">→ Ver mis servicios</a></li>
            <li><a href="/facturacion" className="hover:underline">→ Ver facturación</a></li>
            <li><a href="/soporte" className="hover:underline">→ Abrir un ticket</a></li>
            <li><a href="/cuenta" className="hover:underline">→ Editar mi cuenta</a></li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
