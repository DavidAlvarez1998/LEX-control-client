import { redirect } from "next/navigation";

// "Mis procesos" se integró al toggle de /procesos (Jurisdicción · Todos · Míos).
// La ruta se mantiene como deep-link y redirige a la vista "Míos".
export default function MisProcesosPage() {
  redirect("/procesos?vista=mios");
}
