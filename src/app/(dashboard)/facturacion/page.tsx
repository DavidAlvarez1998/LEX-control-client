import { Card, EmptyState, PageHeader } from "@/components/ui";

export default function FacturacionPage() {
  const facturas: { id: string; numero: string; fecha: string; monto: string; estado: string }[] = [];

  return (
    <div>
      <PageHeader
        title="Facturación"
        subtitle="Consulta y descarga tus facturas."
      />

      {facturas.length === 0 ? (
        <EmptyState
          title="Sin facturas todavía"
          description="Aquí verás tus facturas emitidas y su estado de pago."
        />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Número</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Monto</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800">{f.numero}</td>
                  <td className="px-5 py-3 text-slate-600">{f.fecha}</td>
                  <td className="px-5 py-3 text-slate-600">{f.monto}</td>
                  <td className="px-5 py-3 text-slate-600">{f.estado}</td>
                  <td className="px-5 py-3 text-right text-indigo-600">Descargar</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
