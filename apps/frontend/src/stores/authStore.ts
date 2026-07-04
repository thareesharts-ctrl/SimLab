import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { User, UserRole } from "@/types"
import api from "@/lib/api"

interface AuthState {
  user: User | null
  role: UserRole | null
  isAuthenticated: boolean
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
const ROLE_SCOPED_PERSIST_KEYS = [
  'simplab-simulation-storage',
  'simplab-campaign-storage',
  'simplab-instructor-storage',
  'simplab-results-storage',
  'simplab-leaderboard-storage',
  'simplab-metrics-storage',
];

function clearRoleScopedStorage() {
  try {
    ROLE_SCOPED_PERSIST_KEYS.forEach(key => {
      localStorage.removeItem(key);
    });
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

      fetchMe: async () => {
        try {
          const res = await api.get<any>('/api/auth/me');
          const data = res.data;
          // Store role exactly as returned by the backend (uppercase, e.g. INDIVIDUAL, ADMIN)
          // Do NOT lowercase or transform — the backend always returns canonical uppercase values.
          const user = data as User;
          set({ user, role: user.role, isAuthenticated: true });
          return user;
        } catch (error) {
          set({ user: null, role: null, isAuthenticated: false });
          return null;
        }
      },

      login: async (email, password = 'user_password_string') => {
        // Clear stale role-scoped state before logging in
        clearRoleScopedStorage();
        await api.post('/api/auth/sign-in/email', { email, password });
        const user = await get().fetchMe();
        if (!user) throw new Error("Failed to retrieve user profile after authentication");
        return user;
      },

      registerIndividual: async (data) => {
        clearRoleScopedStorage();
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
      },

      registerStudent: async (data) => {
        clearRoleScopedStorage();
        await api.post('/api/auth/register/student', {
          email: data.email,
          password: data.password || 'user_password_string',
          name: data.name,
          classJoinCode: data.classJoinCode,
        });
        const user = await get().fetchMe();
        if (!user) throw new Error("Failed to retrieve user profile after class registration");
        return user;
      },

      registerInstructor: async (data) => {
        clearRoleScopedStorage();
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
      },

      logout: async () => {
        try {
          await api.post('/api/auth/sign-out');
        } catch (err) {
          console.error("Sign out request failed", err);
        }
        // Clear all role-scoped persisted state before redirect
        clearRoleScopedStorage();
        set({ user: null, role: null, isAuthenticated: false });
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
