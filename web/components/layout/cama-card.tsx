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
}

const ESTADO_ESTILO: Record<EstadoCama, string> = {
  NORMAL: "bg-[#86EFAC] border-[#4ADE80] text-black",
  REEMPLAZO: "bg-[#16A34A] border-[#15803D] text-white",
  PERMISO_ESPECIAL: "bg-[#EF4444] border-[#DC2626] text-white",
  PERMISO: "bg-[#FDE047] border-[#FACC15] text-black",
  LICENCIA: "bg-[#A855F7] border-[#9333EA] text-white",
  OVERRIDE: "bg-[#F97316] border-[#EA580C] text-black",
  CONDUCTOR: "bg-[#60A5FA] border-[#3B82F6] text-black",
  VACIA: "bg-[#374151] border-[#4B5563] text-gray-300",
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

export function CamaCard({ numeroCama, voluntario, estado, className }: CamaCardProps) {
  const [abierto, setAbierto] = useState(false);

  const etiqueta = voluntario ? `${voluntario.nombres} ${voluntario.apellidoP}` : ESTADO_LABEL[estado];

  return (
    <button
      type="button"
      onClick={() => setAbierto((valor) => !valor)}
      onBlur={() => setAbierto(false)}
      className={cn(
        "group relative flex h-full w-full items-center justify-center rounded-sm border font-bold",
        ESTADO_ESTILO[estado],
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
