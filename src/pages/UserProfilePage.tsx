import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { UserAvatar } from '@/components/ui/UserAvatar';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path;
}

export default function UserProfilePage(): JSX.Element {
  const { accessToken, user, logout } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!accessToken) {
      setError('Нет доступа. Попробуйте перелогиниться.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { message?: string }).message ?? 'Ошибка смены пароля');
      }

      setSuccess('Пароль успешно изменён.');
      setOldPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены пароля');
    } finally {
      setLoading(false);
    }
  }

  const displayName = user?.fullName ?? user?.email ?? 'Пользователь';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 page-enter">
      <div className="space-y-5">
        <div className="glass-panel p-5 flex items-start justify-between gap-4 flex-col md:flex-row">
          <div className="flex items-center gap-4">
            <UserAvatar name={user?.fullName ?? null} email={user?.email ?? null} size={52} />
            <div>
              <div className="glass-kicker">Профиль</div>
              <h1 className="glass-title mt-1 mb-0 text-2xl">{displayName}</h1>
              <p className="text-sm glass-muted mt-1">{user?.email ?? '—'}</p>
              <p className="text-xs glass-muted mt-2">Роль: {user?.role ?? '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end">
            <Link to="/dashboard" className="glass-btn-soft">
              В кабинет
            </Link>
            <button
              type="button"
              onClick={() => {
                void logout();
              }}
              className="glass-btn-dark"
            >
              Выйти
            </button>
          </div>
        </div>

        <div className="glass-panel p-5">
          <div className="glass-kicker">Данные пользователя</div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex gap-3">
              <div className="w-[140px] text-ink-muted">Email</div>
              <div className="font-medium">{user?.email ?? '—'}</div>
            </div>
            <div className="flex gap-3">
              <div className="w-[140px] text-ink-muted">Никнейм</div>
              <div className="font-medium">{user?.fullName ?? '—'}</div>
            </div>
            <div className="flex gap-3">
              <div className="w-[140px] text-ink-muted">Пароль</div>
              <div className="font-medium text-ink-muted">********</div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5">
          <div className="glass-kicker">Смена пароля</div>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs glass-muted mb-1">Старый пароль</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="glass-input"
                required
              />
            </div>

            <div>
              <label className="block text-xs glass-muted mb-1">Новый пароль</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="glass-input"
                required
                minLength={8}
              />
            </div>

            {error && <div className="text-xs glass-danger">{error}</div>}
            {success && <div className="text-xs text-[#1f5c14] font-medium">{success}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full glass-btn-dark disabled:opacity-60"
            >
              {loading ? 'Смена...' : 'Изменить пароль'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


