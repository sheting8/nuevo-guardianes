import { useAuthStore } from "@/lib/store/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipAuth?: boolean;
}

interface ApiErrorBody {
  message?: string | string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshEnCurso: Promise<string | null> | null = null;

async function renovarAccessToken(): Promise<string | null> {
  if (!refreshEnCurso) {
    refreshEnCurso = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json()) as { data: { accessToken: string } };
        return body.data.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshEnCurso = null;
      });
  }
  return refreshEnCurso;
}

function irALogin(): void {
  useAuthStore.getState().clearAuth();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

async function ejecutarFetch(path: string, options: ApiOptions, token: string | null): Promise<Response> {
  const { skipAuth, body, headers, ...rest } = options;
  // FormData (subida de archivos) no debe serializarse ni forzar
  // Content-Type: el navegador setea el boundary multipart automáticamente.
  const esFormData = body instanceof FormData;
  return fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(esFormData ? {} : { "Content-Type": "application/json" }),
      ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: esFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// Ejecuta el fetch y, si vence el access token (401), lo renueva una vez y
// reintenta — usado tanto por las respuestas JSON como por las binarias
// (descarga de documentos), para que ambas compartan el mismo comportamiento
// de sesión en vez de que cada llamador reimplemente su propio 401→refresh.
async function fetchConReintento(path: string, options: ApiOptions = {}): Promise<Response> {
  const accessToken = useAuthStore.getState().accessToken;
  let res = await ejecutarFetch(path, options, accessToken);

  if (res.status === 401 && !options.skipAuth) {
    const nuevoToken = await renovarAccessToken();
    if (!nuevoToken) {
      irALogin();
      throw new ApiError("Sesión expirada", 401);
    }
    useAuthStore.getState().setAccessToken(nuevoToken);
    res = await ejecutarFetch(path, options, nuevoToken);
  }

  return res;
}

async function leerMensajeError(res: Response, fallback: string): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & ApiErrorBody;
  const mensaje = body.message ?? fallback;
  return new ApiError(Array.isArray(mensaje) ? mensaje[0] : mensaje, res.status);
}

async function requestEnvelope(path: string, options: ApiOptions = {}): Promise<Record<string, unknown>> {
  const res = await fetchConReintento(path, options);

  if (!res.ok) {
    throw await leerMensajeError(res, "Ocurrió un error inesperado");
  }

  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const body = await requestEnvelope(path, options);
  return ("data" in body ? body.data : body) as T;
}

async function requestPaginated<T>(path: string, options: ApiOptions = {}): Promise<PaginatedResponse<T>> {
  const body = await requestEnvelope(path, options);
  return body as unknown as PaginatedResponse<T>;
}

function descargarBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = filename;
  enlace.click();
  URL.revokeObjectURL(url);
}

// Para endpoints que retornan un binario (.docx) en vez del envelope { data }
// habitual — comparte el mismo fetch con reintento de sesión que el resto del
// cliente, en vez de que cada página adjunte el token y maneje el 401 a mano.
async function download(path: string, filename: string, options?: ApiOptions): Promise<void> {
  const res = await fetchConReintento(path, { ...options, method: "GET" });

  if (!res.ok) {
    throw await leerMensajeError(res, "No se pudo generar el documento");
  }

  descargarBlob(await res.blob(), filename);
}

export const api = {
  get: <T>(path: string, options?: ApiOptions) => request<T>(path, { ...options, method: "GET" }),
  getPaginated: <T>(path: string, options?: ApiOptions) =>
    requestPaginated<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: ApiOptions) => request<T>(path, { ...options, method: "DELETE" }),
  download,
};
