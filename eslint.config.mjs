import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Reglas del React Compiler (eslint-plugin-react-hooks) que eslint-config-next
  // promovió a ERROR. Son advisorias de rendimiento, no bugs de correctitud, y
  // flaggean patrones preexistentes (init-sync en efectos, etc.) que la app ya usa.
  // Se degradan a WARN para no bloquear el CI: SIGUEN VISIBLES (no se silencian) y se
  // van bajando como deuda. El gate real del front es `next build` (type-check).
  // DEUDA: openspec/changes/mejoras-proyecto-roadmap → burn-down de estas warnings.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
    },
  },
]);

export default eslintConfig;
