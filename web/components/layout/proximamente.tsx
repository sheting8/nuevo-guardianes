import type { LucideIcon } from "lucide-react";

interface ProximamenteProps {
  titulo: string;
  descripcion: string;
  icon: LucideIcon;
}

export function Proximamente({ titulo, descripcion, icon: Icon }: ProximamenteProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{titulo}</h1>
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <Icon className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </div>
    </div>
  );
}
