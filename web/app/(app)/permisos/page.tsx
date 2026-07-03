"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth-store";

type TipoPermiso = "PERMISO" | "PERMISO_ESPECIAL" | "REEMPLAZO";
type EstadoPermiso = "PENDIENTE" | "APROBADO" | "RECHAZADO";

interface VoluntarioResumen {
  id: string;
  nombres: string;
  apellidoP: string;
  correlativo: number;
}

interface Permiso {
  id: string;
  tipo: TipoPermiso;
  fechaGuardia: string;
  estado: EstadoPermiso;
  comentarios: string | null;
  fechaEnvio: string;
  solicitante: VoluntarioResumen;
  reemplazante: VoluntarioResumen | null;
}

const TIPO_LABEL: Record<TipoPermiso, string> = {
  PERMISO: "Permiso",
  PERMISO_ESPECIAL: "Permiso especial",
  REEMPLAZO: "Reemplazo",
};

const ESTADO_VARIANT: Record<EstadoPermiso, "default" | "secondary" | "outline"> = {
  PENDIENTE: "secondary",
  APROBADO: "default",
  RECHAZADO: "outline",
};

function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function nombreVoluntario(v: VoluntarioResumen): string {
  return `#${v.correlativo} ${v.nombres} ${v.apellidoP}`;
}

