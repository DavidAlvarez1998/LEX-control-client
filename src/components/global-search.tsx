"use client";

// Búsqueda global del topbar (v1). Llama a GET /buscar (consciente de rol: el
// backend solo devuelve lo que el usuario puede ver) y muestra un desplegable
// agrupado por tipo; al elegir, navega a la ficha. Reemplaza el input maqueta.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Resultado = {
  tipo: "cliente" | "proceso" | "factura" | "usuario" | "contrato";
  id: string;
  titulo: string;
  subtitulo: string | null;
};

const TIPO_LABEL: Record<Resultado["tipo"], string> = {
  cliente: "Clientes",
  proceso: "Procesos",
  factura: "Facturas",
  usuario: "Equipo",
  contrato: "Contratos",
};

function hrefDe(r: Resultado): string {
  // Cliente/proceso tienen ficha propia; el resto navega a su lista prefiltrada.
  switch (r.tipo) {
    case "cliente":
      return `/clientes/${r.id}`;
    case "proceso":
      return `/procesos/${r.id}`;
    case "factura":
      return `/facturacion?q=${encodeURIComponent(r.titulo)}`;
    case "usuario":
      return `/equipo?q=${encodeURIComponent(r.titulo)}`;
    case "contrato":
      return `/contratos?q=${encodeURIComponent(r.titulo)}`;
  }
}

const inputCls =
  "w-64 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800";

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activo, setActivo] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounce: consulta 250 ms después de dejar de escribir (mín. 2 chars).
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setResultados([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.get<{ resultados: Resultado[] }>(
          `/buscar?q=${encodeURIComponent(t)}`,
        );
        setResultados(data.resultados);
        setActivo(0);
        setOpen(true);
      } catch {
        setResultados([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  // Cerrar al hacer clic afuera.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function ir(r: Resultado) {
    setOpen(false);
    setQ("");
    setResultados([]);
    router.push(hrefDe(r));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || resultados.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      ir(resultados[activo]);
    }
  }

  return (
    <div ref={boxRef} className="relative hidden sm:block">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => resultados.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Buscar cliente, proceso, factura…"
        className={inputCls}
      />
      <svg
        className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.5" y2="16.5" />
      </svg>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {loading && resultados.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-400 dark:text-slate-500">Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-400 dark:text-slate-500">Sin resultados</p>
          ) : (
            <ul className="max-h-80 overflow-auto py-1">
              {resultados.map((r, i) => {
                const nuevoGrupo = i === 0 || resultados[i - 1].tipo !== r.tipo;
                return (
                  <li key={`${r.tipo}-${r.id}`}>
                    {nuevoGrupo && (
                      <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {TIPO_LABEL[r.tipo]}
                      </p>
                    )}
                    <button
                      type="button"
                      onMouseEnter={() => setActivo(i)}
                      onClick={() => ir(r)}
                      className={`block w-full px-3 py-2 text-left text-sm ${
                        i === activo
                          ? "bg-indigo-50 dark:bg-slate-800"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="block truncate font-medium text-slate-800 dark:text-slate-100">
                        {r.titulo}
                      </span>
                      {r.subtitulo && (
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {r.subtitulo}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
