// El App Router de Next usa el canary de React, que incluye <ViewTransition>.
// Esta referencia activa sus tipos (export const ViewTransition en @types/react/canary)
// para que `import { ViewTransition } from "react"` compile sin errores.
/// <reference types="react/canary" />
