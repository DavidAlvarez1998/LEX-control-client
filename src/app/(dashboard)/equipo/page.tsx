"use client";

import { useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHeader, PlusIcon } from "@/components/ui";
import { Field, Input } from "@/components/form-ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { api, errorMessage } from "@/lib/api";
import { getUser } from "@/lib/auth";

type Estado = "ACTIVO" | "PENDIENTE" | "INACTIVO";

type Rol = "ADMINISTRADOR" | "JURIDICO" | "CONTABLE" | "COMERCIAL";

// Orden y etiquetas de los roles de empresa (mismo enum que la API).
const ROLES: { rol: Rol; label: string; desc: string }[] = [
  { rol: "ADMINISTRADOR", label: "Administrador", desc: "Gestiona al equipo y todo el despacho" },
  { rol: "JURIDICO", label: "Jurídico", desc: "Lleva los procesos / expedientes" },
  { rol: "COMERCIAL", label: "Comercial", desc: "Embudo de ventas (prospectos, cotización, contrato)" },
  { rol: "CONTABLE", label: "Contable", desc: "Finanzas (ingresos, egresos, cartera, facturación)" },
];
const ROL_LABEL: Record<Rol, string> = Object.fromEntries(
  ROLES.map((r) => [r.rol, r.label]),
) as Record<Rol, string>;

type Cupo = { rol: Rol; cap: number | null; usados: number };

type Miembro = {
  id: string;
  email: string;
  nombre: string;
  esAdminEmpresa: boolean;
  activo: boolean;
  estado: Estado;
  roles: Rol[];
  createdAt: string;
};

type FormState = {
  email: string;
  nombre: string;
  roles: Rol[];
};

const EMPTY_FORM: FormState = { email: "", nombre: "", roles: ["JURIDICO"] };

const ESTADO_STYLES: Record<Estado, string> = {
  ACTIVO: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  PENDIENTE: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  INACTIVO: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
};

/** Texto de disponibilidad de una silla según el cupo del plan. */
function cupoHint(c: Cupo | undefined): string {
  if (!c || c.cap === 0) return "no incluido en el plan";
  if (c.cap === null) return "ilimitado";
  return `${c.usados}/${c.cap} usado${c.cap === 1 ? "" : "s"}`;
}

/** ¿Hay silla libre para AÑADIR este rol? (no aplica a roles ya asignados). */
function haySilla(c: Cupo | undefined): boolean {
  if (!c) return false;
  if (c.cap === null) return true; // ilimitado
  return c.usados < c.cap;
}

