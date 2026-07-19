"use client";

import { type ReactNode, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Settings, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth-store";

type EstadoItem = "OPERATIVO" | "EN_MANTENCION" | "FUERA_DE_SERVICIO" | "PERDIDO";

interface CategoriaInventario {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

interface Ubicacion {
  id: string;
  nombre: string;
  descripcion: string | null;
  carroId: string | null;
  activo: boolean;
}

interface ItemInventario {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoriaId: string;
  ubicacionId: string;
  codigo: string | null;
  estado: EstadoItem;
  cantidad: number;
}

const ESTADO_LABEL: Record<EstadoItem, string> = {
  OPERATIVO: "Operativo",
  EN_MANTENCION: "En mantención",
  FUERA_DE_SERVICIO: "Fuera de servicio",
  PERDIDO: "Perdido",
};

const ESTADO_VARIANT: Record<EstadoItem, "default" | "secondary" | "outline" | "gold"> = {
  OPERATIVO: "default",
  EN_MANTENCION: "gold",
  FUERA_DE_SERVICIO: "outline",
  PERDIDO: "outline",
};

type ModalState =
  | { tipo: "gestion" }
  | { tipo: "crearItem" }
  | { tipo: "editarItem"; item: ItemInventario }
  | { tipo: "eliminarItem"; item: ItemInventario }
  | null;

export default function InventarioPage() {
  const roles = useAuthStore((s) => s.user?.roles) ?? [];
  const esAdmin = roles.includes("ADMIN");
  const queryClient = useQueryClient();

  const [modal, setModal] = useState<ModalState>(null);
  const [categoriaId, setCategoriaId] = useState("");
  const [ubicacionId, setUbicacionId] = useState("");
  const [estado, setEstado] = useState<EstadoItem | "">("");
  const [search, setSearch] = useState("");

  const categoriasQuery = useQuery({
    queryKey: ["inventario", "categorias"],
    queryFn: () => api.get<CategoriaInventario[]>("/inventario/categorias"),
  });

  const ubicacionesQuery = useQuery({
    queryKey: ["inventario", "ubicaciones"],
    queryFn: () => api.get<Ubicacion[]>("/inventario/ubicaciones"),
  });

  const params = new URLSearchParams({ limit: "50" });
  if (categoriaId) params.set("categoriaId", categoriaId);
  if (ubicacionId) params.set("ubicacionId", ubicacionId);
  if (estado) params.set("estado", estado);
  if (search) params.set("search", search);

  const itemsQuery = useQuery({
    queryKey: ["inventario", "items", categoriaId, ubicacionId, estado, search],
    queryFn: () => api.getPaginated<ItemInventario>(`/inventario/items?${params.toString()}`),
  });

  function invalidarItems() {
    void queryClient.invalidateQueries({ queryKey: ["inventario", "items"] });
  }

  function invalidarCategoriasYUbicaciones() {
    void queryClient.invalidateQueries({ queryKey: ["inventario", "categorias"] });
    void queryClient.invalidateQueries({ queryKey: ["inventario", "ubicaciones"] });
    invalidarItems();
  }

  const categoriaPorId = new Map((categoriasQuery.data ?? []).map((c) => [c.id, c]));
  const ubicacionPorId = new Map((ubicacionesQuery.data ?? []).map((u) => [u.id, u]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Inventario</h1>
          <p className="text-sm text-muted-foreground">Ítems, categorías y ubicaciones del material</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => setModal({ tipo: "crearItem" })}>
            + Nuevo ítem
          </Button>
          {esAdmin && (
            <Button
              type="button"
              variant="outline"
              size="default"
              title="Gestionar categorías y ubicaciones"
              onClick={() => setModal({ tipo: "gestion" })}
            >
              <Settings className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5 sm:min-w-[200px]">
            <Label htmlFor="filtroSearch">Buscar</Label>
            <Input
              id="filtroSearch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre o código"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:min-w-[180px]">
            <Label htmlFor="filtroCategoria">Categoría</Label>
            <select
              id="filtroCategoria"
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
            >
              <option value="">Todas</option>
              {categoriasQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 sm:min-w-[180px]">
            <Label htmlFor="filtroUbicacion">Ubicación</Label>
            <select
              id="filtroUbicacion"
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={ubicacionId}
              onChange={(e) => setUbicacionId(e.target.value)}
            >
              <option value="">Todas</option>
              {ubicacionesQuery.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 sm:min-w-[160px]">
            <Label htmlFor="filtroEstado">Estado</Label>
            <select
              id="filtroEstado"
              className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoItem | "")}
            >
              <option value="">Todos</option>
              {Object.entries(ESTADO_LABEL).map(([valor, label]) => (
                <option key={valor} value={valor}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {itemsQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {itemsQuery.isError && <p className="text-sm text-destructive">No se pudo cargar el listado de ítems</p>}

      {itemsQuery.data && itemsQuery.data.data.length === 0 && (
        <p className="text-sm text-muted-foreground">No tienes acceso a ningún inventario todavía.</p>
      )}

      {itemsQuery.data && itemsQuery.data.data.length > 0 && (
        <TablaItems
          items={itemsQuery.data.data}
          categoriaPorId={categoriaPorId}
          ubicacionPorId={ubicacionPorId}
          onEditar={(item) => setModal({ tipo: "editarItem", item })}
          onEliminar={(item) => setModal({ tipo: "eliminarItem", item })}
        />
      )}

      {(modal?.tipo === "crearItem" || modal?.tipo === "editarItem") && (
        <ItemFormModal
          itemExistente={modal.tipo === "editarItem" ? modal.item : null}
          categorias={categoriasQuery.data ?? []}
          ubicaciones={ubicacionesQuery.data ?? []}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            invalidarItems();
          }}
        />
      )}

      {modal?.tipo === "eliminarItem" && (
        <EliminarItemModal
          item={modal.item}
          onCerrar={() => setModal(null)}
          onEliminado={() => {
            setModal(null);
            invalidarItems();
          }}
        />
      )}

      {modal?.tipo === "gestion" && (
        <GestionModal
          categorias={categoriasQuery.data ?? []}
          ubicaciones={ubicacionesQuery.data ?? []}
          onCerrar={() => setModal(null)}
          onCambio={invalidarCategoriasYUbicaciones}
        />
      )}
    </div>
  );
}

function ModalOverlay({ onCerrar, children }: { onCerrar: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <Card
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="flex flex-col gap-4 p-5">{children}</CardContent>
      </Card>
    </div>
  );
}

function ModalHeader({ titulo, descripcion, onCerrar }: { titulo: string; descripcion?: string; onCerrar: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-base font-semibold">{titulo}</p>
        {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      <button
        type="button"
        onClick={onCerrar}
        className="text-sm text-muted-foreground hover:text-foreground"
        aria-label="Cerrar"
      >
        ✕
      </button>
    </div>
  );
}

function TablaItems({
  items,
  categoriaPorId,
  ubicacionPorId,
  onEditar,
  onEliminar,
}: {
  items: ItemInventario[];
  categoriaPorId: Map<string, CategoriaInventario>;
  ubicacionPorId: Map<string, Ubicacion>;
  onEditar: (item: ItemInventario) => void;
  onEliminar: (item: ItemInventario) => void;
}) {
  return (
    <>
      {/* Desktop: tabla */}
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Ubicación</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium">{item.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {categoriaPorId.get(item.categoriaId)?.nombre ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {ubicacionPorId.get(item.ubicacionId)?.nombre ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{item.codigo ?? "—"}</td>
                <td className="px-4 py-3">{item.cantidad}</td>
                <td className="px-4 py-3">
                  <Badge variant={ESTADO_VARIANT[item.estado]}>{ESTADO_LABEL[item.estado]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => onEditar(item)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      title="Eliminar"
                      onClick={() => onEliminar(item)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: cards apiladas */}
      <div className="flex flex-col gap-3 md:hidden">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {categoriaPorId.get(item.categoriaId)?.nombre ?? "—"} ·{" "}
                    {ubicacionPorId.get(item.ubicacionId)?.nombre ?? "—"}
                  </p>
                </div>
                <Badge variant={ESTADO_VARIANT[item.estado]}>{ESTADO_LABEL[item.estado]}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Cantidad: {item.cantidad}</span>
                {item.codigo && <span>Código: {item.codigo}</span>}
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" size="sm" variant="outline" onClick={() => onEditar(item)}>
                  Editar
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => onEliminar(item)}>
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function ItemFormModal({
  itemExistente,
  categorias,
  ubicaciones,
  onCerrar,
  onGuardado,
}: {
  itemExistente: ItemInventario | null;
  categorias: CategoriaInventario[];
  ubicaciones: Ubicacion[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const esEdicion = !!itemExistente;
  const [nombre, setNombre] = useState(itemExistente?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(itemExistente?.descripcion ?? "");
  const [categoriaId, setCategoriaId] = useState(itemExistente?.categoriaId ?? "");
  const [ubicacionId, setUbicacionId] = useState(itemExistente?.ubicacionId ?? "");
  const [codigo, setCodigo] = useState(itemExistente?.codigo ?? "");
  const [estado, setEstado] = useState<EstadoItem>(itemExistente?.estado ?? "OPERATIVO");
  const [cantidad, setCantidad] = useState(String(itemExistente?.cantidad ?? 1));
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => {
      const payload = {
        nombre,
        descripcion: descripcion || undefined,
        categoriaId,
        ubicacionId,
        codigo: codigo || undefined,
        estado,
        cantidad: Number(cantidad),
      };
      if (esEdicion) {
        return api.patch(`/inventario/items/${itemExistente.id}`, payload);
      }
      return api.post("/inventario/items", payload);
    },
    onSuccess: onGuardado,
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo guardar el ítem"),
  });

  const puedeGuardar = nombre && categoriaId && ubicacionId && cantidad !== "" && !guardar.isPending;

  return (
    <ModalOverlay onCerrar={onCerrar}>
      <ModalHeader titulo={esEdicion ? "Editar ítem" : "Nuevo ítem"} onCerrar={onCerrar} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="itemNombre">Nombre</Label>
          <Input id="itemNombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="itemDescripcion">Descripción (opcional)</Label>
          <Input id="itemDescripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="itemCategoria">Categoría</Label>
          <select
            id="itemCategoria"
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
          >
            <option value="">Seleccionar…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="itemUbicacion">Ubicación</Label>
          <select
            id="itemUbicacion"
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={ubicacionId}
            onChange={(e) => setUbicacionId(e.target.value)}
          >
            <option value="">Seleccionar…</option>
            {ubicaciones.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="itemCodigo">Código (opcional)</Label>
          <Input id="itemCodigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="itemCantidad">Cantidad</Label>
          <Input
            id="itemCantidad"
            type="number"
            min={0}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="itemEstado">Estado</Label>
          <select
            id="itemEstado"
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoItem)}
          >
            {Object.entries(ESTADO_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="button" disabled={!puedeGuardar} onClick={() => guardar.mutate()}>
          {guardar.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </ModalOverlay>
  );
}

function EliminarItemModal({
  item,
  onCerrar,
  onEliminado,
}: {
  item: ItemInventario;
  onCerrar: () => void;
  onEliminado: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/inventario/items/${item.id}`),
    onSuccess: onEliminado,
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo eliminar el ítem"),
  });

  return (
    <ModalOverlay onCerrar={onCerrar}>
      <ModalHeader titulo="Eliminar ítem" onCerrar={onCerrar} />
      <p className="text-sm">
        Vas a eliminar permanentemente <span className="font-medium text-foreground">{item.nombre}</span>.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="button" variant="destructive" disabled={eliminar.isPending} onClick={() => eliminar.mutate()}>
          {eliminar.isPending ? "Eliminando…" : "Eliminar"}
        </Button>
      </div>
    </ModalOverlay>
  );
}

function GestionModal({
  categorias,
  ubicaciones,
  onCerrar,
  onCambio,
}: {
  categorias: CategoriaInventario[];
  ubicaciones: Ubicacion[];
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [tab, setTab] = useState<"categorias" | "ubicaciones">("categorias");

  return (
    <ModalOverlay onCerrar={onCerrar}>
      <ModalHeader
        titulo="Categorías y ubicaciones"
        descripcion="Gestión administrativa del inventario"
        onCerrar={onCerrar}
      />

      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("categorias")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === "categorias"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Categorías
        </button>
        <button
          type="button"
          onClick={() => setTab("ubicaciones")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === "ubicaciones"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Ubicaciones
        </button>
      </div>

      {tab === "categorias" ? (
        <CategoriasCrud categorias={categorias} onCambio={onCambio} />
      ) : (
        <UbicacionesCrud ubicaciones={ubicaciones} onCambio={onCambio} />
      )}
    </ModalOverlay>
  );
}

function CategoriasCrud({ categorias, onCambio }: { categorias: CategoriaInventario[]; onCambio: () => void }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: () => api.post("/inventario/categorias", { nombre, descripcion: descripcion || undefined }),
    onSuccess: () => {
      setError(null);
      setNombre("");
      setDescripcion("");
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo crear la categoría"),
  });

  const alternarActivo = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api.patch(`/inventario/categorias/${id}`, { activo }),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo actualizar la categoría"),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => api.delete(`/inventario/categorias/${id}`),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo eliminar la categoría"),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="categoriaNombre" className="text-xs text-muted-foreground">
            Nombre
          </Label>
          <Input id="categoriaNombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="categoriaDescripcion" className="text-xs text-muted-foreground">
            Descripción
          </Label>
          <Input id="categoriaDescripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <Button type="button" size="sm" disabled={!nombre || crear.isPending} onClick={() => crear.mutate()}>
          {crear.isPending ? "Creando…" : "Agregar"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {categorias.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay categorías creadas.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {categorias.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{c.nombre}</p>
                {c.descripcion && <p className="text-xs text-muted-foreground">{c.descripcion}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.activo ? "default" : "outline"}>{c.activo ? "Activa" : "Inactiva"}</Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={alternarActivo.isPending}
                  onClick={() => alternarActivo.mutate({ id: c.id, activo: !c.activo })}
                >
                  {c.activo ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={eliminar.isPending}
                  onClick={() => eliminar.mutate(c.id)}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UbicacionesCrud({ ubicaciones, onCambio }: { ubicaciones: Ubicacion[]; onCambio: () => void }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: () => api.post("/inventario/ubicaciones", { nombre, descripcion: descripcion || undefined }),
    onSuccess: () => {
      setError(null);
      setNombre("");
      setDescripcion("");
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo crear la ubicación"),
  });

  const alternarActivo = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api.patch(`/inventario/ubicaciones/${id}`, { activo }),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo actualizar la ubicación"),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => api.delete(`/inventario/ubicaciones/${id}`),
    onSuccess: () => {
      setError(null);
      onCambio();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo eliminar la ubicación"),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ubicacionNombre" className="text-xs text-muted-foreground">
            Nombre
          </Label>
          <Input id="ubicacionNombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ubicacionDescripcion" className="text-xs text-muted-foreground">
            Descripción
          </Label>
          <Input id="ubicacionDescripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <Button type="button" size="sm" disabled={!nombre || crear.isPending} onClick={() => crear.mutate()}>
          {crear.isPending ? "Creando…" : "Agregar"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {ubicaciones.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay ubicaciones creadas.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {ubicaciones.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{u.nombre}</p>
                {u.descripcion && <p className="text-xs text-muted-foreground">{u.descripcion}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={u.activo ? "default" : "outline"}>{u.activo ? "Activa" : "Inactiva"}</Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={alternarActivo.isPending}
                  onClick={() => alternarActivo.mutate({ id: u.id, activo: !u.activo })}
                >
                  {u.activo ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={eliminar.isPending}
                  onClick={() => eliminar.mutate(u.id)}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
