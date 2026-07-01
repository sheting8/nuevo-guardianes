import { useAuthStore } from "@/lib/store/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipAuth?: boolean;
}

interface ApiErrorBody {
  message?: string | string[];
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
  return fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
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

  const data = (await res.json().catch(() => null)) as { data?: T } & ApiErrorBody | null;

  if (!res.ok) {
    const mensaje = data?.message ?? "Ocurrió un error inesperado";
    throw new ApiError(Array.isArray(mensaje) ? mensaje[0] : mensaje, res.status);
  }

  return (data?.data ?? (data as unknown as T)) as T;
}

export const api = {
  get: <T>(path: string, options?: ApiOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: ApiOptions) => request<T>(path, { ...options, method: "DELETE" }),
};
