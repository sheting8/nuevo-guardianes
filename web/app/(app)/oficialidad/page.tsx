"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { api, ApiError } from "@/lib/api";
import { nombreVoluntario, useVoluntariosOpciones, type VoluntarioResumen } from "@/lib/hooks/use-voluntarios-opciones";

interface Oficialidad {
  id: string;
  cargo: string;
  voluntario: VoluntarioResumen;
}

export default function OficialidadPage() {
  const queryClient = useQueryClient();

  const oficialidadQuery = useQuery({
    queryKey: ["oficialidad"],
    queryFn: () => api.get<Oficialidad[]>("/oficialidad"),
  });

  function invalidar() {
    void queryClient.invalidateQueries({ queryKey: ["oficialidad"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Oficialidad</h1>
        <p className="text-sm text-muted-foreground">Mantenedor de cargos de oficialidad</p>
      </div>

      <NuevaOficialidadForm onCreado={invalidar} />

      {oficialidadQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {oficialidadQuery.isError && (
        <p className="text-sm text-destructive">No se pudo cargar el listado de oficialidad</p>
      )}
      {oficialidadQuery.data && oficialidadQuery.data.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay cargos de oficialidad asignados.</p>
      )}
      {oficialidadQuery.data && oficialidadQuery.data.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-4">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4">Voluntario</th>
                  <th className="py-2 pr-4">Cargo</th>
                  <th className="py-2 pr-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {oficialidadQuery.data.map((o) => (
                  <FilaOficialidad key={o.id} oficialidad={o} onCambio={invalidar} />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NuevaOficialidadForm({ onCreado }: { onCreado: () => void }) {
  const [voluntarioId, setVoluntarioId] = useState("");
  const [cargo, setCargo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { opciones, loading } = useVoluntariosOpciones();

  const crear = useMutation({
    mutationFn: () => api.post("/oficialidad", { voluntarioId, cargo }),
    onSuccess: () => {
      setError(null);
      setVoluntarioId("");
      setCargo("");
      onCreado();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo crear el cargo"),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <p className="text-sm font-medium">Nuevo cargo</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ofVoluntario">Voluntario</Label>
            <SearchableSelect
              id="ofVoluntario"
              value={voluntarioId}
              onChange={setVoluntarioId}
              options={opciones}
              loading={loading}
              placeholder="Buscar por nombre o correlativo…"
              emptyText="No se encontraron voluntarios"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ofCargo">Cargo</Label>
            <Input id="ofCargo" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Capitán" />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div>
          <Button type="button" disabled={!voluntarioId || !cargo || crear.isPending} onClick={() => crear.mutate()}>
            {crear.isPending ? "Creando…" : "Asignar cargo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FilaOficialidad({ oficialidad, onCambio }: { oficialidad: Oficialidad; onCambio: () => void }) {
  const [error, setError] = useState<string | null>(null);

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/oficialidad/${oficialidad.id}`),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo eliminar el cargo"),
  });

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4">{nombreVoluntario(oficialidad.voluntario)}</td>
      <td className="py-2 pr-4">{oficialidad.cargo}</td>
      <td className="py-2 pr-4 text-right">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={eliminar.isPending}
          onClick={() => eliminar.mutate()}
        >
          Eliminar
        </Button>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </td>
    </tr>
  );
}
