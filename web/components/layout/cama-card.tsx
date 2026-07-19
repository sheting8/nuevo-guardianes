"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export type EstadoCama =
  | "NORMAL"
  | "REEMPLAZO"
  | "PERMISO_ESPECIAL"
  | "PERMISO"
  | "LICENCIA"
  | "OVERRIDE"
  | "CONDUCTOR"
  | "VACIA";

export interface VoluntarioCama {
  nombres: string;
  apellidoP: string;
  correlativo: number;
}

export interface CamaCardProps {
  numeroCama: number;
  voluntario?: VoluntarioCama | null;
  estado: EstadoCama;
  className?: string;
  seleccionada?: boolean;
  onSeleccionar?: () => void;
}

// Paleta armonizada con el fondo crema cálido / acento rojo institucional
// (ver web/app/globals.css); se mantiene el significado semántico de cada
// estado, solo se ajustan los tonos para no chocar con la nueva identidad.
const ESTADO_ESTILO: Record<EstadoCama, string> = {
  NORMAL: "bg-[#BFE3C6] border-[#7FBF8E] text-[#1F3D2A]",
  REEMPLAZO: "bg-[#4F9A6A] border-[#3B7A52] text-white",
  PERMISO_ESPECIAL: "bg-[#7C1420] border-[#5C0F18] text-white",
  PERMISO: "bg-[#E8B94D] border-[#C79A2E] text-[#241e1a]",
  LICENCIA: "bg-[#B79AE0] border-[#9370C4] text-white",
  OVERRIDE: "bg-[#E38B4E] border-[#C46A2E] text-[#241e1a]",
  CONDUCTOR: "bg-[#7FB3E0] border-[#4C8FC7] text-[#1a2b3d]",
  VACIA: "border-dashed border-border bg-background text-muted-foreground",
};

const ESTADO_LABEL: Record<EstadoCama, string> = {
  NORMAL: "Duerme",
  REEMPLAZO: "Reemplazo",
  PERMISO_ESPECIAL: "Permiso especial",
  PERMISO: "Permiso",
  LICENCIA: "Licencia",
  OVERRIDE: "Override",
  CONDUCTOR: "Conductor",
  VACIA: "Vacía",
};

export function CamaCard({
  numeroCama,
  voluntario,
  estado,
  className,
  seleccionada,
  onSeleccionar,
}: CamaCardProps) {
  const [abierto, setAbierto] = useState(false);

  const etiqueta = voluntario ? `${voluntario.nombres} ${voluntario.apellidoP}` : ESTADO_LABEL[estado];

  return (
    <button
      type="button"
      onClick={() => {
        setAbierto((valor) => !valor);
        onSeleccionar?.();
      }}
      onBlur={() => setAbierto(false)}
      className={cn(
        "group relative flex h-full w-full items-center justify-center rounded-sm border font-bold",
        ESTADO_ESTILO[estado],
        seleccionada && "ring-2 ring-offset-1 ring-primary",
        className,
      )}
    >
      <span className="text-xs">#{numeroCama}</span>

      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 rounded-md border border-border bg-card px-2 py-1 text-xs font-normal whitespace-nowrap text-foreground opacity-0 shadow-md transition-opacity",
          "group-hover:opacity-100 group-focus-visible:opacity-100",
          abierto && "opacity-100",
        )}
      >
        {etiqueta}
      </span>
    </button>
  );
}
