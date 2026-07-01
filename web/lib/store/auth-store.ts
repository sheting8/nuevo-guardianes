import { create } from "zustand";

export interface UsuarioAutenticado {
  id: string;
  nombre: string;
  roles: string[];
  correlativo: number | null;
  tipo: string | null;
}

interface AuthState {
  user: UsuarioAutenticado | null;
  accessToken: string | null;
  setAuth: (user: UsuarioAutenticado, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
}));
