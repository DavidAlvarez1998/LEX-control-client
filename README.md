# lex-control-client

Portal de **LEX Control** para los **usuarios CLIENTE** de un despacho (tenant). Cada
despacho ve solo lo suyo: su cartera de clientes/CRM, procesos legales, agenda,
servicios contratados, contable, facturación, contratos y su equipo. Corre en **`:3001`**.

- **Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript.
- Misma estructura que el admin (es una variante scoped a un tenant): rutas bajo
  `src/app/(dashboard)/`, navegación en `src/lib/nav.tsx`, UI en `src/components/ui.tsx`.
  Alias `@/` → `src/`.

## Comandos

```bash
pnpm dev      # dev server → http://localhost:3001
pnpm build    # next build (output: standalone)
pnpm start    # sirve el build de producción → :3001
pnpm lint     # eslint
```

## Entorno

`lex-control-client/.env.local`:

- `API_PROXY_TARGET` — destino del proxy `/api/*` (rewrites de `next.config.ts`); el
  navegador llama same-origin y Next reenvía a la API. Default `http://localhost:4000`;
  en Docker `http://api:4000`. **Ojo:** se evalúa en build (pasalo como build arg).
- `NEXT_PUBLIC_API_URL` — URL de la API para el código de cliente.

---

Setup completo, variables de entorno y cómo levantar toda la plataforma: ver el
[README del repo paraguas](../README.md).
