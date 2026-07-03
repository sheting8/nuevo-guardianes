"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { navItemsParaRoles } from "@/lib/nav-items";
import { useAuthStore } from "@/lib/store/auth-store";

const MAX_ITEMS = 5;

export function BottomNav() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const items = navItemsParaRoles(user?.roles ?? []).slice(0, MAX_ITEMS);

  return (
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
              "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
              activo ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            <span className="truncate px-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
