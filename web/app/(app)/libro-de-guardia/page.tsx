"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { EstadoCama } from "@/components/layout/cama-card";
import { PanelCamas, type CamaPanelData } from "@/components/layout/panel-camas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth-store";

interface VoluntarioResumen {
  id: string;
  nombres: string;
  apellidoP: string;
  correlativo: number;
}

interface CamaPanelResponse {
  numeroCama: number;
  voluntarioTitular: VoluntarioResumen | null;
  voluntarioEfectivo: VoluntarioResumen | null;
  estado: EstadoCama | null;
}

interface PanelResponse {
  fecha: string;
  citacionId: string | null;
  camas: CamaPanelResponse[];
}

interface GuardiaNocheResponse {
  mensajero: VoluntarioResumen | null;
  conductores: VoluntarioResumen[];
  jgs: VoluntarioResumen | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function hoyISO(): string {
  const ahora = new Date();
  const offset = ahora.getTimezoneOffset();
  return new Date(ahora.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function nombreVoluntario(v: VoluntarioResumen): string {
  return `#${v.correlativo} ${v.nombres} ${v.apellidoP}`;
}

function nombreODash(v: VoluntarioResumen | null): string {
  return v ? nombreVoluntario(v) : "—";
}

export default function LibroDeGuardiaPage() {
  const [fecha, setFecha] = useState(hoyISO());
  const [camaSeleccionada, setCamaSeleccionada] = useState<number | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  const panelQuery = useQuery({
    queryKey: ["libro-guardia", "panel", fecha],
    queryFn: () => api.get<PanelResponse>(`/citaciones/panel?fecha=${fecha}`),
  });

  const guardiaQuery = useQuery({
    queryKey: ["libro-guardia", "guardia", fecha],
    queryFn: () => api.get<GuardiaNocheResponse>(`/guardia?fecha=${fecha}`),
  });

  function invalidar() {
    void queryClient.invalidateQueries({ queryKey: ["libro-guardia"] });
  }

  const camas: CamaPanelData[] =
    panelQuery.data?.camas.map((cama) => ({
      numeroCama: cama.numeroCama,
      estado: cama.estado ?? "VACIA",
      voluntario: cama.voluntarioEfectivo,
    })) ?? [];

  const camaActiva = panelQuery.data?.camas.find((c) => c.numeroCama === camaSeleccionada) ?? null;

  async function descargarDocx() {
    setErrorDescarga(null);
    setDescargando(true);
    try {
      const res = await fetch(`${API_URL}/documentos/libro-guardia?fecha=${fecha}`, {
        credentials: "include",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) {
        throw new Error("No se pudo generar el documento");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `libro-guardia-${fecha}.docx`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorDescarga("No se pudo descargar el documento");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Libro de Guardia</h1>
          <p className="text-sm text-muted-foreground">Panel de camas, roles nocturnos y correcciones manuales</p>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                setCamaSeleccionada(null);
              }}
            />
          </div>
          <Button type="button" variant="outline" disabled={descargando} onClick={() => void descargarDocx()}>
            {descargando ? "Generando…" : "Descargar .docx"}
          </Button>
        </div>
      </div>

      {errorDescarga && <p className="text-sm text-destructive">{errorDescarga}</p>}

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex justify-center md:block md:shrink-0">
          <div className="flex flex-col gap-2">
            <PanelCamas
              camas={camas}
              camaSeleccionada={camaSeleccionada}
              onSeleccionarCama={(numero) => setCamaSeleccionada((actual) => (actual === numero ? null : numero))}
            />
            <p className="text-xs text-muted-foreground">Haz clic en una cama para corregir si esa persona durmió.</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {panelQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando panel…</p>}
          {panelQuery.isError && <p className="text-sm text-destructive">No se pudo cargar el panel de camas</p>}
          {panelQuery.data && !panelQuery.data.citacionId && (
            <p className="text-sm text-muted-foreground">No hay citación ni asignación para esta fecha.</p>
          )}

          {camaActiva && (
            <OverrideForm
              fecha={fecha}
              cama={camaActiva}
              onGuardado={() => {
                setCamaSeleccionada(null);
                invalidar();
              }}
              onCancelar={() => setCamaSeleccionada(null)}
            />
          )}

          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <p className="text-sm font-semibold">Roles nocturnos</p>
              {guardiaQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
              {guardiaQuery.isError && (
                <p className="text-sm text-destructive">No se pudieron cargar los roles nocturnos</p>
              )}
              {guardiaQuery.data && (
                <div className="flex flex-col gap-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Mensajero: </span>
                    {nombreODash(guardiaQuery.data.mensajero)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Conductores: </span>
                    {guardiaQuery.data.conductores.length
                      ? guardiaQuery.data.conductores.map(nombreVoluntario).join(", ")
                      : "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">JGS Subrogante: </span>
                    {nombreODash(guardiaQuery.data.jgs)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OverrideForm({
  fecha,
  cama,
  onGuardado,
  onCancelar,
}: {
  fecha: string;
  cama: CamaPanelResponse;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const titular = cama.voluntarioTitular;

  const guardar = useMutation({
    mutationFn: (durmio: boolean) =>
      api.post("/libro-guardia/override", { fecha, voluntarioId: titular?.id, durmio }),
    onSuccess: () => {
      setError(null);
      onGuardado();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la corrección");
    },
  });

  if (!titular) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <p className="text-sm text-muted-foreground">La cama #{cama.numeroCama} no tiene titular asignado esa noche.</p>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={onCancelar}>
              Cerrar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Corregir cama #{cama.numeroCama}</p>
          <p className="text-xs text-muted-foreground">
            Titular: {nombreVoluntario(titular)} — estado actual: {cama.estado ?? "NORMAL"}
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={guardar.isPending} onClick={() => guardar.mutate(true)}>
            Marcar que durmió
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={guardar.isPending}
            onClick={() => guardar.mutate(false)}
          >
            Marcar que no durmió
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
