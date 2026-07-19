"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { bottomNavItemsParaRoles } from "@/lib/nav-items";
import { useAuthStore } from "@/lib/store/auth-store";
import { NotificationBell } from "@/components/layout/notification-bell";

export function BottomNav() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const items = bottomNavItemsParaRoles(user?.roles ?? []);

  return (
    <>
      {/* Barra superior sólo para el campanazo de notificaciones — el bottom
          nav ya tiene un tope fijo de MAX_ITEMS y es exclusivamente de
          navegación por rutas, así que no se le agrega un ítem extra ahí. */}
      <div className="fixed inset-x-0 top-0 z-10 flex justify-end border-b border-border bg-card px-2 py-1 md:hidden">
        <NotificationBell />
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-card md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {items.map((item) => {
          const activo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 border-t-2 py-2 text-[11px] font-medium transition-colors",
                activo
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              <span className="truncate px-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
