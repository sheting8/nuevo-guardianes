"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Shield, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth-store";

type TipoVoluntario = "QUINCE" | "CONFEDERADO";
type RolSistema = "ADMIN" | "JEFE_GUARDIA" | "GUARDIAN" | "CONDUCTOR" | "OFICIALIDAD";

interface Voluntario {
  id: string;
  correlativo: number;
  tipo: TipoVoluntario;
  activo: boolean;
  nombres: string;
  apellidoP: string;
  apellidoM: string | null;
  rut: string;
  rutDigito: string;
  company: number;
  email: string;
  telefono: string | null;
  fechaNacimiento: string | null;
}

interface ErrorFilaImportacion {
  fila: number;
  correlativo: number | null;
  motivo: string;
}

interface ResultadoImportacion {
  creados: number;
  errores: ErrorFilaImportacion[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ROLES_DISPONIBLES: { valor: RolSistema; label: string }[] = [
  { valor: "ADMIN", label: "Administrador" },
  { valor: "JEFE_GUARDIA", label: "Jefe de Guardia" },
  { valor: "GUARDIAN", label: "Guardián" },
  { valor: "CONDUCTOR", label: "Conductor" },
  { valor: "OFICIALIDAD", label: "Oficialidad" },
];

type ModalState =
  | { tipo: "importar" }
  | { tipo: "crear" }
  | { tipo: "editar"; voluntario: Voluntario }
  | { tipo: "roles"; voluntario: Voluntario }
  | { tipo: "eliminar"; voluntario: Voluntario }
  | null;

export default function VoluntariosPage() {
  const roles = useAuthStore((s) => s.user?.roles) ?? [];
  const esAdmin = roles.includes("ADMIN");
  const [modal, setModal] = useState<ModalState>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["voluntarios"],
    queryFn: () => api.getPaginated<Voluntario>("/voluntarios?limit=50"),
  });

