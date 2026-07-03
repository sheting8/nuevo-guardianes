"use client";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

interface Voluntario {
  id: string;
  correlativo: number;
  tipo: "QUINCE" | "CONFEDERADO";
  activo: boolean;
  nombres: string;
  apellidoP: string;
  apellidoM: string | null;
  email: string;
  telefono: string | null;
}

export default function VoluntariosPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["voluntarios"],
    queryFn: () => api.getPaginated<Voluntario>("/voluntarios?limit=50"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Voluntarios</h1>
        <p className="text-sm text-muted-foreground">
          {data ? `${data.meta.total} voluntarios registrados` : "Listado de la compañía"}
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {isError && <p className="text-sm text-destructive">No se pudo cargar el listado de voluntarios</p>}

      {data && <VoluntariosTabla voluntarios={data.data} />}
    </div>
  );
}

function VoluntariosTabla({ voluntarios }: { voluntarios: Voluntario[] }) {
  if (voluntarios.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay voluntarios para mostrar.</p>;
  }

  return (
    <>
      {/* Desktop: tabla */}
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Correlativo</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Correo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {voluntarios.map((voluntario) => (
              <tr key={voluntario.id}>
                <td className="px-4 py-3 font-medium">#{voluntario.correlativo}</td>
                <td className="px-4 py-3">
                  {voluntario.nombres} {voluntario.apellidoP} {voluntario.apellidoM ?? ""}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={voluntario.tipo === "QUINCE" ? "gold" : "secondary"}>{voluntario.tipo}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={voluntario.activo ? "default" : "outline"}>
                    {voluntario.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{voluntario.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: cards apiladas */}
      <div className="flex flex-col gap-3 md:hidden">
        {voluntarios.map((voluntario) => (
          <Card key={voluntario.id} className="border-border bg-card">
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {voluntario.nombres} {voluntario.apellidoP} {voluntario.apellidoM ?? ""}
                  </p>
                  <p className="text-xs text-muted-foreground">#{voluntario.correlativo}</p>
                </div>
                <Badge variant={voluntario.tipo === "QUINCE" ? "gold" : "secondary"}>{voluntario.tipo}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{voluntario.email}</span>
                <Badge variant={voluntario.activo ? "default" : "outline"}>
                  {voluntario.activo ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
