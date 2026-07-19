"use client";

import { useQuery } from "@tanstack/react-query";

import { PanelCamas, type CamaPanelData } from "@/components/layout/panel-camas";
import type { EstadoCama } from "@/components/layout/cama-card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface VoluntarioPanel {
  id: string;
  nombres: string;
  apellidoP: string;
  correlativo: number;
}

interface CamaPanelResponse {
  numeroCama: number;
  voluntarioTitular: VoluntarioPanel | null;
  voluntarioEfectivo: VoluntarioPanel | null;
  estado: EstadoCama | null;
}

interface PanelResponse {
  fecha: string;
  citacionId: string | null;
  camas: CamaPanelResponse[];
}

function hoyISO(): string {
  const ahora = new Date();
  const offset = ahora.getTimezoneOffset();
  return new Date(ahora.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export default function InicioPage() {
  const fecha = hoyISO();
  const hoy = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["citaciones", "panel", fecha],
    queryFn: () => api.get<PanelResponse>(`/citaciones/panel?fecha=${fecha}`),
  });

  const camas: CamaPanelData[] =
    data?.camas.map((cama) => ({
      numeroCama: cama.numeroCama,
      estado: cama.estado ?? "VACIA",
      voluntario: cama.voluntarioEfectivo,
    })) ?? [];

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="flex justify-center md:block md:shrink-0">
        <div className="flex flex-col gap-3">
          <PanelCamas camas={camas} />

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Leyenda color="#BFE3C6" label="Duerme" />
            <Leyenda color="#4F9A6A" label="Reemplazo" />
            <Leyenda color="#7C1420" label="Permiso especial" />
            <Leyenda color="#E8B94D" label="Permiso" />
            <Leyenda color="#B79AE0" label="Licencia" />
            <Leyenda color="#E38B4E" label="Override" />
            <Leyenda color="#7FB3E0" label="Conductor" />
            <Leyenda color="transparent" label="Vacía" />
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold">Panel de la noche</h1>
        <p className="text-sm text-muted-foreground capitalize">{hoy}</p>
        {isLoading && <p className="mt-2 text-sm text-muted-foreground">Cargando panel…</p>}
        {isError && <p className="mt-2 text-sm text-destructive">No se pudo cargar el panel de camas</p>}
        {data && !data.citacionId && (
          <p className="mt-2 text-sm text-muted-foreground">No hay citación ni asignación para hoy.</p>
        )}
      </div>
    </div>
  );
}

function Leyenda({ color, label }: { color: string; label: string }) {
  const vacia = color === "transparent";
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn("size-3 rounded-sm border", vacia ? "border-dashed border-border bg-background" : "border-border")}
        style={vacia ? undefined : { backgroundColor: color }}
      />
      {label}
    </span>
  );
}
