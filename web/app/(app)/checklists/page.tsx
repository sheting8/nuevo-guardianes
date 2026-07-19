"use client";

import { type ReactNode, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

type AlcanceTipo = "ITEM_INVENTARIO" | "CATEGORIA_INVENTARIO" | "UBICACION";
type FrecuenciaTipo = "ROLLING" | "POR_CAMBIO_TURNO" | "ANTES_DE_USO";
type TipoPregunta = "PASA_FALLA" | "NUMERO" | "SELECTOR" | "MATRIZ" | "TEXTO";

interface ConfiguracionNumero {
  min?: number;
  max?: number;
}

interface ConfiguracionSelector {
  opciones: string[];
  multiple: boolean;
}

interface ConfiguracionMatriz {
  filas: string[];
  columnas: string[];
}

interface RespuestaMatrizPar {
  fila: string;
  columna: string;
}

interface ChecklistTemplateItem {
  id: string;
  orden: number;
  descripcion: string;
  tipoPregunta: TipoPregunta;
  configuracion: Record<string, unknown> | null;
}

interface ChecklistTemplate {
  id: string;
  nombre: string;
  descripcion: string | null;
  alcanceTipo: AlcanceTipo;
  alcanceId: string;
  tipoFrecuencia: FrecuenciaTipo;
  intervaloMinutos: number | null;
  activo: boolean;
  items: ChecklistTemplateItem[];
}

interface ChecklistEjecucionItem {
  id: string;
  checklistTemplateItemId: string;
  descripcion: string;
  tipoPregunta: TipoPregunta;
  respuesta: unknown;
  observacion: string | null;
}

interface ChecklistEjecucion {
  id: string;
  fechaEjecucion: string;
  observacionesGenerales: string | null;
  ejecutadoPor: { id: string; nombres: string; apellidoP: string; correlativo: number } | null;
  items: ChecklistEjecucionItem[];
}

const ALCANCE_LABEL: Record<AlcanceTipo, string> = {
  ITEM_INVENTARIO: "Ítem de inventario",
  CATEGORIA_INVENTARIO: "Categoría de inventario",
  UBICACION: "Ubicación",
};

const FRECUENCIA_LABEL: Record<FrecuenciaTipo, string> = {
  ROLLING: "Recurrente (por intervalo)",
  POR_CAMBIO_TURNO: "Por cambio de turno",
  ANTES_DE_USO: "Antes de uso",
};

const TIPO_PREGUNTA_LABEL: Record<TipoPregunta, string> = {
  PASA_FALLA: "Pasa/Falla",
  NUMERO: "Número",
  SELECTOR: "Selector",
  MATRIZ: "Matriz",
  TEXTO: "Texto",
};

export default function ChecklistsPage() {
  const [tab, setTab] = useState<"pendientes" | "templates">("pendientes");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [ejecutando, setEjecutando] = useState<ChecklistTemplate | null>(null);
  const queryClient = useQueryClient();

  const pendientesQuery = useQuery({
    queryKey: ["checklists", "templates", "vencidos"],
    queryFn: () => api.getPaginated<ChecklistTemplate>("/checklists/templates?vencidos=true&limit=50"),
    enabled: tab === "pendientes",
  });

  const templatesQuery = useQuery({
    queryKey: ["checklists", "templates", "todos"],
    queryFn: () => api.getPaginated<ChecklistTemplate>("/checklists/templates?limit=50"),
    enabled: tab === "templates",
  });

  function invalidarTemplates() {
    void queryClient.invalidateQueries({ queryKey: ["checklists", "templates"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Checklists</h1>
          <p className="text-sm text-muted-foreground">Plantillas de revisión y ejecuciones pendientes</p>
        </div>
        {tab === "templates" && (
          <Button type="button" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? "Cancelar" : "+ Nueva plantilla"}
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b border-border">
        <TabButton activo={tab === "pendientes"} onClick={() => setTab("pendientes")}>
          Pendientes
        </TabButton>
        <TabButton activo={tab === "templates"} onClick={() => setTab("templates")}>
          Templates
        </TabButton>
      </div>

      {tab === "pendientes" && (
        <>
          {pendientesQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {pendientesQuery.isError && (
            <p className="text-sm text-destructive">No se pudo cargar los checklists pendientes</p>
          )}
          {pendientesQuery.data && pendientesQuery.data.data.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay checklists pendientes por ahora.</p>
          )}
          {pendientesQuery.data && pendientesQuery.data.data.length > 0 && (
            <div className="flex flex-col gap-3">
              {pendientesQuery.data.data.map((t) => (
                <Card key={t.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <p className="font-medium">{t.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {ALCANCE_LABEL[t.alcanceTipo]} · {FRECUENCIA_LABEL[t.tipoFrecuencia]}
                      </p>
                    </div>
                    <Button type="button" size="sm" onClick={() => setEjecutando(t)}>
                      Ejecutar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "templates" && (
        <>
          {mostrarForm && (
            <TemplateFormModal
              onCerrar={() => setMostrarForm(false)}
              onGuardado={() => {
                setMostrarForm(false);
                invalidarTemplates();
              }}
            />
          )}

          {templatesQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {templatesQuery.isError && (
            <p className="text-sm text-destructive">No se pudo cargar el listado de plantillas</p>
          )}
          {templatesQuery.data && templatesQuery.data.data.length === 0 && (
            <p className="text-sm text-muted-foreground">No tienes acceso a ninguna plantilla todavía.</p>
          )}
          {templatesQuery.data && templatesQuery.data.data.length > 0 && (
            <ListadoTemplates templates={templatesQuery.data.data} onCambio={invalidarTemplates} />
          )}
        </>
      )}

      {ejecutando && (
        <EjecutarModal
          template={ejecutando}
          onCerrar={() => setEjecutando(null)}
          onEjecutado={() => {
            setEjecutando(null);
            invalidarTemplates();
          }}
        />
      )}
    </div>
  );
}

function TabButton({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        activo ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
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

// Lista simple de strings con agregar/quitar — reusada por opciones de
// SELECTOR y filas/columnas de MATRIZ en el form de plantilla.
function ListaDinamica({
  label,
  valores,
  onChange,
  placeholder,
  addLabel,
}: {
  label: string;
  valores: string[];
  onChange: (valores: string[]) => void;
  placeholder?: string;
  addLabel: string;
}) {
  function actualizar(index: number, valor: string) {
    onChange(valores.map((v, i) => (i === index ? valor : v)));
  }

  function quitar(index: number) {
    onChange(valores.filter((_, i) => i !== index));
  }

  function agregar() {
    onChange([...valores, ""]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {valores.map((valor, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input value={valor} onChange={(e) => actualizar(index, e.target.value)} placeholder={placeholder} />
          {valores.length > 1 && (
            <button
              type="button"
              onClick={() => quitar(index)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Quitar"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <div>
        <Button type="button" size="sm" variant="outline" onClick={agregar}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

function ListadoTemplates({
  templates,
  onCambio,
}: {
  templates: ChecklistTemplate[];
  onCambio: () => void;
}) {
  const [editando, setEditando] = useState<ChecklistTemplate | null>(null);
  const [eliminando, setEliminando] = useState<ChecklistTemplate | null>(null);
  const [verHistorial, setVerHistorial] = useState<ChecklistTemplate | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {templates.map((t) => (
        <Card key={t.id}>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{t.nombre}</p>
                {t.descripcion && <p className="text-xs text-muted-foreground">{t.descripcion}</p>}
                <p className="text-xs text-muted-foreground">
                  {ALCANCE_LABEL[t.alcanceTipo]} · {FRECUENCIA_LABEL[t.tipoFrecuencia]}
                  {t.tipoFrecuencia === "ROLLING" && t.intervaloMinutos
                    ? ` (cada ${t.intervaloMinutos} min)`
                    : ""}
                </p>
              </div>
              <Badge variant={t.activo ? "default" : "outline"}>{t.activo ? "Activo" : "Inactivo"}</Badge>
            </div>

            <div className="flex flex-wrap gap-1">
              {t.items
                .slice()
                .sort((a, b) => a.orden - b.orden)
                .map((item) => (
                  <span key={item.id} className="rounded-md border border-border px-2 py-1 text-xs">
                    {item.orden}. {item.descripcion}{" "}
                    <span className="text-muted-foreground">({TIPO_PREGUNTA_LABEL[item.tipoPregunta]})</span>
                  </span>
                ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditando(t)}>
                Editar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setVerHistorial(t)}>
                Ver historial
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => setEliminando(t)}>
                <Trash2 className="size-4" />
                Eliminar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {editando && (
        <TemplateFormModal
          templateExistente={editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            onCambio();
          }}
        />
      )}

      {eliminando && (
        <EliminarTemplateModal
          template={eliminando}
          onCerrar={() => setEliminando(null)}
          onEliminado={() => {
            setEliminando(null);
            onCambio();
          }}
        />
      )}

      {verHistorial && <HistorialModal template={verHistorial} onCerrar={() => setVerHistorial(null)} />}
    </div>
  );
}

// Estado local por item del formulario de creación — superset de todos los
// campos posibles según tipoPregunta; sólo los relevantes al tipo elegido se
// usan al construir la configuración a enviar.
interface ItemForm {
  orden: number;
  descripcion: string;
  tipoPregunta: TipoPregunta;
  min: string;
  max: string;
  opciones: string[];
  multiple: boolean;
  filas: string[];
  columnas: string[];
}

function nuevoItemForm(orden: number): ItemForm {
  return {
    orden,
    descripcion: "",
    tipoPregunta: "PASA_FALLA",
    min: "",
    max: "",
    opciones: [""],
    multiple: false,
    filas: [""],
    columnas: [""],
  };
}

function construirConfiguracion(item: ItemForm): Record<string, unknown> | undefined {
  if (item.tipoPregunta === "NUMERO") {
    const configuracion: Record<string, unknown> = {};
    if (item.min.trim()) configuracion.min = Number(item.min);
    if (item.max.trim()) configuracion.max = Number(item.max);
    return Object.keys(configuracion).length > 0 ? configuracion : undefined;
  }
  if (item.tipoPregunta === "SELECTOR") {
    return {
      opciones: item.opciones.map((o) => o.trim()).filter(Boolean),
      multiple: item.multiple,
    };
  }
  if (item.tipoPregunta === "MATRIZ") {
    return {
      filas: item.filas.map((f) => f.trim()).filter(Boolean),
      columnas: item.columnas.map((c) => c.trim()).filter(Boolean),
    };
  }
  return undefined;
}

function ItemFormRow({
  item,
  index,
  puedeQuitar,
  onChange,
  onQuitar,
}: {
  item: ItemForm;
  index: number;
  puedeQuitar: boolean;
  onChange: (index: number, patch: Partial<ItemForm>) => void;
  onQuitar: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <span className="w-6 text-xs text-muted-foreground">{item.orden}.</span>
        <Input
          value={item.descripcion}
          onChange={(e) => onChange(index, { descripcion: e.target.value })}
          placeholder="Descripción del punto a revisar"
        />
        {puedeQuitar && (
          <button
            type="button"
            onClick={() => onQuitar(index)}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Quitar item"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5 sm:w-64">
        <Label>Tipo de pregunta</Label>
        <select
          className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          value={item.tipoPregunta}
          onChange={(e) => onChange(index, { tipoPregunta: e.target.value as TipoPregunta })}
        >
          {Object.entries(TIPO_PREGUNTA_LABEL).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {item.tipoPregunta === "NUMERO" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>Mínimo (opcional)</Label>
            <Input type="number" value={item.min} onChange={(e) => onChange(index, { min: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Máximo (opcional)</Label>
            <Input type="number" value={item.max} onChange={(e) => onChange(index, { max: e.target.value })} />
          </div>
        </div>
      )}

      {item.tipoPregunta === "SELECTOR" && (
        <>
          <ListaDinamica
            label="Opciones"
            valores={item.opciones}
            onChange={(opciones) => onChange(index, { opciones })}
            placeholder="Opción"
            addLabel="+ Agregar opción"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.multiple}
              onChange={(e) => onChange(index, { multiple: e.target.checked })}
            />
            Permite selección múltiple
          </label>
        </>
      )}

      {item.tipoPregunta === "MATRIZ" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ListaDinamica
            label="Filas"
            valores={item.filas}
            onChange={(filas) => onChange(index, { filas })}
            placeholder="Fila"
            addLabel="+ Agregar fila"
          />
          <ListaDinamica
            label="Columnas"
            valores={item.columnas}
            onChange={(columnas) => onChange(index, { columnas })}
            placeholder="Columna"
            addLabel="+ Agregar columna"
          />
        </div>
      )}
    </div>
  );
}

function TemplateFormModal({
  templateExistente,
  onCerrar,
  onGuardado,
}: {
  templateExistente?: ChecklistTemplate;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const esEdicion = !!templateExistente;
  const [nombre, setNombre] = useState(templateExistente?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(templateExistente?.descripcion ?? "");
  const [alcanceTipo, setAlcanceTipo] = useState<AlcanceTipo>(templateExistente?.alcanceTipo ?? "ITEM_INVENTARIO");
  const [alcanceId, setAlcanceId] = useState(templateExistente?.alcanceId ?? "");
  const [tipoFrecuencia, setTipoFrecuencia] = useState<FrecuenciaTipo>(
    templateExistente?.tipoFrecuencia ?? "ANTES_DE_USO",
  );
  const [intervaloMinutos, setIntervaloMinutos] = useState(
    templateExistente?.intervaloMinutos ? String(templateExistente.intervaloMinutos) : "",
  );
  const [items, setItems] = useState<ItemForm[]>([nuevoItemForm(1)]);
  const [error, setError] = useState<string | null>(null);

  function agregarItem() {
    setItems((prev) => [...prev, nuevoItemForm(prev.length + 1)]);
  }

  function quitarItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, orden: i + 1 })));
  }

  function actualizarItem(index: number, patch: Partial<ItemForm>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  const guardar = useMutation({
    mutationFn: () => {
      if (esEdicion) {
        return api.patch(`/checklists/templates/${templateExistente.id}`, {
          nombre,
          descripcion: descripcion || undefined,
          alcanceTipo,
          alcanceId,
          tipoFrecuencia,
          intervaloMinutos: tipoFrecuencia === "ROLLING" ? Number(intervaloMinutos) : undefined,
        });
      }
      return api.post("/checklists/templates", {
        nombre,
        descripcion: descripcion || undefined,
        alcanceTipo,
        alcanceId,
        tipoFrecuencia,
        intervaloMinutos: tipoFrecuencia === "ROLLING" ? Number(intervaloMinutos) : undefined,
        items: items
          .filter((i) => i.descripcion.trim())
          .map((i) => ({
            orden: i.orden,
            descripcion: i.descripcion,
            tipoPregunta: i.tipoPregunta,
            configuracion: construirConfiguracion(i),
          })),
      });
    },
    onSuccess: onGuardado,
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo guardar la plantilla"),
  });

  const itemsValidos = items.filter((i) => i.descripcion.trim()).length > 0;
  const puedeGuardar =
    nombre &&
    alcanceId &&
    (tipoFrecuencia !== "ROLLING" || intervaloMinutos) &&
    (esEdicion || itemsValidos) &&
    !guardar.isPending;

  return (
    <ModalOverlay onCerrar={onCerrar}>
      <ModalHeader titulo={esEdicion ? "Editar plantilla" : "Nueva plantilla"} onCerrar={onCerrar} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="templateNombre">Nombre</Label>
          <Input id="templateNombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="templateDescripcion">Descripción (opcional)</Label>
          <Input id="templateDescripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="templateAlcanceTipo">Alcance</Label>
          <select
            id="templateAlcanceTipo"
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={alcanceTipo}
            onChange={(e) => setAlcanceTipo(e.target.value as AlcanceTipo)}
          >
            {Object.entries(ALCANCE_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="templateAlcanceId">Id del recurso</Label>
          <Input
            id="templateAlcanceId"
            value={alcanceId}
            onChange={(e) => setAlcanceId(e.target.value)}
            placeholder="id del ítem, categoría o ubicación"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="templateFrecuencia">Frecuencia</Label>
          <select
            id="templateFrecuencia"
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={tipoFrecuencia}
            onChange={(e) => setTipoFrecuencia(e.target.value as FrecuenciaTipo)}
          >
            {Object.entries(FRECUENCIA_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {tipoFrecuencia === "ROLLING" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="templateIntervalo">Intervalo (minutos)</Label>
            <Input
              id="templateIntervalo"
              type="number"
              min={1}
              value={intervaloMinutos}
              onChange={(e) => setIntervaloMinutos(e.target.value)}
            />
          </div>
        )}
      </div>

      {!esEdicion && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Items del checklist</p>
          {items.map((item, index) => (
            <ItemFormRow
              key={index}
              item={item}
              index={index}
              puedeQuitar={items.length > 1}
              onChange={actualizarItem}
              onQuitar={quitarItem}
            />
          ))}
          <div>
            <Button type="button" size="sm" variant="outline" onClick={agregarItem}>
              + Agregar item
            </Button>
          </div>
        </div>
      )}

      {esEdicion && (
        <p className="text-xs text-muted-foreground">
          La edición de una plantilla existente no permite modificar sus items.
        </p>
      )}

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

function EliminarTemplateModal({
  template,
  onCerrar,
  onEliminado,
}: {
  template: ChecklistTemplate;
  onCerrar: () => void;
  onEliminado: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/checklists/templates/${template.id}`),
    onSuccess: onEliminado,
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo eliminar la plantilla"),
  });

  return (
    <ModalOverlay onCerrar={onCerrar}>
      <ModalHeader titulo="Eliminar plantilla" onCerrar={onCerrar} />
      <p className="text-sm">
        Vas a eliminar permanentemente <span className="font-medium text-foreground">{template.nombre}</span>.
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

// Estado de respuesta en curso durante la ejecución. `respuesta` guarda el
// valor con la forma que exige el backend para el tipoPregunta del item
// (boolean | number | string | string[] | RespuestaMatrizPar[]).
interface RespuestaForm {
  respuesta: unknown;
  observacion: string;
}

function respuestaInicial(item: ChecklistTemplateItem): unknown {
  if (item.tipoPregunta === "PASA_FALLA") return true;
  if (item.tipoPregunta === "NUMERO") return 0;
  if (item.tipoPregunta === "TEXTO") return "";
  if (item.tipoPregunta === "SELECTOR") {
    const config = (item.configuracion ?? {}) as Partial<ConfiguracionSelector>;
    if (config.multiple) return [] as string[];
    return config.opciones?.[0] ?? "";
  }
  if (item.tipoPregunta === "MATRIZ") {
    const config = (item.configuracion ?? {}) as Partial<ConfiguracionMatriz>;
    const columnaInicial = config.columnas?.[0] ?? "";
    return (config.filas ?? []).map((fila) => ({ fila, columna: columnaInicial }));
  }
  return null;
}

function fueraDeRango(valor: number, config: ConfiguracionNumero): boolean {
  if (config.min !== undefined && valor < config.min) return true;
  if (config.max !== undefined && valor > config.max) return true;
  return false;
}

function CampoRespuesta({
  item,
  valor,
  onChange,
}: {
  item: ChecklistTemplateItem;
  valor: unknown;
  onChange: (respuesta: unknown) => void;
}) {
  if (item.tipoPregunta === "PASA_FALLA") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={valor === true} onChange={(e) => onChange(e.target.checked)} />
        Cumple
      </label>
    );
  }

  if (item.tipoPregunta === "NUMERO") {
    const config = (item.configuracion ?? {}) as ConfiguracionNumero;
    const numero = typeof valor === "number" ? valor : 0;
    const fuera = fueraDeRango(numero, config);
    return (
      <div className="flex flex-col gap-1">
        <Input
          type="number"
          value={numero}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className={fuera ? "border-destructive text-destructive" : undefined}
        />
        {(config.min !== undefined || config.max !== undefined) && (
          <p className="text-xs text-muted-foreground">
            Rango esperado: {config.min ?? "sin mínimo"} – {config.max ?? "sin máximo"}
          </p>
        )}
        {fuera && <p className="text-xs text-destructive">Fuera de rango</p>}
      </div>
    );
  }

  if (item.tipoPregunta === "TEXTO") {
    return (
      <textarea
        className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={typeof valor === "string" ? valor : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (item.tipoPregunta === "SELECTOR") {
    const config = (item.configuracion ?? {}) as unknown as ConfiguracionSelector;
    if (config.multiple) {
      const seleccionadas = Array.isArray(valor) ? (valor as string[]) : [];
      return (
        <div className="flex flex-col gap-1">
          {config.opciones.map((opcion) => (
            <label key={opcion} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={seleccionadas.includes(opcion)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...seleccionadas, opcion]
                      : seleccionadas.filter((o) => o !== opcion),
                  )
                }
              />
              {opcion}
            </label>
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        {config.opciones.map((opcion) => (
          <label key={opcion} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`selector-${item.id}`}
              checked={valor === opcion}
              onChange={() => onChange(opcion)}
            />
            {opcion}
          </label>
        ))}
      </div>
    );
  }

  if (item.tipoPregunta === "MATRIZ") {
    const config = (item.configuracion ?? {}) as unknown as ConfiguracionMatriz;
    const pares = Array.isArray(valor) ? (valor as RespuestaMatrizPar[]) : [];

    function columnaDeFila(fila: string): string | undefined {
      return pares.find((p) => p.fila === fila)?.columna;
    }

    function elegir(fila: string, columna: string) {
      const otras = pares.filter((p) => p.fila !== fila);
      onChange([...otras, { fila, columna }]);
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left"></th>
              {config.columnas.map((columna) => (
                <th key={columna} className="px-2 py-1 text-center font-medium">
                  {columna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.filas.map((fila) => (
              <tr key={fila} className="border-t border-border">
                <td className="px-2 py-1 font-medium">{fila}</td>
                {config.columnas.map((columna) => (
                  <td key={columna} className="px-2 py-1 text-center">
                    <input
                      type="radio"
                      name={`matriz-${item.id}-${fila}`}
                      checked={columnaDeFila(fila) === columna}
                      onChange={() => elegir(fila, columna)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

function EjecutarModal({
  template,
  onCerrar,
  onEjecutado,
}: {
  template: ChecklistTemplate;
  onCerrar: () => void;
  onEjecutado: () => void;
}) {
  const [observacionesGenerales, setObservacionesGenerales] = useState("");
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaForm>>(
    Object.fromEntries(
      template.items.map((i) => [i.id, { respuesta: respuestaInicial(i), observacion: "" }]),
    ),
  );
  const [error, setError] = useState<string | null>(null);

  const ejecutar = useMutation({
    mutationFn: () =>
      api.post(`/checklists/templates/${template.id}/ejecuciones`, {
        observacionesGenerales: observacionesGenerales || undefined,
        items: template.items.map((i) => ({
          checklistTemplateItemId: i.id,
          respuesta: respuestas[i.id]?.respuesta,
          observacion: respuestas[i.id]?.observacion || undefined,
        })),
      }),
    onSuccess: onEjecutado,
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo registrar la ejecución"),
  });

  return (
    <ModalOverlay onCerrar={onCerrar}>
      <ModalHeader titulo={`Ejecutar: ${template.nombre}`} onCerrar={onCerrar} />

      <div className="flex flex-col gap-3">
        {template.items
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((item) => (
            <div key={item.id} className="flex flex-col gap-1.5 rounded-md border border-border p-3">
              <p className="text-sm font-medium">
                {item.orden}. {item.descripcion}
              </p>
              <CampoRespuesta
                item={item}
                valor={respuestas[item.id]?.respuesta}
                onChange={(respuesta) =>
                  setRespuestas((prev) => ({
                    ...prev,
                    [item.id]: { ...prev[item.id], respuesta },
                  }))
                }
              />
              <Input
                placeholder="Observación (opcional)"
                value={respuestas[item.id]?.observacion ?? ""}
                onChange={(e) =>
                  setRespuestas((prev) => ({
                    ...prev,
                    [item.id]: { ...prev[item.id], observacion: e.target.value },
                  }))
                }
              />
            </div>
          ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="observacionesGenerales">Observaciones generales (opcional)</Label>
        <Input
          id="observacionesGenerales"
          value={observacionesGenerales}
          onChange={(e) => setObservacionesGenerales(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="button" disabled={ejecutar.isPending} onClick={() => ejecutar.mutate()}>
          {ejecutar.isPending ? "Guardando…" : "Registrar ejecución"}
        </Button>
      </div>
    </ModalOverlay>
  );
}

// Render de una respuesta histórica — se apoya SIEMPRE en el tipoPregunta
// snapshotted en el propio ChecklistEjecucionItem, nunca en el tipo vigente
// del item de la plantilla (que puede haber cambiado desde entonces).
function RespuestaHistorial({
  item,
  itemVigente,
}: {
  item: ChecklistEjecucionItem;
  itemVigente?: ChecklistTemplateItem;
}) {
  if (item.tipoPregunta === "PASA_FALLA") {
    const cumple = item.respuesta === true;
    return (
      <Badge variant={cumple ? "default" : "outline"} className="inline-flex items-center gap-1">
        {cumple ? <Check className="size-3" /> : <X className="size-3" />}
        {cumple ? "Cumple" : "No cumple"}
      </Badge>
    );
  }

  if (item.tipoPregunta === "NUMERO") {
    const numero = typeof item.respuesta === "number" ? item.respuesta : null;
    // Sólo se puede marcar fuera de rango si el item vigente sigue siendo
    // NUMERO y expone la misma configuración — si no, se muestra sin marcar.
    const config =
      itemVigente && itemVigente.tipoPregunta === "NUMERO"
        ? ((itemVigente.configuracion ?? {}) as ConfiguracionNumero)
        : undefined;
    const fuera = numero !== null && config ? fueraDeRango(numero, config) : false;
    return <span className={fuera ? "text-destructive" : undefined}>{numero ?? "—"}</span>;
  }

  if (item.tipoPregunta === "TEXTO") {
    return <p className="whitespace-pre-wrap text-sm">{typeof item.respuesta === "string" ? item.respuesta : ""}</p>;
  }

  if (item.tipoPregunta === "SELECTOR") {
    const seleccionadas = Array.isArray(item.respuesta)
      ? (item.respuesta as string[])
      : typeof item.respuesta === "string"
        ? [item.respuesta]
        : [];
    return (
      <div className="flex flex-wrap gap-1">
        {seleccionadas.map((opcion) => (
          <Badge key={opcion} variant="secondary">
            {opcion}
          </Badge>
        ))}
      </div>
    );
  }

  if (item.tipoPregunta === "MATRIZ") {
    const pares = Array.isArray(item.respuesta) ? (item.respuesta as RespuestaMatrizPar[]) : [];
    return (
      <table className="text-xs">
        <tbody>
          {pares.map((par) => (
            <tr key={par.fila}>
              <td className="pr-2 font-medium">{par.fila}</td>
              <td>{par.columna}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return null;
}

function HistorialModal({ template, onCerrar }: { template: ChecklistTemplate; onCerrar: () => void }) {
  const historialQuery = useQuery({
    queryKey: ["checklists", "historial", template.id],
    queryFn: () =>
      api.getPaginated<ChecklistEjecucion>(`/checklists/templates/${template.id}/ejecuciones?limit=20`),
  });

  const itemVigentePorId = new Map(template.items.map((i) => [i.id, i]));

  return (
    <ModalOverlay onCerrar={onCerrar}>
      <ModalHeader titulo={`Historial: ${template.nombre}`} onCerrar={onCerrar} />

      {historialQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {historialQuery.isError && (
        <p className="text-sm text-destructive">No se pudo cargar el historial de este checklist</p>
      )}
      {historialQuery.data && historialQuery.data.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no hay ejecuciones registradas.</p>
      )}

      <div className="flex flex-col gap-3">
        {historialQuery.data?.data.map((ejecucion) => (
          <div key={ejecucion.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{new Date(ejecucion.fechaEjecucion).toLocaleString()}</span>
              {ejecucion.ejecutadoPor && (
                <span>
                  {ejecucion.ejecutadoPor.nombres} {ejecucion.ejecutadoPor.apellidoP}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {ejecucion.items.map((item) => (
                <div key={item.id} className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{item.descripcion}</p>
                  <RespuestaHistorial item={item} itemVigente={itemVigentePorId.get(item.checklistTemplateItemId)} />
                  {item.observacion && <p className="text-xs text-muted-foreground">{item.observacion}</p>}
                </div>
              ))}
            </div>

            {ejecucion.observacionesGenerales && (
              <p className="text-xs text-muted-foreground">Observaciones: {ejecucion.observacionesGenerales}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>
    </ModalOverlay>
  );
}
