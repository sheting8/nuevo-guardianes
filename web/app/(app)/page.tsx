"use client";

import { useQuery } from "@tanstack/react-query";

import { PanelCamas, type CamaPanelData } from "@/components/layout/panel-camas";
import type { EstadoCama } from "@/components/layout/cama-card";
import { api } from "@/lib/api";

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
      estado: cama.voluntarioEfectivo ? (cama.estado ?? "NORMAL") : "VACIA",
      voluntario: cama.voluntarioEfectivo,
    })) ?? [];

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="flex justify-center md:block md:shrink-0">
        <div className="flex flex-col gap-3">
          <PanelCamas camas={camas} />

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Leyenda color="#86EFAC" label="Duerme" />
            <Leyenda color="#16A34A" label="Reemplazo" />
            <Leyenda color="#EF4444" label="Permiso especial" />
            <Leyenda color="#FDE047" label="Permiso" />
            <Leyenda color="#A855F7" label="Licencia" />
            <Leyenda color="#F97316" label="Override" />
            <Leyenda color="#60A5FA" label="Conductor" />
            <Leyenda color="#374151" label="Vacía" />
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
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded-sm border border-border" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
