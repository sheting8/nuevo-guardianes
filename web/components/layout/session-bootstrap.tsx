"use client";

import { useEffect } from "react";

import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth-store";

interface MeResponse {
  id: string;
  nombres: string;
  apellidoP: string;
  roles: string[];
  correlativo: number | null;
  tipo: string | null;
}

// Al recargar la página se pierde el `user` en memoria (Zustand no persiste),
// aunque la sesión siga válida vía la cookie de refresh. Este componente
// recupera los datos del usuario con /auth/me para que el sidebar y el
// bottom nav reflejen la sesión activa sin pedir login de nuevo.
export function SessionBootstrap() {
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    if (user) return;

    api
      .get<MeResponse>("/auth/me")
      .then((me) => {
        setAuth(
          {
            id: me.id,
            nombre: `${me.nombres} ${me.apellidoP}`,
            roles: me.roles,
            correlativo: me.correlativo,
            tipo: me.tipo,
          },
          useAuthStore.getState().accessToken ?? "",
        );
      })
      .catch(() => {
        // lib/api.ts ya redirige a /login si el refresh también falla.
      });
  }, [user, setAuth]);

  return null;
}
