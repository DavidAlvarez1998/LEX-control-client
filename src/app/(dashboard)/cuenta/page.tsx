import { Button, Card, PageHeader } from "@/components/ui";

export default function CuentaPage() {
  return (
    <div>
      <PageHeader
        title="Mi Cuenta"
        subtitle="Gestiona los datos de tu perfil y acceso."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-medium text-slate-800">Datos de perfil</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Nombre</dt>
              <dd className="font-medium text-slate-800">Cliente</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-800">cliente@lex.com</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Rol</dt>
              <dd className="font-medium text-slate-800">CLIENTE</dd>
            </div>
          </dl>
          <div className="mt-5">
            <Button variant="ghost">Editar perfil</Button>
          </div>
        </Card>

        <Card>
          <h3 className="font-medium text-slate-800">Seguridad</h3>
          <p className="mt-4 text-sm text-slate-500">
            Cambia tu contraseña periódicamente para mantener tu cuenta segura.
          </p>
          <div className="mt-5">
            <Button variant="ghost">Cambiar contraseña</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
