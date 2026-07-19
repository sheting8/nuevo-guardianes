import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";

export interface VoluntarioResumen {
  id: string;
  nombres: string;
  apellidoP: string;
  correlativo: number;
}

export function nombreVoluntario(v: VoluntarioResumen): string {
  return `#${v.correlativo} ${v.nombres} ${v.apellidoP}`;
}

/** Lista de voluntarios activos para alimentar un SearchableSelect —
 * compartido por cualquier página que necesite elegir un voluntario por
 * nombre en vez de pegar su id (RBAC, mantenedor de carros, etc.). */
export function useVoluntariosOpciones() {
  const query = useQuery({
    queryKey: ["voluntarios", "selector"],
    queryFn: () => api.getPaginated<VoluntarioResumen>("/voluntarios?limit=200&activo=true"),
  });
  const opciones: SearchableSelectOption[] = (query.data?.data ?? []).map((v) => ({
    value: v.id,
    label: nombreVoluntario(v),
  }));
  return { opciones, loading: query.isLoading };
}
