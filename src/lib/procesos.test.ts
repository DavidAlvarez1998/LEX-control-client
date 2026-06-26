// Tests de la lógica PURA del motor de reglas del cliente (S0.5). Es el motor espejado
// del backend; sin estos tests un drift cliente↔servidor pasaría inadvertido.
import { describe, expect, it } from "vitest";
import {
  campoEfectivamenteRequerido,
  documentosRequeridosDeEtapas,
  evaluarCondicion,
  validarDatos,
} from "./procesos";
import type { CampoEsquema, EtapaDef } from "./procesos";

const campo = (p: Partial<CampoEsquema> & { key: string }): CampoEsquema =>
  ({ label: p.key, tipo: "texto", requerido: false, ...p });
const etapa = (p: Partial<EtapaDef> & { key: string }): EtapaDef =>
  ({ nombre: p.key, orden: 1, ...p });

describe("evaluarCondicion", () => {
  it("hoja: igualdad simple y por array de objetivos", () => {
    expect(evaluarCondicion({ campo: "a", igualA: "Sí" }, { a: "Sí" })).toBe(true);
    expect(evaluarCondicion({ campo: "a", igualA: "Sí" }, { a: "No" })).toBe(false);
    expect(evaluarCondicion({ campo: "a", igualA: ["X", "Y"] }, { a: "Y" })).toBe(true);
  });
  it("array-aware (multiselect) y boolean por String()", () => {
    expect(evaluarCondicion({ campo: "m", igualA: "X" }, { m: ["X", "Z"] })).toBe(true);
    expect(evaluarCondicion({ campo: "m", igualA: "Q" }, { m: ["X", "Z"] })).toBe(false);
    expect(evaluarCondicion({ campo: "b", igualA: "true" }, { b: true })).toBe(true);
  });
  it("vacío/ausente no cumple", () => {
    expect(evaluarCondicion({ campo: "a", igualA: "Sí" }, {})).toBe(false);
  });
  it("todas (AND) y alguna (OR)", () => {
    const datos = { a: "Sí", b: "No" };
    expect(evaluarCondicion({ todas: [{ campo: "a", igualA: "Sí" }, { campo: "b", igualA: "No" }] }, datos)).toBe(true);
    expect(evaluarCondicion({ todas: [{ campo: "a", igualA: "Sí" }, { campo: "b", igualA: "Sí" }] }, datos)).toBe(false);
    expect(evaluarCondicion({ alguna: [{ campo: "a", igualA: "No" }, { campo: "b", igualA: "No" }] }, datos)).toBe(true);
  });
});

describe("campoEfectivamenteRequerido", () => {
  it("requerido fijo y visible", () => {
    expect(campoEfectivamenteRequerido(campo({ key: "n", requerido: true }), {})).toBe(true);
  });
  it("requeridoSi cuando se cumple la condición", () => {
    const c = campo({ key: "n", requeridoSi: { campo: "x", igualA: "Sí" } });
    expect(campoEfectivamenteRequerido(c, { x: "Sí" })).toBe(true);
    expect(campoEfectivamenteRequerido(c, { x: "No" })).toBe(false);
  });
  it("auto nunca se exige; oculto (mostrarSi falso) tampoco", () => {
    expect(campoEfectivamenteRequerido(campo({ key: "n", requerido: true, auto: true }), {})).toBe(false);
    const oculto = campo({ key: "n", requerido: true, mostrarSi: { campo: "x", igualA: "Sí" } });
    expect(campoEfectivamenteRequerido(oculto, { x: "No" })).toBe(false);
  });
});

describe("documentosRequeridosDeEtapas", () => {
  const etapas: EtapaDef[] = [
    etapa({ key: "e1", reglas: { documentosRequeridos: ["demanda.pdf"], requeridosSi: [{ si: { campo: "contesto", igualA: "Sí" }, documentosRequeridos: ["excepciones.pdf"] }] } }),
    etapa({ key: "e2", disponibleSi: { campo: "cautelares", igualA: "Sí" }, reglas: { documentosRequeridos: ["embargo.pdf"] } }),
    etapa({ key: "e3", reglas: { documentosRequeridos: ["demanda.pdf"] } }), // duplicado → dedup
  ];
  it("incluye base + requeridosSi cumplido, dedup, y respeta disponibleSi", () => {
    expect(documentosRequeridosDeEtapas(etapas, { contesto: "Sí", cautelares: "No" }))
      .toEqual(["demanda.pdf", "excepciones.pdf"]); // sin embargo.pdf (e2 no disponible), sin duplicar demanda
  });
  it("incluye la etapa con disponibleSi cumplido", () => {
    expect(documentosRequeridosDeEtapas(etapas, { cautelares: "Sí" })).toContain("embargo.pdf");
  });
});

describe("validarDatos", () => {
  const esquema: CampoEsquema[] = [
    campo({ key: "n", label: "Nombre", requerido: true }),
    campo({ key: "ok", label: "Acepta", tipo: "boolean", requerido: true }), // boolean: no se exige
    campo({ key: "cond", label: "Motivo", requeridoSi: { campo: "n", igualA: "X" } }),
  ];
  it("falta el requerido vacío; el boolean no cuenta", () => {
    expect(validarDatos(esquema, {})).toEqual({ ok: false, faltantes: ["Nombre"] });
  });
  it("ok cuando los visibles+requeridos están llenos", () => {
    expect(validarDatos(esquema, { n: "Juan" })).toEqual({ ok: true, faltantes: [] });
  });
  it("requeridoSi activa el faltante", () => {
    expect(validarDatos(esquema, { n: "X" })).toEqual({ ok: false, faltantes: ["Motivo"] });
  });
});
