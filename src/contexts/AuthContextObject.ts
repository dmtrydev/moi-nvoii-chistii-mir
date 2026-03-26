import { createContext } from 'react';

export interface AuthUser {
  id: number;
  email: string;
  fullName?: string;
  role: 'USER' | 'MODERATOR' | 'SUPERADMIN';
}

export interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, fullName: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

