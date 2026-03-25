import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const ROLE_PRIORITY: Record<string, number> = {
  GUEST: 0,
  USER: 1,
  MODERATOR: 2,
  SUPERADMIN: 3,
};

interface Props {
  minRole: 'USER' | 'MODERATOR' | 'SUPERADMIN';
  children: ReactNode;
}

export function RequireRole({ minRole, children }: Props): JSX.Element {
  const { user, isReady } = useAuth();
  const location = useLocation();
  const role = user?.role ?? 'GUEST';

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] text-slate-600 text-sm">
        Проверка доступа...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if ((ROLE_PRIORITY[role] ?? 0) < ROLE_PRIORITY[minRole]) {
    return <Navigate to="/403" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

