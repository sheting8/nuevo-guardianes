import { PanelCamas, type CamaPanelData } from "@/components/layout/panel-camas";

// Datos de ejemplo (misma distribución de la imagen de referencia) mientras
// el endpoint GET /citaciones/panel del Sprint 4 no está disponible.
const CAMAS_DEMO: CamaPanelData[] = [
  { numeroCama: 1, estado: "NORMAL", voluntario: { nombres: "Diego", apellidoP: "Rojas", correlativo: 12 } },
  { numeroCama: 2, estado: "REEMPLAZO", voluntario: { nombres: "Marco", apellidoP: "Lira", correlativo: 45 } },
  { numeroCama: 3, estado: "NORMAL", voluntario: { nombres: "Ismael", apellidoP: "Toro", correlativo: 8 } },
  { numeroCama: 4, estado: "VACIA" },
  { numeroCama: 5, estado: "NORMAL", voluntario: { nombres: "Felipe", apellidoP: "Vera", correlativo: 21 } },
  { numeroCama: 6, estado: "NORMAL", voluntario: { nombres: "Cristóbal", apellidoP: "Paz", correlativo: 33 } },
  { numeroCama: 7, estado: "NORMAL", voluntario: { nombres: "Andrés", apellidoP: "Soto", correlativo: 5 } },
  { numeroCama: 8, estado: "NORMAL", voluntario: { nombres: "Rodrigo", apellidoP: "Díaz", correlativo: 19 } },
  { numeroCama: 9, estado: "NORMAL", voluntario: { nombres: "Bastián", apellidoP: "Reyes", correlativo: 27 } },
  { numeroCama: 10, estado: "REEMPLAZO", voluntario: { nombres: "Vicente", apellidoP: "Muñoz", correlativo: 51 } },
  { numeroCama: 11, estado: "REEMPLAZO", voluntario: { nombres: "Tomás", apellidoP: "Cid", correlativo: 62 } },
  { numeroCama: 12, estado: "NORMAL", voluntario: { nombres: "Joaquín", apellidoP: "Silva", correlativo: 14 } },
  { numeroCama: 13, estado: "NORMAL", voluntario: { nombres: "Nicolás", apellidoP: "Fuentes", correlativo: 38 } },
  { numeroCama: 14, estado: "PERMISO_ESPECIAL", voluntario: { nombres: "Pablo", apellidoP: "Araya", correlativo: 44 } },
  { numeroCama: 15, estado: "NORMAL", voluntario: { nombres: "Gabriel", apellidoP: "Núñez", correlativo: 9 } },
  { numeroCama: 16, estado: "NORMAL", voluntario: { nombres: "Ignacio", apellidoP: "Bravo", correlativo: 17 } },
  { numeroCama: 17, estado: "VACIA" },
  { numeroCama: 18, estado: "VACIA" },
];

export default function InicioPage() {
  const hoy = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="flex justify-center md:block md:shrink-0">
        <div className="flex flex-col gap-3">
          <PanelCamas camas={CAMAS_DEMO} />

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Leyenda color="#86EFAC" label="Duerme" />
            <Leyenda color="#16A34A" label="Reemplazo" />
            <Leyenda color="#EF4444" label="Permiso especial" />
            <Leyenda color="#FDE047" label="Permiso" />
            <Leyenda color="#60A5FA" label="Conductor" />
            <Leyenda color="#374151" label="Vacía" />
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold">Panel de la noche</h1>
        <p className="text-sm text-muted-foreground capitalize">{hoy}</p>
      </div>
    </div>
  );
}

function Leyenda({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded-sm border border-border" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
