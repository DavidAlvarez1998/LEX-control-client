// Mensaje de vencimiento unificado (S0.5). Lógica pura de presentación.
import { describe, expect, it } from "vitest";
import { vencimientoTexto } from "./vencimiento";

const base = { etapaNombre: "Subsanación", plazoEtiqueta: null, plazoDias: null, plazoTipoDias: null };

describe("vencimientoTexto", () => {
  it("null si no hay fecha límite", () => {
    expect(vencimientoTexto({ ...base, fechaLimite: null, semaforo: null } as never)).toBeNull();
  });

  it("arma 'etiqueta: fecha (N días …) — estado' y marca vencido", () => {
    const r = vencimientoTexto({
      fechaLimite: "2026-06-24", semaforo: "vencido",
      etapaNombre: "Subsanación", plazoEtiqueta: "Plazo para subsanar",
      plazoDias: 5, plazoTipoDias: "habiles",
    } as never)!;
    expect(r.texto).toBe("⏱ Plazo para subsanar: 24 de junio de 2026 (5 días hábiles) — vencido");
    expect(r.estado).toBe("vencido");
    expect(r.cls).toContain("rose");
  });

  it("usa etapaNombre si no hay etiqueta, y omite el detalle sin plazoDias", () => {
    const r = vencimientoTexto({
      fechaLimite: "2026-06-24", semaforo: "por_vencer",
      etapaNombre: "Contestación", plazoEtiqueta: null, plazoDias: null, plazoTipoDias: null,
    } as never)!;
    expect(r.texto).toBe("⏱ Contestación: 24 de junio de 2026 — por vencer");
    expect(r.estado).toBe("por vencer");
    expect(r.cls).toContain("amber");
  });

  it("días calendario cuando plazoTipoDias = calendario", () => {
    const r = vencimientoTexto({
      fechaLimite: "2026-06-24", semaforo: null,
      etapaNombre: "X", plazoEtiqueta: null, plazoDias: 10, plazoTipoDias: "calendario",
    } as never)!;
    expect(r.texto).toContain("(10 días calendario)");
  });
});