export default function EquipoPage() {
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  const [miId, setMiId] = useState<string | null>(null);

  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [cupos, setCupos] = useState<Record<Rol, Cupo>>({} as Record<Rol, Cupo>);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Modal de creación.
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal de edición de roles.
  const [editar, setEditar] = useState<Miembro | null>(null);
  const [editRoles, setEditRoles] = useState<Rol[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Enlace de activación a compartir manualmente (no hay envío por email aún).
  const [link, setLink] = useState<{ url: string; nombre: string } | null>(null);

  // Confirmación (modal acorde al portal, en vez de window.confirm).
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmText: string;
    danger: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  async function ejecutarConfirm() {
    if (!confirm) return;
    setConfirmBusy(true);
    setError(null);
    try {
      await confirm.onConfirm();
      setConfirm(null);
    } catch (err) {
      setConfirm(null);
      setError(errorMessage(err, "Error"));
    } finally {
      setConfirmBusy(false);
    }
  }

  useEffect(() => {
    const u = getUser();
    setEsAdmin(!!u?.esAdminEmpresa);
    setMiId(u?.id ?? null);
  }, []);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const [ms, cs] = await Promise.all([
        api.get<Miembro[]>("/mi-empresa/usuarios"),
        api.get<Cupo[]>("/mi-empresa/cupos"),
      ]);
      setMiembros(ms);
      setCupos(Object.fromEntries(cs.map((c) => [c.rol, c])) as Record<Rol, Cupo>);
    } catch (err) {
      setError(errorMessage(err, "Error al cargar"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (esAdmin) cargar();
  }, [esAdmin]);

  // Filtro de texto (nombre/email), prellenado desde ?q= (búsqueda global).
  const [filtro, setFiltro] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setFiltro(q);
  }, []);
  const miembrosVisibles = (() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return miembros;
    return miembros.filter(
      (m) => m.nombre.toLowerCase().includes(t) || m.email.toLowerCase().includes(t),
    );
  })();

  function abrirCrear() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function toggleRol(roles: Rol[], rol: Rol): Rol[] {
    return roles.includes(rol) ? roles.filter((r) => r !== rol) : [...roles, rol];
  }

  async function crear() {
    setFormError(null);
    const faltan: string[] = [];
    if (!form.nombre.trim()) faltan.push("Nombre");
    if (!form.email.trim()) faltan.push("Correo");
    if (form.roles.length === 0) faltan.push("Roles");
    if (faltan.length) {
      setFormError(`Completa los campos obligatorios: ${faltan.join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      const { user, activationUrl } = await api.post<{
        user: Miembro;
        activationUrl: string;
      }>("/mi-empresa/usuarios", {
        email: form.email.trim(),
        nombre: form.nombre.trim(),
        roles: form.roles,
      });
      setFormOpen(false);
      await cargar();
      setLink({ url: activationUrl, nombre: user.nombre });
    } catch (err) {
      setFormError(
        errorMessage(err, "Error al crear el usuario"),
      );
    } finally {
      setSaving(false);
    }
  }

  function abrirEditarRoles(m: Miembro) {
    setEditar(m);
    setEditRoles(m.roles);
    setEditError(null);
  }

  async function guardarRoles() {
    if (!editar) return;
    if (editRoles.length === 0) {
      setEditError("Selecciona al menos un rol");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await api.patch(`/mi-empresa/usuarios/${editar.id}`, { roles: editRoles });
      setEditar(null);
      await cargar();
      setAviso(`Roles de "${editar.nombre}" actualizados.`);
    } catch (err) {
      setEditError(
        errorMessage(err, "Error al actualizar los roles"),
      );
    } finally {
      setEditSaving(false);
    }
  }

  // Aplica el cambio de estado. Lanza en error para que el modal lo capture.
  async function aplicarActivo(m: Miembro) {
    await api.patch(`/mi-empresa/usuarios/${m.id}`, { activo: !m.activo });
    await cargar();
    setAviso(`Usuario ${m.activo ? "desactivado" : "activado"}.`);
  }

  function alternarActivo(m: Miembro) {
    setAviso(null);
    setError(null);
    // Activar no es destructivo → sin confirmación. Desactivar sí pregunta.
    if (!m.activo) {
      aplicarActivo(m).catch((err) =>
        setError(errorMessage(err, "Error al activar el usuario")),
      );
      return;
    }
    setConfirm({
      title: "Desactivar usuario",
      message: `Se desactivará a "${m.nombre}". No podrá iniciar sesión y se cerrará su sesión activa. ¿Continuar?`,
      confirmText: "Desactivar",
      danger: true,
      onConfirm: () => aplicarActivo(m),
    });
  }

  // Regenera el enlace de activación (reenvío / restablecer). Lanza en error.
  async function generarEnlace(m: Miembro) {
    const { activationUrl } = await api.post<{ activationUrl: string }>(
      `/mi-empresa/usuarios/${m.id}/activation`,
      {},
    );
    await cargar();
    setLink({ url: activationUrl, nombre: m.nombre });
  }

  function reenviarEnlace(m: Miembro) {
    setAviso(null);
    setError(null);
    setConfirm({
      title: "Reenviar enlace",
      message: `Se generará un enlace de activación nuevo para "${m.nombre}". El enlace anterior y su sesión activa dejarán de servir. ¿Continuar?`,
      confirmText: "Generar enlace",
      danger: false,
      onConfirm: () => generarEnlace(m),
    });
  }

  // Restablecer la contraseña de un miembro ya activado: regenera el enlace de
  // activación (mismo endpoint que el reenvío), revocando su sesión y el enlace
  // anterior. Equivale al "Restablecer contraseña" del panel ADMIN.
  function restablecerPassword(m: Miembro) {
    setAviso(null);
    setError(null);
    setConfirm({
      title: "Restablecer contraseña",
      message: `Se generará un nuevo enlace de activación para "${m.nombre}". El enlace anterior y su sesión activa dejarán de servir. ¿Continuar?`,
      confirmText: "Generar enlace",
      danger: false,
      onConfirm: () => generarEnlace(m),
    });
  }

  async function copiarLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setAviso("Enlace copiado al portapapeles.");
    } catch {
      setAviso("No se pudo copiar automáticamente. Cópialo manualmente.");
    }
  }

  // La API es la autoridad (403 a no-admins); la UI solo evita mostrar la pantalla.
  if (esAdmin === false) {
    return (
      <div>
        <PageHeader title="Equipo" subtitle="Gestión de los usuarios de tu empresa." />
        <EmptyState
          title="Acceso restringido"
          description="Solo el administrador de la empresa puede gestionar el equipo."
        />
      </div>
    );
  }

  // Selector de roles (checkboxes) reutilizado por crear y editar. `actuales` son
  // los roles que el miembro ya tiene (siempre des-marcables aunque la silla esté
  // llena); un rol no asignado solo se puede marcar si hay silla libre.
  function SelectorRoles({
    seleccionados,
    actuales,
    bloquearAdministrador,
    onToggle,
  }: {
    seleccionados: Rol[];
    actuales: Rol[];
    bloquearAdministrador: boolean;
    onToggle: (rol: Rol) => void;
  }) {
    return (
      <div className="space-y-2">
        {ROLES.map(({ rol, label, desc }) => {
          const c = cupos[rol];
          const marcado = seleccionados.includes(rol);
          const yaLoTiene = actuales.includes(rol);
          const lockSelf = bloquearAdministrador && rol === "ADMINISTRADOR" && marcado;
          // Deshabilitado si: no lo tiene y no hay silla, o es el auto-admin bloqueado.
          const disabled = lockSelf || (!yaLoTiene && !marcado && !haySilla(c));
          return (
            <label
              key={rol}
              className={`flex items-start gap-3 rounded-lg border p-3 ${
                disabled
                  ? "cursor-not-allowed border-slate-100 dark:border-slate-800 opacity-60"
                  : "cursor-pointer border-slate-200 dark:border-slate-700"
              } ${marcado ? "bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700" : ""}`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-indigo-600"
                checked={marcado}
                disabled={disabled}
                onChange={() => onToggle(rol)}
              />
              <span className="flex-1">
                <span className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
                  <span className="text-xs text-slate-400">{cupoHint(c)}</span>
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{desc}</span>
                {lockSelf && (
                  <span className="block text-xs text-amber-600 dark:text-amber-400">
                    No puedes quitarte tu propio rol Administrador.
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Equipo"
        subtitle="Crea y administra los usuarios de tu empresa."
        action={
          <Button onClick={abrirCrear}>
            <PlusIcon />
            Invitar usuario
          </Button>
        }
      />

      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
          {error}{" "}
          <button onClick={cargar} className="font-medium underline">
            reintentar
          </button>
        </Card>
      )}
      {aviso && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 text-sm text-emerald-700 dark:text-emerald-300">
          {aviso}
        </Card>
      )}

      {!loading && miembros.length > 0 && (
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          className="mb-4 w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        />
      )}

      {loading ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">Cargando…</Card>
      ) : miembros.length === 0 ? (
        <EmptyState
          title="Sin usuarios todavía"
          description="Invita al primer miembro de tu equipo. Recibirá un enlace para definir su contraseña."
          action={
            <Button onClick={abrirCrear}>
              <PlusIcon />
              Invitar usuario
            </Button>
          }
        />
      ) : miembrosVisibles.length === 0 ? (
        <Card className="text-sm text-slate-500 dark:text-slate-400">
          Ningún miembro coincide con “{filtro}”.
        </Card>
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Roles</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {miembrosVisibles.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-800 dark:text-slate-100">
                      {m.nombre}
                      {m.id === miId && (
                        <span className="ml-2 text-xs font-normal text-slate-400">(tú)</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{m.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {m.roles.length === 0 ? (
                        <span className="text-xs text-slate-400">Sin roles</span>
                      ) : (
                        m.roles.map((r) => (
                          <span
                            key={r}
                            className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300"
                          >
                            {ROL_LABEL[r] ?? r}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_STYLES[m.estado]}`}>
                      {m.estado}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => abrirEditarRoles(m)}
                      className="mr-4 font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                    >
                      Editar roles
                    </button>
                    {m.estado === "PENDIENTE" ? (
                      <button
                        onClick={() => reenviarEnlace(m)}
                        className="mr-4 font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                      >
                        Reenviar enlace
                      </button>
                    ) : (
                      m.id !== miId && (
                        <button
                          onClick={() => restablecerPassword(m)}
                          className="mr-4 font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                        >
                          Restablecer contraseña
                        </button>
                      )
                    )}
                    {m.id !== miId && (
                      <button
                        onClick={() => alternarActivo(m)}
                        className={
                          m.activo
                            ? "font-medium text-red-600 dark:text-red-400 hover:text-red-500"
                            : "font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
                        }
                      >
                        {m.activo ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setFormOpen(false);
          }}
        >
          <Card className="w-full max-w-md">
            <h3 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
              Invitar usuario
            </h3>

            <div className="space-y-3">
              <Field label="Correo" requerido>
                <Input
                  type="text"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  placeholder="usuario@empresa.com"
                />
              </Field>

              <Field label="Nombre" requerido>
                <Input
                  value={form.nombre}
                  onChange={(v) => setForm({ ...form, nombre: v })}
                  placeholder="Nombre y apellido"
                />
              </Field>

              <div>
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Roles<span className="ml-0.5 text-red-500">*</span>
                </span>
                <SelectorRoles
                  seleccionados={form.roles}
                  actuales={[]}
                  bloquearAdministrador={false}
                  onToggle={(rol) => setForm({ ...form, roles: toggleRol(form.roles, rol) })}
                />
              </div>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={crear} disabled={saving}>
                {saving ? "Creando…" : "Crear y generar enlace"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {editar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget && !editSaving) setEditar(null);
          }}
        >
          <Card className="w-full max-w-md">
            <h3 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
              Editar roles
            </h3>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{editar.nombre}</p>

            <SelectorRoles
              seleccionados={editRoles}
              actuales={editar.roles}
              bloquearAdministrador={editar.id === miId}
              onToggle={(rol) => setEditRoles(toggleRol(editRoles, rol))}
            />

            {editError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{editError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditar(null)} disabled={editSaving}>
                Cancelar
              </Button>
              <Button onClick={guardarRoles} disabled={editSaving}>
                {editSaving ? "Guardando…" : "Guardar roles"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {link && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60">
          <Card className="w-full max-w-lg">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Enlace de activación
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Comparte este enlace con <strong>{link.nombre}</strong> para que defina su
              contraseña. Es de un solo uso y vence en 48 horas.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2">
              <input
                readOnly
                value={link.url}
                onFocus={(e) => e.target.select()}
                className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none"
              />
              <Button onClick={copiarLink}>Copiar</Button>
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="ghost" onClick={() => setLink(null)}>
                Cerrar
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmText={confirm?.confirmText}
        danger={confirm?.danger}
        busy={confirmBusy}
        onConfirm={ejecutarConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
