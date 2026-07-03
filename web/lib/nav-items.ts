import { BookOpen, CalendarDays, ClipboardList, Home, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/citaciones", label: "Citaciones", icon: CalendarDays },
  { href: "/permisos", label: "Permisos", icon: ClipboardList },
  { href: "/voluntarios", label: "Voluntarios", icon: Users },
  {
    href: "/libro-de-guardia",
    label: "Libro de Guardia",
    icon: BookOpen,
    roles: ["JEFE_GUARDIA", "ADMIN"],
  },
];

export function navItemsParaRoles(roles: string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.some((rol) => roles.includes(rol)));
}
