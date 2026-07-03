import { BookOpen } from "lucide-react";
import { Proximamente } from "@/components/layout/proximamente";

export default function LibroDeGuardiaPage() {
  return (
    <Proximamente
      titulo="Libro de Guardia"
      descripcion="El libro de guardia, overrides y documentos estarán disponibles en un próximo sprint."
      icon={BookOpen}
    />
  );
}
