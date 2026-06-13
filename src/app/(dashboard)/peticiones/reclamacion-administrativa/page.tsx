"use client";

import ListaPeticionSimple from "../_lista-peticion-simple";

export default function ReclamacionAdministrativaPage() {
  return (
    <ListaPeticionSimple
      tipoNombre="Reclamación Administrativa"
      title="Reclamación Administrativa"
      subtitle="Reclamos previos ante la administración de tu despacho."
      botonNuevo="Nueva reclamación"
    />
  );
}