  function invalidarVoluntarios() {
    void queryClient.invalidateQueries({ queryKey: ["voluntarios"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Voluntarios</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.meta.total} voluntarios registrados` : "Listado de la compañía"}
          </p>
        </div>
        {esAdmin && (
          <div className="flex gap-2">
            <Button type="button" onClick={() => setModal({ tipo: "crear" })}>
              Agregar voluntario
            </Button>
            <Button type="button" variant="outline" onClick={() => setModal({ tipo: "importar" })}>
              Importar Excel
            </Button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {isError && <p className="text-sm text-destructive">No se pudo cargar el listado de voluntarios</p>}

      {data && (
        <VoluntariosTabla
          voluntarios={data.data}
          esAdmin={esAdmin}
          onEditar={(v) => setModal({ tipo: "editar", voluntario: v })}
          onRoles={(v) => setModal({ tipo: "roles", voluntario: v })}
          onEliminar={(v) => setModal({ tipo: "eliminar", voluntario: v })}
        />
      )}

      {modal?.tipo === "importar" && (
        <ImportarExcelModal onCerrar={() => setModal(null)} onImportado={invalidarVoluntarios} />
      )}

      {(modal?.tipo === "crear" || modal?.tipo === "editar") && (
        <VoluntarioFormModal
          voluntarioExistente={modal.tipo === "editar" ? modal.voluntario : null}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            invalidarVoluntarios();
          }}
        />
      )}

      {modal?.tipo === "roles" && (
        <RolesModal
          voluntario={modal.voluntario}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            invalidarVoluntarios();
          }}
        />
      )}

      {modal?.tipo === "eliminar" && (
        <EliminarModal
          voluntario={modal.voluntario}
          onCerrar={() => setModal(null)}
          onEliminado={() => {
            setModal(null);
            invalidarVoluntarios();
          }}
        />
      )}
    </div>
  );
}

function ModalOverlay({ onCerrar, children }: { onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
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

function ImportarExcelModal({ onCerrar, onImportado }: { onCerrar: () => void; onImportado: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descargandoPlantilla, setDescargandoPlantilla] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  const importar = useMutation({
    mutationFn: () => {
      const formData = new FormData();
      formData.append("file", archivo as File);
      return api.post<ResultadoImportacion>("/voluntarios/importar", formData);
    },
    onSuccess: () => {
      setError(null);
      onImportado();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "No se pudo importar el archivo");
    },
  });

  async function descargarPlantilla() {
    setDescargandoPlantilla(true);
    try {
      const res = await fetch(`${API_URL}/voluntarios/importar/plantilla`, {
        credentials: "include",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) {
        throw new Error("No se pudo generar la plantilla");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "plantilla-voluntarios.xlsx";
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo descargar la plantilla");
    } finally {
      setDescargandoPlantilla(false);
    }
  }

  function cerrarYLimpiar() {
    setArchivo(null);
    setError(null);
    importar.reset();
    onCerrar();
  }

  return (
    <ModalOverlay onCerrar={cerrarYLimpiar}>
      <ModalHeader
        titulo="Importar voluntarios desde Excel"
        descripcion="Sube un archivo .xlsx con las columnas del template."
        onCerrar={cerrarYLimpiar}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={descargandoPlantilla}
        onClick={() => void descargarPlantilla()}
      >
        {descargandoPlantilla ? "Generando…" : "Descargar template de ejemplo"}
      </Button>

      {!importar.data && (
        <>
          <div className="flex flex-col gap-1.5">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-sm"
            />
            {archivo && <p className="text-xs text-muted-foreground">Archivo seleccionado: {archivo.name}</p>}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={cerrarYLimpiar}>
              Cancelar
            </Button>
            <Button type="button" disabled={!archivo || importar.isPending} onClick={() => importar.mutate()}>
              {importar.isPending ? "Subiendo…" : "Subir"}
            </Button>
          </div>
        </>
      )}

      {importar.data && (
        <ResultadoImportacionVista
          resultado={importar.data}
          onCerrar={cerrarYLimpiar}
          onImportarOtro={() => {
            importar.reset();
            setArchivo(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      )}
    </ModalOverlay>
  );
}

function ResultadoImportacionVista({
  resultado,
  onCerrar,
  onImportarOtro,
}: {
  resultado: ResultadoImportacion;
  onCerrar: () => void;
  onImportarOtro: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        <span className="font-medium text-foreground">{resultado.creados}</span> voluntario
        {resultado.creados === 1 ? "" : "s"} creado{resultado.creados === 1 ? "" : "s"}.
      </p>

      {resultado.errores.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-destructive">
            {resultado.errores.length} fila{resultado.errores.length === 1 ? "" : "s"} con errores:
          </p>
          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-secondary text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Fila</th>
                  <th className="px-3 py-2 font-medium">Correlativo</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {resultado.errores.map((e, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{e.fila}</td>
                    <td className="px-3 py-2">{e.correlativo ?? "—"}</td>
                    <td className="px-3 py-2 text-destructive">{e.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onImportarOtro}>
          Importar otro archivo
        </Button>
        <Button type="button" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}

function VoluntarioFormModal({
  voluntarioExistente,
  onCerrar,
  onGuardado,
}: {
  voluntarioExistente: Voluntario | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const esEdicion = !!voluntarioExistente;
  const [tipo, setTipo] = useState<TipoVoluntario>(voluntarioExistente?.tipo ?? "QUINCE");
  const [correlativo, setCorrelativo] = useState(
    voluntarioExistente ? String(voluntarioExistente.correlativo) : "",
  );
  const [nombres, setNombres] = useState(voluntarioExistente?.nombres ?? "");
  const [apellidoP, setApellidoP] = useState(voluntarioExistente?.apellidoP ?? "");
  const [apellidoM, setApellidoM] = useState(voluntarioExistente?.apellidoM ?? "");
  const [rut, setRut] = useState(voluntarioExistente?.rut ?? "");
  const [rutDigito, setRutDigito] = useState(voluntarioExistente?.rutDigito ?? "");
  const [company, setCompany] = useState(
    voluntarioExistente ? String(voluntarioExistente.company) : "15",
  );
  const [email, setEmail] = useState(voluntarioExistente?.email ?? "");
  const [telefono, setTelefono] = useState(voluntarioExistente?.telefono ?? "");
  const [fechaNacimiento, setFechaNacimiento] = useState(
    voluntarioExistente?.fechaNacimiento?.slice(0, 10) ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => {
      const payload = {
        nombres,
        apellidoP,
        apellidoM: apellidoM || undefined,
        rut,
        rutDigito,
        company: Number(company),
        email,
        telefono: telefono || undefined,
        fechaNacimiento: fechaNacimiento || undefined,
      };

      if (esEdicion) {
        return api.patch(`/voluntarios/${voluntarioExistente.id}`, payload);
      }
      return api.post("/voluntarios", { ...payload, tipo, correlativo: Number(correlativo) });
    },
    onSuccess: onGuardado,
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el voluntario");
    },
  });

  const puedeGuardar =
    correlativo && nombres && apellidoP && rut && rutDigito && company && email && !guardar.isPending;

  return (
    <ModalOverlay onCerrar={onCerrar}>
      <ModalHeader
        titulo={esEdicion ? "Editar voluntario" : "Agregar voluntario"}
        descripcion={esEdicion ? `#${voluntarioExistente.correlativo}` : undefined}
        onCerrar={onCerrar}
      />

      <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tipo">Tipo</Label>
          <select
            id="tipo"
            disabled={esEdicion}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoVoluntario)}
          >
            <option value="QUINCE">QUINCE</option>
            <option value="CONFEDERADO">CONFEDERADO</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="correlativo">Correlativo</Label>
          <Input
            id="correlativo"
            type="number"
            disabled={esEdicion}
            value={correlativo}
            onChange={(e) => setCorrelativo(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombres">Nombres</Label>
          <Input id="nombres" value={nombres} onChange={(e) => setNombres(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="apellidoP">Apellido paterno</Label>
          <Input id="apellidoP" value={apellidoP} onChange={(e) => setApellidoP(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="apellidoM">Apellido materno</Label>
          <Input id="apellidoM" value={apellidoM} onChange={(e) => setApellidoM(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rut">RUT</Label>
          <Input id="rut" value={rut} onChange={(e) => setRut(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rutDigito">Dígito verificador</Label>
          <Input id="rutDigito" value={rutDigito} onChange={(e) => setRutDigito(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company">Compañía</Label>
          <Input id="company" type="number" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
          <Input
            id="fechaNacimiento"
            type="date"
            value={fechaNacimiento}
            onChange={(e) => setFechaNacimiento(e.target.value)}
          />
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

function RolesModal({
  voluntario,
  onCerrar,
  onGuardado,
}: {
  voluntario: Voluntario;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<RolSistema[] | null>(null);

  const detalleQuery = useQuery({
    queryKey: ["voluntarios", voluntario.id, "detalle"],
    queryFn: () => api.get<{ roles: { rol: RolSistema }[] }>(`/voluntarios/${voluntario.id}`),
  });

  const rolesActuales = seleccionados ?? detalleQuery.data?.roles.map((r) => r.rol) ?? [];

  const guardar = useMutation({
    mutationFn: () => api.patch(`/voluntarios/${voluntario.id}/roles`, { roles: rolesActuales }),
    onSuccess: onGuardado,
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo actualizar los roles"),
  });

  function alternar(rol: RolSistema) {
    const actuales = seleccionados ?? detalleQuery.data?.roles.map((r) => r.rol) ?? [];
    setSeleccionados(
      actuales.includes(rol) ? actuales.filter((r) => r !== rol) : [...actuales, rol],
    );
  }

  return (
    <ModalOverlay onCerrar={onCerrar}>
      <ModalHeader
        titulo="Roles del sistema"
        descripcion={`#${voluntario.correlativo} ${voluntario.nombres} ${voluntario.apellidoP}`}
        onCerrar={onCerrar}
      />

      {detalleQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando roles…</p>}
      {detalleQuery.isError && <p className="text-sm text-destructive">No se pudieron cargar los roles</p>}

      {detalleQuery.data && (
        <div className="flex flex-col gap-2">
          {ROLES_DISPONIBLES.map((r) => (
            <label key={r.valor} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rolesActuales.includes(r.valor)}
                onChange={() => alternar(r.valor)}
              />
              {r.label}
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="button" disabled={!detalleQuery.data || guardar.isPending} onClick={() => guardar.mutate()}>
          {guardar.isPending ? "Guardando…" : "Guardar roles"}
        </Button>
      </div>
    </ModalOverlay>
  );
}

function EliminarModal({
  voluntario,
  onCerrar,
  onEliminado,
}: {
  voluntario: Voluntario;
  onCerrar: () => void;
  onEliminado: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const eliminar = useMutation({
    mutationFn: () => api.patch(`/voluntarios/${voluntario.id}/eliminar`),
    onSuccess: onEliminado,
    onError: (err) => setError(err instanceof ApiError ? err.message : "No se pudo eliminar el voluntario"),
  });

  return (
    <ModalOverlay onCerrar={onCerrar}>
      <ModalHeader titulo="Eliminar voluntario" onCerrar={onCerrar} />

      <p className="text-sm">
        Vas a eliminar permanentemente a{" "}
        <span className="font-medium text-foreground">
          #{voluntario.correlativo} {voluntario.nombres} {voluntario.apellidoP}
        </span>
        . Esta acción es <span className="font-medium text-destructive">irreversible</span>: la persona ya no
        podrá iniciar sesión ni aparecerá en el listado. Su historial, camas y permisos quedan conservados.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="button" variant="destructive" disabled={eliminar.isPending} onClick={() => eliminar.mutate()}>
          {eliminar.isPending ? "Eliminando…" : "Eliminar definitivamente"}
        </Button>
      </div>
    </ModalOverlay>
  );
}

function VoluntariosTabla({
  voluntarios,
  esAdmin,
  onEditar,
  onRoles,
  onEliminar,
}: {
  voluntarios: Voluntario[];
  esAdmin: boolean;
  onEditar: (v: Voluntario) => void;
  onRoles: (v: Voluntario) => void;
  onEliminar: (v: Voluntario) => void;
}) {
  if (voluntarios.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay voluntarios para mostrar.</p>;
  }

  return (
    <>
      {/* Desktop: tabla */}
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Correlativo</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Correo</th>
              {esAdmin && <th className="px-4 py-3 font-medium">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {voluntarios.map((voluntario) => (
              <tr key={voluntario.id}>
                <td className="px-4 py-3 font-medium">#{voluntario.correlativo}</td>
                <td className="px-4 py-3">
                  {voluntario.nombres} {voluntario.apellidoP} {voluntario.apellidoM ?? ""}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={voluntario.tipo === "QUINCE" ? "gold" : "secondary"}>{voluntario.tipo}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={voluntario.activo ? "default" : "outline"}>
                    {voluntario.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{voluntario.email}</td>
                {esAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => onEditar(voluntario)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Roles"
                        onClick={() => onRoles(voluntario)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Shield className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Eliminar"
                        onClick={() => onEliminar(voluntario)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: cards apiladas */}
      <div className="flex flex-col gap-3 md:hidden">
        {voluntarios.map((voluntario) => (
          <Card key={voluntario.id} className="border-border bg-card">
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {voluntario.nombres} {voluntario.apellidoP} {voluntario.apellidoM ?? ""}
                  </p>
                  <p className="text-xs text-muted-foreground">#{voluntario.correlativo}</p>
                </div>
                <Badge variant={voluntario.tipo === "QUINCE" ? "gold" : "secondary"}>{voluntario.tipo}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{voluntario.email}</span>
                <Badge variant={voluntario.activo ? "default" : "outline"}>
                  {voluntario.activo ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              {esAdmin && (
                <div className="flex gap-2 pt-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => onEditar(voluntario)}>
                    Editar
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => onRoles(voluntario)}>
                    Roles
                  </Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => onEliminar(voluntario)}>
                    Eliminar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
