import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Habilita la integración de la View Transitions API de React en el App Router:
    // las navegaciones de ruta pasan a ser transiciones y el <ViewTransition> de React
    // anima el cambio de página (crossfade por defecto). Degrada solo en navegadores
    // sin soporte (la app funciona, simplemente no anima).
    viewTransition: true,
  },
  // Las 3 secciones viejas se unificaron dentro de /procesos (vista por sección).
  // Redirige sus índices a la vista unificada para no romper bookmarks/links viejos.
  // Las fichas y "nueva/nuevo" siguen existiendo como re-exports (back-compat).
  async redirects() {
    return [
      { source: "/peticiones", destination: "/procesos?vista=seccion&grupo=PETICION", permanent: false },
      { source: "/peticiones/derecho-peticion", destination: "/procesos?vista=seccion&grupo=PETICION", permanent: false },
      { source: "/peticiones/reclamacion-administrativa", destination: "/procesos?vista=seccion&grupo=PETICION", permanent: false },
      { source: "/peticiones/constitucion-renuencia", destination: "/procesos?vista=seccion&grupo=PETICION", permanent: false },
      { source: "/acciones-constitucionales", destination: "/procesos?vista=seccion&grupo=CONSTITUCIONAL", permanent: false },
      { source: "/procesos-laborales", destination: "/procesos?vista=seccion&grupo=LABORAL", permanent: false },
    ];
  },
};

export default nextConfig;
