import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { User, UserRole } from "@/types"
import api from "@/lib/api"

interface AuthState {
  user: User | null
  role: UserRole | null
  isAuthenticated: boolean
  loading: boolean
  fetchMe: () => Promise<User | null>
  login: (email: string, password?: string) => Promise<User>
  registerIndividual: (data: any) => Promise<User>
  registerStudent: (data: any) => Promise<User>
  registerInstructor: (data: any) => Promise<User>
  logout: () => Promise<void>
  setUser: (user: User | null) => void
  resetRoleScopedClientState: () => void
}

/**
 * Keys of all Zustand persisted stores that hold role-scoped state.
 * Clear these on login/logout to prevent stale state from a previous session
 * (e.g., a student store persisted under an individual's session).
 */
function clearRoleScopedStorage() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('simplab-') || key.startsWith('better-auth'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (_) {
    // localStorage may be unavailable in some environments
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      role: null,
      isAuthenticated: false,
      loading: false,

      fetchMe: async () => {
        set({ loading: true });
        try {
          const res = await api.get<any>('/api/auth/me');
          const data = res.data;
          // Store role exactly as returned by the backend (uppercase, e.g. INDIVIDUAL, ADMIN)
          // Do NOT lowercase or transform — the backend always returns canonical uppercase values.
          const user = data as User;
          set({ user, role: user.role, isAuthenticated: true, loading: false });
          return user;
        } catch (error) {
          set({ user: null, role: null, isAuthenticated: false, loading: false });
          return null;
        }
      },

      login: async (email, password = 'user_password_string') => {
        // Clear stale role-scoped state before logging in
        clearRoleScopedStorage();
        set({ loading: true });
        try {
          await api.post('/api/auth/sign-in/email', { email, password });
          const user = await get().fetchMe();
          if (!user) throw new Error("Failed to retrieve user profile after authentication");
          return user;
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      registerIndividual: async (data) => {
        clearRoleScopedStorage();
        set({ loading: true });
        try {
          await api.post('/api/auth/register/individual', {
            email: data.email,
            password: data.password || 'user_password_string',
            name: data.name,
            institution: data.institution,
            planType: data.planType,
          });
          const user = await get().fetchMe();
          if (!user) throw new Error("Failed to retrieve user profile after registration");
          return user;
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      registerStudent: async (data) => {
        clearRoleScopedStorage();
        set({ loading: true });
        try {
          await api.post('/api/auth/register/student', {
            email: data.email,
            password: data.password || 'user_password_string',
            name: data.name,
            classJoinCode: data.classJoinCode,
          });
          const user = await get().fetchMe();
          if (!user) throw new Error("Failed to retrieve user profile after class registration");
          return user;
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      registerInstructor: async (data) => {
        clearRoleScopedStorage();
        set({ loading: true });
        try {
          await api.post('/api/auth/sign-up/email', {
            email: data.email,
            password: data.password || 'user_password_string',
            name: data.name,
            role: 'INSTRUCTOR',
            institution: data.institution,
          });
          const user = await get().fetchMe();
          if (!user) throw new Error("Failed to retrieve user profile after instructor registration");
          return user;
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.post('/api/auth/sign-out');
        } catch (err) {
          console.error("Sign out request failed", err);
        }
        // Clear all role-scoped persisted state before redirect
        clearRoleScopedStorage();
        set({ user: null, role: null, isAuthenticated: false, loading: false });
        window.location.href = '/login';
      },

      setUser: (user) => set({ user, role: user ? user.role : null, isAuthenticated: !!user }),

      resetRoleScopedClientState: () => {
        clearRoleScopedStorage();
      },
    }),
    {
      name: "simplab-auth-storage",
    }
  )
)
export default useAuthStore;
