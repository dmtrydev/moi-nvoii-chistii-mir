import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { AuthUser } from '@/contexts/AuthContextObject';
import { AuthContext } from '@/contexts/AuthContextObject';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path;
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  const loadCurrentUser = useCallback(async () => {
    const res = await fetch(getApiUrl('/api/auth/me'), {
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
    const data = (await res.json()) as { user: AuthUser };
    setUser(data.user);
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
    const payload = data as { user: AuthUser };
    setUser(payload.user);
    return payload.user;
  }, []);

  const requestRegistrationCode = useCallback(async (email: string, password: string, fullName: string) => {
    const res = await fetch(getApiUrl('/api/auth/register/request-code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, fullName }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Ошибка отправки кода подтверждения');
    }
  }, []);

  const confirmRegistration = useCallback(async (email: string, code: string) => {
    const res = await fetch(getApiUrl('/api/auth/register/confirm'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, code }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Ошибка подтверждения регистрации');
    }

    const payload = data as { user: AuthUser };
    setUser(payload.user);
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
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth(): Promise<void> {
      try {
        await refreshSession();
      } catch {
        if (!cancelled) {
          setUser(null);
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
    if (!user) return;
    const REFRESH_INTERVAL = 10 * 60 * 1000;
    const id = setInterval(() => {
      refreshSession().catch(() => {});
    }, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [user, refreshSession]);

  const value = useMemo(
    () => ({ user, isReady, login, requestRegistrationCode, confirmRegistration, logout }),
    [user, isReady, login, requestRegistrationCode, confirmRegistration, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// NOTE: Fast Refresh prefers that context modules only export components.
// Keep the hook in a separate module to avoid react-refresh warnings.

