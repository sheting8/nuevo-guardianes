"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { api, ApiError } from "@/lib/api";
import { nombreVoluntario, useVoluntariosOpciones, type VoluntarioResumen } from "@/lib/hooks/use-voluntarios-opciones";

interface CarroResumen {
  id: string;
  nombre: string;
}

interface CuarteleroResumen {
  id: string;
  nombre: string;
  clave: string;
}

interface CarroDetalle extends CarroResumen {
  voluntarios: { voluntario: VoluntarioResumen }[];
  cuarteleros: { cuartelero: CuarteleroResumen }[];
}

export default function CarrosPage() {
  const queryClient = useQueryClient();

  const carrosQuery = useQuery({
    queryKey: ["carros"],
    queryFn: () => api.get<CarroResumen[]>("/carros"),
  });

  function invalidarCarros() {
    void queryClient.invalidateQueries({ queryKey: ["carros"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Carros</h1>
        <p className="text-sm text-muted-foreground">
          Mantenedor de carros y su dotación de voluntarios y cuarteleros habilitados
        </p>
      </div>

      <NuevoCarroForm onCreado={invalidarCarros} />

      {carrosQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {carrosQuery.isError && <p className="text-sm text-destructive">No se pudo cargar el listado de carros</p>}
      {carrosQuery.data && carrosQuery.data.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay carros creados.</p>
      )}
      {carrosQuery.data?.map((carro) => (
        <FilaCarro key={carro.id} carro={carro} onCambio={invalidarCarros} />
      ))}
    </div>
  );
}

function NuevoCarroForm({ onCreado }: { onCreado: () => void }) {
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: () => api.post("/carros", { nombre }),
    onSuccess: () => {
      setError(null);
      setNombre("");
      onCreado();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo crear el carro"),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <p className="text-sm font-medium">Nuevo carro</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="carroNombre">Nombre</Label>
            <Input
              id="carroNombre"
              className="w-64"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Carro B-1"
            />
          </div>
          <Button type="button" disabled={!nombre || crear.isPending} onClick={() => crear.mutate()}>
            {crear.isPending ? "Creando…" : "Crear carro"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function FilaCarro({ carro, onCambio }: { carro: CarroResumen; onCambio: () => void }) {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(carro.nombre);
  const [voluntarioId, setVoluntarioId] = useState("");
  const [cuarteleroId, setCuarteleroId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { opciones: opcionesVoluntarios, loading: cargandoVoluntarios } = useVoluntariosOpciones();

  const cuarteleroesQuery = useQuery({
    queryKey: ["cuarteleros", "selector"],
    queryFn: () => api.get<CuarteleroResumen[]>("/cuarteleros?vigente=true"),
  });
  const opcionesCuarteleros: SearchableSelectOption[] = (cuarteleroesQuery.data ?? []).map((c) => ({
    value: c.id,
    label: `${c.nombre} (${c.clave})`,
  }));

  const detalleQuery = useQuery({
    queryKey: ["carros", carro.id],
    queryFn: () => api.get<CarroDetalle>(`/carros/${carro.id}`),
  });

  function invalidar() {
    void queryClient.invalidateQueries({ queryKey: ["carros", carro.id] });
    onCambio();
  }

  const actualizar = useMutation({
    mutationFn: () => api.patch(`/carros/${carro.id}`, { nombre }),
    onSuccess: () => {
      setError(null);
      setEditando(false);
      invalidar();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo actualizar el carro"),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/carros/${carro.id}`),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo eliminar el carro"),
  });

  const agregarVoluntario = useMutation({
    mutationFn: () => api.post(`/carros/${carro.id}/voluntarios`, { voluntarioIds: [voluntarioId] }),
    onSuccess: () => {
      setError(null);
      setVoluntarioId("");
      invalidar();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo agregar el voluntario"),
  });

  const quitarVoluntario = useMutation({
    mutationFn: (id: string) => api.delete(`/carros/${carro.id}/voluntarios/${id}`),
    onSuccess: () => {
      setError(null);
      invalidar();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo quitar el voluntario"),
  });

  const agregarCuartelero = useMutation({
    mutationFn: () => api.post(`/carros/${carro.id}/cuarteleros`, { cuarteleroIds: [cuarteleroId] }),
    onSuccess: () => {
      setError(null);
      setCuarteleroId("");
      invalidar();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo agregar el cuartelero"),
  });

  const detalle = detalleQuery.data;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {editando ? (
            <div className="flex items-center gap-2">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-48" />
              <Button
                type="button"
                size="sm"
                disabled={!nombre || actualizar.isPending}
                onClick={() => actualizar.mutate()}
              >
                Guardar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditando(false);
                  setNombre(carro.nombre);
                }}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <p className="font-medium">{carro.nombre}</p>
          )}

          {!editando && (
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditando(true)}>
                Editar
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

        {detalleQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando dotación…</p>}

        {detalle && (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Voluntarios habilitados</p>
              {detalle.voluntarios.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {detalle.voluntarios.map(({ voluntario }) => (
                    <span
                      key={voluntario.id}
                      className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"
                    >
                      {nombreVoluntario(voluntario)}
                      <button
                        type="button"
                        disabled={quitarVoluntario.isPending}
                        onClick={() => quitarVoluntario.mutate(voluntario.id)}
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
                    options={opcionesVoluntarios}
                    loading={cargandoVoluntarios}
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
                  Habilitar
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Cuarteleros habilitados</p>
              {detalle.cuarteleros.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {detalle.cuarteleros.map(({ cuartelero }) => (
                    <Badge key={cuartelero.id} variant="secondary">
                      {cuartelero.nombre} ({cuartelero.clave})
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-64">
                  <SearchableSelect
                    value={cuarteleroId}
                    onChange={setCuarteleroId}
                    options={opcionesCuarteleros}
                    loading={cuarteleroesQuery.isLoading}
                    placeholder="Buscar cuartelero…"
                    emptyText="No se encontraron cuarteleros"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!cuarteleroId || agregarCuartelero.isPending}
                  onClick={() => agregarCuartelero.mutate()}
                >
                  Habilitar
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
