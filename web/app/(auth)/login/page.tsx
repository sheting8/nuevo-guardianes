"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import { registrarPushWeb } from "@/lib/push";
import { useAuthStore } from "@/lib/store/auth-store";

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    nombre: string;
    roles: string[];
    correlativo: number | null;
    tipo: string | null;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCargando(true);

    try {
      const data = await api.post<LoginResponse>(
        "/auth/login",
        { username, password },
        { skipAuth: true },
      );
      setAuth(data.user, data.accessToken);
      void registrarPushWeb(); // best-effort, no bloquea el login
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Card className="w-full max-w-sm border-border bg-card">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-24 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/30">
          <Image src="/logo.png" alt="Compañía 15" width={72} height={80} priority />
        </div>
        <CardTitle className="text-primary">Guardianes</CardTitle>
        <CardDescription>Ingresa tus credenciales para acceder al sistema</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={cargando}>
            {cargando ? "Ingresando…" : "Ingresar"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Compañía 15 · Sistema de gestión operativa
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
