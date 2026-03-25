import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface AuthUser {
  id: number;
  email: string;
  fullName?: string;
  role: 'USER' | 'MODERATOR' | 'SUPERADMIN';
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, fullName: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path;
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const loadCurrentUser = useCallback(async (token: string) => {
    const res = await fetch(getApiUrl('/api/auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('Не удалось получить пользователя');
    }
    const data = (await res.json()) as { user: AuthUser };
    setUser(data.user);
  }, []);

  const refreshSession = useCallback(async () => {
    const res = await fetch(getApiUrl('/api/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('Сессия неактивна');
    }
    const data = (await res.json()) as { user: AuthUser; accessToken: string };
    setUser(data.user);
    setAccessToken(data.accessToken);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(getApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Ошибка входа');
    }
    const payload = data as { user: AuthUser; accessToken: string };
    setUser(payload.user);
    setAccessToken(payload.accessToken);
    return payload.user;
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    const res = await fetch(getApiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, fullName }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Ошибка регистрации');
    }

    const payload = data as { user: AuthUser; accessToken: string };
    setUser(payload.user);
    setAccessToken(payload.accessToken);
    return payload.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(getApiUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth(): Promise<void> {
      try {
        const storedToken = localStorage.getItem('auth_access_token');
        if (storedToken) {
          setAccessToken(storedToken);
          await loadCurrentUser(storedToken);
          return;
        }
        await refreshSession();
      } catch {
        if (!cancelled) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    }

    void bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, [loadCurrentUser, refreshSession]);

  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('auth_access_token', accessToken);
    } else {
      localStorage.removeItem('auth_access_token');
    }
  }, [accessToken]);

  const value = useMemo(
    () => ({ user, accessToken, isReady, login, register, logout }),
    [user, accessToken, isReady, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

