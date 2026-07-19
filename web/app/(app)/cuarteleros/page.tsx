"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

type Clave = "C-1" | "C-2" | "C-3";

interface Cuartelero {
  id: string;
  nombre: string;
  clave: Clave;
  nacimiento: string | null;
  fechaIngreso: string | null;
  vigente: boolean;
}

const CLAVES: Clave[] = ["C-1", "C-2", "C-3"];

export default function CuartelerosPage() {
  const queryClient = useQueryClient();
  const [soloVigentes, setSoloVigentes] = useState(true);

  const cuartelerosQuery = useQuery({
    queryKey: ["cuarteleros", soloVigentes],
    queryFn: () => api.get<Cuartelero[]>(`/cuarteleros?vigente=${soloVigentes}`),
  });

  function invalidar() {
    void queryClient.invalidateQueries({ queryKey: ["cuarteleros"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Cuarteleros</h1>
          <p className="text-sm text-muted-foreground">Mantenedor de cuarteleros CBS</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={soloVigentes}
            onChange={(e) => setSoloVigentes(e.target.checked)}
          />
          Solo vigentes
        </label>
      </div>

      <NuevoCuarteleroForm onCreado={invalidar} />

      {cuartelerosQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {cuartelerosQuery.isError && (
        <p className="text-sm text-destructive">No se pudo cargar el listado de cuarteleros</p>
      )}
      {cuartelerosQuery.data && cuartelerosQuery.data.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay cuarteleros registrados.</p>
      )}
      {cuartelerosQuery.data?.map((c) => (
        <FilaCuartelero key={c.id} cuartelero={c} onCambio={invalidar} />
      ))}
    </div>
  );
}

function NuevoCuarteleroForm({ onCreado }: { onCreado: () => void }) {
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState<Clave>("C-1");
  const [nacimiento, setNacimiento] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState("");
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: () =>
      api.post("/cuarteleros", {
        nombre,
        clave,
        nacimiento: nacimiento || undefined,
        fechaIngreso: fechaIngreso || undefined,
      }),
    onSuccess: () => {
      setError(null);
      setNombre("");
      setNacimiento("");
      setFechaIngreso("");
      onCreado();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo crear el cuartelero"),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <p className="text-sm font-medium">Nuevo cuartelero</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cNombre">Nombre</Label>
            <Input id="cNombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cClave">Clave</Label>
            <select
              id="cClave"
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={clave}
              onChange={(e) => setClave(e.target.value as Clave)}
            >
              {CLAVES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cNacimiento">Nacimiento (opcional)</Label>
            <Input id="cNacimiento" type="date" value={nacimiento} onChange={(e) => setNacimiento(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cIngreso">Fecha de ingreso (opcional)</Label>
            <Input
              id="cIngreso"
              type="date"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div>
          <Button type="button" disabled={!nombre || crear.isPending} onClick={() => crear.mutate()}>
            {crear.isPending ? "Creando…" : "Crear cuartelero"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FilaCuartelero({ cuartelero, onCambio }: { cuartelero: Cuartelero; onCambio: () => void }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(cuartelero.nombre);
  const [clave, setClave] = useState<Clave>(cuartelero.clave);
  const [error, setError] = useState<string | null>(null);

  const actualizar = useMutation({
    mutationFn: () => api.patch(`/cuarteleros/${cuartelero.id}`, { nombre, clave }),
    onSuccess: () => {
      setError(null);
      setEditando(false);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo actualizar el cuartelero"),
  });

  const cambiarVigencia = useMutation({
    mutationFn: () => api.patch(`/cuarteleros/${cuartelero.id}`, { vigente: !cuartelero.vigente }),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo actualizar la vigencia"),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/cuarteleros/${cuartelero.id}`),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo eliminar el cuartelero"),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {editando ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-48" />
              <select
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                value={clave}
                onChange={(e) => setClave(e.target.value as Clave)}
              >
                {CLAVES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" disabled={!nombre || actualizar.isPending} onClick={() => actualizar.mutate()}>
                Guardar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditando(false);
                  setNombre(cuartelero.nombre);
                  setClave(cuartelero.clave);
                }}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="font-medium">{cuartelero.nombre}</p>
              <Badge variant="secondary">{cuartelero.clave}</Badge>
              <Badge variant={cuartelero.vigente ? "default" : "outline"}>
                {cuartelero.vigente ? "Vigente" : "No vigente"}
              </Badge>
            </div>
          )}

          {!editando && (
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditando(true)}>
                Editar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={cambiarVigencia.isPending}
                onClick={() => cambiarVigencia.mutate()}
              >
                {cuartelero.vigente ? "Marcar no vigente" : "Marcar vigente"}
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
      </CardContent>
    </Card>
  );
}
