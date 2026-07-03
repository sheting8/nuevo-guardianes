import { CalendarDays } from "lucide-react";
import { Proximamente } from "@/components/layout/proximamente";

export default function CitacionesPage() {
  return (
    <Proximamente
      titulo="Citaciones"
      descripcion="La gestión de citaciones y asignaciones estará disponible en el próximo sprint."
      icon={CalendarDays}
    />
  );
}
