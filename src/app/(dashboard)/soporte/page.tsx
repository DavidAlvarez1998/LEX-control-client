import { Button, EmptyState, PageHeader, PlusIcon } from "@/components/ui";

export default function SoportePage() {
  const tickets: { id: string; asunto: string; estado: string }[] = [];

  return (
    <div>
      <PageHeader
        title="Soporte"
        subtitle="Abre tickets y revisa el estado de tus solicitudes."
        action={
          <Button>
            <PlusIcon />
            Nuevo ticket
          </Button>
        }
      />

      {tickets.length === 0 ? (
        <EmptyState
          title="No tienes tickets"
          description="¿Necesitas ayuda? Abre un ticket y nuestro equipo te atenderá."
          action={
            <Button>
              <PlusIcon />
              Nuevo ticket
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
