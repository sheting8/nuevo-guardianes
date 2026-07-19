"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

type TipoNotificacion =
  | "CHECKLIST_VENCIDO"
  | "PERMISO_SOLICITADO"
  | "PERMISO_APROBADO"
  | "PERMISO_RECHAZADO";

interface Notificacion {
  id: string;
  voluntarioId: string;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string;
  datos?: Record<string, unknown>;
  leida: boolean;
  createdAt: string;
}

const TIPO_LABEL: Record<TipoNotificacion, string> = {
  CHECKLIST_VENCIDO: "Checklist vencido",
  PERMISO_SOLICITADO: "Permiso solicitado",
  PERMISO_APROBADO: "Permiso aprobado",
  PERMISO_RECHAZADO: "Permiso rechazado",
};

function formatearRelativo(fecha: string): string {
  const diffMs = Date.now() - new Date(fecha).getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin < 1) return "Recién";
  if (diffMin < 60) return `Hace ${diffMin} min`;

  const diffHoras = Math.round(diffMin / 60);
  if (diffHoras < 24) return `Hace ${diffHoras} h`;

  const diffDias = Math.round(diffHoras / 24);
  if (diffDias < 7) return `Hace ${diffDias} d`;

  return new Date(fecha).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function NotificacionesPage() {
  const queryClient = useQueryClient();

  const notificacionesQuery = useQuery({
    queryKey: ["notificaciones", "lista"],
    queryFn: () => api.getPaginated<Notificacion>("/notificaciones?limit=50"),
  });

  function invalidarNotificaciones() {
    void queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
  }

  const marcarTodas = useMutation({
    mutationFn: () => api.patch("/notificaciones/leer-todas"),
    onSuccess: invalidarNotificaciones,
  });

  const hayNoLeidas = notificacionesQuery.data?.data.some((n) => !n.leida) ?? false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Notificaciones</h1>
          <p className="text-sm text-muted-foreground">Avisos de checklists, permisos y solicitudes</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hayNoLeidas || marcarTodas.isPending}
          onClick={() => marcarTodas.mutate()}
        >
          {marcarTodas.isPending ? "Marcando…" : "Marcar todas como leídas"}
        </Button>
      </div>

      {notificacionesQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {notificacionesQuery.isError && (
        <p className="text-sm text-destructive">No se pudo cargar el listado de notificaciones</p>
      )}
      {notificacionesQuery.data && (
        <ListadoNotificaciones
          notificaciones={notificacionesQuery.data.data}
          onCambio={invalidarNotificaciones}
        />
      )}
    </div>
  );
}

function ListadoNotificaciones({
  notificaciones,
  onCambio,
}: {
  notificaciones: Notificacion[];
  onCambio: () => void;
}) {
  if (notificaciones.length === 0) {
    return <p className="text-sm text-muted-foreground">No tienes notificaciones.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {notificaciones.map((n) => (
        <FilaNotificacion key={n.id} notificacion={n} onCambio={onCambio} />
      ))}
    </div>
  );
}

function FilaNotificacion({ notificacion, onCambio }: { notificacion: Notificacion; onCambio: () => void }) {
  const marcarLeida = useMutation({
    mutationFn: () => api.patch(`/notificaciones/${notificacion.id}/leer`),
    onSuccess: onCambio,
  });

  return (
    <Card
      className={notificacion.leida ? undefined : "cursor-pointer border-primary/40 bg-primary/5"}
      onClick={() => {
        if (!notificacion.leida) marcarLeida.mutate();
      }}
    >
      <CardContent className="flex flex-col gap-1.5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {!notificacion.leida && <span className="size-2 shrink-0 rounded-full bg-primary" />}
            <p className="font-medium">{notificacion.titulo}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{TIPO_LABEL[notificacion.tipo]}</Badge>
            <span className="text-xs text-muted-foreground">{formatearRelativo(notificacion.createdAt)}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{notificacion.cuerpo}</p>
      </CardContent>
    </Card>
  );
}
