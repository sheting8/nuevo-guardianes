"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface Citacion {
  id: string;
  fechaInicio: string;
  fechaFin: string | null;
  turno: { id: string; nombre: string } | null;
}

function hoyISO(): string {
  const ahora = new Date();
  const offset = ahora.getTimezoneOffset();
  return new Date(ahora.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function DocumentosPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Documentos</h1>
        <p className="text-sm text-muted-foreground">Generación de documentos Word del libro de guardia y conteos</p>
      </div>

      <LibroGuardiaDescarga />
      <ConteoDescarga />
    </div>
  );
}

function LibroGuardiaDescarga() {
  const [fecha, setFecha] = useState(hoyISO());
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    setError(null);
    setDescargando(true);
    try {
      await api.download(`/documentos/libro-guardia?fecha=${fecha}`, `libro-guardia-${fecha}.docx`);
    } catch {
      setError("No se pudo descargar el documento");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-sm font-medium">Libro de guardia</p>
          <p className="text-xs text-muted-foreground">
            Genera el documento Word con el panel de camas, mensajero, conductores y JGS de la noche seleccionada.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fecha-libro">Fecha</Label>
            <Input id="fecha-libro" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <Button type="button" disabled={!fecha || descargando} onClick={() => void descargar()}>
            {descargando ? "Generando…" : "Descargar libro de guardia"}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function ConteoDescarga() {
  const [citacionId, setCitacionId] = useState("");
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const citacionesQuery = useQuery({
    queryKey: ["citaciones", "citacion"],
    queryFn: () => api.getPaginated<Citacion>("/citaciones?tipo=citacion&limit=50"),
  });

  async function descargar() {
    if (!citacionId) return;
    setError(null);
    setDescargando(true);
    try {
      await api.download(`/documentos/conteo?citacionId=${citacionId}`, `conteo-${citacionId}.docx`);
    } catch {
      setError("No se pudo descargar el documento");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-sm font-medium">Conteo de citación</p>
          <p className="text-xs text-muted-foreground">
            Genera el documento Word con la tabla de voluntarios y noches efectivas de la citación seleccionada.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="citacion">Citación</Label>
            <select
              id="citacion"
              className="h-11 min-w-[240px] rounded-md border border-input bg-background px-3 text-sm"
              value={citacionId}
              onChange={(e) => setCitacionId(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {citacionesQuery.data?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatearFecha(c.fechaInicio)}
                  {c.fechaFin ? ` — ${formatearFecha(c.fechaFin)}` : ""}
                  {c.turno ? ` (${c.turno.nombre})` : ""}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" disabled={!citacionId || descargando} onClick={() => void descargar()}>
            {descargando ? "Generando…" : "Descargar conteo"}
          </Button>
        </div>

        {citacionesQuery.isError && (
          <p className="text-sm text-destructive">No se pudo cargar el listado de citaciones</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