export default function PermisosPage() {
  const roles = useAuthStore((s) => s.user?.roles) ?? [];
  const esGestor = roles.includes("JEFE_GUARDIA") || roles.includes("ADMIN");
  const queryClient = useQueryClient();

  const misPermisosQuery = useQuery({
    queryKey: ["permisos", "mis"],
    queryFn: () => api.get<Permiso[]>("/permisos/mis"),
  });

  const todosPermisosQuery = useQuery({
    queryKey: ["permisos", "todos"],
    queryFn: () => api.get<Permiso[]>("/permisos"),
    enabled: esGestor,
  });

  function invalidarTodo() {
    void queryClient.invalidateQueries({ queryKey: ["permisos"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Permisos</h1>
        <p className="text-sm text-muted-foreground">Solicitud, permisos y reemplazos de guardia</p>
      </div>

      <SolicitarPermisoForm onCreado={invalidarTodo} />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Mis solicitudes</h2>
        {misPermisosQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {misPermisosQuery.isError && (
          <p className="text-sm text-destructive">No se pudo cargar tus solicitudes</p>
        )}
        {misPermisosQuery.data && (
          <TablaPermisos permisos={misPermisosQuery.data} mostrarSolicitante={false} onCambio={invalidarTodo} />
        )}
      </div>

      {esGestor && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Gestión de permisos</h2>
          {todosPermisosQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {todosPermisosQuery.isError && (
            <p className="text-sm text-destructive">No se pudo cargar el listado de permisos</p>
          )}
          {todosPermisosQuery.data && (
            <TablaPermisos
              permisos={todosPermisosQuery.data}
              mostrarSolicitante
              gestionable
              onCambio={invalidarTodo}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SolicitarPermisoForm({ onCreado }: { onCreado: () => void }) {
  const [tipo, setTipo] = useState<TipoPermiso>("PERMISO");
  const [fechaGuardia, setFechaGuardia] = useState("");
  const [reemplazanteId, setReemplazanteId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const voluntariosQuery = useQuery({
    queryKey: ["voluntarios", "selector"],
    queryFn: () => api.getPaginated<VoluntarioResumen>("/voluntarios?limit=200&activo=true"),
    enabled: tipo === "REEMPLAZO",
  });

  const crear = useMutation({
    mutationFn: () =>
      api.post("/permisos", {
        tipo,
        fechaGuardia,
        reemplazanteId: tipo === "REEMPLAZO" ? reemplazanteId : undefined,
      }),
    onSuccess: () => {
      setError(null);
      setExito(true);
      setFechaGuardia("");
      setReemplazanteId("");
      onCreado();
    },
    onError: (err) => {
      setExito(false);
      setError(err instanceof ApiError ? err.message : "No se pudo crear la solicitud");
    },
  });

  const puedeEnviar = fechaGuardia && (tipo !== "REEMPLAZO" || reemplazanteId) && !crear.isPending;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <p className="text-sm font-medium">Nueva solicitud</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <select
              id="tipo"
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as TipoPermiso);
                setReemplazanteId("");
              }}
            >
              <option value="PERMISO">Permiso</option>
              <option value="PERMISO_ESPECIAL">Permiso especial</option>
              <option value="REEMPLAZO">Reemplazo</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fechaGuardia">Fecha de guardia</Label>
            <Input
              id="fechaGuardia"
              type="date"
              value={fechaGuardia}
              onChange={(e) => setFechaGuardia(e.target.value)}
            />
          </div>

          {tipo === "REEMPLAZO" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reemplazante">Reemplazante</Label>
              <select
                id="reemplazante"
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                value={reemplazanteId}
                onChange={(e) => setReemplazanteId(e.target.value)}
              >
                <option value="">Seleccionar…</option>
                {voluntariosQuery.data?.data.map((v) => (
                  <option key={v.id} value={v.id}>
                    {nombreVoluntario(v)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {exito && !error && <p className="text-sm text-emerald-600">Solicitud enviada correctamente.</p>}

        <div>
          <Button type="button" disabled={!puedeEnviar} onClick={() => crear.mutate()}>
            {crear.isPending ? "Enviando…" : "Solicitar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TablaPermisos({
  permisos,
  mostrarSolicitante,
  gestionable = false,
  onCambio,
}: {
  permisos: Permiso[];
  mostrarSolicitante: boolean;
  gestionable?: boolean;
  onCambio: () => void;
}) {
  if (permisos.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay solicitudes para mostrar.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {permisos.map((permiso) => (
        <FilaPermiso
          key={permiso.id}
          permiso={permiso}
          mostrarSolicitante={mostrarSolicitante}
          gestionable={gestionable}
          onCambio={onCambio}
        />
      ))}
    </div>
  );
}

function FilaPermiso({
  permiso,
  mostrarSolicitante,
  gestionable,
  onCambio,
}: {
  permiso: Permiso;
  mostrarSolicitante: boolean;
  gestionable: boolean;
  onCambio: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const actualizarEstado = useMutation({
    mutationFn: (estado: "APROBADO" | "RECHAZADO") => api.patch(`/permisos/${permiso.id}`, { estado }),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo actualizar el permiso"),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/permisos/${permiso.id}`),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo eliminar el permiso"),
  });

  const puedeEliminar = gestionable || permiso.estado === "PENDIENTE";

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">
              {TIPO_LABEL[permiso.tipo]} — {formatearFecha(permiso.fechaGuardia)}
            </p>
            {mostrarSolicitante && (
              <p className="text-xs text-muted-foreground">Solicitante: {nombreVoluntario(permiso.solicitante)}</p>
            )}
            {permiso.reemplazante && (
              <p className="text-xs text-muted-foreground">Reemplazante: {nombreVoluntario(permiso.reemplazante)}</p>
            )}
            {permiso.comentarios && (
              <p className="text-xs text-muted-foreground">Comentarios: {permiso.comentarios}</p>
            )}
          </div>
          <Badge variant={ESTADO_VARIANT[permiso.estado]}>{permiso.estado}</Badge>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {gestionable && permiso.estado === "PENDIENTE" && (
            <>
              <Button
                type="button"
                size="sm"
                disabled={actualizarEstado.isPending}
                onClick={() => actualizarEstado.mutate("APROBADO")}
              >
                Aprobar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={actualizarEstado.isPending}
                onClick={() => actualizarEstado.mutate("RECHAZADO")}
              >
                Rechazar
              </Button>
            </>
          )}
          {puedeEliminar && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={eliminar.isPending}
              onClick={() => eliminar.mutate()}
            >
              Eliminar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
