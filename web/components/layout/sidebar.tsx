"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { agruparNavItems, navItemsParaRoles } from "@/lib/nav-items";
import { api } from "@/lib/api";
import { eliminarTokenPush } from "@/lib/push";
import { useAuthStore } from "@/lib/store/auth-store";
import { NotificationBell } from "@/components/layout/notification-bell";

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const grupos = agruparNavItems(navItemsParaRoles(user?.roles ?? []));

  async function handleLogout() {
    try {
      await eliminarTokenPush();
    } catch {
      // best-effort, nunca debe bloquear el logout
    }
    try {
      await api.post("/auth/logout", undefined, { skipAuth: true });
    } finally {
      clearAuth();
      router.push("/login");
    }
  }

  return (
    <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-card">
      <div className="flex items-center gap-3 border-b border-border px-4 py-5">
        <Image src="/logo.png" alt="Compañía 15" width={40} height={44} className="shrink-0" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-primary">Guardianes</span>
          <span className="text-xs text-muted-foreground">Compañía 15</span>
        </div>
        <NotificationBell className="ml-auto" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {grupos.map((grupo) => (
          <div key={grupo.label ?? "_sin-grupo"} className="flex flex-col gap-1">
            {grupo.label && (
              <span className="mt-3 px-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase first:mt-1">
                {grupo.label}
              </span>
            )}
            {grupo.items.map((item) => {
              const activo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md border-l-2 px-3 text-sm font-medium transition-colors",
                    activo
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-border px-4 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {user ? iniciales(user.nombre) : "?"}
        </div>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-medium">{user?.nombre ?? "Sin sesión"}</span>
          <span className="truncate text-xs text-muted-foreground">
            {user ? `${user.tipo ?? ""} · #${user.correlativo ?? "-"}` : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
}
