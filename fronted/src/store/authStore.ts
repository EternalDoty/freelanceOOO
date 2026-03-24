import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'freelancer' | 'customer' | 'admin' | 'moderator';
  avatar_url?: string;
  rating: string;
  total_tasks: number;
  completed_tasks: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isBlocked: boolean;
  login: (token: string, user: User, isBlocked?: boolean) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isBlocked: false,
      login: (token, user, blocked = false) => {
        localStorage.setItem('token', token);
        set({ 
          token, 
          user, 
          isAuthenticated: true,
          isBlocked: blocked 
        });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ 
          token: null, 
          user: null, 
          isAuthenticated: false,
          isBlocked: false 
        });
      },
      updateUser: (userData) => set((state) => ({
        user: state.user ? { ...state.user, ...userData } : null
      })),
    }),
    {
      name: 'auth-storage',
    }
  )
);
