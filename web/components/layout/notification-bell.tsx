"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface Notificacion {
  id: string;
}

// Solo nos interesa meta.total (cuántas no leídas hay); limit=1 evita traer
// contenido que no se usa acá, la lista completa vive en /notificaciones.
export function NotificationBell({ className }: { className?: string }) {
  const noLeidasQuery = useQuery({
    queryKey: ["notificaciones", "no-leidas", "conteo"],
    queryFn: () => api.getPaginated<Notificacion>("/notificaciones?leida=false&limit=1"),
    refetchInterval: 60_000,
  });

  const total = noLeidasQuery.data?.meta.total ?? 0;

  return (
    <Link
      href="/notificaciones"
      aria-label={total > 0 ? `Notificaciones (${total} sin leer)` : "Notificaciones"}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      <Bell className="size-5" />
      {total > 0 && (
        <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
          {total > 9 ? "9+" : total}
        </span>
      )}
    </Link>
  );
}
