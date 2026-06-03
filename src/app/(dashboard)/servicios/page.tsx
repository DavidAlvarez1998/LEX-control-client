import { Card, EmptyState, PageHeader } from "@/components/ui";

export default function ServiciosPage() {
  const servicios: { id: string; nombre: string; precio: string; estado: string }[] = [];

  return (
    <div>
      <PageHeader
        title="Mis Servicios"
        subtitle="Servicios que tienes contratados con LEX Control."
      />

      {servicios.length === 0 ? (
        <EmptyState
          title="Aún no tienes servicios"
          description="Cuando contrates un servicio aparecerá aquí su estado y detalle."
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Servicio</th>
                <th className="px-5 py-3 font-medium">Precio</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {servicios.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800">{s.nombre}</td>
                  <td className="px-5 py-3 text-slate-600">{s.precio}</td>
                  <td className="px-5 py-3 text-slate-600">{s.estado}</td>
                  <td className="px-5 py-3 text-right text-indigo-600">Ver</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
