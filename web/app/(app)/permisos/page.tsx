import { ClipboardList } from "lucide-react";
import { Proximamente } from "@/components/layout/proximamente";

export default function PermisosPage() {
  return (
    <Proximamente
      titulo="Permisos"
      descripcion="La solicitud y aprobación de permisos estará disponible en un próximo sprint."
      icon={ClipboardList}
    />
  );
}
