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

interface Turno {
  id: string;
  nombre: string;
  voluntarios: VoluntarioResumen[];
}

export default function TurnosPage() {
  const queryClient = useQueryClient();

  const turnosQuery = useQuery({
    queryKey: ["turnos"],
    queryFn: () => api.get<Turno[]>("/turnos"),
  });

  function invalidar() {
    void queryClient.invalidateQueries({ queryKey: ["turnos"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Turnos</h1>
        <p className="text-sm text-muted-foreground">Mantenedor de turnos y sus voluntarios integrantes</p>
      </div>

      <NuevoTurnoForm onCreado={invalidar} />

      {turnosQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {turnosQuery.isError && <p className="text-sm text-destructive">No se pudo cargar el listado de turnos</p>}
      {turnosQuery.data && turnosQuery.data.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay turnos creados.</p>
      )}
      {turnosQuery.data?.map((turno) => (
        <FilaTurno key={turno.id} turno={turno} onCambio={invalidar} />
      ))}
    </div>
  );
}

function NuevoTurnoForm({ onCreado }: { onCreado: () => void }) {
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: () => api.post("/turnos", { nombre, voluntarioIds: [] }),
    onSuccess: () => {
      setError(null);
      setNombre("");
      onCreado();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo crear el turno"),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <p className="text-sm font-medium">Nuevo turno</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="turnoNombre">Nombre</Label>
            <Input
              id="turnoNombre"
              className="w-64"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Turno A"
            />
          </div>
          <Button type="button" disabled={!nombre || crear.isPending} onClick={() => crear.mutate()}>
            {crear.isPending ? "Creando…" : "Crear turno"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Agrega los voluntarios integrantes después de crear el turno.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function FilaTurno({ turno, onCambio }: { turno: Turno; onCambio: () => void }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(turno.nombre);
  const [voluntarioId, setVoluntarioId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { opciones, loading } = useVoluntariosOpciones();

  const renombrar = useMutation({
    mutationFn: () => api.patch(`/turnos/${turno.id}`, { nombre }),
    onSuccess: () => {
      setError(null);
      setEditando(false);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo actualizar el turno"),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/turnos/${turno.id}`),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo eliminar el turno"),
  });

  const idsActuales = turno.voluntarios.map((v) => v.id);

  const agregarVoluntario = useMutation({
    mutationFn: () =>
      api.patch(`/turnos/${turno.id}`, { voluntarioIds: [...idsActuales, voluntarioId] }),
    onSuccess: () => {
      setError(null);
      setVoluntarioId("");
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo agregar el voluntario"),
  });

  const quitarVoluntario = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/turnos/${turno.id}`, { voluntarioIds: idsActuales.filter((v) => v !== id) }),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo quitar el voluntario"),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {editando ? (
            <div className="flex items-center gap-2">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-48" />
              <Button type="button" size="sm" disabled={!nombre || renombrar.isPending} onClick={() => renombrar.mutate()}>
                Guardar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditando(false);
                  setNombre(turno.nombre);
                }}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <p className="font-medium">{turno.nombre}</p>
          )}

          {!editando && (
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditando(true)}>
                Editar nombre
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={eliminar.isPending}
                onClick={() => eliminar.mutate()}
              >
                Eliminar
              </Button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {turno.voluntarios.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {turno.voluntarios.map((v) => (
              <span
                key={v.id}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"
              >
                {nombreVoluntario(v)}
                <button
                  type="button"
                  disabled={quitarVoluntario.isPending}
                  onClick={() => quitarVoluntario.mutate(v.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Quitar voluntario"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-64">
            <SearchableSelect
              value={voluntarioId}
              onChange={setVoluntarioId}
              options={opciones.filter((o) => !idsActuales.includes(o.value))}
              loading={loading}
              placeholder="Buscar voluntario…"
              emptyText="No se encontraron voluntarios"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!voluntarioId || agregarVoluntario.isPending}
            onClick={() => agregarVoluntario.mutate()}
          >
            Agregar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
