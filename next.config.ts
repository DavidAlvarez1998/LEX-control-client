import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Habilita la integración de la View Transitions API de React en el App Router:
    // las navegaciones de ruta pasan a ser transiciones y el <ViewTransition> de React
    // anima el cambio de página (crossfade por defecto). Degrada solo en navegadores
    // sin soporte (la app funciona, simplemente no anima).
    viewTransition: true,
  },
};

export default nextConfig;
