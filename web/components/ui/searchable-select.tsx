"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  loading?: boolean;
  emptyText?: string;
  disabled?: boolean;
}

/** Input con búsqueda + lista desplegable, para elegir un id (voluntario,
 * categoría, ubicación, plantilla, etc.) por nombre en vez de pegarlo a mano. */
export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Buscar…",
  loading,
  emptyText = "Sin resultados",
  disabled,
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const seleccionado = options.find((o) => o.value === value);

  useEffect(() => {
    function alClickearFuera(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", alClickearFuera);
    return () => document.removeEventListener("mousedown", alClickearFuera);
  }, []);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        disabled={disabled}
        value={open ? query : (seleccionado?.label ?? "")}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onChange("");
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-md">
          {loading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Cargando…</p>
          ) : filtrados.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            filtrados.map((o) => (
              <button
                key={o.value}
                type="button"
                className={cn(
                  "flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-secondary",
                  o.value === value && "bg-primary/10 text-primary",
                )}
                onClick={() => {
                  onChange(o.value);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
                {o.description && <span className="text-xs text-muted-foreground">{o.description}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
