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
    if ((data as { requiresTwoFactor?: boolean }).requiresTwoFactor) {
      return {
        requiresTwoFactor: true as const,
        challengeToken: (data as { challengeToken: string }).challengeToken,
      };
    }
    const payload = data as { user: AuthUser };
    setUser(payload.user);
    return payload.user;
  }, []);

  const loginWithTwoFactor = useCallback(async (
    challengeToken: string,
    options: { totpCode?: string; recoveryCode?: string },
  ) => {
    const res = await fetch(getApiUrl('/api/auth/login/2fa'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ challengeToken, ...options }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Ошибка 2FA входа');
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

  const getSecurityOverview = useCallback(async () => {
    const res = await fetch(getApiUrl('/api/auth/security/overview'), {
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Не удалось получить данные безопасности');
    }
    return data as {
      twoFactorEnabled: boolean;
      trustedDeviceDays: number;
      sessions: Array<{ id: string; userAgent?: string; ipAddress?: string; createdAt: string; expiresAt: string; revokedAt?: string | null }>;
    };
  }, []);

  const requestSecurePasswordChange = useCallback(async (oldPassword: string, newPassword: string) => {
    const res = await fetch(getApiUrl('/api/auth/security/change-password/request-confirmation'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Не удалось запросить подтверждение смены пароля');
    }
  }, []);

  const confirmSecurePasswordChange = useCallback(async (code: string) => {
    const res = await fetch(getApiUrl('/api/auth/security/change-password/confirm'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Не удалось подтвердить смену пароля');
    }
  }, []);

  const setupTwoFactor = useCallback(async () => {
    const res = await fetch(getApiUrl('/api/auth/security/2fa/setup'), {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Не удалось запустить настройку 2FA');
    }
    return data as { secret: string; otpauthUrl: string };
  }, []);

  const enableTwoFactor = useCallback(async (totpCode: string) => {
    const res = await fetch(getApiUrl('/api/auth/security/2fa/enable'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ totpCode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Не удалось включить 2FA');
    }
    return { recoveryCodes: (data as { recoveryCodes?: string[] }).recoveryCodes ?? [] };
  }, []);

  const disableTwoFactor = useCallback(async (options: { totpCode?: string; recoveryCode?: string }) => {
    const res = await fetch(getApiUrl('/api/auth/security/2fa/disable'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(options),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Не удалось отключить 2FA');
    }
  }, []);

  const regenerateRecoveryCodes = useCallback(async () => {
    const res = await fetch(getApiUrl('/api/auth/security/2fa/recovery-codes/regenerate'), {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Не удалось обновить recovery-коды');
    }
    return { recoveryCodes: (data as { recoveryCodes?: string[] }).recoveryCodes ?? [] };
  }, []);

  const revokeSession = useCallback(async (sessionId: string) => {
    const res = await fetch(getApiUrl('/api/auth/security/sessions/revoke'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Не удалось завершить сессию');
    }
  }, []);

  const revokeAllOtherSessions = useCallback(async () => {
    const res = await fetch(getApiUrl('/api/auth/security/sessions/revoke-all-others'), {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? 'Не удалось завершить другие сессии');
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
    () => ({
      user,
      isReady,
      login,
      loginWithTwoFactor,
      requestRegistrationCode,
      confirmRegistration,
      getSecurityOverview,
      requestSecurePasswordChange,
      confirmSecurePasswordChange,
      setupTwoFactor,
      enableTwoFactor,
      disableTwoFactor,
      regenerateRecoveryCodes,
      revokeSession,
      revokeAllOtherSessions,
      logout,
    }),
    [
      user,
      isReady,
      login,
      loginWithTwoFactor,
      requestRegistrationCode,
      confirmRegistration,
      getSecurityOverview,
      requestSecurePasswordChange,
      confirmSecurePasswordChange,
      setupTwoFactor,
      enableTwoFactor,
      disableTwoFactor,
      regenerateRecoveryCodes,
      revokeSession,
      revokeAllOtherSessions,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// NOTE: Fast Refresh prefers that context modules only export components.
// Keep the hook in a separate module to avoid react-refresh warnings.

