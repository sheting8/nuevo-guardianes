import { CamaCard, type EstadoCama, type VoluntarioCama } from "./cama-card";

export interface CamaPanelData {
  numeroCama: number;
  estado: EstadoCama;
  voluntario?: VoluntarioCama | null;
}

interface Pieza {
  id: string;
  camas: number[];
  direccion: "fila" | "columna";
  left: string;
  top: string;
  width: string;
  height: string;
}

/**
 * Posiciones normalizadas (%) calculadas sobre la imagen de referencia
 * "Distribución camas.png" (plano real del cuartel, 600x1138).
 * El orden y la agrupación por pieza replican esa imagen; no es una grilla genérica.
 */
const PIEZAS: Pieza[] = [
  { id: "p1", camas: [7, 8, 9], direccion: "fila", left: "1%", top: "1%", width: "48%", height: "14%" },
  { id: "p2", camas: [10, 11, 12], direccion: "fila", left: "50%", top: "1%", width: "49%", height: "14%" },
  { id: "p3", camas: [6, 5], direccion: "columna", left: "1%", top: "16%", width: "33%", height: "19%" },
  { id: "p4", camas: [4, 3], direccion: "columna", left: "1%", top: "36%", width: "33%", height: "19%" },
  { id: "p5", camas: [2, 1], direccion: "columna", left: "1%", top: "56%", width: "33%", height: "19%" },
  { id: "p6", camas: [13, 14], direccion: "columna", left: "66%", top: "55%", width: "33%", height: "19%" },
  { id: "p7", camas: [15, 16], direccion: "columna", left: "1%", top: "78%", width: "33%", height: "20%" },
  { id: "p8", camas: [17, 18], direccion: "columna", left: "66%", top: "78%", width: "33%", height: "20%" },
];

// Panel compacto: ~320px de ancho fijo. Todas las camas miden lo mismo
// (36x44px, forma rectangular real) sin importar la pieza en la que estén.
const PANEL_ANCHO_PX = 320;
const CAMA_ANCHO_PX = 36;
const CAMA_ALTO_PX = 44;

interface PanelCamasProps {
  camas: CamaPanelData[];
  camaSeleccionada?: number | null;
  onSeleccionarCama?: (numeroCama: number) => void;
}

export function PanelCamas({ camas, camaSeleccionada, onSeleccionarCama }: PanelCamasProps) {
  const porNumero = new Map(camas.map((cama) => [cama.numeroCama, cama]));

  return (
    <div
      className="relative shrink-0 rounded-lg border border-border bg-background"
      style={{ width: PANEL_ANCHO_PX, aspectRatio: "600 / 1138" }}
    >
      <div className="absolute inset-x-0 top-[75%] border-t border-dashed border-border" aria-hidden />

      {PIEZAS.map((pieza) => (
        <div
          key={pieza.id}
          className="absolute flex items-start gap-1 rounded-sm border border-border bg-card/60 p-1"
          style={{
            left: pieza.left,
            top: pieza.top,
            width: pieza.width,
            height: pieza.height,
            flexDirection: pieza.direccion === "fila" ? "row" : "column",
            justifyContent: pieza.direccion === "fila" ? "flex-start" : "space-between",
          }}
        >
          {pieza.camas.map((numeroCama) => {
            const cama = porNumero.get(numeroCama);
            return (
              <div key={numeroCama} style={{ width: CAMA_ANCHO_PX, height: CAMA_ALTO_PX, flexShrink: 0 }}>
                <CamaCard
                  numeroCama={numeroCama}
                  estado={cama?.estado ?? "VACIA"}
                  voluntario={cama?.voluntario}
                  seleccionada={camaSeleccionada === numeroCama}
                  onSeleccionar={onSeleccionarCama ? () => onSeleccionarCama(numeroCama) : undefined}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
