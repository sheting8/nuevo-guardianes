import {
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Contact,
  FileText,
  Home,
  Package,
  ShieldCheck,
  Truck,
  Users,
  Users2,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
  // Sin group => se muestra suelto, antes de cualquier sección (p. ej. Inicio).
  group?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },

  // Guardia — operación diaria.
  { href: "/citaciones", label: "Citaciones", icon: CalendarDays, group: "Guardia" },
  { href: "/permisos", label: "Permisos", icon: ClipboardList, group: "Guardia" },
  {
    href: "/libro-de-guardia",
    label: "Libro de Guardia",
    icon: BookOpen,
    roles: ["JEFE_GUARDIA", "ADMIN"],
    group: "Guardia",
  },
  {
    href: "/estadisticas",
    label: "Estadísticas",
    icon: BarChart3,
    roles: ["JEFE_GUARDIA", "ADMIN"],
    group: "Guardia",
  },

  // Administración — gestión y configuración.
  { href: "/voluntarios", label: "Voluntarios", icon: Users, group: "Administración" },
  {
    href: "/rbac",
    label: "Permisos de acceso",
    icon: ShieldCheck,
    roles: ["ADMIN"],
    group: "Administración",
  },
  { href: "/inventario", label: "Inventario", icon: Package, group: "Administración" },
  { href: "/checklists", label: "Checklists", icon: ClipboardCheck, group: "Administración" },
  { href: "/carros", label: "Carros", icon: Truck, group: "Administración" },
  { href: "/turnos", label: "Turnos", icon: Users2, group: "Administración" },
  { href: "/cuarteleros", label: "Cuarteleros", icon: Contact, group: "Administración" },
  { href: "/oficialidad", label: "Oficialidad", icon: Award, group: "Administración" },
  {
    href: "/documentos",
    label: "Documentos",
    icon: FileText,
    roles: ["JEFE_GUARDIA", "ADMIN"],
    group: "Administración",
  },
];

export function navItemsParaRoles(roles: string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.some((rol) => roles.includes(rol)));
}

// La barra inferior (mobile) sólo tiene espacio para unos pocos items — se
// elige explícitamente en vez de tomar los primeros N de NAV_ITEMS, que ahora
// están ordenados por grupo (Guardia/Administración) para el sidebar y ya no
// reflejan qué es más prioritario para un acceso rápido en mobile.
const BOTTOM_NAV_PRIORITY = [
  "/",
  "/citaciones",
  "/permisos",
  "/voluntarios",
  "/inventario",
];

export function bottomNavItemsParaRoles(roles: string[], max = 5): NavItem[] {
  const disponibles = navItemsParaRoles(roles);
  const porHref = new Map(disponibles.map((item) => [item.href, item]));

  const priorizados = BOTTOM_NAV_PRIORITY.map((href) => porHref.get(href)).filter(
    (item): item is NavItem => !!item,
  );
  const resto = disponibles.filter((item) => !BOTTOM_NAV_PRIORITY.includes(item.href));

  return [...priorizados, ...resto].slice(0, max);
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/** Agrupa preservando el orden de NAV_ITEMS — cada grupo aparece una sola
 * vez, en la posición de su primer item. */
export function agruparNavItems(items: NavItem[]): NavGroup[] {
  const grupos: NavGroup[] = [];
  const indicePorLabel = new Map<string | null, number>();

  for (const item of items) {
    const label = item.group ?? null;
    let indice = indicePorLabel.get(label);
    if (indice === undefined) {
      indice = grupos.length;
      indicePorLabel.set(label, indice);
      grupos.push({ label, items: [] });
    }
    grupos[indice].items.push(item);
  }

  return grupos;
}
