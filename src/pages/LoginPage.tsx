import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';

export default function LoginPage(): JSX.Element {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function redirectAfterAuth(authUser: { role: string }): Promise<void> {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    navigate(authUser.role === 'SUPERADMIN' ? '/admin/dashboard' : '/dashboard', { replace: true });
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'register') {
        const created = await register(email, password, fullName);
        await redirectAfterAuth(created);
        return;
      }

      const loggedInUser = await login(email, password);
      await redirectAfterAuth(loggedInUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'register' ? 'Ошибка регистрации' : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center glass-bg text-slate-900 px-4 py-8">
      <div className="w-full max-w-md glass-shell p-6 space-y-4">
        <div>
          <div className="glass-kicker">Welcome</div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#f5fff7] mt-1">Вход / Регистрация</h1>
        </div>

        <div className="glass-panel p-1.5 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${
              mode === 'login'
                ? 'bg-[#4caf50]/30 text-white border border-[#89df96]/50'
                : 'text-[#9fb8ab] hover:bg-white/10'
            }`}
          >
            Войти
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${
              mode === 'register'
                ? 'bg-[#4caf50]/30 text-white border border-[#89df96]/50'
                : 'text-[#9fb8ab] hover:bg-white/10'
            }`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs glass-muted mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input"
              required
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs glass-muted mb-1">Имя и фамилия</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="glass-input"
                required
                minLength={2}
              />
            </div>
          )}

          <div>
            <label className="block text-xs glass-muted mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input"
              required
              minLength={8}
            />
          </div>
          {error && <div className="text-xs glass-danger">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full glass-btn-dark disabled:opacity-60"
          >
            {loading ? (mode === 'register' ? 'Создание...' : 'Вход...') : mode === 'register' ? 'Создать аккаунт' : 'Войти'}
          </button>
        </form>

        {mode === 'register' && (
          <div className="text-[11px] text-[#9ab3a5] leading-relaxed">
            Регистрация создаёт пользователя с ролью <span className="text-[#90e19a] font-semibold">USER</span>.
            Для роли <span className="text-[#90e19a] font-semibold">SUPERADMIN</span> используйте создание через админ-скрипт/DB.
          </div>
        )}

        <div className="text-xs text-[#9ab3a5]">
          <Link to="/" className="glass-link underline underline-offset-2">
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
