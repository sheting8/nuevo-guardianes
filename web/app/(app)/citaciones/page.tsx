"use client";

import { type ReactNode, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

interface VoluntarioResumen {
  id: string;
  nombres: string;
  apellidoP: string;
  correlativo: number;
}

interface Turno {
  id: string;
  nombre: string;
  voluntarios: VoluntarioResumen[];
}

interface CamaAsignacion {
  id: string;
  numeroCama: number;
  voluntario: VoluntarioResumen;
}

interface Citacion {
  id: string;
  turnoId: string | null;
  turno: { id: string; nombre: string } | null;
  fechaInicio: string;
  fechaFin: string | null;
  camas: CamaAsignacion[];
}

const NUMEROS_CAMA = Array.from({ length: 18 }, (_, i) => i + 1);

function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function CitacionesPage() {
  const [tab, setTab] = useState<"citacion" | "asignacion">("citacion");
  const [mostrarForm, setMostrarForm] = useState(false);

  const citacionesQuery = useQuery({
    queryKey: ["citaciones", "citacion"],
    queryFn: () => api.getPaginated<Citacion>("/citaciones?tipo=citacion&limit=50"),
  });

  const asignacionesQuery = useQuery({
    queryKey: ["citaciones", "asignacion"],
    queryFn: () => api.getPaginated<Citacion>("/citaciones?tipo=asignacion&limit=50"),
  });

  const activa = tab === "citacion" ? citacionesQuery : asignacionesQuery;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Citaciones</h1>
          <p className="text-sm text-muted-foreground">Citaciones semanales y asignaciones diarias de camas</p>
        </div>
        <Button type="button" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? "Cancelar" : "+ Nueva"}
        </Button>
      </div>

      {mostrarForm && (
        <NuevaCitacionForm
          onCreada={() => {
            setMostrarForm(false);
            void citacionesQuery.refetch();
            void asignacionesQuery.refetch();
          }}
        />
      )}

      <div className="flex gap-2 border-b border-border">
        <TabButton activo={tab === "citacion"} onClick={() => setTab("citacion")}>
          Citaciones semanales
        </TabButton>
        <TabButton activo={tab === "asignacion"} onClick={() => setTab("asignacion")}>
          Asignaciones diarias
        </TabButton>
      </div>

      {activa.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {activa.isError && <p className="text-sm text-destructive">No se pudo cargar el listado</p>}
      {activa.data && <ListadoCitaciones citaciones={activa.data.data} />}
    </div>
  );
}

function TabButton({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        activo ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ListadoCitaciones({ citaciones }: { citaciones: Citacion[] }) {
  if (citaciones.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay registros para mostrar.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {citaciones.map((c) => (
        <Card key={c.id}>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {formatearFecha(c.fechaInicio)}
                  {c.fechaFin ? ` — ${formatearFecha(c.fechaFin)}` : ""}
                </p>
                {c.turno && <p className="text-xs text-muted-foreground">Turno: {c.turno.nombre}</p>}
              </div>
              <Badge variant="secondary">{c.camas.length} camas asignadas</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {c.camas
                .slice()
                .sort((a, b) => a.numeroCama - b.numeroCama)
                .map((cama) => (
                  <span key={cama.id} className="rounded-md border border-border px-2 py-1 text-xs">
                    #{cama.numeroCama} {cama.voluntario.nombres} {cama.voluntario.apellidoP}
                  </span>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NuevaCitacionForm({ onCreada }: { onCreada: () => void }) {
  const [tipo, setTipo] = useState<"citacion" | "asignacion">("citacion");
  const [turnoId, setTurnoId] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [camas, setCamas] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const turnosQuery = useQuery({
    queryKey: ["turnos"],
    queryFn: () => api.get<Turno[]>("/turnos"),
  });

  const voluntariosQuery = useQuery({
    queryKey: ["voluntarios", "selector"],
    queryFn: () => api.getPaginated<VoluntarioResumen>("/voluntarios?limit=200&activo=true"),
  });

  const crear = useMutation({
    mutationFn: () => {
      const camasPayload = Object.entries(camas)
        .filter(([, voluntarioId]) => voluntarioId)
        .map(([numero, voluntarioId]) => ({ numero: Number(numero), voluntarioId }));

      return api.post("/citaciones", {
        turnoId: turnoId || undefined,
        fechaInicio,
        fechaFin: tipo === "citacion" ? fechaFin : undefined,
        camas: camasPayload,
      });
    },
    onSuccess: () => {
      setError(null);
      onCreada();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el registro");
    },
  });

  const camasSeleccionadas = Object.values(camas).some((v) => v);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={tipo === "citacion"} onChange={() => setTipo("citacion")} />
            Citación semanal
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={tipo === "asignacion"} onChange={() => setTipo("asignacion")} />
            Asignación diaria
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="turno">Turno (opcional)</Label>
            <select
              id="turno"
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={turnoId}
              onChange={(e) => setTurnoId(e.target.value)}
            >
              <option value="">Sin turno</option>
              {turnosQuery.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fechaInicio">Fecha de inicio</Label>
            <Input
              id="fechaInicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>

          {tipo === "citacion" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fechaFin">Fecha de fin</Label>
              <Input id="fechaFin" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Camas</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {NUMEROS_CAMA.map((numero) => (
              <div key={numero} className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Cama #{numero}</Label>
                <select
                  className="h-11 rounded-md border border-input bg-background px-2 text-sm"
                  value={camas[numero] ?? ""}
                  onChange={(e) => setCamas((prev) => ({ ...prev, [numero]: e.target.value }))}
                >
                  <option value="">— Vacía —</option>
                  {voluntariosQuery.data?.data.map((v) => (
                    <option key={v.id} value={v.id}>
                      #{v.correlativo} {v.nombres} {v.apellidoP}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div>
          <Button
            type="button"
            disabled={!fechaInicio || (tipo === "citacion" && !fechaFin) || !camasSeleccionadas || crear.isPending}
            onClick={() => crear.mutate()}
          >
            {crear.isPending ? "Creando…" : "Crear"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
