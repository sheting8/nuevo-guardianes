"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { api, ApiError } from "@/lib/api";
import { nombreVoluntario, useVoluntariosOpciones, type VoluntarioResumen } from "@/lib/hooks/use-voluntarios-opciones";

type SujetoTipo = "USUARIO" | "GRUPO";
type RecursoTipo = "CATEGORIA_INVENTARIO" | "UBICACION" | "CHECKLIST_TEMPLATE";
type Nivel = "LEER" | "GESTIONAR";

interface GrupoMiembro {
  voluntario: VoluntarioResumen;
}

interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  miembros: GrupoMiembro[];
}

interface Autorizacion {
  id: string;
  sujetoTipo: SujetoTipo;
  voluntarioId: string | null;
  grupoId: string | null;
  recursoTipo: RecursoTipo;
  recursoId: string;
  nivel: Nivel;
  voluntario: VoluntarioResumen | null;
  grupo: { id: string; nombre: string } | null;
}

interface CategoriaInventario {
  id: string;
  nombre: string;
}

interface Ubicacion {
  id: string;
  nombre: string;
}

interface ChecklistTemplate {
  id: string;
  nombre: string;
}

const RECURSO_LABEL: Record<RecursoTipo, string> = {
  CATEGORIA_INVENTARIO: "Categoría de inventario",
  UBICACION: "Ubicación",
  CHECKLIST_TEMPLATE: "Plantilla de checklist",
};


