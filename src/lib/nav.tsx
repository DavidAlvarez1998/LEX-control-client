import type { ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean; // solo visible para el admin de la empresa (esAdminEmpresa)
  // Roles de empresa (RolEmpresa) que ven el ítem. El admin de empresa los ve
  // todos. Sin `roles` ni `adminOnly` ⇒ visible para todos (ítems base).
  roles?: string[];
};

const ic = "h-5 w-5 shrink-0";

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/inicio",
    label: "Inicio",
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
        <path d="M9 20v-6h6v6" />
      </svg>
    ),
  },
  {
    href: "/clientes",
    label: "Clientes",
    roles: ["COMERCIAL", "JURIDICO"],
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    ),
  },
  {
    href: "/agenda",
    label: "Agenda",
    // Sin `roles`: la agenda está disponible para TODO usuario del despacho.
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
  },
  {
    href: "/procesos",
    label: "Procesos",
    roles: ["JURIDICO", "COMERCIAL"],
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M5 3h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M9 13h6M9 17h6" />
      </svg>
    ),
  },
  {
    href: "/peticiones",
    label: "Peticiones",
    roles: ["JURIDICO"], // trámites ante entidad (DdP, etc.); el admin de empresa lo ve por defecto
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
        <path d="M14 4v5h5" />
        <path d="M8 13h6M8 17h4" />
      </svg>
    ),
  },
  {
    href: "/acciones-constitucionales",
    label: "Acciones Constitucionales",
    roles: ["JURIDICO"], // tutela, popular, grupo, cumplimiento; el admin de empresa lo ve por defecto
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 4 6v5c0 4 3.5 7 8 8 4.5-1 8-4 8-8V6l-8-3Z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/servicios",
    label: "Servicios",
    adminOnly: true,
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.7 2.7-2-2 2.7-2.7Z" />
      </svg>
    ),
  },
  {
    href: "/contable",
    label: "Contable",
    roles: ["CONTABLE"],
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </svg>
    ),
  },
  {
    href: "/facturacion",
    label: "Facturación",
    roles: ["CONTABLE"],
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2h9l3 3v17l-3-1.5L12 22l-3-1.5L6 22Z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </svg>
    ),
  },
  {
    href: "/contratos",
    label: "Contratos",
    adminOnly: true,
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M5 3h9l5 5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M9 12h6M9 16h4" />
        <circle cx="8" cy="9" r="1" />
      </svg>
    ),
  },
  {
    href: "/equipo",
    label: "Equipo",
    adminOnly: true,
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/cuenta",
    label: "Mi Cuenta",
    icon: (
      <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    ),
  },
];
