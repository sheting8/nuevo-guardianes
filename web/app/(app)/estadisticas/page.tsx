"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface VoluntarioResumen {
  id: string;
  nombres: string;
  apellidoP: string;
  correlativo: number;
  tipo?: string;
}

interface TotalesNoches {
  noches: number;
  permiso: number;
  permisoEspecial: number;
  reemplazoRecibido: number;
  licencia: number;
  override: number;
}

interface EstadisticaVoluntario {
  voluntario: VoluntarioResumen;
  totales: TotalesNoches;
}

function hoyISO(): string {
  const ahora = new Date();
  const offset = ahora.getTimezoneOffset();
  return new Date(ahora.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function primerDiaDelMesISO(): string {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-01`;
}

function nombreVoluntario(v: VoluntarioResumen): string {
  return `#${v.correlativo} ${v.nombres} ${v.apellidoP}`;
}

export default function EstadisticasPage() {
  const [desde, setDesde] = useState(primerDiaDelMesISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [voluntarioId, setVoluntarioId] = useState("");

  const voluntariosQuery = useQuery({
    queryKey: ["voluntarios", "selector"],
    queryFn: () => api.getPaginated<VoluntarioResumen>("/voluntarios?limit=200&activo=true"),
  });

  const rangoValido = Boolean(desde && hasta && desde <= hasta);

  const estadisticasQuery = useQuery({
    queryKey: ["estadisticas", "noches", desde, hasta, voluntarioId],
    queryFn: () => {
      const params = new URLSearchParams({ desde, hasta });
      if (voluntarioId) {
        params.set("voluntarioId", voluntarioId);
      }
      return api.get<EstadisticaVoluntario[]>(`/estadisticas/noches?${params.toString()}`);
    },
    enabled: rangoValido,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Estadísticas</h1>
        <p className="text-sm text-muted-foreground">Noches, permisos y reemplazos por rango de fechas</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="desde">Desde</Label>
              <Input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hasta">Hasta</Label>
              <Input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="voluntario">Voluntario (opcional)</Label>
              <select
                id="voluntario"
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                value={voluntarioId}
                onChange={(e) => setVoluntarioId(e.target.value)}
              >
                <option value="">Todos</option>
                {voluntariosQuery.data?.data.map((v) => (
                  <option key={v.id} value={v.id}>
                    {nombreVoluntario(v)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!rangoValido && (
            <p className="text-sm text-destructive">La fecha &quot;desde&quot; debe ser anterior o igual a &quot;hasta&quot;.</p>
          )}
        </CardContent>
      </Card>

      {estadisticasQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando estadísticas…</p>}
      {estadisticasQuery.isError && (
        <p className="text-sm text-destructive">No se pudieron cargar las estadísticas</p>
      )}

      {estadisticasQuery.data && <TablaEstadisticas datos={estadisticasQuery.data} />}
    </div>
  );
}

function TablaEstadisticas({ datos }: { datos: EstadisticaVoluntario[] }) {
  if (datos.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay datos para el rango seleccionado.</p>;
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-4">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4">Voluntario</th>
              <th className="py-2 pr-4 text-right">Noches</th>
              <th className="py-2 pr-4 text-right">Permiso</th>
              <th className="py-2 pr-4 text-right">Permiso especial</th>
              <th className="py-2 pr-4 text-right">Reemplazo recibido</th>
              <th className="py-2 pr-4 text-right">Licencia</th>
              <th className="py-2 pr-4 text-right">Override</th>
            </tr>
          </thead>
          <tbody>
            {datos.map(({ voluntario, totales }) => (
              <tr key={voluntario.id} className="border-b border-border last:border-0">
                <td className="py-2 pr-4">{nombreVoluntario(voluntario)}</td>
                <td className="py-2 pr-4 text-right font-medium">{totales.noches}</td>
                <td className="py-2 pr-4 text-right">{totales.permiso}</td>
                <td className="py-2 pr-4 text-right">{totales.permisoEspecial}</td>
                <td className="py-2 pr-4 text-right">{totales.reemplazoRecibido}</td>
                <td className="py-2 pr-4 text-right">{totales.licencia}</td>
                <td className="py-2 pr-4 text-right">{totales.override}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