export default function RbacPage() {
  const queryClient = useQueryClient();

  const gruposQuery = useQuery({
    queryKey: ["rbac", "grupos"],
    queryFn: () => api.get<Grupo[]>("/rbac/grupos"),
  });

  const autorizacionesQuery = useQuery({
    queryKey: ["rbac", "autorizaciones"],
    queryFn: () => api.get<Autorizacion[]>("/rbac/autorizaciones"),
  });

  const categoriasQuery = useQuery({
    queryKey: ["inventario", "categorias", "selector"],
    queryFn: () => api.get<CategoriaInventario[]>("/inventario/categorias"),
  });
  const ubicacionesQuery = useQuery({
    queryKey: ["inventario", "ubicaciones", "selector"],
    queryFn: () => api.get<Ubicacion[]>("/inventario/ubicaciones"),
  });
  const templatesQuery = useQuery({
    queryKey: ["checklists", "templates", "selector"],
    queryFn: () => api.getPaginated<ChecklistTemplate>("/checklists/templates?limit=200"),
  });

  function invalidarGrupos() {
    void queryClient.invalidateQueries({ queryKey: ["rbac", "grupos"] });
  }

  function invalidarAutorizaciones() {
    void queryClient.invalidateQueries({ queryKey: ["rbac", "autorizaciones"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Permisos de acceso</h1>
        <p className="text-sm text-muted-foreground">
          Grupos de voluntarios y autorizaciones sobre inventario y checklists
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Grupos</h2>
        <NuevoGrupoForm onCreado={invalidarGrupos} />

        {gruposQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {gruposQuery.isError && <p className="text-sm text-destructive">No se pudo cargar el listado de grupos</p>}
        {gruposQuery.data && (
          <ListadoGrupos grupos={gruposQuery.data} onCambio={invalidarGrupos} />
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Autorizaciones</h2>
        <NuevaAutorizacionForm
          grupos={gruposQuery.data ?? []}
          categorias={categoriasQuery.data ?? []}
          ubicaciones={ubicacionesQuery.data ?? []}
          templates={templatesQuery.data?.data ?? []}
          onCreada={invalidarAutorizaciones}
        />

        {autorizacionesQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {autorizacionesQuery.isError && (
          <p className="text-sm text-destructive">No se pudo cargar el listado de autorizaciones</p>
        )}
        {autorizacionesQuery.data && (
          <ListadoAutorizaciones autorizaciones={autorizacionesQuery.data} onCambio={invalidarAutorizaciones} />
        )}
      </div>
    </div>
  );
}

function NuevoGrupoForm({ onCreado }: { onCreado: () => void }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: () => api.post("/rbac/grupos", { nombre, descripcion: descripcion || undefined }),
    onSuccess: () => {
      setError(null);
      setNombre("");
      setDescripcion("");
      onCreado();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo crear el grupo"),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <p className="text-sm font-medium">Nuevo grupo</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grupoNombre">Nombre</Label>
            <Input id="grupoNombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grupoDescripcion">Descripción (opcional)</Label>
            <Input id="grupoDescripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div>
          <Button type="button" disabled={!nombre || crear.isPending} onClick={() => crear.mutate()}>
            {crear.isPending ? "Creando…" : "Crear grupo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ListadoGrupos({ grupos, onCambio }: { grupos: Grupo[]; onCambio: () => void }) {
  if (grupos.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay grupos creados.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {grupos.map((grupo) => (
        <FilaGrupo key={grupo.id} grupo={grupo} onCambio={onCambio} />
      ))}
    </div>
  );
}

function FilaGrupo({ grupo, onCambio }: { grupo: Grupo; onCambio: () => void }) {
  const [voluntarioId, setVoluntarioId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { opciones: opcionesVoluntarios, loading: cargandoVoluntarios } = useVoluntariosOpciones();

  const agregar = useMutation({
    mutationFn: () => api.post(`/rbac/grupos/${grupo.id}/miembros/${voluntarioId}`),
    onSuccess: () => {
      setError(null);
      setVoluntarioId("");
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo agregar el miembro"),
  });

  const quitar = useMutation({
    mutationFn: (id: string) => api.delete(`/rbac/grupos/${grupo.id}/miembros/${id}`),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo quitar el miembro"),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{grupo.nombre}</p>
            {grupo.descripcion && <p className="text-xs text-muted-foreground">{grupo.descripcion}</p>}
          </div>
          <Badge variant="secondary">
            {grupo.miembros.length} miembro{grupo.miembros.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {grupo.miembros.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {grupo.miembros.map((m) => (
              <span
                key={m.voluntario.id}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs"
              >
                {nombreVoluntario(m.voluntario)}
                <button
                  type="button"
                  disabled={quitar.isPending}
                  onClick={() => quitar.mutate(m.voluntario.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Quitar miembro"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex w-64 flex-col gap-1.5">
            <Label htmlFor={`miembro-${grupo.id}`} className="text-xs text-muted-foreground">
              Voluntario
            </Label>
            <SearchableSelect
              id={`miembro-${grupo.id}`}
              value={voluntarioId}
              onChange={setVoluntarioId}
              options={opcionesVoluntarios}
              loading={cargandoVoluntarios}
              placeholder="Buscar por nombre o correlativo…"
              emptyText="No se encontraron voluntarios"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!voluntarioId || agregar.isPending}
            onClick={() => agregar.mutate()}
          >
            {agregar.isPending ? "Agregando…" : "Agregar miembro"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NuevaAutorizacionForm({
  grupos,
  categorias,
  ubicaciones,
  templates,
  onCreada,
}: {
  grupos: Grupo[];
  categorias: CategoriaInventario[];
  ubicaciones: Ubicacion[];
  templates: ChecklistTemplate[];
  onCreada: () => void;
}) {
  const [sujetoTipo, setSujetoTipo] = useState<SujetoTipo>("USUARIO");
  const [voluntarioId, setVoluntarioId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [recursoTipo, setRecursoTipo] = useState<RecursoTipo>("CATEGORIA_INVENTARIO");
  const [recursoId, setRecursoId] = useState("");
  const [nivel, setNivel] = useState<Nivel>("LEER");
  const [error, setError] = useState<string | null>(null);
  const { opciones: opcionesVoluntarios, loading: cargandoVoluntarios } = useVoluntariosOpciones();

  const opcionesRecurso: SearchableSelectOption[] =
    recursoTipo === "CATEGORIA_INVENTARIO"
      ? categorias.map((c) => ({ value: c.id, label: c.nombre }))
      : recursoTipo === "UBICACION"
        ? ubicaciones.map((u) => ({ value: u.id, label: u.nombre }))
        : templates.map((t) => ({ value: t.id, label: t.nombre }));

  const crear = useMutation({
    mutationFn: () =>
      api.post("/rbac/autorizaciones", {
        sujetoTipo,
        voluntarioId: sujetoTipo === "USUARIO" ? voluntarioId : undefined,
        grupoId: sujetoTipo === "GRUPO" ? grupoId : undefined,
        recursoTipo,
        recursoId,
        nivel,
      }),
    onSuccess: () => {
      setError(null);
      setVoluntarioId("");
      setGrupoId("");
      setRecursoId("");
      onCreada();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo crear la autorización"),
  });

  const puedeCrear =
    recursoId && (sujetoTipo === "USUARIO" ? !!voluntarioId : !!grupoId) && !crear.isPending;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <p className="text-sm font-medium">Nueva autorización</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sujetoTipo">Sujeto</Label>
            <select
              id="sujetoTipo"
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={sujetoTipo}
              onChange={(e) => setSujetoTipo(e.target.value as SujetoTipo)}
            >
              <option value="USUARIO">Usuario</option>
              <option value="GRUPO">Grupo</option>
            </select>
          </div>

          {sujetoTipo === "USUARIO" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="voluntarioId">Voluntario</Label>
              <SearchableSelect
                id="voluntarioId"
                value={voluntarioId}
                onChange={setVoluntarioId}
                options={opcionesVoluntarios}
                loading={cargandoVoluntarios}
                placeholder="Buscar por nombre o correlativo…"
                emptyText="No se encontraron voluntarios"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="grupoId">Grupo</Label>
              <select
                id="grupoId"
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                value={grupoId}
                onChange={(e) => setGrupoId(e.target.value)}
              >
                <option value="">Seleccionar…</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nivel">Nivel</Label>
            <select
              id="nivel"
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={nivel}
              onChange={(e) => setNivel(e.target.value as Nivel)}
            >
              <option value="LEER">Leer</option>
              <option value="GESTIONAR">Gestionar</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recursoTipo">Tipo de recurso</Label>
            <select
              id="recursoTipo"
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={recursoTipo}
              onChange={(e) => {
                setRecursoTipo(e.target.value as RecursoTipo);
                setRecursoId("");
              }}
            >
              <option value="CATEGORIA_INVENTARIO">Categoría de inventario</option>
              <option value="UBICACION">Ubicación</option>
              <option value="CHECKLIST_TEMPLATE">Plantilla de checklist</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="recursoId">{RECURSO_LABEL[recursoTipo]}</Label>
            <SearchableSelect
              id="recursoId"
              value={recursoId}
              onChange={setRecursoId}
              options={opcionesRecurso}
              placeholder="Buscar por nombre…"
              emptyText="No se encontraron resultados"
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div>
          <Button type="button" disabled={!puedeCrear} onClick={() => crear.mutate()}>
            {crear.isPending ? "Creando…" : "Crear autorización"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ListadoAutorizaciones({
  autorizaciones,
  onCambio,
}: {
  autorizaciones: Autorizacion[];
  onCambio: () => void;
}) {
  if (autorizaciones.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay autorizaciones registradas.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {autorizaciones.map((a) => (
        <FilaAutorizacion key={a.id} autorizacion={a} onCambio={onCambio} />
      ))}
    </div>
  );
}

function FilaAutorizacion({
  autorizacion,
  onCambio,
}: {
  autorizacion: Autorizacion;
  onCambio: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const revocar = useMutation({
    mutationFn: () => api.delete(`/rbac/autorizaciones/${autorizacion.id}`),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo revocar la autorización"),
  });

  const sujeto =
    autorizacion.sujetoTipo === "USUARIO"
      ? autorizacion.voluntario
        ? nombreVoluntario(autorizacion.voluntario)
        : "Voluntario eliminado"
      : (autorizacion.grupo?.nombre ?? "Grupo eliminado");

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">
              {autorizacion.sujetoTipo === "USUARIO" ? "Usuario" : "Grupo"}: {sujeto}
            </p>
            <p className="text-xs text-muted-foreground">
              {RECURSO_LABEL[autorizacion.recursoTipo]} — {autorizacion.recursoId}
            </p>
          </div>
          <Badge variant={autorizacion.nivel === "GESTIONAR" ? "default" : "secondary"}>
            {autorizacion.nivel === "GESTIONAR" ? "Gestionar" : "Leer"}
          </Badge>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={revocar.isPending}
            onClick={() => revocar.mutate()}
          >
            {revocar.isPending ? "Revocando…" : "Revocar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
