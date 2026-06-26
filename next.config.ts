import type { NextConfig } from "next";

// Cabeceras de seguridad (defensa en profundidad). La CSP permite inline en script/style
// porque Next (scripts de hidratación) y Tailwind v4 (estilos inline) los requieren; aun
// así restringe a same-origin, bloquea el framing (clickjacking) y `object/embed`. Las
// llamadas al API van por el proxy same-origin (/api/*), así que `connect-src 'self'` basta.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Build a self-contained server bundle (.next/standalone) for slim Docker images:
  // the runtime copies only the bundled server + the node_modules it actually needs.
  output: "standalone",
  experimental: {
    // Habilita la integración de la View Transitions API de React en el App Router:
    // las navegaciones de ruta pasan a ser transiciones y el <ViewTransition> de React
    // anima el cambio de página (crossfade por defecto). Degrada solo en navegadores
    // sin soporte (la app funciona, simplemente no anima).
    viewTransition: true,
  },
  // Proxy same-origin a la API: el navegador llama a /api/* (mismo host que este
  // front) y Next reenvía a la API del lado servidor. Así el navegador no necesita
  // alcanzar localhost:4000 directamente (clave en SSH donde solo se forwardean
  // 3000/3001). Destino configurable por env (API_PROXY_TARGET).
  async rewrites() {
    const target = process.env.API_PROXY_TARGET ?? "http://localhost:4000";
    return [{ source: "/api/:path*", destination: `${target}/:path*` }];
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
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
